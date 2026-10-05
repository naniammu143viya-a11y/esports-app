import { createHmac, timingSafeEqual } from "node:crypto";

const ROOM_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;

type RoomTokenClaims = {
  role: "tournament-room";
  tournamentId: string;
  username: string;
  exp: number;
};

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("Room access signing is not configured.");
  return value;
}

export function createTournamentRoomAccessToken(
  tournamentId: string,
  username: string,
  now = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: "tournament-room",
      tournamentId,
      username,
      exp: now + ROOM_TOKEN_TTL_MS,
    } satisfies RoomTokenClaims),
  ).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyTournamentRoomAccessToken(
  token: string | undefined,
  tournamentId: string,
): string | null {
  if (!token) return null;

  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra !== undefined) return null;

    const expected = createHmac("sha256", secret()).update(payload).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
      return null;

    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<RoomTokenClaims>;
    if (
      claims.role !== "tournament-room" ||
      claims.tournamentId !== tournamentId ||
      typeof claims.username !== "string" ||
      typeof claims.exp !== "number" ||
      claims.exp <= Date.now()
    ) {
      return null;
    }
    return claims.username;
  } catch {
    return null;
  }
}
