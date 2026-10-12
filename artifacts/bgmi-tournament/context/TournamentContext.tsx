import React, { createContext, useContext, useMemo } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approvePayment as approvePaymentRequest,
  awardTournamentPayout,
  completeTournament as completeTournamentRequest,
  createTournament as createTournamentRequest,
  getGetMyMatchesQueryOptions,
  getGetMyPaymentsQueryOptions,
  getGetMyMatchesQueryKey,
  getGetMyPaymentsQueryKey,
  getGetPendingPaymentsQueryOptions,
  getGetPendingPaymentsQueryKey,
  getGetTournamentRegistrationsQueryKey,
  getGetTournamentRegistrationsQueryOptions,
  getGetTournamentsQueryKey,
  getGetTournamentsQueryOptions,
  getMyMatches as getMyMatchesRequest,
  getMyPayments as getMyPaymentsRequest,
  getPendingPayments as getPendingPaymentsRequest,
  getTournaments as getTournamentsRequest,
  joinTournament as joinTournamentRequest,
  rejectPayment as rejectPaymentRequest,
  submitTournamentUtr,
  updateTournament as updateTournamentRequest,
} from '@workspace/api-client-react';
import type { Payout } from '@workspace/api-client-react';
import { useAuth } from '@/context/AuthContext';

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
  entryFee: number;
  prizePool: number;
  status: TournamentStatus;
  teamSize: number;
  maxTeams: number;
  registeredTeams: number;
  date: string;
  time: string;
  roomId?: string | null;
  password?: string | null;
  perKillPrize: number;
  rankPrizes: RankPrizes;
  completedAt?: string | null;
  winners?: Payout[];
}

export interface Payment {
  id: string;
  tournamentId: string;
  status: 'PENDING' | 'PAID' | 'FREE' | 'REJECTED';
  paymentId: string;
  paidAt: string;
  amount: number;
  utr?: string;
  submittedAt?: string;
  verifiedAt?: string | null;
  player?: PlayerInfo;
  tournamentName?: string;
}

export interface Registration {
  id: string;
  userId: string;
  tournamentId: string;
  username: string;
  mobile: string;
  gameId: string;
  gameType: GameType;
  paymentId: string;
  paidAt: string;
  amount: number;
  payout?: Payout | null;
}

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
  verificationPayments: Payment[];
  refresh: () => Promise<void>;
  joinFreeWithPlayer: (id: string, player: PlayerInfo) => Promise<void>;
  joinTournament: (id: string) => void;
  confirmPayment: (tournamentId: string, amount: number, player: PlayerInfo) => Promise<string>;
  submitPaymentUtr: (tournamentId: string, amount: number, player: PlayerInfo, utr: string) => Promise<string>;
  approvePayment: (paymentId: string) => Promise<void>;
  rejectPayment: (paymentId: string) => Promise<void>;
  getRegistrations: (tournamentId: string) => Registration[];
  updateRoomDetails: (id: string, roomId: string, password: string) => Promise<void>;
  updateTournamentSlots: (id: string, newMax: number) => Promise<void>;
  startTournament: (id: string) => Promise<void>;
  addTournament: (t: Omit<Tournament, 'id' | 'registeredTeams' | 'winners' | 'completedAt'>) => Promise<void>;
  completeTournament: (id: string) => Promise<void>;
  awardWinner: (tournamentId: string, userId: string, kills: number, rank: string) => Promise<Payout>;
}

const TournamentContext = createContext<TournamentContextType | null>(null);
const POLL_MS = 4000;

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tournamentsQuery = useQuery({
    ...getGetTournamentsQueryOptions({
      query: { queryKey: getGetTournamentsQueryKey(), refetchInterval: POLL_MS },
    }),
  });
  const matchesQuery = useQuery({
    ...getGetMyMatchesQueryOptions({
      query: { queryKey: getGetMyMatchesQueryKey(), enabled: !!user, refetchInterval: POLL_MS },
    }),
  });
  const playerPaymentsQuery = useQuery({
    ...getGetMyPaymentsQueryOptions({
      query: { queryKey: getGetMyPaymentsQueryKey(), enabled: !!user, refetchInterval: POLL_MS },
    }),
  });
  const verificationQuery = useQuery({
    ...getGetPendingPaymentsQueryOptions({
      query: { queryKey: getGetPendingPaymentsQueryKey(), enabled: user?.isAdmin === true, refetchInterval: POLL_MS },
    }),
  });
  const tournaments = (tournamentsQuery.data?.tournaments ?? []) as Tournament[];
  const adminRegistrationQueries = useQueries({
    queries: tournaments.map((tournament) =>
      getGetTournamentRegistrationsQueryOptions(tournament.id, {
        query: { queryKey: getGetTournamentRegistrationsQueryKey(tournament.id), enabled: user?.isAdmin === true, refetchInterval: POLL_MS },
      }),
    ),
  });
  const registrations = useMemo(
    () => user?.isAdmin
      ? adminRegistrationQueries.flatMap((query) => (query.data?.registrations ?? []) as Registration[])
      : (matchesQuery.data?.registrations ?? []) as Registration[],
    [user?.isAdmin, adminRegistrationQueries, matchesQuery.data],
  );
  const payments = useMemo(() => {
    const result: Record<string, Payment> = {};
    for (const payment of playerPaymentsQuery.data?.payments ?? []) {
      const current = result[payment.tournamentId];
      if (!current || (payment.submittedAt ?? payment.paidAt) > (current.submittedAt ?? current.paidAt)) {
        result[payment.tournamentId] = payment as Payment;
      }
    }
    return result;
  }, [playerPaymentsQuery.data]);
  const verificationPayments = (verificationQuery.data?.payments ?? []) as Payment[];
  const joinedIds = useMemo(
    () => [...new Set([
      ...registrations.map((registration) => registration.tournamentId),
      ...Object.values(payments)
        .filter((payment) => payment.status === 'PENDING' || payment.status === 'PAID')
        .map((payment) => payment.tournamentId),
    ])],
    [registrations, payments],
  );

  async function refresh() {
    await queryClient.invalidateQueries();
  }

  async function joinFreeWithPlayer(id: string, _player: PlayerInfo) {
    await joinTournamentRequest(id);
    await refresh();
  }

  function joinTournament(id: string) {
    void joinFreeWithPlayer(id, { username: '', mobile: '', gameId: '', gameType: 'BGMI' });
  }

  async function confirmPayment(_tournamentId: string, _amount: number, _player: PlayerInfo): Promise<string> {
    throw new Error('Submit the 12-digit UTR to request payment verification.');
  }

  async function submitUtr(tournamentId: string, _amount: number, _player: PlayerInfo, utr: string) {
    const payment = await submitTournamentUtr(tournamentId, { utr: utr.trim() });
    await refresh();
    return payment.paymentId;
  }

  async function approve(paymentId: string) {
    await approvePaymentRequest(paymentId);
    await refresh();
  }

  async function reject(paymentId: string) {
    await rejectPaymentRequest(paymentId);
    await refresh();
  }

  function getRegistrations(tournamentId: string) {
    return registrations.filter((registration) => registration.tournamentId === tournamentId);
  }

  async function updateRoomDetails(id: string, roomId: string, password: string) {
    await updateTournamentRequest(id, { roomId, password });
    await refresh();
  }

  async function updateTournamentSlots(id: string, newMax: number) {
    await updateTournamentRequest(id, { maxTeams: newMax });
    await refresh();
  }

  async function startMatch(id: string) {
    await updateTournamentRequest(id, { status: 'ongoing' });
    await refresh();
  }

  async function addTournament(tournament: Omit<Tournament, 'id' | 'registeredTeams' | 'winners' | 'completedAt'>) {
    const { status: _status, ...input } = tournament;
    await createTournamentRequest({ ...input, teamSize: input.teamSize as 1 | 2 | 4 });
    await refresh();
  }

  async function completeMatch(id: string) {
    await completeTournamentRequest(id);
    await refresh();
  }

  async function awardWinner(tournamentId: string, userId: string, kills: number, rank: string) {
    const payout = await awardTournamentPayout(tournamentId, { userId, kills, rank: rank as '1st' | '2nd' | '3rd' | 'Qualifier' | 'None' });
    await refresh();
    return payout;
  }

  return (
    <TournamentContext.Provider value={{
      tournaments,
      joinedIds,
      payments,
      registrations,
      verificationPayments,
      refresh,
      joinFreeWithPlayer,
      joinTournament,
      confirmPayment,
      submitPaymentUtr: submitUtr,
      approvePayment: approve,
      rejectPayment: reject,
      getRegistrations,
      updateRoomDetails,
      updateTournamentSlots,
      startTournament: startMatch,
      addTournament,
      completeTournament: completeMatch,
      awardWinner,
    }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournaments() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournaments must be inside TournamentProvider');
  return ctx;
}
