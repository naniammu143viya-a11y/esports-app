import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type GameType = 'BGMI' | 'FreeFire';
export type TournamentStatus = 'ongoing' | 'upcoming' | 'completed';

export interface Tournament {
  id: string;
  game: GameType;
  name: string;
  map: string;
  entryFee: number;
  prizePool: number;
  status: TournamentStatus;
  teamSize: number;
  maxTeams: number;
  registeredTeams: number;
  date: string;
  time: string;
  roomId?: string;
  password?: string;
}

export interface Payment {
  tournamentId: string;
  status: 'PAID';
  paymentId: string;
  paidAt: string;
  amount: number;
}

interface TournamentContextType {
  tournaments: Tournament[];
  /** All joined tournament IDs (free joins + confirmed payments) */
  joinedIds: string[];
  /** Map of tournamentId → Payment record (only for paid tournaments) */
  payments: Record<string, Payment>;
  /** Join a free (₹0) tournament directly */
  joinTournament: (id: string) => void;
  /**
   * Confirm payment for a paid tournament.
   * Increments registeredTeams, saves payment record.
   * Returns the generated paymentId.
   */
  confirmPayment: (tournamentId: string, amount: number) => Promise<string>;
  updateRoomDetails: (id: string, roomId: string, password: string) => void;
  addTournament: (t: Omit<Tournament, 'id' | 'registeredTeams'>) => void;
}

const TournamentContext = createContext<TournamentContextType | null>(null);

const TOURNAMENTS_KEY = '@bgmi_tournaments';
const JOINED_KEY = '@bgmi_joined';
const PAYMENTS_KEY = '@bgmi_payments';

const MOCK_TOURNAMENTS: Tournament[] = [
  {
    id: '1',
    game: 'BGMI',
    name: 'Battleground Masters',
    map: 'Erangel',
    entryFee: 50,
    prizePool: 5000,
    status: 'ongoing',
    teamSize: 4,
    maxTeams: 25,
    registeredTeams: 18,
    date: '2026-07-14',
    time: '20:00',
  },
  {
    id: '2',
    game: 'FreeFire',
    name: 'Booyah Cup',
    map: 'Bermuda',
    entryFee: 30,
    prizePool: 3000,
    status: 'ongoing',
    teamSize: 4,
    maxTeams: 20,
    registeredTeams: 15,
    date: '2026-07-14',
    time: '21:00',
  },
  {
    id: '3',
    game: 'BGMI',
    name: 'Pro League Season 5',
    map: 'Miramar',
    entryFee: 100,
    prizePool: 10000,
    status: 'upcoming',
    teamSize: 4,
    maxTeams: 30,
    registeredTeams: 8,
    date: '2026-07-16',
    time: '18:00',
  },
  {
    id: '4',
    game: 'FreeFire',
    name: 'Clash Squad Champions',
    map: 'Purgatory',
    entryFee: 20,
    prizePool: 2000,
    status: 'upcoming',
    teamSize: 4,
    maxTeams: 16,
    registeredTeams: 3,
    date: '2026-07-17',
    time: '19:00',
  },
  {
    id: '5',
    game: 'BGMI',
    name: 'Weekend Warriors',
    map: 'Vikendi',
    entryFee: 75,
    prizePool: 7500,
    status: 'upcoming',
    teamSize: 4,
    maxTeams: 25,
    registeredTeams: 20,
    date: '2026-07-18',
    time: '20:30',
  },
  {
    id: '6',
    game: 'FreeFire',
    name: 'Grand Open 2026',
    map: 'Kalahari',
    entryFee: 0,
    prizePool: 1000,
    status: 'completed',
    teamSize: 4,
    maxTeams: 20,
    registeredTeams: 20,
    date: '2026-07-12',
    time: '18:00',
    roomId: 'GGOP2026',
    password: 'ffire123',
  },
  {
    id: '7',
    game: 'BGMI',
    name: 'Chicken Dinner Classic',
    map: 'Sanhok',
    entryFee: 0,
    prizePool: 500,
    status: 'upcoming',
    teamSize: 4,
    maxTeams: 20,
    registeredTeams: 6,
    date: '2026-07-20',
    time: '17:00',
  },
];

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  /** Free-only joined IDs */
  const [freeJoins, setFreeJoins] = useState<string[]>([]);
  /** Confirmed paid tournament records */
  const [payments, setPayments] = useState<Record<string, Payment>>({});

  // Derived: all joined IDs (free + paid)
  const joinedIds: string[] = [
    ...freeJoins,
    ...Object.keys(payments),
  ];

  useEffect(() => {
    (async () => {
      try {
        const [rawT, rawJ, rawP] = await Promise.all([
          AsyncStorage.getItem(TOURNAMENTS_KEY),
          AsyncStorage.getItem(JOINED_KEY),
          AsyncStorage.getItem(PAYMENTS_KEY),
        ]);
        setTournaments(rawT ? JSON.parse(rawT) : MOCK_TOURNAMENTS);
        setFreeJoins(rawJ ? JSON.parse(rawJ) : []);
        setPayments(rawP ? JSON.parse(rawP) : {});
      } catch {
        setTournaments(MOCK_TOURNAMENTS);
      }
    })();
  }, []);

  async function persistTournaments(updated: Tournament[]) {
    setTournaments(updated);
    await AsyncStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(updated));
  }

  // ─── Join free tournament ─────────────────────────────────────────────────
  function joinTournament(id: string) {
    if (joinedIds.includes(id)) return;
    const updated = tournaments.map((t) =>
      t.id === id
        ? { ...t, registeredTeams: Math.min(t.registeredTeams + 1, t.maxTeams) }
        : t
    );
    const newFree = [...freeJoins, id];
    setFreeJoins(newFree);
    persistTournaments(updated);
    AsyncStorage.setItem(JOINED_KEY, JSON.stringify(newFree));
  }

  // ─── Confirm paid payment ─────────────────────────────────────────────────
  async function confirmPayment(tournamentId: string, amount: number): Promise<string> {
    const paymentId = `PAY${Date.now().toString(36).toUpperCase()}`;

    const payment: Payment = {
      tournamentId,
      status: 'PAID',
      paymentId,
      paidAt: new Date().toISOString(),
      amount,
    };

    const newPayments = { ...payments, [tournamentId]: payment };

    // Increment registered teams, cap at maxTeams
    const updated = tournaments.map((t) =>
      t.id === tournamentId
        ? { ...t, registeredTeams: Math.min(t.registeredTeams + 1, t.maxTeams) }
        : t
    );

    setPayments(newPayments);
    await Promise.all([
      AsyncStorage.setItem(PAYMENTS_KEY, JSON.stringify(newPayments)),
      persistTournaments(updated),
    ]);

    return paymentId;
  }

  // ─── Admin: set room details ──────────────────────────────────────────────
  function updateRoomDetails(id: string, roomId: string, password: string) {
    const updated = tournaments.map((t) =>
      t.id === id ? { ...t, roomId, password } : t
    );
    persistTournaments(updated);
  }

  // ─── Admin: add tournament ────────────────────────────────────────────────
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
        tournaments,
        joinedIds,
        payments,
        joinTournament,
        confirmPayment,
        updateRoomDetails,
        addTournament,
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
