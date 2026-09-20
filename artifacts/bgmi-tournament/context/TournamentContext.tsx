import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";

export type GameType = "BGMI" | "FreeFire";
export type TournamentStatus = "live" | "upcoming" | "completed";

export const COMPLETED_TOURNAMENT_RETENTION_MS = 60 * 60 * 1000;

export interface RankPrizes {
  rank1: number;
  rank2: number;
  rank3: number;
}

export interface Tournament {
  id: string;
  game: GameType;
  name: string;
  map: string;
  entryFee: number; // 0 = FREE
  prizePool: number;
  status: TournamentStatus;
  teamSize: number;
  maxTeams: number;
  registeredTeams: number;
  date: string;
  time: string;
  roomId?: string;
  password?: string;
  winnerNote?: string;
  completedAt?: string;
  // ── Prize structure ────────────────────────────────────────────────────────
  perKillPrize: number; // ₹ per kill
  rankPrizes: RankPrizes; // rank 1/2/3 prizes
}

export interface Payment {
  tournamentId: string;
  status: "PAID" | "FREE";
  paymentId: string;
  utr?: string;
  paidAt: string;
  amount: number;
}

/** Player registration record (paid OR free join) */
export interface Registration {
  tournamentId: string;
  username: string;
  mobile: string;
  gameId: string;
  gameType: GameType;
  paymentId: string;
  paidAt: string;
  amount: number; // 0 for free tournaments
}

/** Minimal player info required when joining */
export interface PlayerInfo {
  username: string;
  mobile: string;
  gameId: string;
  gameType: GameType;
}

interface TournamentContextType {
  tournaments: Tournament[];
  joinedIds: string[];
  payments: Record<string, Payment>;
  registrations: Registration[];
  /** Join a free (₹0) tournament — creates a Registration for the admin player list */
  joinFreeWithPlayer: (id: string, player: PlayerInfo) => Promise<void>;
  /** Legacy alias (no registration record) */
  joinTournament: (id: string) => void;
  /** Confirm payment for a paid tournament. Returns generated paymentId. */
  confirmPayment: (
    tournamentId: string,
    amount: number,
    utr: string,
    player: PlayerInfo,
  ) => Promise<string>;
  getRegistrations: (tournamentId: string) => Registration[];
  updateRoomDetails: (id: string, roomId: string, password: string) => void;
  /** Admin: change the max player slots for a tournament */
  updateTournamentSlots: (id: string, newMax: number) => void;
  /** Admin: announce the winner and complete a tournament. */
  completeTournament: (id: string, winnerNote: string) => void;
  addTournament: (t: Omit<Tournament, "id" | "registeredTeams">) => void;
}

const TournamentContext = createContext<TournamentContextType | null>(null);

const TOURNAMENTS_KEY = "@bgmi_tournaments";
const JOINED_KEY = "@bgmi_joined";
const PAYMENTS_KEY = "@bgmi_payments";
const REGISTRATIONS_KEY = "@bgmi_registrations";

const DEFAULT_RANK_PRIZES: RankPrizes = { rank1: 0, rank2: 0, rank3: 0 };

const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: "1",
    game: "BGMI",
    name: "Battleground Masters",
    map: "Erangel",
    entryFee: 50,
    prizePool: 5000,
    status: "live",
    teamSize: 4,
    maxTeams: 25,
    registeredTeams: 18,
    date: "2026-07-14",
    time: "20:00",
    perKillPrize: 5,
    rankPrizes: { rank1: 100, rank2: 60, rank3: 30 },
  },
  {
    id: "2",
    game: "FreeFire",
    name: "Booyah Cup",
    map: "Bermuda",
    entryFee: 30,
    prizePool: 3000,
    status: "live",
    teamSize: 4,
    maxTeams: 20,
    registeredTeams: 15,
    date: "2026-07-14",
    time: "21:00",
    perKillPrize: 3,
    rankPrizes: { rank1: 75, rank2: 40, rank3: 20 },
  },
  {
    id: "3",
    game: "BGMI",
    name: "Pro League Season 5",
    map: "Miramar",
    entryFee: 100,
    prizePool: 10000,
    status: "upcoming",
    teamSize: 4,
    maxTeams: 30,
    registeredTeams: 8,
    date: "2026-07-16",
    time: "18:00",
    perKillPrize: 10,
    rankPrizes: { rank1: 300, rank2: 150, rank3: 75 },
  },
  {
    id: "4",
    game: "FreeFire",
    name: "Clash Squad Champions",
    map: "Purgatory",
    entryFee: 20,
    prizePool: 2000,
    status: "upcoming",
    teamSize: 4,
    maxTeams: 16,
    registeredTeams: 3,
    date: "2026-07-17",
    time: "19:00",
    perKillPrize: 2,
    rankPrizes: { rank1: 50, rank2: 25, rank3: 10 },
  },
  {
    id: "5",
    game: "BGMI",
    name: "Weekend Warriors",
    map: "Vikendi",
    entryFee: 75,
    prizePool: 7500,
    status: "upcoming",
    teamSize: 4,
    maxTeams: 25,
    registeredTeams: 20,
    date: "2026-07-18",
    time: "20:30",
    perKillPrize: 7,
    rankPrizes: { rank1: 200, rank2: 100, rank3: 50 },
  },
  {
    id: "6",
    game: "FreeFire",
    name: "Grand Open 2026",
    map: "Kalahari",
    entryFee: 0,
    prizePool: 1000,
    status: "completed",
    teamSize: 4,
    maxTeams: 20,
    registeredTeams: 20,
    date: "2026-07-12",
    time: "18:00",
    roomId: "GGOP2026",
    password: "ffire123",
    perKillPrize: 0,
    rankPrizes: DEFAULT_RANK_PRIZES,
    completedAt: "2026-07-14T22:00:00.000Z",
    winnerNote: "Winner: BGMI-1001",
  },
  {
    id: "7",
    game: "BGMI",
    name: "Chicken Dinner Classic",
    map: "Sanhok",
    entryFee: 0,
    prizePool: 500,
    status: "upcoming",
    teamSize: 4,
    maxTeams: 20,
    registeredTeams: 6,
    date: "2026-07-20",
    time: "17:00",
    perKillPrize: 0,
    rankPrizes: DEFAULT_RANK_PRIZES,
  },
];

/** Parse the scheduled tournament start in the device's local timezone. */
export function getTournamentStartTime(
  tournament: Pick<Tournament, "date" | "time">,
): number | null {
  const timestamp = new Date(
    `${tournament.date}T${tournament.time}:00`,
  ).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Completed tournaments remain visible to users for one hour after completion. */
export function isTournamentHiddenFromPlayers(
  tournament: Tournament,
  now = Date.now(),
): boolean {
  if (tournament.status !== "completed" || !tournament.completedAt)
    return false;
  const completedAt = new Date(tournament.completedAt).getTime();
  return (
    Number.isFinite(completedAt) &&
    now - completedAt >= COMPLETED_TOURNAMENT_RETENTION_MS
  );
}

function applyAutomaticLifecycle(
  tournamentList: Tournament[],
  now = Date.now(),
): {
  tournaments: Tournament[];
  changed: boolean;
} {
  let changed = false;
  const updated = tournamentList.map((tournament) => {
    // Older local data used "ongoing"; normalize it during migration.
    const normalizedStatus =
      (tournament.status as string) === "ongoing" ? "live" : tournament.status;
    const startTime =
      normalizedStatus === "upcoming"
        ? getTournamentStartTime(tournament)
        : null;
    const nextStatus =
      normalizedStatus === "upcoming" && startTime !== null && startTime <= now
        ? "live"
        : normalizedStatus;

    if (nextStatus !== tournament.status) changed = true;
    return nextStatus === tournament.status
      ? tournament
      : { ...tournament, status: nextStatus as TournamentStatus };
  });

  return { tournaments: updated, changed };
}

export function TournamentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [freeJoins, setFreeJoins] = useState<string[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment>>({});
  const [registrations, setRegistrations] = useState<Registration[]>([]);

  const joinedIds: string[] = [...freeJoins, ...Object.keys(payments)];

  useEffect(() => {
    (async () => {
      try {
        const [rawT, rawJ, rawP, rawR] = await Promise.all([
          AsyncStorage.getItem(TOURNAMENTS_KEY),
          AsyncStorage.getItem(JOINED_KEY),
          AsyncStorage.getItem(PAYMENTS_KEY),
          AsyncStorage.getItem(REGISTRATIONS_KEY),
        ]);
        // Migrate old tournaments that lack prize fields or used "ongoing".
        const parsed: Tournament[] = rawT
          ? (JSON.parse(rawT) as any[]).map((t) => ({
              perKillPrize: 0,
              rankPrizes: DEFAULT_RANK_PRIZES,
              ...t,
              status: t.status === "ongoing" ? "live" : t.status,
            }))
          : MOCK_TOURNAMENTS;
        const lifecycle = applyAutomaticLifecycle(parsed);
        setTournaments(lifecycle.tournaments);
        if (lifecycle.changed || !rawT) {
          await AsyncStorage.setItem(
            TOURNAMENTS_KEY,
            JSON.stringify(lifecycle.tournaments),
          );
        }
        setFreeJoins(rawJ ? JSON.parse(rawJ) : []);
        setPayments(rawP ? JSON.parse(rawP) : {});
        setRegistrations(rawR ? JSON.parse(rawR) : []);

        if (user?.username && process.env.EXPO_PUBLIC_DOMAIN) {
          const response = await fetch(
            `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/payments/joins?username=${encodeURIComponent(user.username)}`,
          );
          if (response.ok) {
            const payload = (await response.json()) as {
              joins?: Array<{
                tournamentId: string;
                username: string;
                mobile: string;
                gameId: string;
                gameType: GameType;
                paymentId: string;
                utr: string;
                joinedAt: string;
                amount: number;
              }>;
            };
            const serverPayments: Record<string, Payment> = {};
            const serverRegistrations: Registration[] = [];
            for (const join of payload.joins ?? []) {
              serverPayments[join.tournamentId] = {
                tournamentId: join.tournamentId,
                status: "PAID",
                paymentId: join.paymentId,
                utr: join.utr,
                paidAt: join.joinedAt,
                amount: join.amount,
              };
              serverRegistrations.push({
                tournamentId: join.tournamentId,
                username: join.username,
                mobile: join.mobile,
                gameId: join.gameId,
                gameType: join.gameType,
                paymentId: join.paymentId,
                paidAt: join.joinedAt,
                amount: join.amount,
              });
            }
            setPayments(serverPayments);
            setRegistrations((previous) => [
              ...previous.filter((registration) => registration.amount === 0),
              ...serverRegistrations,
            ]);
          }
        }
      } catch {
        const lifecycle = applyAutomaticLifecycle(MOCK_TOURNAMENTS);
        setTournaments(lifecycle.tournaments);
      }
    })();
  }, [user?.username]);

  // Keep a backgrounded app current when it remains open across a scheduled start.
  useEffect(() => {
    const refreshLifecycle = () => {
      setTournaments((current) => {
        const lifecycle = applyAutomaticLifecycle(current);
        if (lifecycle.changed) {
          void AsyncStorage.setItem(
            TOURNAMENTS_KEY,
            JSON.stringify(lifecycle.tournaments),
          );
        }
        return lifecycle.tournaments;
      });
    };

    const interval = setInterval(refreshLifecycle, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function persistTournaments(updated: Tournament[]) {
    setTournaments(updated);
    await AsyncStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(updated));
  }

  // ─── Join free tournament (creates Registration so admin can see players) ──
  async function joinFreeWithPlayer(
    id: string,
    player: PlayerInfo,
  ): Promise<void> {
    if (joinedIds.includes(id)) return;
    const tournament = tournaments.find((item) => item.id === id);
    if (
      !tournament ||
      tournament.status === "completed" ||
      isTournamentHiddenFromPlayers(tournament)
    )
      return;

    const paymentId = `FREE${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();

    const payment: Payment = {
      tournamentId: id,
      status: "FREE",
      paymentId,
      paidAt: now,
      amount: 0,
    };

    const registration: Registration = {
      tournamentId: id,
      username: player.username,
      mobile: player.mobile,
      gameId: player.gameId,
      gameType: player.gameType,
      paymentId,
      paidAt: now,
      amount: 0,
    };

    const newPayments = { ...payments, [id]: payment };
    const newRegistrations = [...registrations, registration];
    const updated = tournaments.map((t) =>
      t.id === id
        ? { ...t, registeredTeams: Math.min(t.registeredTeams + 1, t.maxTeams) }
        : t,
    );

    setPayments(newPayments);
    setRegistrations(newRegistrations);
    await Promise.all([persistTournaments(updated)]);
  }

  // ─── Legacy free join (no player info) ────────────────────────────────────
  function joinTournament(id: string) {
    if (joinedIds.includes(id)) return;
    const updated = tournaments.map((t) =>
      t.id === id
        ? { ...t, registeredTeams: Math.min(t.registeredTeams + 1, t.maxTeams) }
        : t,
    );
    const newFree = [...freeJoins, id];
    setFreeJoins(newFree);
    persistTournaments(updated);
    AsyncStorage.setItem(JOINED_KEY, JSON.stringify(newFree));
  }

  // ─── Confirm paid payment ─────────────────────────────────────────────────
  async function confirmPayment(
    tournamentId: string,
    amount: number,
    utr: string,
    player: PlayerInfo,
  ): Promise<string> {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) throw new Error("Payment service is not configured.");
    const response = await fetch(`https://${domain}/api/payments/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId,
        amount,
        utr,
        status: tournaments.find((tournament) => tournament.id === tournamentId)
          ?.status,
        date: tournaments.find((tournament) => tournament.id === tournamentId)
          ?.date,
        time: tournaments.find((tournament) => tournament.id === tournamentId)
          ?.time,
        completedAt: tournaments.find(
          (tournament) => tournament.id === tournamentId,
        )?.completedAt,
        ...player,
      }),
    });
    const payload = (await response.json()) as {
      paymentId?: string;
      error?: string;
    };
    if (!response.ok || !payload.paymentId) {
      throw new Error(payload.error ?? "Invalid or Unverified UTR Number");
    }

    const now = new Date().toISOString();
    const payment: Payment = {
      tournamentId,
      status: "PAID",
      paymentId: payload.paymentId,
      utr,
      paidAt: now,
      amount,
    };
    const registration: Registration = {
      tournamentId,
      username: player.username,
      mobile: player.mobile,
      gameId: player.gameId,
      gameType: player.gameType,
      paymentId: payload.paymentId,
      paidAt: now,
      amount,
    };
    const newPayments = { ...payments, [tournamentId]: payment };
    const newRegistrations = [...registrations, registration];
    const updated = tournaments.map((t) =>
      t.id === tournamentId
        ? { ...t, registeredTeams: Math.min(t.registeredTeams + 1, t.maxTeams) }
        : t,
    );
    setPayments(newPayments);
    setRegistrations(newRegistrations);
    await Promise.all([
      AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(newPayments)),
      AsyncStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(newRegistrations)),
      persistTournaments(updated),
    ]);
    return payload.paymentId;
  }

  function getRegistrations(tournamentId: string): Registration[] {
    return registrations.filter((r) => r.tournamentId === tournamentId);
  }

  function updateRoomDetails(id: string, roomId: string, password: string) {
    persistTournaments(
      tournaments.map((t) => (t.id === id ? { ...t, roomId, password } : t)),
    );
  }

  // ─── Admin: update player slot limit ─────────────────────────────────────
  function updateTournamentSlots(id: string, newMax: number) {
    const clamped = Math.max(newMax, 1);
    persistTournaments(
      tournaments.map((t) => (t.id === id ? { ...t, maxTeams: clamped } : t)),
    );
  }

  function completeTournament(id: string, winnerNote: string) {
    const note = winnerNote.trim();
    if (!note) return;
    const completedAt = new Date().toISOString();
    persistTournaments(
      tournaments.map((tournament) =>
        tournament.id === id
          ? {
              ...tournament,
              status: "completed",
              winnerNote: note,
              completedAt,
            }
          : tournament,
      ),
    );
  }

  function addTournament(t: Omit<Tournament, "id" | "registeredTeams">) {
    const newT: Tournament = {
      ...t,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      registeredTeams: 0,
    };
    persistTournaments([newT, ...tournaments]);
  }

  return (
    <TournamentContext.Provider
      value={{
        tournaments,
        joinedIds,
        payments,
        registrations,
        joinFreeWithPlayer,
        joinTournament,
        confirmPayment,
        getRegistrations,
        updateRoomDetails,
        updateTournamentSlots,
        completeTournament,
        addTournament,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournaments() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error("useTournaments must be inside TournamentProvider");
  return ctx;
}
