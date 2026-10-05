import {
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const playerAccounts = pgTable("player_accounts", {
  usernameKey: text("username_key").primaryKey(),
  username: text("username").notNull(),
  mobile: text("mobile").notNull(),
  gameId: text("game_id").notNull(),
  gameType: text("game_type").notNull(),
  upiId: text("upi_id"),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PlayerAccount = typeof playerAccounts.$inferSelect;
