import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import {
  CreateAlertSubscriptionBody,
  CreateAlertSubscriptionResponse,
} from "@workspace/api-zod";
import { alertSubscriptionsTable, db } from "@workspace/db";

const router: IRouter = Router();

router.post("/alerts", async (req, res): Promise<void> => {
  const parsed = CreateAlertSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [subscription] = await db
    .insert(alertSubscriptionsTable)
    .values({ id: crypto.randomUUID(), topics: parsed.data.topics })
    .returning();

  res.status(201).json(
    CreateAlertSubscriptionResponse.parse({
      subscribed: true,
      topics: subscription.topics,
      createdAt: subscription.createdAt,
      privacyNote:
        "This is an anonymous in-app subscription. We do not collect an email, account, or profile for change alerts.",
    }),
  );
});

export default router;