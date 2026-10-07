import { createInsertSchema } from "drizzle-zod";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const visaResourceSourcesTable = pgTable(
  "visa_resource_sources",
  {
    id: text("id").primaryKey(),
    destinationCountry: text("destination_country").notNull(),
    passportCountries: text("passport_countries").array().notNull().default([]),
    purposeTags: text("purpose_tags").array().notNull(),
    recordKind: text("record_kind").notNull(),
    pathwayName: text("pathway_name").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    reviewedOn: date("reviewed_on", { mode: "string" }).notNull(),
    authority: text("authority").notNull().default("official"),
    accessStatus: text("access_status").notNull().default("pending_policy_review"),
    termsUrl: text("terms_url"),
    termsReviewedOn: date("terms_reviewed_on", { mode: "string" }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    nextCheckAt: timestamp("next_check_at", { withTimezone: true }),
    etag: text("etag"),
    lastModified: text("last_modified"),
    currentContentHash: text("current_content_hash"),
    pendingContentHash: text("pending_content_hash"),
    pendingSourceUrl: text("pending_source_url"),
    httpStatus: integer("http_status"),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("visa_resource_sources_destination_idx").on(table.destinationCountry),
    index("visa_resource_sources_access_check_idx").on(table.accessStatus, table.nextCheckAt),
  ],
);

export const visaResourceSourceChangesTable = pgTable(
  "visa_resource_source_changes",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    previousContentHash: text("previous_content_hash"),
    detectedContentHash: text("detected_content_hash").notNull(),
    previousSourceUrl: text("previous_source_url").notNull(),
    detectedSourceUrl: text("detected_source_url"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    reviewStatus: text("review_status").notNull().default("pending_review"),
  },
  (table) => [
    index("visa_resource_source_changes_source_idx").on(table.sourceId, table.detectedAt),
  ],
);

export const insertVisaResourceSourceSchema = createInsertSchema(visaResourceSourcesTable);
export const insertVisaResourceSourceChangeSchema = createInsertSchema(
  visaResourceSourceChangesTable,
);
export type InsertVisaResourceSource = z.infer<typeof insertVisaResourceSourceSchema>;
export type VisaResourceSource = typeof visaResourceSourcesTable.$inferSelect;
export type InsertVisaResourceSourceChange = z.infer<
  typeof insertVisaResourceSourceChangeSchema
>;
export type VisaResourceSourceChange = typeof visaResourceSourceChangesTable.$inferSelect;
