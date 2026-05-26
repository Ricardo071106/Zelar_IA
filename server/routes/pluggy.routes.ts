import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import {
  handlePluggyTransactionsCreatedWebhook,
  handlePluggyTransactionsUpdatedWebhook,
  handlePluggyItemLinkedFromWebhook,
} from "../services/pluggy/pluggyPaymentProcessor";
import { isPluggyInMaintenance } from "../services/pluggy/pluggyMaintenance";

const router = Router();

/**
 * Webhook Pluggy: responda 2xx em <5s; processamento assíncrono.
 * Opcional: PLUGGY_WEBHOOK_SECRET + header X-Zelar-Pluggy-Secret (mesmo valor).
 */
router.post(
  "/webhook",
  asyncHandler(async (req: Request, res: Response) => {
    const secret = process.env.PLUGGY_WEBHOOK_SECRET?.trim();
    if (secret) {
      const h = req.headers["x-zelar-pluggy-secret"];
      if (typeof h !== "string" || h !== secret) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
    }

    res.status(200).json({ ok: true });

    const body = req.body as Record<string, unknown>;
    const event = typeof body.event === "string" ? body.event : "";

    setImmediate(() => {
      void (async () => {
        try {
          if (isPluggyInMaintenance()) return;
          if (event === "item/created" || event === "item/updated") {
            await handlePluggyItemLinkedFromWebhook(
              event,
              body.clientUserId as string | undefined,
              body.itemId as string | undefined,
            );
          } else if (event === "transactions/created") {
            await handlePluggyTransactionsCreatedWebhook(body);
          } else if (event === "transactions/updated") {
            await handlePluggyTransactionsUpdatedWebhook(body);
          }
        } catch (e) {
          console.error("[Pluggy] webhook processamento:", e);
        }
      })();
    });
  }),
);

export default router;
