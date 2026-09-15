import { promises as fs } from "node:fs";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PASSWORD_STORE_PATH = path.resolve(process.cwd(), "data", "admin-password.json");
const DEFAULT_ADMIN_PASSWORD = "Admin@9988";
const MIN_PASSWORD_LENGTH = 8;

interface PasswordRecord {
  salt: string;
  hash: string;
}

function initialPassword(): string {
  return process.env["ADMIN_INITIAL_PASSWORD"] ?? DEFAULT_ADMIN_PASSWORD;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return derivedKey.toString("hex");
}

async function createPasswordRecord(password: string): Promise<PasswordRecord> {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: await hashPassword(password, salt) };
}

async function readPasswordRecord(): Promise<PasswordRecord> {
  try {
    const raw = await fs.readFile(PASSWORD_STORE_PATH, "utf8");
    const record = JSON.parse(raw) as PasswordRecord;
    if (!record.salt || !record.hash) throw new Error("Invalid admin password record");
    return record;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;

    const record = await createPasswordRecord(initialPassword());
    await fs.mkdir(path.dirname(PASSWORD_STORE_PATH), { recursive: true });
    await fs.writeFile(PASSWORD_STORE_PATH, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    return record;
  }
}

async function writePasswordRecord(record: PasswordRecord): Promise<void> {
  await fs.mkdir(path.dirname(PASSWORD_STORE_PATH), { recursive: true });
  const temporaryPath = `${PASSWORD_STORE_PATH}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  await fs.rename(temporaryPath, PASSWORD_STORE_PATH);
}

async function passwordMatches(password: string, record: PasswordRecord): Promise<boolean> {
  const candidate = Buffer.from(await hashPassword(password, record.salt), "hex");
  const expected = Buffer.from(record.hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export class InvalidAdminPasswordError extends Error {}
export class IncorrectAdminPasswordError extends Error {}

export async function updateAdminPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new InvalidAdminPasswordError(
      `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    );
  }

  if (currentPassword === newPassword) {
    throw new InvalidAdminPasswordError("New password must be different from the current password.");
  }

  const currentRecord = await readPasswordRecord();
  if (!(await passwordMatches(currentPassword, currentRecord))) {
    throw new IncorrectAdminPasswordError("Current admin password is incorrect.");
  }

  await writePasswordRecord(await createPasswordRecord(newPassword));
}