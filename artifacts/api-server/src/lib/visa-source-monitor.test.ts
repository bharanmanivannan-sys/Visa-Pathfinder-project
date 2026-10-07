import assert from "node:assert/strict";
import test from "node:test";
import type { VisaResourceSource } from "@workspace/db";
import { inspectVisaSource, isAllowedByRobots } from "./visa-source-monitor";

function source(overrides: Partial<VisaResourceSource> = {}): VisaResourceSource {
  return {
    id: "uk-skilled-worker",
    destinationCountry: "United Kingdom",
    passportCountries: [],
    purposeTags: ["work"],
    recordKind: "pathway",
    pathwayName: "Skilled Worker visa",
    title: "Skilled Worker visa",
    description: "Official route source.",
    sourceName: "GOV.UK",
    sourceUrl: "https://www.gov.uk/skilled-worker-visa",
    reviewedOn: "2026-09-18",
    authority: "official",
    accessStatus: "allowed",
    termsUrl: "https://www.gov.uk/help/terms-conditions",
    termsReviewedOn: "2026-10-01",
    lastCheckedAt: null,
    nextCheckAt: null,
    etag: null,
    lastModified: null,
    currentContentHash: "previous-hash",
    pendingContentHash: null,
    pendingSourceUrl: null,
    httpStatus: null,
    lastError: null,
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    ...overrides,
  };
}

test("robots allow rules can reopen a more specific path", () => {
  const robots = "User-agent: *\nDisallow: /private\nAllow: /private/public";
  assert.equal(isAllowedByRobots(robots, "/private/public/guide"), true);
  assert.equal(isAllowedByRobots(robots, "/private/guide"), false);
});

test("source checks do not fetch a page until access policy review is recorded", async () => {
  let fetchCount = 0;
  const fetcher: typeof fetch = async () => {
    fetchCount += 1;
    return new Response("should not be fetched");
  };
  const result = await inspectVisaSource(source({ accessStatus: "pending_policy_review" }), fetcher);
  assert.deepEqual(result, { status: "skipped_policy_review" });
  assert.equal(fetchCount, 0);
});

test("source checks stop when robots disallows the configured page", async () => {
  let pageFetchCount = 0;
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/robots.txt")) {
      return new Response("User-agent: *\nDisallow: /skilled-worker-visa", {
        headers: { "content-type": "text/plain" },
      });
    }
    pageFetchCount += 1;
    return new Response("<html>page</html>", { headers: { "content-type": "text/html" } });
  };
  const result = await inspectVisaSource(source(), fetcher);
  assert.equal(result.status, "robots_denied");
  assert.equal(pageFetchCount, 0);
});

test("source checks hash public page text and flag changes without returning page content", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/robots.txt")) {
      return new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } });
    }
    return new Response("<html><title>Updated</title><p>New official guidance</p><script>noise()</script></html>", {
      headers: { "content-type": "text/html", etag: '"new-etag"' },
    });
  };
  const result = await inspectVisaSource(source({ sourceUrl: "https://www.gov.uk/visa-guidance?review-test=changed" }), fetcher);
  assert.equal(result.status, "changed");
  if (result.status !== "changed") return;
  assert.equal(result.sourceUrl, "https://www.gov.uk/visa-guidance?review-test=changed");
  assert.equal(result.etag, '"new-etag"');
  assert.equal("pageText" in result, false);
  assert.match(result.contentHash, /^[a-f0-9]{64}$/);
});
