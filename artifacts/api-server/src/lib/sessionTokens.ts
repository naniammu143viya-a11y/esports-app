import { createHmac, timingSafeEqual } from "node:crypto";
import { type Request, type Response } from "express";

const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PLAYER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionSecret(): string | null {
  return process.env.SESSION_SECRET || null;
}

function signPayload(payload: string): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function verifyPayload(token: string | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expectedSignature = signPayload(payload);
  if (!expectedSignature) return null;
  const expected = Buffer.from(expectedSignature, "base64url");
  const supplied = Buffer.from(signature, "base64url");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
    return null;

  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return typeof decoded === "object" &&
      decoded !== null &&
      !Array.isArray(decoded)
      ? (decoded as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function bearerToken(req: Request): string | undefined {
  const match = req.header("authorization")?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

export function isSessionSigningConfigured(): boolean {
  return Boolean(sessionSecret());
}

export function createAdminToken(now = Date.now()): {
  token: string;
  expiresAt: string;
} {
  const expiresAtMs = now + ADMIN_SESSION_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({ role: "admin", exp: expiresAtMs }),
  ).toString("base64url");
  const signature = signPayload(payload);
  if (!signature) throw new Error("Admin session signing is not configured.");
  return {
    token: `${payload}.${signature}`,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export function createPlayerToken(
  usernameKey: string,
  sessionVersion: number,
  now = Date.now(),
): { token: string; expiresAt: string } {
  const expiresAtMs = now + PLAYER_SESSION_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({
      role: "player",
      sub: usernameKey,
      ver: sessionVersion,
      exp: expiresAtMs,
    }),
  ).toString("base64url");
  const signature = signPayload(payload);
  if (!signature) throw new Error("Player session signing is not configured.");
  return {
    token: `${payload}.${signature}`,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export function verifyAdminToken(token: string | undefined): boolean {
  const payload = verifyPayload(token);
  return (
    payload?.role === "admin" &&
    typeof payload.exp === "number" &&
    payload.exp > Date.now()
  );
}

export function verifyPlayerToken(
  token: string | undefined,
): { usernameKey: string; sessionVersion: number } | null {
  const payload = verifyPayload(token);
  if (
    payload?.role !== "player" ||
    typeof payload.sub !== "string" ||
    typeof payload.ver !== "number" ||
    !Number.isInteger(payload.ver) ||
    typeof payload.exp !== "number" ||
    payload.exp <= Date.now()
  ) {
    return null;
  }
  return { usernameKey: payload.sub, sessionVersion: payload.ver };
}

export function requestHasAdminToken(req: Request): boolean {
  return verifyAdminToken(bearerToken(req));
}

export function requireAdmin(req: Request, res: Response): boolean {
  if (!requestHasAdminToken(req)) {
    res.status(401).json({ error: "A valid admin session is required." });
    return false;
  }
  return true;
}

export function requestPlayerToken(req: Request): string | undefined {
  return bearerToken(req);
}
