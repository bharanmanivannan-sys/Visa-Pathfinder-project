import { desc } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  ListChangesQueryParams,
  ListChangesResponse,
  ListGuidanceResponse,
} from "@workspace/api-zod";
import { db, regulationChangesTable, visaGuidanceTable } from "@workspace/db";
import { ensureGuidanceCatalog } from "../lib/guidance-catalog";

const router: IRouter = Router();

router.get("/guidance", async (_req, res): Promise<void> => {
  await ensureGuidanceCatalog();
  const items = await db
    .select()
    .from(visaGuidanceTable)
    .orderBy(desc(visaGuidanceTable.fitScore));
  res.json(
    ListGuidanceResponse.parse({
      items,
      reviewedAt: new Date(),
      sourcePolicy:
        "Official government sources are labelled. Community guidance is context only and is not legal advice.",
    }),
  );
});

router.get("/changes", async (req, res): Promise<void> => {
  const parsed = ListChangesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await ensureGuidanceCatalog();
  const items = await db
    .select()
    .from(regulationChangesTable)
    .orderBy(desc(regulationChangesTable.publishedOn))
    .limit(parsed.data.limit);
  res.json(ListChangesResponse.parse({ items, reviewedAt: new Date() }));
});

export default router;