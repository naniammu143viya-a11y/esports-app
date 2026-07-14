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

interface TournamentContextType {
  tournaments: Tournament[];
  joinedIds: string[];
  joinTournament: (id: string) => void;
  updateRoomDetails: (id: string, roomId: string, password: string) => void;
  addTournament: (t: Omit<Tournament, 'id' | 'registeredTeams'>) => void;
}

const TournamentContext = createContext<TournamentContextType | null>(null);

const TOURNAMENTS_KEY = '@bgmi_tournaments';
const JOINED_KEY = '@bgmi_joined';

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
  const [joinedIds, setJoinedIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [rawT, rawJ] = await Promise.all([
          AsyncStorage.getItem(TOURNAMENTS_KEY),
          AsyncStorage.getItem(JOINED_KEY),
        ]);
        setTournaments(rawT ? JSON.parse(rawT) : MOCK_TOURNAMENTS);
        setJoinedIds(rawJ ? JSON.parse(rawJ) : []);
      } catch {
        setTournaments(MOCK_TOURNAMENTS);
        setJoinedIds([]);
      }
    })();
  }, []);

  async function persist(updated: Tournament[], joined: string[]) {
    setTournaments(updated);
    setJoinedIds(joined);
    await Promise.all([
      AsyncStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(updated)),
      AsyncStorage.setItem(JOINED_KEY, JSON.stringify(joined)),
    ]);
  }

  function joinTournament(id: string) {
    if (joinedIds.includes(id)) return;
    const updated = tournaments.map((t) =>
      t.id === id ? { ...t, registeredTeams: t.registeredTeams + 1 } : t
    );
    const newJoined = [...joinedIds, id];
    persist(updated, newJoined);
  }

  function updateRoomDetails(id: string, roomId: string, password: string) {
    const updated = tournaments.map((t) =>
      t.id === id ? { ...t, roomId, password } : t
    );
    persist(updated, joinedIds);
  }

  function addTournament(t: Omit<Tournament, 'id' | 'registeredTeams'>) {
    const newT: Tournament = {
      ...t,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      registeredTeams: 0,
    };
    const updated = [newT, ...tournaments];
    persist(updated, joinedIds);
  }

  return (
    <TournamentContext.Provider
      value={{ tournaments, joinedIds, joinTournament, updateRoomDetails, addTournament }}
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
