import { createInsertSchema } from "drizzle-zod";
import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const visaGuidanceTable = pgTable("visa_guidance", {
  id: text("id").primaryKey(),
  visaSubclass: text("visa_subclass").notNull(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  fitScore: integer("fit_score").notNull(),
  signal: text("signal").notNull(),
  duration: text("duration").notNull(),
  governmentFee: text("government_fee").notNull(),
  stage: text("stage").notNull(),
  note: text("note").notNull(),
  eligibilityChecks: text("eligibility_checks").array().notNull(),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  reviewedOn: date("reviewed_on", { mode: "string" }).notNull(),
  authority: text("authority").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const regulationChangesTable = pgTable("regulation_changes", {
  id: text("id").primaryKey(),
  changeType: text("change_type").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  publishedOn: date("published_on", { mode: "string" }).notNull(),
  effectiveOn: date("effective_on", { mode: "string" }),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  reviewedOn: date("reviewed_on", { mode: "string" }).notNull(),
  authority: text("authority").notNull(),
});

export const alertSubscriptionsTable = pgTable("alert_subscriptions", {
  id: text("id").primaryKey(),
  topics: text("topics").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const savedPlansTable = pgTable(
  "saved_plans",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    pathway: jsonb("pathway").notNull(),
    comparison: jsonb("comparison").notNull(),
    roadmap: jsonb("roadmap").notNull(),
    documentChecklist: jsonb("document_checklist").notNull(),
    costAssumptions: jsonb("cost_assumptions").notNull(),
    planningContext: jsonb("planning_context"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("saved_plans_workspace_id_idx").on(table.workspaceId)],
);

export const insertVisaGuidanceSchema = createInsertSchema(visaGuidanceTable);
export const insertRegulationChangeSchema =
  createInsertSchema(regulationChangesTable);
export const insertAlertSubscriptionSchema = createInsertSchema(
  alertSubscriptionsTable,
).omit({ createdAt: true });
export const insertSavedPlanSchema = createInsertSchema(savedPlansTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertVisaGuidance = z.infer<typeof insertVisaGuidanceSchema>;
export type VisaGuidance = typeof visaGuidanceTable.$inferSelect;
export type InsertRegulationChange = z.infer<
  typeof insertRegulationChangeSchema
>;
export type RegulationChange = typeof regulationChangesTable.$inferSelect;
export type InsertAlertSubscription = z.infer<
  typeof insertAlertSubscriptionSchema
>;
export type AlertSubscription = typeof alertSubscriptionsTable.$inferSelect;
export type InsertSavedPlan = z.infer<typeof insertSavedPlanSchema>;
export type SavedPlan = typeof savedPlansTable.$inferSelect;