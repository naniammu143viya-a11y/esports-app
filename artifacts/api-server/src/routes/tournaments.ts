import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  freeTournamentJoins,
  tournamentPaymentJoins,
  tournamentRecords,
  type StoredTournament,
} from "@workspace/db";
import {
  createTournamentRoomAccessToken,
  verifyTournamentRoomAccessToken,
} from "../lib/tournamentRoomAccess";
import {
  createAdminToken,
  isSessionSigningConfigured,
  requestHasAdminToken,
  requireAdmin,
} from "../lib/sessionTokens";

const router: IRouter = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function isNonNegativeInteger(value: unknown, max = 100_000): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max;
}

function isTournament(value: unknown): value is StoredTournament {
  if (!isRecord(value) || !isRecord(value.rankPrizes)) return false;
  return (
    isNonEmptyString(value.id, 120) &&
    (value.game === "BGMI" || value.game === "FreeFire") &&
    isNonEmptyString(value.name, 160) &&
    isNonEmptyString(value.map, 120) &&
    isNonNegativeInteger(value.entryFee) &&
    isNonNegativeInteger(value.prizePool) &&
    ["live", "upcoming", "completed"].includes(String(value.status)) &&
    isNonNegativeInteger(value.teamSize, 100) &&
    Number(value.teamSize) >= 1 &&
    isNonNegativeInteger(value.maxTeams) &&
    Number(value.maxTeams) >= 1 &&
    isNonNegativeInteger(value.registeredTeams) &&
    isNonEmptyString(value.date, 32) &&
    isNonEmptyString(value.time, 32) &&
    isNonNegativeInteger(value.perKillPrize) &&
    isNonNegativeInteger(value.rankPrizes.rank1) &&
    isNonNegativeInteger(value.rankPrizes.rank2) &&
    isNonNegativeInteger(value.rankPrizes.rank3) &&
    (value.roomId === undefined ||
      (typeof value.roomId === "string" && value.roomId.length <= 200)) &&
    (value.password === undefined ||
      (typeof value.password === "string" && value.password.length <= 200)) &&
    (value.winnerNote === undefined ||
      (typeof value.winnerNote === "string" && value.winnerNote.length <= 1000)) &&
    (value.completedAt === undefined ||
      (typeof value.completedAt === "string" &&
        Number.isFinite(new Date(value.completedAt).getTime())))
  );
}

function passwordMatches(candidate: string, expected: string): boolean {
  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

router.post("/admin/session", (req, res) => {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !isSessionSigningConfigured()) {
    res.status(503).json({ error: "Admin authentication is not configured." });
    return;
  }
  if (typeof req.body?.password !== "string") {
    res.status(400).json({ error: "A password is required." });
    return;
  }
  if (!passwordMatches(req.body.password, expected)) {
    res.status(401).json({ error: "Incorrect admin password." });
    return;
  }

  res.json(createAdminToken());
});

router.get("/tournaments", async (req, res) => {
  try {
    const rows = await db
      .select({ data: tournamentRecords.data })
      .from(tournamentRecords)
      .orderBy(desc(tournamentRecords.createdAt));
    const isAdmin = requestHasAdminToken(req);
    const tournaments = isAdmin
      ? rows.map((row) => row.data)
      : rows.map(({ data }) => {
          const { roomId: _roomId, password: _password, ...publicData } = data;
          return publicData;
        });
    res.json({ tournaments });
  } catch (error) {
    req.log?.error?.(error, "tournament list failed");
    res.status(500).json({ error: "Unable to load tournaments." });
  }
});

router.get("/tournaments/:id/room", async (req, res) => {
  const accessToken =
    typeof req.query.accessToken === "string" ? req.query.accessToken : undefined;
  const username = verifyTournamentRoomAccessToken(accessToken, req.params.id);
  if (!username) {
    res.status(401).json({ error: "A valid player registration token is required." });
    return;
  }

  try {
    const [tournament] = await db
      .select({ data: tournamentRecords.data })
      .from(tournamentRecords)
      .where(eq(tournamentRecords.id, req.params.id))
      .limit(1);
    if (!tournament) {
      res.status(404).json({ error: "Tournament not found." });
      return;
    }

    const [freeJoin] = await db
      .select({ paymentId: freeTournamentJoins.paymentId })
      .from(freeTournamentJoins)
      .where(
        and(
          eq(freeTournamentJoins.tournamentId, req.params.id),
          eq(freeTournamentJoins.username, username),
        ),
      )
      .limit(1);
    const [paidJoin] = await db
      .select({ id: tournamentPaymentJoins.id })
      .from(tournamentPaymentJoins)
      .where(
        and(
          eq(tournamentPaymentJoins.tournamentId, req.params.id),
          eq(tournamentPaymentJoins.username, username),
        ),
      )
      .limit(1);
    if (!freeJoin && !paidJoin) {
      res.status(403).json({ error: "Player is not registered for this tournament." });
      return;
    }

    const { roomId, password } = tournament.data;
    res.json({
      ...(roomId ? { roomId } : {}),
      ...(password ? { password } : {}),
    });
  } catch (error) {
    req.log?.error?.(error, "tournament room lookup failed");
    res.status(500).json({ error: "Unable to load room details." });
  }
});

router.post("/tournaments/:id/free-joins", async (req, res) => {
  const { username, mobile, gameId, gameType } = req.body ?? {};
  if (
    !isNonEmptyString(username, 100) ||
    typeof mobile !== "string" ||
    mobile.length > 32 ||
    typeof gameId !== "string" ||
    gameId.length > 100 ||
    (gameType !== "BGMI" && gameType !== "FreeFire")
  ) {
    res.status(400).json({ error: "Invalid player registration." });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(tournamentRecords)
        .where(eq(tournamentRecords.id, req.params.id))
        .for("update")
        .limit(1);
      if (!row) return { status: 404 as const, error: "Tournament not found." };
      const tournament = row.data;
      if (tournament.entryFee !== 0 || tournament.status === "completed") {
        return { status: 409 as const, error: "This tournament is not accepting free joins." };
      }

      const [existing] = await tx
        .select({
          paymentId: freeTournamentJoins.paymentId,
          joinedAt: freeTournamentJoins.joinedAt,
        })
        .from(freeTournamentJoins)
        .where(
          and(
            eq(freeTournamentJoins.tournamentId, req.params.id),
            eq(freeTournamentJoins.username, username.trim()),
          ),
        )
        .limit(1);
      if (existing) {
        return {
          status: 200 as const,
          paymentId: existing.paymentId,
          joinedAt: existing.joinedAt.toISOString(),
          registeredTeams: tournament.registeredTeams,
        };
      }
      if (tournament.registeredTeams >= tournament.maxTeams) {
        return { status: 409 as const, error: "This tournament is full." };
      }

      const paymentId = `FREE${Date.now().toString(36).toUpperCase()}${randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;
      const [join] = await tx
        .insert(freeTournamentJoins)
        .values({
          paymentId,
          tournamentId: req.params.id,
          username: username.trim(),
          mobile: mobile.trim(),
          gameId: gameId.trim(),
          gameType,
        })
        .returning({ paymentId: freeTournamentJoins.paymentId, joinedAt: freeTournamentJoins.joinedAt });
      const registeredTeams = tournament.registeredTeams + 1;
      await tx
        .update(tournamentRecords)
        .set({
          data: { ...tournament, registeredTeams },
          updatedAt: new Date(),
        })
        .where(eq(tournamentRecords.id, req.params.id));
      return {
        status: 200 as const,
        paymentId: join.paymentId,
        joinedAt: join.joinedAt.toISOString(),
        registeredTeams,
      };
    });

    if ("error" in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(result.status).json({
      paymentId: result.paymentId,
      joinedAt: result.joinedAt,
      registeredTeams: result.registeredTeams,
      roomAccessToken: createTournamentRoomAccessToken(
        req.params.id,
        username.trim(),
      ),
    });
  } catch (error) {
    req.log?.error?.(error, "free tournament registration failed");
    res.status(500).json({ error: "Unable to register for this tournament." });
  }
});

router.post("/admin/tournaments/import", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const tournaments = req.body?.tournaments;
  if (
    !Array.isArray(tournaments) ||
    tournaments.length > 500 ||
    !tournaments.every(isTournament)
  ) {
    res.status(400).json({ error: "A valid tournament list is required." });
    return;
  }
  if (tournaments.length === 0) {
    res.json({ inserted: 0 });
    return;
  }

  try {
    const inserted = await db
      .insert(tournamentRecords)
      .values(
        tournaments.map((tournament) => ({
          id: tournament.id,
          data: tournament,
        })),
      )
      .onConflictDoNothing({ target: tournamentRecords.id })
      .returning({ id: tournamentRecords.id });
    res.json({ inserted: inserted.length });
  } catch (error) {
    req.log?.error?.(error, "local tournament import failed");
    res.status(500).json({ error: "Unable to import tournaments." });
  }
});

router.post("/admin/tournaments", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!isTournament(req.body)) {
    res.status(400).json({ error: "Invalid tournament data." });
    return;
  }

  try {
    const [created] = await db
      .insert(tournamentRecords)
      .values({ id: req.body.id, data: req.body })
      .onConflictDoNothing({ target: tournamentRecords.id })
      .returning({ data: tournamentRecords.data });
    if (!created) {
      res.status(409).json({ error: "A tournament with this ID already exists." });
      return;
    }
    res.status(201).json({ tournament: created.data });
  } catch (error) {
    req.log?.error?.(error, "tournament creation failed");
    res.status(500).json({ error: "Unable to create tournament." });
  }
});

router.patch("/admin/tournaments/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!isRecord(req.body)) {
    res.status(400).json({ error: "Invalid tournament update." });
    return;
  }

  const allowedKeys = new Set([
    "roomId",
    "password",
    "maxTeams",
    "status",
    "winnerNote",
    "completedAt",
  ]);
  const patch = req.body;
  if (
    Object.keys(patch).length === 0 ||
    Object.keys(patch).some((key) => !allowedKeys.has(key)) ||
    (patch.roomId !== undefined &&
      (typeof patch.roomId !== "string" || patch.roomId.length > 200)) ||
    (patch.password !== undefined &&
      (typeof patch.password !== "string" || patch.password.length > 200)) ||
    (patch.maxTeams !== undefined &&
      (!isNonNegativeInteger(patch.maxTeams) || Number(patch.maxTeams) < 1)) ||
    (patch.status !== undefined &&
      !["live", "upcoming", "completed"].includes(String(patch.status))) ||
    (patch.winnerNote !== undefined &&
      (typeof patch.winnerNote !== "string" || patch.winnerNote.length > 1000)) ||
    (patch.completedAt !== undefined &&
      (typeof patch.completedAt !== "string" ||
        !Number.isFinite(new Date(patch.completedAt).getTime())))
  ) {
    res.status(400).json({ error: "Invalid tournament update." });
    return;
  }

  try {
    const [current] = await db
      .select({ data: tournamentRecords.data })
      .from(tournamentRecords)
      .where(eq(tournamentRecords.id, req.params.id))
      .limit(1);
    if (!current) {
      res.status(404).json({ error: "Tournament not found." });
      return;
    }

    const merged: StoredTournament = {
      ...current.data,
      ...patch,
      id: req.params.id,
      maxTeams: Math.max(
        Number(patch.maxTeams ?? current.data.maxTeams),
        current.data.registeredTeams,
      ),
    };
    if (patch.status === "completed" && !merged.winnerNote?.trim()) {
      res.status(400).json({ error: "A winner note is required to complete a tournament." });
      return;
    }
    if (!isTournament(merged)) {
      res.status(400).json({ error: "Invalid tournament update." });
      return;
    }

    const [updated] = await db
      .update(tournamentRecords)
      .set({ data: merged, updatedAt: new Date() })
      .where(eq(tournamentRecords.id, req.params.id))
      .returning({ data: tournamentRecords.data });
    res.json({ tournament: updated.data });
  } catch (error) {
    req.log?.error?.(error, "tournament update failed");
    res.status(500).json({ error: "Unable to update tournament." });
  }
});

export default router;
