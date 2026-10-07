import { createHash } from "node:crypto";
import { and, eq, isNotNull, isNull, lte, or } from "drizzle-orm";
import {
  db,
  visaResourceSourceChangesTable,
  visaResourceSourcesTable,
} from "@workspace/db";
import type { VisaResourceSource } from "@workspace/db";
import { logger } from "./logger";
import { visaResourceCatalog } from "./visa-resource-catalog";

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MONITOR_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_PAGE_BYTES = 2_000_000;
const USER_AGENT = "VisaPathfinderSourceMonitor/1.0 (public government source freshness check)";
const ALLOWED_SOURCE_HOSTS = new Set(visaResourceCatalog.map((source) => new URL(source.sourceUrl).hostname));
let monitorRunning = false;
const robotsCache = new Map<string, { checkedAt: number; body: string | null; unavailable: boolean }>();

export type SourceCheckResult =
  | { status: "skipped_policy_review" }
  | { status: "robots_denied" }
  | { status: "unchanged"; checkedAt: Date; httpStatus: number; etag: string | null; lastModified: string | null; contentHash?: string }
  | { status: "changed"; checkedAt: Date; httpStatus: number; etag: string | null; lastModified: string | null; contentHash: string; sourceUrl: string }
  | { status: "unavailable"; checkedAt: Date; httpStatus: number | null; error: string };

function normalizeContent(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAllowedByRobots(robotsText: string, pathAndQuery: string): boolean {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let current: { agents: string[]; rules: Array<{ allow: boolean; path: string }> } | undefined;
  let sawRule = false;

  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0]?.trim();
    if (!line) continue;
    const colonIndex = line.indexOf(":");
    if (colonIndex < 0) continue;
    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    if (key === "user-agent") {
      if (!current || sawRule) {
        current = { agents: [], rules: [] };
        groups.push(current);
        sawRule = false;
      }
      current.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current && value) {
      current.rules.push({ allow: key === "allow", path: value });
      sawRule = true;
    }
  }

  const specific = groups.filter((group) => group.agents.some((agent) => agent !== "*" && USER_AGENT.toLowerCase().includes(agent)));
  const applicable = specific.length > 0
    ? specific
    : groups.filter((group) => group.agents.includes("*"));
  const rules = applicable.flatMap((group) => group.rules);
  const matching = rules
    .filter(({ path }) => {
      const escaped = path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$/g, "$");
      return new RegExp(`^${escaped}`).test(pathAndQuery);
    })
    .sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return matching.length === 0 || matching[0]!.allow;
}

async function getRobotsPolicy(
  url: URL,
  fetcher: typeof fetch,
): Promise<{ body: string | null; denied: boolean }> {
  const cached = robotsCache.get(url.origin);
  if (cached && Date.now() - cached.checkedAt < CHECK_INTERVAL_MS) {
    return {
      body: cached.body,
      denied: cached.unavailable || (cached.body !== null
        && !isAllowedByRobots(cached.body, `${url.pathname}${url.search}`)),
    };
  }
  try {
    const response = await fetcher(`${url.origin}/robots.txt`, {
      headers: { "user-agent": USER_AGENT, accept: "text/plain" },
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 404 || response.status === 410) {
      robotsCache.set(url.origin, { checkedAt: Date.now(), body: null, unavailable: false });
      return { body: null, denied: false };
    }
    if (!response.ok) {
      robotsCache.set(url.origin, { checkedAt: Date.now(), body: null, unavailable: true });
      return { body: null, denied: true };
    }
    const body = await response.text();
    const denied = !isAllowedByRobots(body, `${url.pathname}${url.search}`);
    robotsCache.set(url.origin, { checkedAt: Date.now(), body, unavailable: false });
    return { body, denied };
  } catch {
    robotsCache.set(url.origin, { checkedAt: Date.now(), body: null, unavailable: true });
    return { body: null, denied: true };
  }
}

async function fetchSourcePage(
  initialUrl: URL,
  source: VisaResourceSource,
  fetcher: typeof fetch,
): Promise<Response | { finalUrl: URL; response: Response }> {
  let currentUrl = initialUrl;
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    const headers = new Headers({
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
    });
    if (source.etag) headers.set("if-none-match", source.etag);
    if (source.lastModified) headers.set("if-modified-since", source.lastModified);
    const response = await fetcher(currentUrl, {
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { finalUrl: currentUrl, response };
    }
    const location = response.headers.get("location");
    if (!location) return { finalUrl: currentUrl, response };
    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.protocol !== "https:" || nextUrl.hostname !== initialUrl.hostname) {
      throw new Error("Redirect left the configured HTTPS source host.");
    }
    currentUrl = nextUrl;
  }
  throw new Error("Source redirected more than four times.");
}

async function readPageWithinLimit(response: Response): Promise<string | null> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_PAGE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function inspectVisaSource(
  source: VisaResourceSource,
  fetcher: typeof fetch = fetch,
): Promise<SourceCheckResult> {
  if (source.accessStatus !== "allowed" || !source.termsUrl || !source.termsReviewedOn) {
    return { status: "skipped_policy_review" };
  }
  let configuredUrl: URL;
  try {
    configuredUrl = new URL(source.sourceUrl);
  } catch {
    return { status: "unavailable", checkedAt: new Date(), httpStatus: null, error: "Invalid configured source URL." };
  }
  if (
    configuredUrl.protocol !== "https:"
    || configuredUrl.username
    || configuredUrl.password
    || configuredUrl.port
    || !ALLOWED_SOURCE_HOSTS.has(configuredUrl.hostname)
  ) {
    return { status: "unavailable", checkedAt: new Date(), httpStatus: null, error: "Source is outside the configured HTTPS host allowlist." };
  }

  const robots = await getRobotsPolicy(configuredUrl, fetcher);
  if (robots.denied || !isAllowedByRobots(robots.body ?? "", `${configuredUrl.pathname}${configuredUrl.search}`)) {
    return { status: "robots_denied" };
  }

  try {
    const result = await fetchSourcePage(configuredUrl, source, fetcher);
    if (result instanceof Response) {
      return { status: "unavailable", checkedAt: new Date(), httpStatus: result.status, error: "Could not validate the source response." };
    }
    const { finalUrl, response } = result;
    const checkedAt = new Date();
    if (response.status === 304) {
      return {
        status: "unchanged",
        checkedAt,
        httpStatus: response.status,
        etag: response.headers.get("etag") ?? source.etag,
        lastModified: response.headers.get("last-modified") ?? source.lastModified,
      };
    }
    if (!response.ok) {
      return { status: "unavailable", checkedAt, httpStatus: response.status, error: `Source returned HTTP ${response.status}.` };
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return { status: "unavailable", checkedAt, httpStatus: response.status, error: "Source did not return a readable public web page." };
    }
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_PAGE_BYTES) {
      return { status: "unavailable", checkedAt, httpStatus: response.status, error: "Source page exceeded the size limit." };
    }
    const pageText = await readPageWithinLimit(response);
    if (pageText === null) {
      return { status: "unavailable", checkedAt, httpStatus: response.status, error: "Source page exceeded the size limit." };
    }
    const contentHash = createHash("sha256").update(normalizeContent(pageText)).digest("hex");
    if (source.currentContentHash && source.currentContentHash !== contentHash) {
      return {
        status: "changed",
        checkedAt,
        httpStatus: response.status,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        contentHash,
        sourceUrl: finalUrl.href,
      };
    }
    return {
      status: "unchanged",
      checkedAt,
      httpStatus: response.status,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      contentHash,
    };
  } catch (error) {
    return {
      status: "unavailable",
      checkedAt: new Date(),
      httpStatus: null,
      error: error instanceof Error ? error.message.slice(0, 240) : "Source check failed.",
    };
  }
}

async function recordSourceCheck(source: VisaResourceSource): Promise<void> {
  const result = await inspectVisaSource(source);
  const checkedAt = "checkedAt" in result ? result.checkedAt : new Date();
  const nextCheckAt = new Date(checkedAt.getTime() + CHECK_INTERVAL_MS);

  if (result.status === "skipped_policy_review") {
    return;
  }
  if (result.status === "robots_denied") {
    await db
      .update(visaResourceSourcesTable)
      .set({
        lastCheckedAt: checkedAt,
        nextCheckAt,
        lastError: "Automated access is disallowed or robots policy could not be verified.",
      })
      .where(eq(visaResourceSourcesTable.id, source.id));
    return;
  }
  if (result.status === "unavailable") {
    await db
      .update(visaResourceSourcesTable)
      .set({
        lastCheckedAt: checkedAt,
        nextCheckAt,
        httpStatus: result.httpStatus,
        lastError: result.error,
      })
      .where(eq(visaResourceSourcesTable.id, source.id));
    return;
  }

  if (result.status === "changed") {
    if (source.pendingContentHash !== result.contentHash) {
      await db.insert(visaResourceSourceChangesTable).values({
        id: `${source.id}-${checkedAt.getTime()}`,
        sourceId: source.id,
        previousContentHash: source.currentContentHash,
        detectedContentHash: result.contentHash,
        previousSourceUrl: source.sourceUrl,
        detectedSourceUrl: result.sourceUrl === source.sourceUrl ? null : result.sourceUrl,
        detectedAt: checkedAt,
        reviewStatus: "pending_review",
      });
    }
    await db
      .update(visaResourceSourcesTable)
      .set({
        lastCheckedAt: checkedAt,
        nextCheckAt,
        etag: result.etag,
        lastModified: result.lastModified,
        pendingContentHash: result.contentHash,
        pendingSourceUrl: result.sourceUrl === source.sourceUrl ? null : result.sourceUrl,
        httpStatus: result.httpStatus,
        lastError: null,
      })
      .where(eq(visaResourceSourcesTable.id, source.id));
    return;
  }

  await db
    .update(visaResourceSourcesTable)
    .set({
      lastCheckedAt: checkedAt,
      nextCheckAt,
      etag: result.etag,
      lastModified: result.lastModified,
      currentContentHash: result.contentHash ?? source.currentContentHash,
      httpStatus: result.httpStatus,
      lastError: null,
    })
    .where(eq(visaResourceSourcesTable.id, source.id));
}

export async function runVisaResourceMonitorOnce(): Promise<void> {
  if (monitorRunning) return;
  monitorRunning = true;
  try {
    const now = new Date();
    const dueSources = await db
      .select()
      .from(visaResourceSourcesTable)
      .where(and(
        eq(visaResourceSourcesTable.accessStatus, "allowed"),
        isNotNull(visaResourceSourcesTable.termsUrl),
        isNotNull(visaResourceSourcesTable.termsReviewedOn),
        or(isNull(visaResourceSourcesTable.nextCheckAt), lte(visaResourceSourcesTable.nextCheckAt, now)),
      ));
    const lastHostCheck = new Map<string, number>();
    for (const source of dueSources) {
      const host = new URL(source.sourceUrl).hostname;
      const waitForMs = Math.max(0, 2_000 - (Date.now() - (lastHostCheck.get(host) ?? 0)));
      if (waitForMs > 0) await new Promise((resolve) => setTimeout(resolve, waitForMs));
      lastHostCheck.set(host, Date.now());
      await recordSourceCheck(source);
    }
  } catch (error) {
    logger.error({ error }, "Visa source monitor run failed");
  } finally {
    monitorRunning = false;
  }
}

export function startVisaResourceMonitor(): void {
  void runVisaResourceMonitorOnce();
  const timer = setInterval(() => void runVisaResourceMonitorOnce(), MONITOR_INTERVAL_MS);
  timer.unref();
}
