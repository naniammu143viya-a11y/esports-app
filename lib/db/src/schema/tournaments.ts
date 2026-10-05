import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type StoredTournament = {
  id: string;
  game: "BGMI" | "FreeFire";
  name: string;
  map: string;
  entryFee: number;
  prizePool: number;
  status: "live" | "upcoming" | "completed";
  teamSize: number;
  maxTeams: number;
  registeredTeams: number;
  date: string;
  time: string;
  roomId?: string;
  password?: string;
  winnerNote?: string;
  completedAt?: string;
  perKillPrize: number;
  rankPrizes: { rank1: number; rank2: number; rank3: number };
};

export const tournamentRecords = pgTable("tournament_records", {
  id: text("id").primaryKey(),
  data: jsonb("data").$type<StoredTournament>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const freeTournamentJoins = pgTable(
  "free_tournament_joins",
  {
    paymentId: text("payment_id").primaryKey(),
    tournamentId: text("tournament_id").notNull(),
    username: text("username").notNull(),
    mobile: text("mobile").notNull().default(""),
    gameId: text("game_id").notNull().default(""),
    gameType: text("game_type").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tournamentUserUnique: uniqueIndex("free_tournament_join_user_unique").on(
      table.tournamentId,
      table.username,
    ),
  }),
);
