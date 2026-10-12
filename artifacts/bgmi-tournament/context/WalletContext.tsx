import React, { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getGetMyWalletQueryOptions,
  getGetMyWalletQueryKey,
  getGetPublicSettingsQueryKey,
  getGetPublicSettingsQueryOptions,
  getGetWithdrawalsQueryKey,
  getGetWithdrawalsQueryOptions,
  markWithdrawalPaid as markWithdrawalPaidRequest,
  requestWithdrawal as requestWithdrawalRequest,
  updateAdminSettings,
} from '@workspace/api-client-react';
import { useAuth } from '@/context/AuthContext';

export interface EarningBreakdown {
  kills: number;
  killPrize: number;
  rank: string;
  rankPrize: number;
}

export interface EarningRecord {
  id: string;
  tournamentId: string;
  tournamentName: string;
  amount: number;
  declaredAt: string;
  breakdown?: EarningBreakdown;
}

export interface WalletData {
  balance: number;
  totalEarned: number;
  earnings: EarningRecord[];
}

export interface WithdrawalRequest {
  id: string;
  username: string;
  mobile: string;
  upiId: string;
  amount: number;
  requestedAt: string;
  status: 'PENDING' | 'PAID';
}

interface WalletContextType {
  wallet: WalletData;
  withdrawalRequests: WithdrawalRequest[];
  adminUpiId: string;
  adminUpiLoaded: boolean;
  setAdminUpiId: (upiId: string) => Promise<void>;
  requestWithdrawal: (amount: number, upiId: string) => Promise<void>;
  markWithdrawalPaid: (requestId: string) => Promise<void>;
  getWalletFor: (username: string) => Promise<WalletData>;
  refreshWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);
const EMPTY_WALLET: WalletData = { balance: 0, totalEarned: 0, earnings: [] };
const POLL_MS = 4000;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const walletQuery = useQuery({
    ...getGetMyWalletQueryOptions({
      query: { queryKey: getGetMyWalletQueryKey(), enabled: !!user, refetchInterval: POLL_MS },
    }),
  });
  const settingsQuery = useQuery({
    ...getGetPublicSettingsQueryOptions({
      query: { queryKey: getGetPublicSettingsQueryKey(), refetchInterval: POLL_MS },
    }),
  });
  const withdrawalsQuery = useQuery({
    ...getGetWithdrawalsQueryOptions({
      query: { queryKey: getGetWithdrawalsQueryKey(), enabled: user?.isAdmin === true, refetchInterval: POLL_MS },
    }),
  });

  const wallet = (walletQuery.data ?? EMPTY_WALLET) as WalletData;
  const withdrawalRequests = (withdrawalsQuery.data?.withdrawals ?? []) as WithdrawalRequest[];
  const adminUpiId = settingsQuery.data?.adminUpiId ?? '';
  const adminUpiLoaded = settingsQuery.isFetched;

  async function setAdminUpiId(upiId: string) {
    await updateAdminSettings({ adminUpiId: upiId.trim() });
    await queryClient.invalidateQueries();
  }

  async function requestWithdrawal(amount: number, upiId: string) {
    await requestWithdrawalRequest({ amount, upiId: upiId.trim() });
    await queryClient.invalidateQueries();
  }

  async function markWithdrawalPaid(requestId: string) {
    await markWithdrawalPaidRequest(requestId);
    await queryClient.invalidateQueries();
  }

  async function getWalletFor(username: string) {
    if (user?.username.toLowerCase() === username.toLowerCase()) return wallet;
    return EMPTY_WALLET;
  }

  async function refreshWallet() {
    await walletQuery.refetch();
    await queryClient.invalidateQueries();
  }

  return (
    <WalletContext.Provider value={{
      wallet,
      withdrawalRequests,
      adminUpiId,
      adminUpiLoaded,
      setAdminUpiId,
      requestWithdrawal,
      markWithdrawalPaid,
      getWalletFor,
      refreshWallet,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be inside WalletProvider');
  return ctx;
}
