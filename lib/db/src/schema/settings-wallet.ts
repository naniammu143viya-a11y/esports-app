import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type EarningBreakdown = {
  kills: number;
  killPrize: number;
  rank: string;
  rankPrize: number;
};

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const walletEarnings = pgTable(
  "wallet_earnings",
  {
    id: text("id").primaryKey(),
    usernameKey: text("username_key").notNull(),
    username: text("username").notNull(),
    tournamentId: text("tournament_id").notNull(),
    tournamentName: text("tournament_name").notNull(),
    amount: integer("amount").notNull(),
    breakdown: jsonb("breakdown").$type<EarningBreakdown | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tournamentUserUnique: uniqueIndex(
      "wallet_earnings_tournament_user_unique",
    ).on(table.tournamentId, table.usernameKey),
  }),
);

export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: text("id").primaryKey(),
  usernameKey: text("username_key").notNull(),
  username: text("username").notNull(),
  mobile: text("mobile").notNull(),
  upiId: text("upi_id").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("PENDING"),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});
