import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  ListVisaResourcesQueryParams,
  ListVisaResourcesResponse,
} from "@workspace/api-zod";
import { db, visaResourceSourcesTable } from "@workspace/db";
import {
  filterApplicableVisaSources,
} from "../lib/visa-resource-catalog";

const router: IRouter = Router();

router.get("/visa-resources", async (req, res): Promise<void> => {
  const parsed = ListVisaResourcesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const candidates = await db
    .select()
    .from(visaResourceSourcesTable)
    .where(eq(visaResourceSourcesTable.destinationCountry, parsed.data.destinationCountry));
  const items = filterApplicableVisaSources(
    candidates,
    parsed.data.purposeTag,
    parsed.data.passportCountry,
  )
    .map((source) => ({
      id: source.id,
      destinationCountry: source.destinationCountry,
      purposeTags: source.purposeTags,
      recordKind: source.recordKind as "pathway" | "stream" | "finder",
      pathwayName: source.pathwayName,
      title: source.title,
      description: source.description,
      sourceName: source.sourceName,
      sourceUrl: source.sourceUrl,
      reviewedOn: source.reviewedOn,
      authority: source.authority as "official" | "community",
      monitoringStatus: source.accessStatus !== "allowed" || !source.termsUrl || !source.termsReviewedOn
        ? "pending_policy_review" as const
        : source.pendingContentHash
          ? "changed_pending_review" as const
          : source.lastError
            ? "unavailable" as const
            : source.lastCheckedAt
              ? "current" as const
              : "not_checked" as const,
      lastCheckedAt: source.lastCheckedAt,
      pendingSourceUrl: source.pendingSourceUrl,
    }));

  res.json(ListVisaResourcesResponse.parse({
    items,
    reviewedAt: new Date(),
    sourcePolicy: "Public official links are matched by destination and purpose. Passport-specific filters apply only where explicitly configured. Automated checks are gated on access-policy review; detected page changes are held for review and no source text is copied or auto-published.",
  }));
});

export default router;
