import { createInsertSchema } from "drizzle-zod";
import { date, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const jobMarketPortalsTable = pgTable("job_market_portals", {
  id: text("id").primaryKey(),
  destination: text("destination").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  location: text("location").notNull(),
  workMode: text("work_mode").notNull(),
  recordType: text("record_type").notNull().default("live_portal"),
  observedOn: date("observed_on", { mode: "string" }).notNull(),
  freshnessState: text("freshness_state").notNull().default("fresh"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const jobMarketListingsTable = pgTable("job_market_listings", {
  id: text("id").primaryKey(),
  destination: text("destination").notNull(),
  title: text("title").notNull(),
  employer: text("employer").notNull(),
  location: text("location").notNull(),
  workMode: text("work_mode").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  postedOn: date("posted_on", { mode: "string" }),
  observedOn: date("observed_on", { mode: "string" }).notNull(),
  availability: text("availability").notNull().default("available"),
  reviewStatus: text("review_status").notNull().default("reviewed"),
  freshnessState: text("freshness_state").notNull().default("fresh"),
  note: text("note").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const jobMarketListingHistoryTable = pgTable("job_market_listing_history", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull(),
  changeType: text("change_type").notNull(),
  destination: text("destination").notNull(),
  title: text("title").notNull(),
  employer: text("employer").notNull(),
  location: text("location").notNull(),
  workMode: text("work_mode").notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  postedOn: date("posted_on", { mode: "string" }),
  observedOn: date("observed_on", { mode: "string" }).notNull(),
  availability: text("availability").notNull(),
  reviewStatus: text("review_status").notNull(),
  note: text("note").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertJobMarketPortalSchema = createInsertSchema(jobMarketPortalsTable);
export const insertJobMarketListingSchema = createInsertSchema(jobMarketListingsTable);
export const insertJobMarketListingHistorySchema = createInsertSchema(jobMarketListingHistoryTable);

export type InsertJobMarketPortal = z.infer<typeof insertJobMarketPortalSchema>;
export type JobMarketPortal = typeof jobMarketPortalsTable.$inferSelect;
export type InsertJobMarketListing = z.infer<typeof insertJobMarketListingSchema>;
export type JobMarketListing = typeof jobMarketListingsTable.$inferSelect;
export type InsertJobMarketListingHistory = z.infer<typeof insertJobMarketListingHistorySchema>;
export type JobMarketListingHistory = typeof jobMarketListingHistoryTable.$inferSelect;