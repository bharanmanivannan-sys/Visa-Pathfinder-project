import {
  db,
  jobMarketListingHistoryTable,
  jobMarketListingsTable,
  jobMarketPortalsTable,
} from "@workspace/db";
import type { InsertJobMarketListing, InsertJobMarketPortal } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export type JobMarketFreshness = "fresh" | "stale" | "unavailable";

export type JobMarketListingRefresh = {
  destination: string;
  title: string;
  employer: string;
  location: string;
  workMode: string;
  sourceName: string;
  sourceUrl: string;
  postedOn: string | null;
  observedOn: string;
  availability: "available" | "unavailable";
  reviewStatus: "reviewed" | "pending" | "rejected";
  note: string;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const refreshFields: Array<[keyof JobMarketListingRefresh, number]> = [
  ["destination", 100],
  ["title", 200],
  ["employer", 160],
  ["location", 160],
  ["workMode", 160],
  ["sourceName", 160],
  ["note", 500],
];

export function parseJobMarketListingRefresh(input: unknown):
  | { success: true; data: JobMarketListingRefresh }
  | { success: false; error: string } {
  if (!input || typeof input !== "object") return { success: false, error: "Request body must be an object." };
  const body = input as Record<string, unknown>;
  const values = {} as Record<string, string>;
  for (const [field, maxLength] of refreshFields) {
    if (typeof body[field] !== "string" || !body[field].trim() || body[field].trim().length > maxLength) {
      return { success: false, error: `${field} must be a non-empty string no longer than ${maxLength} characters.` };
    }
    values[field] = body[field].trim();
  }
  if (typeof body.sourceUrl !== "string" || !body.sourceUrl.startsWith("https://")) {
    return { success: false, error: "sourceUrl must be an HTTPS URL." };
  }
  try {
    new URL(body.sourceUrl);
  } catch {
    return { success: false, error: "sourceUrl must be a valid URL." };
  }
  if (body.postedOn !== null && (typeof body.postedOn !== "string" || !datePattern.test(body.postedOn))) {
    return { success: false, error: "postedOn must be an ISO date or null." };
  }
  if (typeof body.observedOn !== "string" || !datePattern.test(body.observedOn)) {
    return { success: false, error: "observedOn must be an ISO date." };
  }
  if (body.availability !== "available" && body.availability !== "unavailable") {
    return { success: false, error: "availability must be available or unavailable." };
  }
  if (body.reviewStatus !== "reviewed" && body.reviewStatus !== "pending" && body.reviewStatus !== "rejected") {
    return { success: false, error: "reviewStatus must be reviewed, pending or rejected." };
  }
  return {
    success: true,
    data: {
      ...values,
      sourceUrl: body.sourceUrl,
      postedOn: body.postedOn as string | null,
      observedOn: body.observedOn,
      availability: body.availability,
      reviewStatus: body.reviewStatus,
    } as JobMarketListingRefresh,
  };
}

export const jobMarketPortalCatalog: InsertJobMarketPortal[] = [
  {
    id: "portal-eures-czechia",
    destination: "Czechia",
    title: "EURES Czechia vacancies",
    description: "EU public employment network with Czechia filters, employer listings and cross-border job information.",
    sourceName: "European Commission · public portal",
    sourceUrl: "https://eures.europa.eu/index_en",
    location: "Czechia · EU/EEA",
    workMode: "Mixed; confirm on the live listing",
    recordType: "live_portal",
    observedOn: "2026-09-18",
    freshnessState: "fresh",
  },
  {
    id: "portal-labour-office-czechia",
    destination: "Czechia",
    title: "Czech Labour Office vacancies",
    description: "Official Czech vacancy source. Use local-language filters and verify the employer can hire your status.",
    sourceName: "Úřad práce České republiky",
    sourceUrl: "https://www.uradprace.cz/volna-mista",
    location: "Czechia · official",
    workMode: "Mixed; confirm on the live listing",
    recordType: "live_portal",
    observedOn: "2026-09-18",
    freshnessState: "fresh",
  },
  {
    id: "portal-jobs-cz",
    destination: "Czechia",
    title: "Jobs.cz English search",
    description: "Czech employment portal with Prague and regional listings, including English-language roles.",
    sourceName: "Jobs.cz",
    sourceUrl: "https://www.jobs.cz/en",
    location: "Czechia · private portal",
    workMode: "Mixed; confirm on the live listing",
    recordType: "live_portal",
    observedOn: "2026-09-18",
    freshnessState: "fresh",
  },
  {
    id: "portal-prace-cz",
    destination: "Czechia",
    title: "Práce.cz",
    description: "Broad Czech job board useful for comparing regional demand, titles and employer requirements.",
    sourceName: "Práce.cz",
    sourceUrl: "https://www.prace.cz/",
    location: "Czechia · private portal",
    workMode: "Mixed; confirm on the live listing",
    recordType: "live_portal",
    observedOn: "2026-09-18",
    freshnessState: "fresh",
  },
  {
    id: "portal-workforce-australia",
    destination: "Australia",
    title: "Workforce Australia",
    description: "Australian Government employment service for searching vacancies and employment support.",
    sourceName: "Australian Government",
    sourceUrl: "https://www.workforceaustralia.gov.au/individuals/jobs/search",
    location: "Australia · official",
    workMode: "Mixed; confirm on the live listing",
    recordType: "live_portal",
    observedOn: "2026-09-18",
    freshnessState: "fresh",
  },
  {
    id: "portal-seek-australia",
    destination: "Australia",
    title: "SEEK Australia",
    description: "Australian job portal for comparing role demand, locations and employer requirements.",
    sourceName: "SEEK",
    sourceUrl: "https://www.seek.com.au/",
    location: "Australia · private portal",
    workMode: "Mixed; confirm on the live listing",
    recordType: "live_portal",
    observedOn: "2026-09-18",
    freshnessState: "fresh",
  },
];

export const jobMarketListingCatalog: InsertJobMarketListing[] = [
  {
    id: "job-axiom-desktop-support",
    destination: "Czechia",
    title: "Desktop Support Engineer (Full Time)",
    employer: "Axiom Technologies",
    location: "Prague, Czech Republic",
    workMode: "On-site / employer details on listing",
    sourceName: "Axiom Technologies · Prague careers",
    sourceUrl: "https://axiomtechnologies.com/job-location/prague/",
    postedOn: "2026-09-14",
    observedOn: "2026-09-18",
    availability: "available",
    reviewStatus: "reviewed",
    freshnessState: "fresh",
    note: "The employer page showed this item as posted 14 September 2026 when checked. Reopen the source before acting.",
  },
  {
    id: "job-actum-account-manager",
    destination: "Czechia",
    title: "Account Manager",
    employer: "Actum Digital",
    location: "Prague, Czechia",
    workMode: "Check listing for work arrangement",
    sourceName: "Actum Digital · Prague careers",
    sourceUrl: "https://www.actumdigital.com/careers/prague",
    postedOn: "2026-09-02",
    observedOn: "2026-09-18",
    availability: "available",
    reviewStatus: "reviewed",
    freshnessState: "fresh",
    note: "The employer page showed this item as posted 2 September 2026 when checked. Reopen the source before acting.",
  },
];

export function getJobMarketFreshness(
  observedOn: string,
  availability: string,
  now = new Date(),
): JobMarketFreshness {
  if (availability !== "available") return "unavailable";
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return observedOn.slice(0, 7) === currentMonth ? "fresh" : "stale";
}

export async function ensureJobMarketCatalog(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_market_portals (
      id text PRIMARY KEY,
      destination text NOT NULL,
      title text NOT NULL,
      description text NOT NULL,
      source_name text NOT NULL,
      source_url text NOT NULL,
      location text NOT NULL,
      work_mode text NOT NULL,
      record_type text NOT NULL DEFAULT 'live_portal',
      observed_on date NOT NULL,
      freshness_state text NOT NULL DEFAULT 'fresh',
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS job_market_listings (
      id text PRIMARY KEY,
      destination text NOT NULL,
      title text NOT NULL,
      employer text NOT NULL,
      location text NOT NULL,
      work_mode text NOT NULL,
      source_name text NOT NULL,
      source_url text NOT NULL,
      posted_on date,
      observed_on date NOT NULL,
      availability text NOT NULL DEFAULT 'available',
      review_status text NOT NULL DEFAULT 'reviewed',
      freshness_state text NOT NULL DEFAULT 'fresh',
      note text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE job_market_listings ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'reviewed';
    CREATE TABLE IF NOT EXISTS job_market_listing_history (
      id text PRIMARY KEY,
      listing_id text NOT NULL,
      change_type text NOT NULL,
      destination text NOT NULL,
      title text NOT NULL,
      employer text NOT NULL,
      location text NOT NULL,
      work_mode text NOT NULL,
      source_name text NOT NULL,
      source_url text NOT NULL,
      posted_on date,
      observed_on date NOT NULL,
      availability text NOT NULL,
      review_status text NOT NULL,
      note text NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  for (const portal of jobMarketPortalCatalog) {
    await db.insert(jobMarketPortalsTable).values(portal).onConflictDoNothing();
  }
  for (const listing of jobMarketListingCatalog) {
    await db.insert(jobMarketListingsTable).values(listing).onConflictDoNothing();
  }
}

export async function refreshJobMarketListing(
  id: string,
  input: JobMarketListingRefresh,
) {
  const [current] = await db
    .select()
    .from(jobMarketListingsTable)
    .where(sql`${jobMarketListingsTable.id} = ${id}`)
    .limit(1);

  if (current) {
    await db.insert(jobMarketListingHistoryTable).values({
      id: randomUUID(),
      listingId: current.id,
      changeType: input.availability === "unavailable" ? "retired" : "refreshed",
      destination: current.destination,
      title: current.title,
      employer: current.employer,
      location: current.location,
      workMode: current.workMode,
      sourceName: current.sourceName,
      sourceUrl: current.sourceUrl,
      postedOn: current.postedOn,
      observedOn: current.observedOn,
      availability: current.availability,
      reviewStatus: current.reviewStatus,
      note: current.note,
    });
    await db
      .update(jobMarketListingsTable)
      .set(input)
      .where(sql`${jobMarketListingsTable.id} = ${id}`);
  } else {
    await db.insert(jobMarketListingsTable).values({ id, ...input });
    await db.insert(jobMarketListingHistoryTable).values({
      id: randomUUID(),
      listingId: id,
      changeType: "created",
      ...input,
    });
  }

  const [updated] = await db
    .select()
    .from(jobMarketListingsTable)
    .where(sql`${jobMarketListingsTable.id} = ${id}`)
    .limit(1);
  return updated;
}