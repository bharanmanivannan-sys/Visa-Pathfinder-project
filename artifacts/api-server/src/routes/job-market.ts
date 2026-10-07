import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, jobMarketListingHistoryTable, jobMarketListingsTable, jobMarketPortalsTable } from "@workspace/db";
import { ensureJobMarketCatalog, getJobMarketFreshness, parseJobMarketListingRefresh, refreshJobMarketListing } from "../lib/job-market-catalog";

const router: IRouter = Router();

router.get("/job-market", async (req, res): Promise<void> => {
  const destination = typeof req.query.destination === "string" ? req.query.destination : undefined;
  await ensureJobMarketCatalog();

  const [portals, listings] = await Promise.all([
    destination
      ? db.select().from(jobMarketPortalsTable).where(eq(jobMarketPortalsTable.destination, destination))
      : db.select().from(jobMarketPortalsTable),
    destination
      ? db.select().from(jobMarketListingsTable).where(eq(jobMarketListingsTable.destination, destination)).orderBy(desc(jobMarketListingsTable.observedOn))
      : db.select().from(jobMarketListingsTable).orderBy(desc(jobMarketListingsTable.observedOn)),
  ]);
  const visibleListings = listings.filter((listing) => listing.reviewStatus === "reviewed");

  res.json({
    portals: portals.map((portal) => ({
      ...portal,
      freshnessState: getJobMarketFreshness(portal.observedOn, "available"),
    })),
    listings: visibleListings.map((listing) => ({
      ...listing,
      freshnessState: getJobMarketFreshness(listing.observedOn, listing.availability),
    })),
    suppressedListingCount: listings.length - visibleListings.length,
    reviewedAt: new Date().toISOString(),
    freshnessPolicy: "Live portals are current source links. Dated examples are shown only when observed in the current month and are marked stale after the month changes or unavailable when the source is closed.",
  });
});

router.put("/job-market/listings/:id", async (req, res): Promise<void> => {
  const parsed = parseJobMarketListingRefresh(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "The listing refresh was not accepted.", details: parsed.error });
    return;
  }
  await ensureJobMarketCatalog();
  const listing = await refreshJobMarketListing(req.params.id, parsed.data);
  if (!listing) {
    res.status(500).json({ error: "The listing refresh could not be stored." });
    return;
  }
  res.json({
    listing: {
      ...listing,
      freshnessState: getJobMarketFreshness(listing.observedOn, listing.availability),
    },
    publicVisibility: listing.reviewStatus === "reviewed" && listing.availability === "available",
  });
});

router.get("/job-market/listings/:id/history", async (req, res): Promise<void> => {
  await ensureJobMarketCatalog();
  const history = await db
    .select()
    .from(jobMarketListingHistoryTable)
    .where(eq(jobMarketListingHistoryTable.listingId, req.params.id))
    .orderBy(desc(jobMarketListingHistoryTable.recordedAt));
  res.json({ listingId: req.params.id, history });
});

export default router;