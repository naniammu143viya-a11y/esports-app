import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import {
  createTournament as apiCreateTournament,
  getTournamentRoom as apiGetTournamentRoom,
  importTournaments as apiImportTournaments,
  joinFreeTournament as apiJoinFreeTournament,
  listTournaments as apiListTournaments,
  updateTournament as apiUpdateTournament,
} from "@workspace/api-client-react";
import type {
  Tournament as ApiTournament,
  TournamentPatch,
} from "@workspace/api-client-react";

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
  roomAccessToken?: string;
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
  updateRoomDetails: (
    id: string,
    roomId: string,
    password: string,
  ) => Promise<void>;
  /** Admin: change the max player slots for a tournament */
  updateTournamentSlots: (id: string, newMax: number) => Promise<void>;
  /** Admin: announce the winner and complete a tournament. */
  completeTournament: (id: string, winnerNote: string) => Promise<void>;
  addTournament: (
    t: Omit<Tournament, "id" | "registeredTeams">,
  ) => Promise<void>;
  getTournamentRoom: (
    id: string,
    roomAccessToken: string,
  ) => Promise<{ roomId?: string; password?: string }>;
  syncError: string | null;
}

const TournamentContext = createContext<TournamentContextType | null>(null);

const TOURNAMENTS_KEY = "@bgmi_tournaments";
const JOINED_KEY = "@bgmi_joined";
const PAYMENTS_KEY = "@bgmi_payments";
const REGISTRATIONS_KEY = "@bgmi_registrations";

const DEFAULT_RANK_PRIZES: RankPrizes = { rank1: 0, rank2: 0, rank3: 0 };
// Remove the original seeded records from devices that already opened an older
// build, while preserving tournaments created by an admin.
const LEGACY_SEED_IDS = new Set(["1", "2", "3", "4", "5", "6", "7"]);

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
  const { user, isLoading: authLoading } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [freeJoins, setFreeJoins] = useState<string[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment>>({});
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [syncError, setSyncError] = useState<string | null>(null);

  const joinedIds: string[] = [...freeJoins, ...Object.keys(payments)];

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    async function loadStoredState() {
      try {
        const [rawT, rawJ, rawP, rawR] = await Promise.all([
          AsyncStorage.getItem(TOURNAMENTS_KEY),
          AsyncStorage.getItem(JOINED_KEY),
          AsyncStorage.getItem(PAYMENTS_KEY),
          AsyncStorage.getItem(REGISTRATIONS_KEY),
        ]);
        const rawRecords: any[] = rawT ? JSON.parse(rawT) : [];
        const parsed: Tournament[] = rawRecords
          .filter((t) => !LEGACY_SEED_IDS.has(String(t.id)))
          .map((t) => ({
            perKillPrize: 0,
            rankPrizes: DEFAULT_RANK_PRIZES,
            ...t,
            status: t.status === "ongoing" ? "live" : t.status,
          }));
        const lifecycle = applyAutomaticLifecycle(parsed);
        const storedFreeJoins: string[] = rawJ ? JSON.parse(rawJ) : [];
        const storedPayments: Record<string, Payment> = rawP
          ? JSON.parse(rawP)
          : {};
        const storedRegistrations: Registration[] = rawR
          ? JSON.parse(rawR)
          : [];

        if (cancelled) return;
        setTournaments(lifecycle.tournaments);
        setFreeJoins(storedFreeJoins);
        setPayments(storedPayments);
        setRegistrations(storedRegistrations);

        try {
          if (user?.isAdmin) {
            for (let offset = 0; offset < lifecycle.tournaments.length; offset += 500) {
              await apiImportTournaments({
                tournaments: lifecycle.tournaments
                  .slice(offset, offset + 500)
                  .map((tournament) => tournament as ApiTournament),
              });
            }
          }

          const { tournaments: remoteTournaments } = await apiListTournaments();
          if (cancelled) return;
          const localById = new Map(
            lifecycle.tournaments.map((tournament) => [tournament.id, tournament]),
          );
          const remoteIds = new Set(remoteTournaments.map((tournament) => tournament.id));
          const merged = remoteTournaments.map((remote) => {
            const local = localById.get(remote.id);
            const combined = { ...local, ...remote } as Tournament;
            if (!user?.isAdmin) {
              combined.roomId = undefined;
              combined.password = undefined;
            }
            return combined;
          });
          merged.push(
            ...lifecycle.tournaments.filter(
              (tournament) => !remoteIds.has(tournament.id),
            ),
          );

          setTournaments(merged);
          setSyncError(null);
          await AsyncStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(merged));
        } catch (error) {
          if (!cancelled) {
            setSyncError(
              error instanceof Error ? error.message : "Tournament sync failed.",
            );
          }
        }

        const serverResponse = user?.username
          ? await fetch(
              `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/payments/joins?username=${encodeURIComponent(user.username)}`,
            )
          : null;
        if (serverResponse?.ok && !cancelled) {
          const payload = (await serverResponse.json()) as {
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
          const mergedPayments = { ...storedPayments, ...serverPayments };
          const serverPaymentIds = new Set(
            serverRegistrations.map((registration) => registration.paymentId),
          );
          const mergedRegistrations = [
            ...storedRegistrations.filter(
              (registration) => !serverPaymentIds.has(registration.paymentId),
            ),
            ...serverRegistrations,
          ];
          setPayments(mergedPayments);
          setRegistrations(mergedRegistrations);
          await Promise.all([
            AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(mergedPayments)),
            AsyncStorage.setItem(
              REGISTRATIONS_KEY,
              JSON.stringify(mergedRegistrations),
            ),
          ]);
        }
      } catch (error) {
        if (!cancelled) {
          setSyncError(
            error instanceof Error ? error.message : "Unable to load saved data.",
          );
        }
      }
    }

    void loadStoredState();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.username, user?.isAdmin]);

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

    const serverJoin = await apiJoinFreeTournament(id, {
      username: player.username,
      mobile: player.mobile,
      gameId: player.gameId,
      gameType: player.gameType,
    });
    const paymentId = serverJoin.paymentId;
    const now = serverJoin.joinedAt;

    const payment: Payment = {
      tournamentId: id,
      status: "FREE",
      paymentId,
      roomAccessToken: serverJoin.roomAccessToken,
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
    const newFreeJoins = freeJoins.includes(id)
      ? freeJoins
      : [...freeJoins, id];
    const updated = tournaments.map((t) =>
      t.id === id
        ? {
            ...t,
            registeredTeams: Math.min(
              serverJoin.registeredTeams,
              t.maxTeams,
            ),
          }
        : t,
    );

    setFreeJoins(newFreeJoins);
    setPayments(newPayments);
    setRegistrations(newRegistrations);
    await Promise.all([
      AsyncStorage.setItem(JOINED_KEY, JSON.stringify(newFreeJoins)),
      AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(newPayments)),
      AsyncStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(newRegistrations)),
      persistTournaments(updated),
    ]);
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
      headers: {
      'Origin': 'https://workspace.replit.dev',
      'Referer': 'https://workspace.replit.dev',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': 'https://workspace.replit.dev',
      'Referer': 'https://workspace.replit.dev',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': 'https://workspace.replit.dev',
      'Referer': 'https://workspace.replit.dev',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': 'https://workspace.replit.dev',
      'Referer': 'https://workspace.replit.dev',
      'X-Requested-With': 'XMLHttpRequest', "Content-Type": "application/json" },
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
      roomAccessToken?: string;
      error?: string;
    };
    if (!response.ok || !payload.paymentId || !payload.roomAccessToken) {
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
      roomAccessToken: payload.roomAccessToken,
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

  async function updateAdminTournament(
    id: string,
    patch: TournamentPatch,
  ): Promise<void> {
    const { tournament } = await apiUpdateTournament(id, patch);
    await persistTournaments(
      tournaments.map((item) =>
        item.id === id ? (tournament as Tournament) : item,
      ),
    );
  }

  async function updateRoomDetails(
    id: string,
    roomId: string,
    password: string,
  ): Promise<void> {
    await updateAdminTournament(id, { roomId, password });
  }

  async function updateTournamentSlots(
    id: string,
    newMax: number,
  ): Promise<void> {
    const current = tournaments.find((tournament) => tournament.id === id);
    if (!current) throw new Error("Tournament not found.");
    await updateAdminTournament(id, {
      maxTeams: Math.max(newMax, current.registeredTeams, 1),
    });
  }

  async function completeTournament(
    id: string,
    winnerNote: string,
  ): Promise<void> {
    const note = winnerNote.trim();
    if (!note) return;
    const completedAt = new Date().toISOString();
    await updateAdminTournament(id, {
      status: "completed",
      winnerNote: note,
      completedAt,
    });
  }

  async function addTournament(
    t: Omit<Tournament, "id" | "registeredTeams">,
  ): Promise<void> {
    const newT: Tournament = {
      ...t,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      registeredTeams: 0,
    };
    const { tournament } = await apiCreateTournament(newT as ApiTournament);
    await persistTournaments([tournament as Tournament, ...tournaments]);
  }

  async function getTournamentRoom(
    id: string,
    roomAccessToken: string,
  ): Promise<{ roomId?: string; password?: string }> {
    return apiGetTournamentRoom(id, { accessToken: roomAccessToken });
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
        getTournamentRoom,
        syncError,
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
