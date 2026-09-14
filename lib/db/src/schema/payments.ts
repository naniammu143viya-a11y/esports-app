import { sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: serial("id").primaryKey(),
    utr: varchar("utr", { length: 32 }).notNull(),
    amount: integer("amount").notNull(),
    source: text("source").notNull().default("bank_webhook"),
    status: text("status").notNull().default("RECEIVED"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    matchedAt: timestamp("matched_at", { withTimezone: true }),
    matchedUsername: text("matched_username"),
    matchedTournamentId: text("matched_tournament_id"),
    reviewNote: text("review_note"),
  },
  (table) => ({
    utrUnique: uniqueIndex("payment_transactions_utr_unique").on(table.utr),
  }),
);

export const paymentVerificationAttempts = pgTable(
  "payment_verification_attempts",
  {
    id: serial("id").primaryKey(),
    utr: varchar("utr", { length: 32 }).notNull(),
    amount: integer("amount").notNull(),
    tournamentId: text("tournament_id").notNull(),
    username: text("username").notNull(),
    mobile: text("mobile").notNull().default(""),
    gameId: text("game_id").notNull().default(""),
    gameType: text("game_type").notNull(),
    status: text("status").notNull(),
    transactionId: integer("transaction_id"),
    paymentId: text("payment_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
  },
);

export const tournamentPaymentJoins = pgTable(
  "tournament_payment_joins",
  {
    id: serial("id").primaryKey(),
    paymentId: text("payment_id").notNull(),
    tournamentId: text("tournament_id").notNull(),
    utr: varchar("utr", { length: 32 }).notNull(),
    username: text("username").notNull(),
    mobile: text("mobile").notNull().default(""),
    gameId: text("game_id").notNull().default(""),
    gameType: text("game_type").notNull(),
    amount: integer("amount").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tournamentUserUnique: uniqueIndex("tournament_payment_join_user_unique").on(
      table.tournamentId,
      table.username,
    ),
    transactionUtrUnique: uniqueIndex("tournament_payment_join_utr_unique").on(
      table.utr,
    ),
  }),
);

export const paymentSchemaHealth = sql`1`;