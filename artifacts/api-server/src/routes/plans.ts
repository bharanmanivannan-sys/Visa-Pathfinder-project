import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  CreateSavedPlanBody,
  CreateSavedPlanResponse,
  GetSavedPlanParams,
  GetSavedPlanResponse,
  ListSavedPlansResponse,
  UpdateSavedPlanBody,
  UpdateSavedPlanParams,
  UpdateSavedPlanResponse,
} from "@workspace/api-zod";
import { db, savedPlansTable } from "@workspace/db";

const router: IRouter = Router();

function workspaceIdFromRequest(req: Request): string | null {
  const workspaceId = req.signedCookies?.visa_workspace;
  return typeof workspaceId === "string" ? workspaceId : null;
}

router.get("/plans", async (req, res): Promise<void> => {
  const workspaceId = workspaceIdFromRequest(req);
  if (!workspaceId) {
    res.json(ListSavedPlansResponse.parse({ items: [] }));
    return;
  }

  const plans = await db
    .select()
    .from(savedPlansTable)
    .where(eq(savedPlansTable.workspaceId, workspaceId))
    .orderBy(desc(savedPlansTable.updatedAt));

  res.json(ListSavedPlansResponse.parse({ items: plans }));
});

router.post("/plans", async (req, res): Promise<void> => {
  const parsed = CreateSavedPlanBody.safeParse(req.body);
  const workspaceId = workspaceIdFromRequest(req);
  if (!parsed.success || !workspaceId) {
    res.status(400).json({
      error: parsed.success
        ? "A private workspace could not be established."
        : parsed.error.message,
    });
    return;
  }

  const [plan] = await db
    .insert(savedPlansTable)
    .values({
      id: crypto.randomUUID(),
      workspaceId,
      ...parsed.data,
    })
    .returning();

  res.status(201).json(CreateSavedPlanResponse.parse(plan));
});

router.get("/plans/:id", async (req, res): Promise<void> => {
  const params = GetSavedPlanParams.safeParse(req.params);
  const workspaceId = workspaceIdFromRequest(req);
  if (!params.success || !workspaceId) {
    res.status(400).json({
      error: params.success
        ? "A private workspace could not be established."
        : params.error.message,
    });
    return;
  }

  const [plan] = await db
    .select()
    .from(savedPlansTable)
    .where(
      and(
        eq(savedPlansTable.id, params.data.id),
        eq(savedPlansTable.workspaceId, workspaceId),
      ),
    );

  if (!plan) {
    res.status(404).json({ error: "Saved plan not found" });
    return;
  }

  res.json(GetSavedPlanResponse.parse(plan));
});

router.patch("/plans/:id", async (req, res): Promise<void> => {
  const params = UpdateSavedPlanParams.safeParse(req.params);
  const parsed = UpdateSavedPlanBody.safeParse(req.body);
  const workspaceId = workspaceIdFromRequest(req);
  if (!params.success || !parsed.success || !workspaceId) {
    res.status(400).json({
      error: !params.success
        ? params.error.message
        : !parsed.success
          ? parsed.error.message
          : "A private workspace could not be established.",
    });
    return;
  }
  if (Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "At least one plan field is required." });
    return;
  }

  const [plan] = await db
    .update(savedPlansTable)
    .set(parsed.data)
    .where(
      and(
        eq(savedPlansTable.id, params.data.id),
        eq(savedPlansTable.workspaceId, workspaceId),
      ),
    )
    .returning();

  if (!plan) {
    res.status(404).json({ error: "Saved plan not found" });
    return;
  }

  res.json(UpdateSavedPlanResponse.parse(plan));
});

export default router;