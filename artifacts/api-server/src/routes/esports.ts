import { randomBytes, randomUUID, scryptSync, createHmac, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  esportsPayments,
  esportsPayouts,
  esportsRegistrations,
  esportsSettings,
  esportsTournaments,
  esportsUsers,
  esportsWithdrawals,
} from "@workspace/db";

type Claims = { userId: string; username: string; isAdmin: boolean; exp: number };

declare global {
  namespace Express {
    interface Request {
      auth?: Claims;
    }
  }
}

const router = Router();
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const bad = (res: Response, status: number, error: string): void => {
  res.status(status).json({ error });
};
const nowIso = (date: Date | null | undefined) => date?.toISOString() ?? null;
const body = (req: Request) => (req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {});
const textValue = (value: unknown) => typeof value === "string" ? value.trim() : "";
const intValue = (value: unknown) => Number.isInteger(Number(value)) ? Number(value) : NaN;
const uuid = () => randomUUID();
const routeParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

function secret(name: "SESSION_SECRET" | "ADMIN_PASSWORD") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function signToken(user: { id: string; username: string; isAdmin: boolean }) {
  const now = Date.now();
  const payload: Claims = {
    userId: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    exp: now + EXPIRY_MS,
  };
  const unsigned = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  return `${unsigned}.${createHmac("sha256", secret("SESSION_SECRET")).update(unsigned).digest("base64url")}`;
}

function readToken(token: string): Claims | null {
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return null;
    const unsigned = `${header}.${payload}`;
    const expected = createHmac("sha256", secret("SESSION_SECRET")).update(unsigned).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as Claims;
    return claims.exp > Date.now() && claims.userId && claims.username ? claims : null;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const claims = token ? readToken(token) : null;
  if (!claims) {
    bad(res, 401, "Sign in to continue.");
    return;
  }
  req.auth = claims;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.isAdmin) {
    bad(res, 403, "Admin access is required.");
    return;
  }
  next();
}

function userJson(row: typeof esportsUsers.$inferSelect) {
  return {
    id: row.id,
    username: row.username,
    mobile: row.mobile,
    gameId: row.gameId,
    gameType: row.gameType,
    isAdmin: row.isAdmin,
    upiId: row.upiId,
  };
}

function payoutJson(row: typeof esportsPayouts.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    username: row.username,
    tournamentId: row.tournamentId,
    tournamentName: row.tournamentName,
    amount: row.amount,
    declaredAt: row.declaredAt.toISOString(),
    breakdown: {
      kills: row.kills,
      killPrize: row.killPrize,
      rank: row.rank,
      rankPrize: row.rankPrize,
    },
  };
}

function tournamentJson(
  row: typeof esportsTournaments.$inferSelect,
  winners: ReturnType<typeof payoutJson>[] = [],
) {
  return {
    id: row.id,
    game: row.game,
    name: row.name,
    map: row.map,
    entryFee: row.entryFee,
    prizePool: row.prizePool,
    status: row.status,
    teamSize: row.teamSize,
    maxTeams: row.maxTeams,
    registeredTeams: row.registeredTeams,
    date: row.date,
    time: row.time,
    roomId: row.roomId,
    password: row.password,
    perKillPrize: row.perKillPrize,
    rankPrizes: { rank1: row.rank1Prize, rank2: row.rank2Prize, rank3: row.rank3Prize },
    completedAt: nowIso(row.completedAt),
    winners,
  };
}

function paymentJson(
  row: typeof esportsPayments.$inferSelect,
  player: typeof esportsUsers.$inferSelect,
  tournamentName: string,
) {
  return {
    id: row.id,
    tournamentId: row.tournamentId,
    status: row.status,
    paymentId: row.paymentId,
    paidAt: nowIso(row.verifiedAt) ?? row.submittedAt.toISOString(),
    amount: row.amount,
    utr: row.utr,
    submittedAt: row.submittedAt.toISOString(),
    verifiedAt: nowIso(row.verifiedAt),
    player: {
      id: player.id,
      username: player.username,
      mobile: player.mobile,
      gameId: player.gameId,
      gameType: player.gameType,
    },
    tournamentName,
  };
}

function withdrawalJson(row: typeof esportsWithdrawals.$inferSelect) {
  return {
    id: row.id,
    username: row.username,
    mobile: row.mobile,
    upiId: row.upiId,
    amount: row.amount,
    requestedAt: row.requestedAt.toISOString(),
    status: row.status,
  };
}

async function expireOldTournaments() {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  await db.delete(esportsTournaments).where(
    and(eq(esportsTournaments.status, "completed"), sql`${esportsTournaments.completedAt} <= ${cutoff}`),
  );
}

const cleanupTimer = setInterval(() => {
  void expireOldTournaments().catch(() => undefined);
}, 60_000);
cleanupTimer.unref();

router.post("/auth/register", async (req, res) => {
  const input = body(req);
  const username = textValue(input.username).toLowerCase();
  const mobile = textValue(input.mobile);
  const gameId = textValue(input.gameId);
  const gameType = textValue(input.gameType);
  const password = typeof input.password === "string" ? input.password : "";
  const upiId = textValue(input.upiId);
  if (username.length < 2 || username.length > 32 || username === "admin") return bad(res, 400, "Choose a valid username.");
  if (!/^\d{10}$/.test(mobile) || !gameId || !["BGMI", "FreeFire"].includes(gameType) || password.length < 6) {
    return bad(res, 400, "Check your mobile, game profile, and password.");
  }
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  try {
    const [created] = await db.insert(esportsUsers).values({
      id: uuid(), username, mobile, gameId, gameType, upiId: upiId || null, passwordHash,
    }).returning();
    res.status(201).json({ token: signToken(created), user: userJson(created) });
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") return bad(res, 409, "Username is already taken.");
    throw error;
  }
});

router.post("/auth/login", async (req, res) => {
  const input = body(req);
  const username = textValue(input.username).toLowerCase();
  const password = typeof input.password === "string" ? input.password : "";
  if (!username || !password) return bad(res, 400, "Enter a username and password.");
  if (username === "admin") {
    let adminPassword: string;
    try { adminPassword = secret("ADMIN_PASSWORD"); }
    catch { return bad(res, 503, "Admin sign-in is not configured."); }
    const submitted = Buffer.from(password);
    const expected = Buffer.from(adminPassword);
    if (submitted.length !== expected.length || !timingSafeEqual(submitted, expected)) return bad(res, 401, "Incorrect username or password.");
    const [admin] = await db.insert(esportsUsers).values({
      id: "admin", username: "admin", mobile: "", gameId: "", gameType: "BGMI", isAdmin: true,
    }).onConflictDoUpdate({
      target: esportsUsers.username,
      set: { isAdmin: true },
    }).returning();
    res.json({ token: signToken(admin), user: userJson(admin) });
    return;
  }
  const [account] = await db.select().from(esportsUsers).where(eq(esportsUsers.username, username)).limit(1);
  if (!account?.passwordHash) return bad(res, 401, "Incorrect username or password.");
  const [salt, storedHex] = account.passwordHash.split(":");
  const submitted = scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHex, "hex");
  if (submitted.length !== stored.length || !timingSafeEqual(submitted, stored)) return bad(res, 401, "Incorrect username or password.");
  res.json({ token: signToken(account), user: userJson(account) });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(esportsUsers).where(eq(esportsUsers.id, req.auth!.userId)).limit(1);
  if (!user) return bad(res, 401, "Account no longer exists.");
  res.json(userJson(user));
});

router.patch("/me/profile", requireAuth, async (req, res) => {
  const rawUpiId = body(req).upiId;
  const upiId = rawUpiId === null ? null : textValue(rawUpiId);
  if (upiId !== null && (upiId.length > 128 || (upiId && !/^[^@\s]+@[^@\s]+$/.test(upiId)))) {
    return bad(res, 400, "Enter a valid UPI ID or leave it empty.");
  }
  const [updated] = await db.update(esportsUsers).set({ upiId })
    .where(and(eq(esportsUsers.id, req.auth!.userId), eq(esportsUsers.isAdmin, false)))
    .returning();
  if (!updated) return bad(res, 404, "Player account not found.");
  res.json(userJson(updated));
});

router.get("/tournaments", async (_req, res) => {
  await expireOldTournaments();
  const rows = await db.select().from(esportsTournaments).orderBy(desc(esportsTournaments.createdAt));
  const payouts = rows.length
    ? await db.select().from(esportsPayouts).where(sql`${esportsPayouts.tournamentId} IN (${sql.join(rows.map((row) => sql`${row.id}`), sql`, `)})`)
    : [];
  const byTournament = new Map<string, ReturnType<typeof payoutJson>[]>();
  for (const payout of payouts) {
    const list = byTournament.get(payout.tournamentId) ?? [];
    list.push(payoutJson(payout));
    byTournament.set(payout.tournamentId, list);
  }
  res.json({ tournaments: rows.map((row) => tournamentJson(row, byTournament.get(row.id) ?? [])) });
});

router.post("/tournaments", requireAuth, requireAdmin, async (req, res) => {
  const input = body(req);
  const name = textValue(input.name);
  const map = textValue(input.map);
  const game = textValue(input.game);
  const teamSize = intValue(input.teamSize);
  const maxTeams = intValue(input.maxTeams);
  const date = textValue(input.date);
  const time = textValue(input.time);
  const rankPrizes = input.rankPrizes as Record<string, unknown> | undefined;
  const moneyFields = [input.entryFee, input.prizePool, input.perKillPrize, rankPrizes?.rank1, rankPrizes?.rank2, rankPrizes?.rank3].map(intValue);
  if (!name || !map || !["BGMI", "FreeFire"].includes(game) || ![1, 2, 4].includes(teamSize) || maxTeams < 1 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) ||
      moneyFields.some((n) => !Number.isInteger(n) || n < 0)) return bad(res, 400, "Tournament details are invalid.");
  const [entryFee, prizePool, perKillPrize, rank1Prize, rank2Prize, rank3Prize] = moneyFields;
  const [created] = await db.insert(esportsTournaments).values({
    id: uuid(), game, name, map, entryFee, prizePool, status: "upcoming", teamSize, maxTeams,
    registeredTeams: 0, date, time, perKillPrize, rank1Prize, rank2Prize, rank3Prize,
  }).returning();
  res.status(201).json(tournamentJson(created));
});

router.patch("/tournaments/:tournamentId", requireAuth, requireAdmin, async (req, res) => {
  const tournamentId = routeParam(req.params.tournamentId);
  const input = body(req);
  const updates: Partial<typeof esportsTournaments.$inferInsert> = {};
  if (input.roomId !== undefined) updates.roomId = textValue(input.roomId) || null;
  if (input.password !== undefined) updates.password = textValue(input.password) || null;
  if (input.status !== undefined) {
    if (input.status !== "ongoing") {
      return bad(res, 400, "Only the upcoming-to-live transition is supported here.");
    }
    const [current] = await db.select().from(esportsTournaments).where(eq(esportsTournaments.id, tournamentId)).limit(1);
    if (!current || current.status !== "upcoming") return bad(res, 409, "Only an upcoming tournament can be started.");
    updates.status = "ongoing";
  }
  if (input.maxTeams !== undefined) {
    const maxTeams = intValue(input.maxTeams);
    const [tournament] = await db.select().from(esportsTournaments).where(eq(esportsTournaments.id, tournamentId)).limit(1);
    if (!tournament || maxTeams < tournament.registeredTeams) return bad(res, 400, "Slot limit cannot be below the current registration count.");
    updates.maxTeams = maxTeams;
  }
  if (!Object.keys(updates).length) return bad(res, 400, "No valid tournament changes were provided.");
  const [updated] = await db.update(esportsTournaments).set(updates).where(eq(esportsTournaments.id, tournamentId)).returning();
  if (!updated) return bad(res, 404, "Tournament not found.");
  res.json(tournamentJson(updated));
});

router.post("/tournaments/:tournamentId/complete", requireAuth, requireAdmin, async (req, res) => {
  const tournamentId = routeParam(req.params.tournamentId);
  const [current] = await db.select().from(esportsTournaments).where(eq(esportsTournaments.id, tournamentId)).limit(1);
  if (!current) return bad(res, 404, "Tournament not found.");
  if (current.status !== "ongoing") return bad(res, 409, "Only a live match can be completed.");
  const [updated] = await db.update(esportsTournaments)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(esportsTournaments.id, tournamentId))
    .returning();
  if (!updated) return bad(res, 404, "Tournament not found.");
  res.json(tournamentJson(updated));
});

async function registrationRows(tournamentId?: string, userId?: string) {
  let query = db.select({
    registration: esportsRegistrations,
    user: esportsUsers,
  }).from(esportsRegistrations)
    .innerJoin(esportsUsers, eq(esportsRegistrations.userId, esportsUsers.id));
  if (tournamentId && userId) query = query.where(and(eq(esportsRegistrations.tournamentId, tournamentId), eq(esportsRegistrations.userId, userId))) as typeof query;
  else if (tournamentId) query = query.where(eq(esportsRegistrations.tournamentId, tournamentId)) as typeof query;
  else if (userId) query = query.where(eq(esportsRegistrations.userId, userId)) as typeof query;
  const rows = await query.orderBy(desc(esportsRegistrations.paidAt));
  const result = [];
  for (const { registration, user } of rows) {
    const [payout] = await db.select().from(esportsPayouts).where(
      and(eq(esportsPayouts.tournamentId, registration.tournamentId), eq(esportsPayouts.userId, user.id)),
    ).limit(1);
    result.push({
      id: registration.id,
      userId: user.id,
      tournamentId: registration.tournamentId,
      username: user.username,
      mobile: user.mobile,
      gameId: user.gameId,
      gameType: user.gameType,
      paymentId: registration.paymentId,
      paidAt: registration.paidAt.toISOString(),
      amount: registration.amount,
      payout: payout ? payoutJson(payout) : null,
    });
  }
  return result;
}

router.get("/tournaments/:tournamentId/registrations", requireAuth, requireAdmin, async (req, res) => {
  res.json({ registrations: await registrationRows(routeParam(req.params.tournamentId)) });
});

router.get("/me/matches", requireAuth, async (req, res) => {
  res.json({ registrations: await registrationRows(undefined, req.auth!.userId) });
});

router.post("/tournaments/:tournamentId/join", requireAuth, async (req, res) => {
  const tournamentId = routeParam(req.params.tournamentId);
  try {
    const registration = await db.transaction(async (tx) => {
      const [tournament] = await tx.select().from(esportsTournaments).where(eq(esportsTournaments.id, tournamentId)).for("update").limit(1);
      if (!tournament || tournament.status !== "upcoming") throw new Error("Tournament is not open for registration.");
      if (tournament.entryFee !== 0) throw new Error("Submit payment and wait for admin verification to join.");
      if (tournament.registeredTeams >= tournament.maxTeams) throw new Error("Tournament is full.");
      const [existing] = await tx.select().from(esportsRegistrations).where(
        and(eq(esportsRegistrations.tournamentId, tournamentId), eq(esportsRegistrations.userId, req.auth!.userId)),
      ).limit(1);
      if (existing) return existing;
      const paymentId = `FREE-${uuid()}`;
      const [created] = await tx.insert(esportsRegistrations).values({
        id: uuid(), tournamentId, userId: req.auth!.userId, paymentId, amount: 0,
      }).returning();
      await tx.update(esportsTournaments).set({ registeredTeams: tournament.registeredTeams + 1 }).where(eq(esportsTournaments.id, tournamentId));
      return created;
    });
    const [user] = await db.select().from(esportsUsers).where(eq(esportsUsers.id, registration.userId)).limit(1);
    if (!user) return bad(res, 404, "Account not found.");
    res.status(201).json({
      id: registration.id, userId: user.id, tournamentId, username: user.username, mobile: user.mobile,
      gameId: user.gameId, gameType: user.gameType, paymentId: registration.paymentId,
      paidAt: registration.paidAt.toISOString(), amount: registration.amount, payout: null,
    });
  } catch (error) {
    return bad(res, 409, error instanceof Error ? error.message : "Unable to join tournament.");
  }
});

router.post("/tournaments/:tournamentId/utr", requireAuth, async (req, res) => {
  const tournamentId = routeParam(req.params.tournamentId);
  const utr = textValue(body(req).utr);
  if (!/^\d{12}$/.test(utr)) return bad(res, 400, "Enter the 12-digit transaction reference.");
  const [tournament] = await db.select().from(esportsTournaments).where(eq(esportsTournaments.id, tournamentId)).limit(1);
  if (!tournament || tournament.status !== "upcoming" || tournament.entryFee <= 0) return bad(res, 404, "Paid tournament not found or no longer open.");
  const [existing] = await db.select().from(esportsPayments).where(and(
    eq(esportsPayments.tournamentId, tournamentId),
    eq(esportsPayments.userId, req.auth!.userId),
    eq(esportsPayments.status, "PENDING"),
  )).limit(1);
  if (existing) return bad(res, 409, "A payment for this tournament is already awaiting verification.");
  const [alreadyRegistered] = await db.select().from(esportsRegistrations).where(and(
    eq(esportsRegistrations.tournamentId, tournamentId),
    eq(esportsRegistrations.userId, req.auth!.userId),
  )).limit(1);
  if (alreadyRegistered) return bad(res, 409, "You are already registered for this tournament.");
  try {
    const [created] = await db.insert(esportsPayments).values({
      id: uuid(), tournamentId, userId: req.auth!.userId, status: "PENDING",
      paymentId: `PAY-${uuid()}`, utr, amount: tournament.entryFee,
    }).returning();
    const [player] = await db.select().from(esportsUsers).where(eq(esportsUsers.id, req.auth!.userId)).limit(1);
    res.status(201).json(paymentJson(created, player, tournament.name));
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") return bad(res, 409, "This UTR has already been submitted.");
    throw error;
  }
});

async function listPayments(status: string, userId?: string) {
  const filters = [eq(esportsPayments.status, status)];
  if (userId) filters.push(eq(esportsPayments.userId, userId));
  const rows = await db.select({ payment: esportsPayments, player: esportsUsers, tournament: esportsTournaments })
    .from(esportsPayments)
    .innerJoin(esportsUsers, eq(esportsPayments.userId, esportsUsers.id))
    .innerJoin(esportsTournaments, eq(esportsPayments.tournamentId, esportsTournaments.id))
    .where(and(...filters))
    .orderBy(desc(esportsPayments.submittedAt));
  return rows.map(({ payment, player, tournament }) => paymentJson(payment, player, tournament.name));
}

router.get("/me/payments", requireAuth, async (req, res) => {
  const statuses = ["PENDING", "PAID", "REJECTED"];
  const payments = (await Promise.all(statuses.map((status) => listPayments(status, req.auth!.userId)))).flat();
  res.json({ payments: payments.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)) });
});

router.get("/admin/payments", requireAuth, requireAdmin, async (_req, res) => {
  res.json({ payments: await listPayments("PENDING") });
});

router.post("/admin/payments/:paymentId/approve", requireAuth, requireAdmin, async (req, res) => {
  const paymentId = routeParam(req.params.paymentId);
  try {
    const payment = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(esportsPayments).where(eq(esportsPayments.id, paymentId)).for("update").limit(1);
      if (!row || row.status !== "PENDING") throw new Error("Payment is no longer pending verification.");
      const [tournament] = await tx.select().from(esportsTournaments).where(eq(esportsTournaments.id, row.tournamentId)).for("update").limit(1);
      if (!tournament || tournament.status !== "upcoming") throw new Error("Tournament is no longer open.");
      const [existing] = await tx.select().from(esportsRegistrations).where(
        and(eq(esportsRegistrations.tournamentId, row.tournamentId), eq(esportsRegistrations.userId, row.userId)),
      ).limit(1);
      if (!existing && tournament.registeredTeams >= tournament.maxTeams) throw new Error("Tournament is full.");
      const verifiedAt = new Date();
      const [approved] = await tx.update(esportsPayments).set({ status: "PAID", verifiedAt }).where(eq(esportsPayments.id, row.id)).returning();
      if (!existing) {
        await tx.insert(esportsRegistrations).values({
          id: uuid(), tournamentId: row.tournamentId, userId: row.userId, paymentId: row.paymentId, amount: row.amount,
        });
        await tx.update(esportsTournaments).set({ registeredTeams: tournament.registeredTeams + 1 }).where(eq(esportsTournaments.id, tournament.id));
      }
      return approved;
    });
    const [player] = await db.select().from(esportsUsers).where(eq(esportsUsers.id, payment.userId)).limit(1);
    const [tournament] = await db.select().from(esportsTournaments).where(eq(esportsTournaments.id, payment.tournamentId)).limit(1);
    res.json(paymentJson(payment, player, tournament?.name ?? "Tournament"));
  } catch (error) {
    return bad(res, 409, error instanceof Error ? error.message : "Unable to approve payment.");
  }
});

router.post("/admin/payments/:paymentId/reject", requireAuth, requireAdmin, async (req, res) => {
  const paymentId = routeParam(req.params.paymentId);
  const [payment] = await db.update(esportsPayments)
    .set({ status: "REJECTED", verifiedAt: new Date() })
    .where(and(eq(esportsPayments.id, paymentId), eq(esportsPayments.status, "PENDING")))
    .returning();
  if (!payment) return bad(res, 404, "Payment is no longer pending verification.");
  const [player] = await db.select().from(esportsUsers).where(eq(esportsUsers.id, payment.userId)).limit(1);
  const [tournament] = await db.select().from(esportsTournaments).where(eq(esportsTournaments.id, payment.tournamentId)).limit(1);
  res.json(paymentJson(payment, player, tournament?.name ?? "Tournament"));
});

router.post("/tournaments/:tournamentId/payouts", requireAuth, requireAdmin, async (req, res) => {
  const tournamentId = routeParam(req.params.tournamentId);
  const input = body(req);
  const userId = textValue(input.userId);
  const kills = intValue(input.kills);
  const rank = textValue(input.rank);
  if (!userId || !Number.isInteger(kills) || kills < 0 || kills > 1000 || !["1st", "2nd", "3rd", "Qualifier", "None"].includes(rank)) {
    return bad(res, 400, "Winner details are invalid.");
  }
  try {
    const payout = await db.transaction(async (tx) => {
      const [tournament] = await tx.select().from(esportsTournaments).where(eq(esportsTournaments.id, tournamentId)).for("update").limit(1);
      if (!tournament || tournament.status !== "completed") throw new Error("End the match before crediting winners.");
      const [registration] = await tx.select().from(esportsRegistrations).where(
        and(eq(esportsRegistrations.tournamentId, tournament.id), eq(esportsRegistrations.userId, userId)),
      ).limit(1);
      if (!registration) throw new Error("Only a registered player can receive a tournament payout.");
      const [user] = await tx.select().from(esportsUsers).where(eq(esportsUsers.id, userId)).for("update").limit(1);
      if (!user) throw new Error("Player account not found.");
      const rankPrize = rank === "1st" ? tournament.rank1Prize : rank === "2nd" ? tournament.rank2Prize : rank === "3rd" ? tournament.rank3Prize : 0;
      const killPrize = kills * tournament.perKillPrize;
      const amount = rankPrize + killPrize;
      if (amount <= 0) throw new Error("This winner has no configured prize.");
      const [created] = await tx.insert(esportsPayouts).values({
        id: uuid(), tournamentId: tournament.id, tournamentName: tournament.name,
        userId, username: user.username, amount, kills, killPrize, rank, rankPrize,
      }).onConflictDoNothing().returning();
      if (!created) {
        const [existing] = await tx.select().from(esportsPayouts).where(
          and(eq(esportsPayouts.tournamentId, tournament.id), eq(esportsPayouts.userId, userId)),
        ).limit(1);
        return existing!;
      }
      await tx.update(esportsUsers).set({
        walletBalance: user.walletBalance + amount,
        totalEarned: user.totalEarned + amount,
      }).where(eq(esportsUsers.id, userId));
      return created;
    });
    res.status(201).json(payoutJson(payout));
  } catch (error) {
    return bad(res, 409, error instanceof Error ? error.message : "Unable to credit prize.");
  }
});

router.get("/me/wallet", requireAuth, async (req, res) => {
  const [user] = await db.select().from(esportsUsers).where(eq(esportsUsers.id, req.auth!.userId)).limit(1);
  if (!user) return bad(res, 404, "Account not found.");
  const earnings = await db.select().from(esportsPayouts).where(eq(esportsPayouts.userId, user.id)).orderBy(desc(esportsPayouts.declaredAt));
  res.json({ balance: user.walletBalance, totalEarned: user.totalEarned, earnings: earnings.map(payoutJson) });
});

router.post("/me/withdrawals", requireAuth, async (req, res) => {
  const amount = intValue(body(req).amount);
  const upiId = textValue(body(req).upiId);
  if (!Number.isInteger(amount) || amount <= 0 || upiId.length < 3) return bad(res, 400, "Enter a valid amount and UPI ID.");
  try {
    const withdrawal = await db.transaction(async (tx) => {
      const [user] = await tx.select().from(esportsUsers).where(eq(esportsUsers.id, req.auth!.userId)).for("update").limit(1);
      if (!user || user.walletBalance < amount) throw new Error("Insufficient wallet balance.");
      const [created] = await tx.insert(esportsWithdrawals).values({
        id: uuid(), userId: user.id, username: user.username, mobile: user.mobile, upiId, amount,
      }).returning();
      await tx.update(esportsUsers).set({ walletBalance: user.walletBalance - amount }).where(eq(esportsUsers.id, user.id));
      return created;
    });
    res.status(201).json(withdrawalJson(withdrawal));
  } catch (error) {
    return bad(res, 409, error instanceof Error ? error.message : "Unable to request withdrawal.");
  }
});

router.get("/admin/withdrawals", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db.select().from(esportsWithdrawals).orderBy(desc(esportsWithdrawals.requestedAt));
  res.json({ withdrawals: rows.map(withdrawalJson) });
});

router.post("/admin/withdrawals/:withdrawalId/paid", requireAuth, requireAdmin, async (req, res) => {
  const withdrawalId = routeParam(req.params.withdrawalId);
  const [updated] = await db.update(esportsWithdrawals)
    .set({ status: "PAID", paidAt: new Date() })
    .where(eq(esportsWithdrawals.id, withdrawalId))
    .returning();
  if (!updated) return bad(res, 404, "Withdrawal request not found.");
  res.json(withdrawalJson(updated));
});

router.get("/settings/public", async (_req, res) => {
  const [setting] = await db.select().from(esportsSettings).where(eq(esportsSettings.key, "admin_upi_id")).limit(1);
  res.json({ adminUpiId: setting?.value ?? "" });
});

router.put("/admin/settings", requireAuth, requireAdmin, async (req, res) => {
  const adminUpiId = textValue(body(req).adminUpiId);
  if (adminUpiId.length < 3 || adminUpiId.length > 128 || !/^[^@\s]+@[^@\s]+$/.test(adminUpiId)) {
    return bad(res, 400, "Enter a valid UPI ID.");
  }
  const [setting] = await db.insert(esportsSettings).values({
    key: "admin_upi_id", value: adminUpiId, updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: esportsSettings.key,
    set: { value: adminUpiId, updatedAt: new Date() },
  }).returning();
  res.json({ adminUpiId: setting.value });
});

export default router;
