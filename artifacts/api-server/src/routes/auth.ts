import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, playerAccounts } from "@workspace/db";
import {
  createPlayerToken,
  isSessionSigningConfigured,
  requestPlayerToken,
  requireAdmin,
  verifyPlayerToken,
} from "../lib/sessionTokens";

const router: IRouter = Router();
const USERNAME_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 200;

type GameType = "BGMI" | "FreeFire";

type AccountDetails = {
  username: string;
  usernameKey: string;
  mobile: string;
  gameId: string;
  gameType: GameType;
  password: string;
  upiId: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function parseAccountDetails(value: unknown): AccountDetails | null {
  if (!isRecord(value)) return null;
  const username = typeof value.username === "string" ? value.username.trim() : "";
  const gameType = value.gameType;
  const password = value.password;
  const upiId =
    typeof value.upiId === "string" && value.upiId.trim()
      ? value.upiId.trim()
      : null;

  if (
    !nonEmptyString(username, USERNAME_MAX_LENGTH) ||
    username.toLowerCase() === "admin" ||
    !nonEmptyString(value.mobile, 10) ||
    !/^\d{10}$/.test(value.mobile) ||
    !nonEmptyString(value.gameId, 100) ||
    (gameType !== "BGMI" && gameType !== "FreeFire") ||
    typeof password !== "string" ||
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH ||
    (value.upiId !== undefined &&
      (typeof value.upiId !== "string" || value.upiId.length > 128))
  ) {
    return null;
  }

  return {
    username,
    usernameKey: username.toLowerCase(),
    mobile: value.mobile,
    gameId: value.gameId.trim(),
    gameType,
    password,
    upiId,
  };
}

function derivePassword(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function hashPassword(password: string): Promise<{
  passwordSalt: string;
  passwordHash: string;
}> {
  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = (await derivePassword(password, passwordSalt)).toString(
    "hex",
  );
  return { passwordSalt, passwordHash };
}

async function passwordMatches(
  password: string,
  passwordSalt: string,
  passwordHash: string,
): Promise<boolean> {
  const expected = Buffer.from(passwordHash, "hex");
  const supplied = await derivePassword(password, passwordSalt);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function publicProfile(account: {
  username: string;
  mobile: string;
  gameId: string;
  gameType: string;
  upiId: string | null;
}) {
  return {
    username: account.username,
    mobile: account.mobile,
    gameId: account.gameId,
    gameType: account.gameType as GameType,
    ...(account.upiId ? { upiId: account.upiId } : {}),
  };
}

function sessionResponse(account: {
  usernameKey: string;
  username: string;
  mobile: string;
  gameId: string;
  gameType: string;
  upiId: string | null;
  sessionVersion: number;
}) {
  const { token, expiresAt } = createPlayerToken(
    account.usernameKey,
    account.sessionVersion,
  );
  return {
    token,
    expiresAt,
    user: publicProfile(account),
  };
}

async function createAccount(
  req: Request,
  res: Response,
  status: 200 | 201,
): Promise<void> {
  if (!isSessionSigningConfigured()) {
    res.status(503).json({ error: "Account session signing is not configured." });
    return;
  }
  const details = parseAccountDetails(req.body);
  if (!details) {
    res.status(400).json({ error: "Valid player account details are required." });
    return;
  }

  try {
    const { passwordHash, passwordSalt } = await hashPassword(details.password);
    const [account] = await db
      .insert(playerAccounts)
      .values({
        usernameKey: details.usernameKey,
        username: details.username,
        mobile: details.mobile,
        gameId: details.gameId,
        gameType: details.gameType,
        upiId: details.upiId,
        passwordHash,
        passwordSalt,
      })
      .onConflictDoNothing({ target: playerAccounts.usernameKey })
      .returning({
        usernameKey: playerAccounts.usernameKey,
        username: playerAccounts.username,
        mobile: playerAccounts.mobile,
        gameId: playerAccounts.gameId,
        gameType: playerAccounts.gameType,
        upiId: playerAccounts.upiId,
        sessionVersion: playerAccounts.sessionVersion,
      });

    if (!account) {
      res.status(409).json({ error: "Username already exists on the server." });
      return;
    }
    res.status(status).json(sessionResponse(account));
  } catch (error) {
    req.log?.error?.(error, "player account creation failed");
    res.status(500).json({ error: "Unable to create player account." });
  }
}

async function authenticatedPlayer(req: Request, res: Response) {
  const token = verifyPlayerToken(requestPlayerToken(req));
  if (!token) {
    res.status(401).json({ error: "A valid player session is required." });
    return null;
  }

  const [account] = await db
    .select({
      usernameKey: playerAccounts.usernameKey,
      username: playerAccounts.username,
      mobile: playerAccounts.mobile,
      gameId: playerAccounts.gameId,
      gameType: playerAccounts.gameType,
      upiId: playerAccounts.upiId,
      sessionVersion: playerAccounts.sessionVersion,
    })
    .from(playerAccounts)
    .where(eq(playerAccounts.usernameKey, token.usernameKey))
    .limit(1);

  if (!account || account.sessionVersion !== token.sessionVersion) {
    res.status(401).json({ error: "Player session expired. Please sign in again." });
    return null;
  }
  return account;
}

router.post("/auth/register", async (req, res) => {
  await createAccount(req, res, 201);
});

router.post("/auth/migrate", async (req, res) => {
  await createAccount(req, res, 200);
});

router.post("/auth/login", async (req, res) => {
  if (!isSessionSigningConfigured()) {
    res.status(503).json({ error: "Account session signing is not configured." });
    return;
  }
  const username =
    typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const password = req.body?.password;
  if (
    !nonEmptyString(username, USERNAME_MAX_LENGTH) ||
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  try {
    const [account] = await db
      .select()
      .from(playerAccounts)
      .where(eq(playerAccounts.usernameKey, username.toLowerCase()))
      .limit(1);
    if (!account) {
      res.status(404).json({ error: "This account has not been migrated yet." });
      return;
    }
    if (
      !(await passwordMatches(
        password,
        account.passwordSalt,
        account.passwordHash,
      ))
    ) {
      res.status(401).json({ error: "Incorrect username or password." });
      return;
    }

    res.json(sessionResponse(account));
  } catch (error) {
    req.log?.error?.(error, "player login failed");
    res.status(500).json({ error: "Unable to sign in." });
  }
});

router.patch("/auth/profile", async (req, res) => {
  if (!isRecord(req.body) || Object.keys(req.body).length !== 1) {
    res.status(400).json({ error: "A valid profile update is required." });
    return;
  }
  if (
    typeof req.body.upiId !== "string" ||
    req.body.upiId.length > 128
  ) {
    res.status(400).json({ error: "A valid UPI ID is required." });
    return;
  }

  try {
    const account = await authenticatedPlayer(req, res);
    if (!account) return;
    const [updated] = await db
      .update(playerAccounts)
      .set({
        upiId: req.body.upiId.trim() || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(playerAccounts.usernameKey, account.usernameKey),
          eq(playerAccounts.sessionVersion, account.sessionVersion),
        ),
      )
      .returning({
        username: playerAccounts.username,
        mobile: playerAccounts.mobile,
        gameId: playerAccounts.gameId,
        gameType: playerAccounts.gameType,
        upiId: playerAccounts.upiId,
      });
    if (!updated) {
      res.status(401).json({ error: "Player session expired. Please sign in again." });
      return;
    }
    res.json(publicProfile(updated));
  } catch (error) {
    req.log?.error?.(error, "player profile update failed");
    res.status(500).json({ error: "Unable to update player profile." });
  }
});

router.get("/auth/profile", async (req, res) => {
  try {
    const account = await authenticatedPlayer(req, res);
    if (!account) return;
    res.json(publicProfile(account));
  } catch (error) {
    req.log?.error?.(error, "player profile lookup failed");
    res.status(500).json({ error: "Unable to load player profile." });
  }
});

router.post("/admin/reset-user-password", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const username =
    typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const newPassword = req.body?.newPassword;
  if (
    !nonEmptyString(username, USERNAME_MAX_LENGTH) ||
    typeof newPassword !== "string" ||
    newPassword.length < PASSWORD_MIN_LENGTH ||
    newPassword.length > PASSWORD_MAX_LENGTH
  ) {
    res.status(400).json({ error: "A username and password of at least 6 characters are required." });
    return;
  }

  try {
    const { passwordHash, passwordSalt } = await hashPassword(newPassword);
    const [updated] = await db
      .update(playerAccounts)
      .set({
        passwordHash,
        passwordSalt,
        sessionVersion: sql`${playerAccounts.sessionVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(playerAccounts.usernameKey, username.toLowerCase()))
      .returning({ usernameKey: playerAccounts.usernameKey });
    if (!updated) {
      res.status(404).json({ error: "Player account not found." });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    req.log?.error?.(error, "admin player password reset failed");
    res.status(500).json({ error: "Unable to reset player password." });
  }
});

export default router;
