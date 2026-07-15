import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type GameType = 'BGMI' | 'FreeFire';
export type TournamentStatus = 'ongoing' | 'upcoming' | 'completed';

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
  entryFee: number;           // 0 = FREE
  prizePool: number;
  status: TournamentStatus;
  teamSize: number;
  maxTeams: number;
  registeredTeams: number;
  date: string;
  time: string;
  roomId?: string;
  password?: string;
  // ── Prize structure ────────────────────────────────────────────────────────
  perKillPrize: number;       // ₹ per kill
  rankPrizes: RankPrizes;     // rank 1/2/3 prizes
}

export interface Payment {
  tournamentId: string;
  status: 'PAID' | 'FREE';
  paymentId: string;
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
  amount: number;             // 0 for free tournaments
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
  confirmPayment: (tournamentId: string, amount: number, player: PlayerInfo) => Promise<string>;
  getRegistrations: (tournamentId: string) => Registration[];
  updateRoomDetails: (id: string, roomId: string, password: string) => void;
  /** Admin: change the max player slots for a tournament */
  updateTournamentSlots: (id: string, newMax: number) => void;
  addTournament: (t: Omit<Tournament, 'id' | 'registeredTeams'>) => void;
}

const TournamentContext = createContext<TournamentContextType | null>(null);

const TOURNAMENTS_KEY  = '@bgmi_tournaments';
const JOINED_KEY       = '@bgmi_joined';
const PAYMENTS_KEY     = '@bgmi_payments';
const REGISTRATIONS_KEY = '@bgmi_registrations';

const DEFAULT_RANK_PRIZES: RankPrizes = { rank1: 0, rank2: 0, rank3: 0 };

const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: '1', game: 'BGMI', name: 'Battleground Masters', map: 'Erangel',
    entryFee: 50, prizePool: 5000, status: 'ongoing', teamSize: 4,
    maxTeams: 25, registeredTeams: 18, date: '2026-07-14', time: '20:00',
    perKillPrize: 5, rankPrizes: { rank1: 100, rank2: 60, rank3: 30 },
  },
  {
    id: '2', game: 'FreeFire', name: 'Booyah Cup', map: 'Bermuda',
    entryFee: 30, prizePool: 3000, status: 'ongoing', teamSize: 4,
    maxTeams: 20, registeredTeams: 15, date: '2026-07-14', time: '21:00',
    perKillPrize: 3, rankPrizes: { rank1: 75, rank2: 40, rank3: 20 },
  },
  {
    id: '3', game: 'BGMI', name: 'Pro League Season 5', map: 'Miramar',
    entryFee: 100, prizePool: 10000, status: 'upcoming', teamSize: 4,
    maxTeams: 30, registeredTeams: 8, date: '2026-07-16', time: '18:00',
    perKillPrize: 10, rankPrizes: { rank1: 300, rank2: 150, rank3: 75 },
  },
  {
    id: '4', game: 'FreeFire', name: 'Clash Squad Champions', map: 'Purgatory',
    entryFee: 20, prizePool: 2000, status: 'upcoming', teamSize: 4,
    maxTeams: 16, registeredTeams: 3, date: '2026-07-17', time: '19:00',
    perKillPrize: 2, rankPrizes: { rank1: 50, rank2: 25, rank3: 10 },
  },
  {
    id: '5', game: 'BGMI', name: 'Weekend Warriors', map: 'Vikendi',
    entryFee: 75, prizePool: 7500, status: 'upcoming', teamSize: 4,
    maxTeams: 25, registeredTeams: 20, date: '2026-07-18', time: '20:30',
    perKillPrize: 7, rankPrizes: { rank1: 200, rank2: 100, rank3: 50 },
  },
  {
    id: '6', game: 'FreeFire', name: 'Grand Open 2026', map: 'Kalahari',
    entryFee: 0, prizePool: 1000, status: 'completed', teamSize: 4,
    maxTeams: 20, registeredTeams: 20, date: '2026-07-12', time: '18:00',
    roomId: 'GGOP2026', password: 'ffire123',
    perKillPrize: 0, rankPrizes: DEFAULT_RANK_PRIZES,
  },
  {
    id: '7', game: 'BGMI', name: 'Chicken Dinner Classic', map: 'Sanhok',
    entryFee: 0, prizePool: 500, status: 'upcoming', teamSize: 4,
    maxTeams: 20, registeredTeams: 6, date: '2026-07-20', time: '17:00',
    perKillPrize: 0, rankPrizes: DEFAULT_RANK_PRIZES,
  },
];

export function TournamentProvider({ children }: { children: React.ReactNode }) {
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
        // Migrate old tournaments that lack prize fields
        const parsed: Tournament[] = rawT
          ? (JSON.parse(rawT) as any[]).map((t) => ({
              perKillPrize: 0,
              rankPrizes: DEFAULT_RANK_PRIZES,
              ...t,
            }))
          : MOCK_TOURNAMENTS;
        setTournaments(parsed);
        setFreeJoins(rawJ ? JSON.parse(rawJ) : []);
        setPayments(rawP ? JSON.parse(rawP) : {});
        setRegistrations(rawR ? JSON.parse(rawR) : []);
      } catch {
        setTournaments(MOCK_TOURNAMENTS);
      }
    })();
  }, []);

  async function persistTournaments(updated: Tournament[]) {
    setTournaments(updated);
    await AsyncStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(updated));
  }

  // ─── Join free tournament (creates Registration so admin can see players) ──
  async function joinFreeWithPlayer(id: string, player: PlayerInfo): Promise<void> {
    if (joinedIds.includes(id)) return;

    const paymentId = `FREE${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();

    const payment: Payment = {
      tournamentId: id, status: 'FREE', paymentId, paidAt: now, amount: 0,
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
      t.id === id ? { ...t, registeredTeams: Math.min(t.registeredTeams + 1, t.maxTeams) } : t,
    );

    setPayments(newPayments);
    setRegistrations(newRegistrations);
    await Promise.all([
      AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(newPayments)),
      AsyncStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(newRegistrations)),
      persistTournaments(updated),
    ]);
  }

  // ─── Legacy free join (no player info) ────────────────────────────────────
  function joinTournament(id: string) {
    if (joinedIds.includes(id)) return;
    const updated = tournaments.map((t) =>
      t.id === id ? { ...t, registeredTeams: Math.min(t.registeredTeams + 1, t.maxTeams) } : t,
    );
    const newFree = [...freeJoins, id];
    setFreeJoins(newFree);
    persistTournaments(updated);
    AsyncStorage.setItem(JOINED_KEY, JSON.stringify(newFree));
  }

  // ─── Confirm paid payment ─────────────────────────────────────────────────
  async function confirmPayment(tournamentId: string, amount: number, player: PlayerInfo): Promise<string> {
    const paymentId = `PAY${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();

    const payment: Payment = { tournamentId, status: 'PAID', paymentId, paidAt: now, amount };
    const registration: Registration = {
      tournamentId, username: player.username, mobile: player.mobile,
      gameId: player.gameId, gameType: player.gameType, paymentId, paidAt: now, amount,
    };

    const newPayments = { ...payments, [tournamentId]: payment };
    const newRegistrations = [...registrations, registration];
    const updated = tournaments.map((t) =>
      t.id === tournamentId ? { ...t, registeredTeams: Math.min(t.registeredTeams + 1, t.maxTeams) } : t,
    );

    setPayments(newPayments);
    setRegistrations(newRegistrations);
    await Promise.all([
      AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(newPayments)),
      AsyncStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(newRegistrations)),
      persistTournaments(updated),
    ]);
    return paymentId;
  }

  function getRegistrations(tournamentId: string): Registration[] {
    return registrations.filter((r) => r.tournamentId === tournamentId);
  }

  function updateRoomDetails(id: string, roomId: string, password: string) {
    persistTournaments(tournaments.map((t) => (t.id === id ? { ...t, roomId, password } : t)));
  }

  // ─── Admin: update player slot limit ─────────────────────────────────────
  function updateTournamentSlots(id: string, newMax: number) {
    const clamped = Math.max(newMax, 1);
    persistTournaments(tournaments.map((t) => (t.id === id ? { ...t, maxTeams: clamped } : t)));
  }

  function addTournament(t: Omit<Tournament, 'id' | 'registeredTeams'>) {
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
        tournaments, joinedIds, payments, registrations,
        joinFreeWithPlayer, joinTournament, confirmPayment,
        getRegistrations, updateRoomDetails, updateTournamentSlots, addTournament,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournaments() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournaments must be inside TournamentProvider');
  return ctx;
}
