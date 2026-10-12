import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const esportsUsers = pgTable(
  "esports_users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash"),
    mobile: text("mobile").notNull().default(""),
    gameId: text("game_id").notNull().default(""),
    gameType: text("game_type").notNull().default("BGMI"),
    upiId: text("upi_id"),
    isAdmin: boolean("is_admin").notNull().default(false),
    walletBalance: integer("wallet_balance").notNull().default(0),
    totalEarned: integer("total_earned").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("esports_users_username_lower_idx").on(table.username)],
);

export const esportsTournaments = pgTable(
  "esports_tournaments",
  {
    id: text("id").primaryKey(),
    game: text("game").notNull(),
    name: text("name").notNull(),
    map: text("map").notNull(),
    entryFee: integer("entry_fee").notNull().default(0),
    prizePool: integer("prize_pool").notNull().default(0),
    status: text("status").notNull().default("upcoming"),
    teamSize: integer("team_size").notNull(),
    maxTeams: integer("max_teams").notNull(),
    registeredTeams: integer("registered_teams").notNull().default(0),
    date: text("match_date").notNull(),
    time: text("match_time").notNull(),
    roomId: text("room_id"),
    password: text("room_password"),
    perKillPrize: integer("per_kill_prize").notNull().default(0),
    rank1Prize: integer("rank1_prize").notNull().default(0),
    rank2Prize: integer("rank2_prize").notNull().default(0),
    rank3Prize: integer("rank3_prize").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("esports_tournaments_status_date_idx").on(table.status, table.date, table.time)],
);

export const esportsRegistrations = pgTable(
  "esports_registrations",
  {
    id: text("id").primaryKey(),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => esportsTournaments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => esportsUsers.id, { onDelete: "cascade" }),
    paymentId: text("payment_id").notNull(),
    amount: integer("amount").notNull().default(0),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("esports_registration_tournament_user_idx").on(table.tournamentId, table.userId),
    index("esports_registration_user_idx").on(table.userId),
  ],
);

export const esportsPayments = pgTable(
  "esports_payments",
  {
    id: text("id").primaryKey(),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => esportsTournaments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => esportsUsers.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("PENDING"),
    paymentId: text("payment_id").notNull().unique(),
    utr: text("utr").notNull().unique(),
    amount: integer("amount").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (table) => [
    index("esports_payments_status_submitted_idx").on(table.status, table.submittedAt),
    index("esports_payments_user_idx").on(table.userId),
  ],
);

export const esportsPayouts = pgTable(
  "esports_payouts",
  {
    id: text("id").primaryKey(),
    tournamentId: text("tournament_id").notNull(),
    tournamentName: text("tournament_name").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => esportsUsers.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    amount: integer("amount").notNull(),
    kills: integer("kills").notNull().default(0),
    killPrize: integer("kill_prize").notNull().default(0),
    rank: text("rank").notNull(),
    rankPrize: integer("rank_prize").notNull().default(0),
    declaredAt: timestamp("declared_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("esports_payout_tournament_user_idx").on(table.tournamentId, table.userId),
    index("esports_payout_user_date_idx").on(table.userId, table.declaredAt),
  ],
);

export const esportsSettings = pgTable("esports_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const esportsWithdrawals = pgTable(
  "esports_withdrawals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => esportsUsers.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    mobile: text("mobile").notNull(),
    upiId: text("upi_id").notNull(),
    amount: integer("amount").notNull(),
    status: text("status").notNull().default("PENDING"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (table) => [index("esports_withdrawals_status_date_idx").on(table.status, table.requestedAt)],
);
