import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";

export type AdminLoginUser = {
  id: string;
  username: string;
  passwordHash: string | null;
  mobile: string;
  gameId: string;
  gameType: string;
  isAdmin: boolean;
  upiId: string | null;
};

type AdminLoginDependencies<User extends AdminLoginUser> = {
  findByUsername: (username: string) => Promise<User | undefined>;
  initializeAdmin: (username: string) => Promise<User>;
  getAdminUsername: () => string;
  getAdminPassword: () => string | undefined;
  issueToken: (user: User) => string;
  serializeUser: (user: User) => unknown;
};

const bad = (res: Response, status: number, error: string): void => {
  res.status(status).json({ error });
};

const body = (req: Request) =>
  req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};

const textValue = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function safeTextEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyPasswordHash(password: string, encoded: string): boolean {
  if (password.length > 128) return false;
  const [salt, storedHex] = encoded.split(":");
  if (!salt || !/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(storedHex ?? "")) return false;
  const submitted = scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHex, "hex");
  return submitted.length === stored.length && timingSafeEqual(submitted, stored);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function createAdminLoginHandler<User extends AdminLoginUser>(
  dependencies: AdminLoginDependencies<User>,
): RequestHandler {
  return async (req, res) => {
    const input = body(req);
    const username = textValue(input.username).toLowerCase();
    const password = typeof input.password === "string" ? input.password : "";
    if (!username || !password) return bad(res, 400, "Enter a username and password.");

    const configuredAdminUsername = dependencies.getAdminUsername();
    if (username !== configuredAdminUsername) return bad(res, 401, "Incorrect username or password.");

    const savedAdmin = await dependencies.findByUsername(configuredAdminUsername);
    let passwordMatches = false;
    if (savedAdmin?.passwordHash) {
      passwordMatches = verifyPasswordHash(password, savedAdmin.passwordHash);
    } else {
      const configuredPassword = dependencies.getAdminPassword();
      if (!configuredPassword) return bad(res, 503, "Admin sign-in is not configured.");
      passwordMatches = safeTextEqual(password, configuredPassword);
    }
    if (!passwordMatches) return bad(res, 401, "Incorrect username or password.");

    const admin = await dependencies.initializeAdmin(configuredAdminUsername);
    res.json({ token: dependencies.issueToken(admin), user: dependencies.serializeUser(admin) });
  };
}
