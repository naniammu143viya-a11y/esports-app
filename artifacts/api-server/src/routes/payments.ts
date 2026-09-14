import { and, desc, eq, isNull } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  db,
  paymentTransactions,
  paymentVerificationAttempts,
  tournamentPaymentJoins,
} from "@workspace/db";

const router: IRouter = Router();
const UTR_PATTERN = /^\d{12}$/;

type VerificationBody = {
  utr?: string;
  amount?: number;
  tournamentId?: string;
  username?: string;
  mobile?: string;
  gameId?: string;
  gameType?: string;
};

function normalizedUtr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function adminAuthorized(req: Request): boolean {
  const configuredSecret = process.env.PAYMENT_ADMIN_SECRET;
  return process.env.NODE_ENV !== "production" ||
    Boolean(configuredSecret && req.header("x-payment-admin-secret") === configuredSecret);
}

router.post("/payments/webhook", async (req, res) => {
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (process.env.NODE_ENV === "production" && !webhookSecret) {
    res.status(503).json({ error: "Payment webhook secret is not configured" });
    return;
  }
  if (webhookSecret && req.header("x-payment-webhook-secret") !== webhookSecret) {
    res.status(401).json({ error: "Invalid payment webhook signature" });
    return;
  }

  const utr = normalizedUtr(req.body?.utr);
  const amount = Number(req.body?.amount);
  if (!UTR_PATTERN.test(utr) || !Number.isInteger(amount) || amount <= 0) {
    res.status(400).json({ error: "A 12-digit UTR and positive amount are required" });
    return;
  }

  try {
    const [transaction] = await db
      .insert(paymentTransactions)
      .values({
        utr,
        amount,
        source: typeof req.body?.source === "string" ? req.body.source : "bank_webhook",
        status: "RECEIVED",
      })
      .onConflictDoNothing({ target: paymentTransactions.utr })
      .returning({ id: paymentTransactions.id, utr: paymentTransactions.utr });

    if (!transaction) {
      res.status(409).json({ error: "Duplicate UTR already received" });
      return;
    }
    res.status(201).json({ ok: true, transaction });
  } catch (error) {
    req.log?.error?.(error, "payment webhook failed");
    res.status(500).json({ error: "Unable to record payment transaction" });
  }
});

router.post("/payments/verify", async (req, res) => {
  const body = req.body as VerificationBody;
  const utr = normalizedUtr(body.utr);
  const amount = Number(body.amount);
  const tournamentId = typeof body.tournamentId === "string" ? body.tournamentId.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const gameType = typeof body.gameType === "string" ? body.gameType : "BGMI";

  if (!UTR_PATTERN.test(utr) || !Number.isInteger(amount) || amount <= 0 || !tournamentId || !username) {
    res.status(400).json({ error: "Enter a valid 12-digit UTR number" });
    return;
  }

  try {
    const [duplicateJoin] = await db
      .select()
      .from(tournamentPaymentJoins)
      .where(eq(tournamentPaymentJoins.utr, utr))
      .limit(1);
    if (duplicateJoin) {
      await db.insert(paymentVerificationAttempts).values({
        utr,
        amount,
        tournamentId,
        username,
        mobile: body.mobile ?? "",
        gameId: body.gameId ?? "",
        gameType,
        status: "DUPLICATE",
        paymentId: duplicateJoin.paymentId,
        reviewNote: "UTR has already been used",
      });
      res.status(409).json({ error: "Invalid or Unverified UTR Number" });
      return;
    }

    const [received] = await db
      .select()
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.utr, utr),
          eq(paymentTransactions.amount, amount),
          eq(paymentTransactions.status, "RECEIVED"),
          isNull(paymentTransactions.matchedAt),
        ),
      )
      .limit(1);

    if (!received) {
      await db.insert(paymentVerificationAttempts).values({
        utr,
        amount,
        tournamentId,
        username,
        mobile: body.mobile ?? "",
        gameId: body.gameId ?? "",
        gameType,
        status: "FLAGGED",
        reviewNote: "No matching verified incoming payment",
      });
      res.status(422).json({ error: "Invalid or Unverified UTR Number" });
      return;
    }

    const paymentId = `PAY${Date.now().toString(36).toUpperCase()}`;
    const result = await db.transaction(async (tx) => {
      const [matched] = await tx
        .update(paymentTransactions)
        .set({
          status: "MATCHED",
          matchedAt: new Date(),
          matchedUsername: username,
          matchedTournamentId: tournamentId,
        })
        .where(
          and(
            eq(paymentTransactions.id, received.id),
            eq(paymentTransactions.status, "RECEIVED"),
            isNull(paymentTransactions.matchedAt),
          ),
        )
        .returning({ id: paymentTransactions.id });
      if (!matched) throw new Error("Payment was matched by another request");

      const [join] = await tx
        .insert(tournamentPaymentJoins)
        .values({
          paymentId,
          tournamentId,
          utr,
          username,
          mobile: body.mobile ?? "",
          gameId: body.gameId ?? "",
          gameType,
          amount,
        })
        .returning({ id: tournamentPaymentJoins.id });
      await tx.insert(paymentVerificationAttempts).values({
        utr,
        amount,
        tournamentId,
        username,
        mobile: body.mobile ?? "",
        gameId: body.gameId ?? "",
        gameType,
        status: "APPROVED",
        transactionId: received.id,
        paymentId,
      });
      return { joinId: join.id };
    });

    res.json({ ok: true, status: "APPROVED", paymentId, ...result });
  } catch (error) {
    req.log?.error?.(error, "payment verification failed");
    res.status(409).json({ error: "Invalid or Unverified UTR Number" });
  }
});

router.get("/payments/joins", async (req, res) => {
  const username = typeof req.query.username === "string" ? req.query.username.trim() : "";
  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }
  const joins = await db
    .select()
    .from(tournamentPaymentJoins)
    .where(eq(tournamentPaymentJoins.username, username))
    .orderBy(desc(tournamentPaymentJoins.joinedAt));
  res.json({ joins });
});

router.get("/payments", async (req, res) => {
  if (!adminAuthorized(req)) {
    res.status(401).json({ error: "Admin payment access is not configured" });
    return;
  }
  const rows = await db
    .select()
    .from(paymentVerificationAttempts)
    .orderBy(desc(paymentVerificationAttempts.createdAt))
    .limit(100);
  res.json({ payments: rows });
});

router.post("/payments/:id/review", async (req, res) => {
  if (!adminAuthorized(req)) {
    res.status(401).json({ error: "Admin payment access is not configured" });
    return;
  }
  const id = Number(req.params.id);
  const action = req.body?.action;
  if (!Number.isInteger(id) || !["APPROVE", "REJECT"].includes(action)) {
    res.status(400).json({ error: "Invalid review action" });
    return;
  }
  const [attempt] = await db
    .select()
    .from(paymentVerificationAttempts)
    .where(eq(paymentVerificationAttempts.id, id))
    .limit(1);
  if (!attempt) {
    res.status(404).json({ error: "Payment review not found" });
    return;
  }
  const nextStatus = action === "APPROVE" ? "MANUALLY_APPROVED" : "REJECTED";
  try {
    const updated = await db.transaction(async (tx) => {
      let paymentId = attempt.paymentId ?? undefined;
      if (action === "APPROVE" && !paymentId) {
        paymentId = `PAYMANUAL${Date.now().toString(36).toUpperCase()}`;
        await tx.insert(tournamentPaymentJoins).values({
          paymentId,
          tournamentId: attempt.tournamentId,
          utr: attempt.utr,
          username: attempt.username,
          mobile: attempt.mobile,
          gameId: attempt.gameId,
          gameType: attempt.gameType,
          amount: attempt.amount,
        }).onConflictDoNothing({ target: tournamentPaymentJoins.utr });
      }
      const [row] = await tx
        .update(paymentVerificationAttempts)
        .set({
          status: nextStatus,
          paymentId,
          reviewedAt: new Date(),
          reviewNote: typeof req.body?.note === "string" ? req.body.note : null,
        })
        .where(eq(paymentVerificationAttempts.id, id))
        .returning();
      return row;
    });
    res.json({ ok: true, payment: updated });
  } catch (error) {
    req.log?.error?.(error, "manual payment review failed");
    res.status(409).json({ error: "Payment could not be manually approved" });
  }
});

export default router;