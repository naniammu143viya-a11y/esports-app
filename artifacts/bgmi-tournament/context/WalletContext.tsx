import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface EarningRecord {
  id: string;
  tournamentId: string;
  tournamentName: string;
  amount: number;
  declaredAt: string;
}

export interface WalletData {
  balance: number;        // current withdrawable amount
  totalEarned: number;    // all-time prize winnings
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

// ─── Storage keys ─────────────────────────────────────────────────────────────
const WALLETS_KEY = '@bgmi_wallets';          // Record<username, WalletData>
const WITHDRAWALS_KEY = '@bgmi_withdrawals';  // WithdrawalRequest[]

const EMPTY_WALLET: WalletData = { balance: 0, totalEarned: 0, earnings: [] };

// ─── Context type ─────────────────────────────────────────────────────────────
interface WalletContextType {
  /** Current logged-in user's wallet */
  wallet: WalletData;
  /** All withdrawal requests (admin sees all; user can filter by username) */
  withdrawalRequests: WithdrawalRequest[];
  /** Admin: credit winnings to a player */
  addEarnings: (
    username: string,
    amount: number,
    tournamentId: string,
    tournamentName: string,
  ) => Promise<void>;
  /** User: submit a withdrawal request */
  requestWithdrawal: (amount: number, upiId: string) => Promise<void>;
  /** Admin: mark a withdrawal request as paid */
  markWithdrawalPaid: (requestId: string) => Promise<void>;
  /** Get wallet for any username (admin use) */
  getWalletFor: (username: string) => Promise<WalletData>;
  /** Reload wallet from storage (call after admin declares winner) */
  refreshWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function loadAllWallets(): Promise<Record<string, WalletData>> {
  try {
    const raw = await AsyncStorage.getItem(WALLETS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveAllWallets(wallets: Record<string, WalletData>): Promise<void> {
  await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
}

async function loadWithdrawals(): Promise<WithdrawalRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(WITHDRAWALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveWithdrawals(requests: WithdrawalRequest[]): Promise<void> {
  await AsyncStorage.setItem(WITHDRAWALS_KEY, JSON.stringify(requests));
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData>(EMPTY_WALLET);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);

  // Load wallet + withdrawal requests on mount / user change
  useEffect(() => {
    loadData();
  }, [user?.username]);

  async function loadData() {
    const [wallets, requests] = await Promise.all([
      loadAllWallets(),
      loadWithdrawals(),
    ]);
    if (user?.username) {
      setWallet(wallets[user.username] ?? EMPTY_WALLET);
    } else {
      setWallet(EMPTY_WALLET);
    }
    setWithdrawalRequests(requests);
  }

  async function refreshWallet() {
    await loadData();
  }

  /**
   * Admin: credit earnings to any player.
   * Updates their wallet balance in the shared wallets store.
   */
  async function addEarnings(
    username: string,
    amount: number,
    tournamentId: string,
    tournamentName: string,
  ): Promise<void> {
    const wallets = await loadAllWallets();
    const existing = wallets[username] ?? EMPTY_WALLET;

    const record: EarningRecord = {
      id: `WIN${Date.now().toString(36).toUpperCase()}`,
      tournamentId,
      tournamentName,
      amount,
      declaredAt: new Date().toISOString(),
    };

    const updated: WalletData = {
      balance: existing.balance + amount,
      totalEarned: existing.totalEarned + amount,
      earnings: [record, ...existing.earnings],
    };

    wallets[username] = updated;
    await saveAllWallets(wallets);

    // If it's the current user, update state immediately
    if (user?.username === username) {
      setWallet(updated);
    }
  }

  /**
   * User: submit a withdrawal request.
   * Deducts the amount from their balance immediately (pending admin confirmation).
   */
  async function requestWithdrawal(amount: number, upiId: string): Promise<void> {
    if (!user) throw new Error('Not logged in');
    if (wallet.balance < amount) throw new Error('Insufficient balance');

    // Deduct balance immediately (optimistic)
    const wallets = await loadAllWallets();
    const current = wallets[user.username] ?? EMPTY_WALLET;
    const updatedWallet: WalletData = {
      ...current,
      balance: current.balance - amount,
    };
    wallets[user.username] = updatedWallet;
    await saveAllWallets(wallets);
    setWallet(updatedWallet);

    // Create withdrawal request
    const request: WithdrawalRequest = {
      id: `WDR${Date.now().toString(36).toUpperCase()}`,
      username: user.username,
      mobile: user.mobile,
      upiId,
      amount,
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
    };

    const existing = await loadWithdrawals();
    const updated = [request, ...existing];
    await saveWithdrawals(updated);
    setWithdrawalRequests(updated);
  }

  /**
   * Admin: mark a withdrawal request as completed.
   */
  async function markWithdrawalPaid(requestId: string): Promise<void> {
    const existing = await loadWithdrawals();
    const updated = existing.map((r) =>
      r.id === requestId ? { ...r, status: 'PAID' as const } : r,
    );
    await saveWithdrawals(updated);
    setWithdrawalRequests(updated);
  }

  async function getWalletFor(username: string): Promise<WalletData> {
    const wallets = await loadAllWallets();
    return wallets[username] ?? EMPTY_WALLET;
  }

  return (
    <WalletContext.Provider
      value={{
        wallet,
        withdrawalRequests,
        addEarnings,
        requestWithdrawal,
        markWithdrawalPaid,
        getWalletFor,
        refreshWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be inside WalletProvider');
  return ctx;
}
