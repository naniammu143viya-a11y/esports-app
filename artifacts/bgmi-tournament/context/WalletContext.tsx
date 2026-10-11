import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface EarningBreakdown {
  kills: number;
  killPrize: number;    // kills * perKillPrize
  rank: string;         // '1st', '2nd', '3rd', 'Qualifier', 'None'
  rankPrize: number;    // from tournament's rankPrizes
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

// ─── Storage keys ─────────────────────────────────────────────────────────────
const WALLETS_KEY     = '@bgmi_wallets';
const WITHDRAWALS_KEY = '@bgmi_withdrawals';
export const ADMIN_UPI_KEY = '@admin_upi_id';

const EMPTY_WALLET: WalletData = { balance: 0, totalEarned: 0, earnings: [] };

// ─── Context type ─────────────────────────────────────────────────────────────
interface WalletContextType {
  wallet: WalletData;
  withdrawalRequests: WithdrawalRequest[];
  adminUpiId: string;
  adminUpiLoaded: boolean;
  setAdminUpiId: (upiId: string) => Promise<void>;
  /** Admin: credit winnings to a player (with optional breakdown) */
  addEarnings: (
    username: string,
    amount: number,
    tournamentId: string,
    tournamentName: string,
    breakdown?: EarningBreakdown,
  ) => Promise<void>;
  requestWithdrawal: (amount: number, upiId: string) => Promise<void>;
  markWithdrawalPaid: (requestId: string) => Promise<void>;
  getWalletFor: (username: string) => Promise<WalletData>;
  refreshWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function loadAllWallets(): Promise<Record<string, WalletData>> {
  try { return JSON.parse((await AsyncStorage.getItem(WALLETS_KEY)) ?? 'null') ?? {}; }
  catch { return {}; }
}
async function saveAllWallets(w: Record<string, WalletData>) {
  await AsyncStorage.setItem(WALLETS_KEY, JSON.stringify(w));
}
async function loadWithdrawals(): Promise<WithdrawalRequest[]> {
  try { return JSON.parse((await AsyncStorage.getItem(WITHDRAWALS_KEY)) ?? 'null') ?? []; }
  catch { return []; }
}
async function saveWithdrawals(r: WithdrawalRequest[]) {
  await AsyncStorage.setItem(WITHDRAWALS_KEY, JSON.stringify(r));
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData>(EMPTY_WALLET);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [adminUpiId, setAdminUpiIdState] = useState('');
  const [adminUpiLoaded, setAdminUpiLoaded] = useState(false);

  useEffect(() => { loadData(); }, [user?.username]);

  async function loadData() {
    const [wallets, requests, storedUpiId] = await Promise.all([
      loadAllWallets(),
      loadWithdrawals(),
      AsyncStorage.getItem(ADMIN_UPI_KEY),
    ]);
    setWallet(user?.username ? (wallets[user.username] ?? EMPTY_WALLET) : EMPTY_WALLET);
    setWithdrawalRequests(requests);
    setAdminUpiIdState(storedUpiId?.trim() ?? '');
    setAdminUpiLoaded(true);
  }

  async function refreshWallet() { await loadData(); }

  async function setAdminUpiId(upiId: string): Promise<void> {
    const normalized = upiId.trim();
    await AsyncStorage.setItem(ADMIN_UPI_KEY, normalized);
    setAdminUpiIdState(normalized);
  }

  async function addEarnings(
    username: string,
    amount: number,
    tournamentId: string,
    tournamentName: string,
    breakdown?: EarningBreakdown,
  ): Promise<void> {
    const wallets = await loadAllWallets();
    const existing = wallets[username] ?? EMPTY_WALLET;
    const record: EarningRecord = {
      id: `WIN${Date.now().toString(36).toUpperCase()}`,
      tournamentId, tournamentName, amount,
      declaredAt: new Date().toISOString(),
      breakdown,
    };
    const updated: WalletData = {
      balance: existing.balance + amount,
      totalEarned: existing.totalEarned + amount,
      earnings: [record, ...existing.earnings],
    };
    wallets[username] = updated;
    await saveAllWallets(wallets);
    if (user?.username === username) setWallet(updated);
  }

  async function requestWithdrawal(amount: number, upiId: string): Promise<void> {
    if (!user) throw new Error('Not logged in');
    if (wallet.balance < amount) throw new Error('Insufficient balance');
    const wallets = await loadAllWallets();
    const current = wallets[user.username] ?? EMPTY_WALLET;
    const updatedWallet: WalletData = { ...current, balance: current.balance - amount };
    wallets[user.username] = updatedWallet;
    await saveAllWallets(wallets);
    setWallet(updatedWallet);
    const request: WithdrawalRequest = {
      id: `WDR${Date.now().toString(36).toUpperCase()}`,
      username: user.username, mobile: user.mobile, upiId, amount,
      requestedAt: new Date().toISOString(), status: 'PENDING',
    };
    const existing = await loadWithdrawals();
    const updated = [request, ...existing];
    await saveWithdrawals(updated);
    setWithdrawalRequests(updated);
  }

  async function markWithdrawalPaid(requestId: string): Promise<void> {
    const existing = await loadWithdrawals();
    const updated = existing.map((r) => r.id === requestId ? { ...r, status: 'PAID' as const } : r);
    await saveWithdrawals(updated);
    setWithdrawalRequests(updated);
  }

  async function getWalletFor(username: string): Promise<WalletData> {
    return (await loadAllWallets())[username] ?? EMPTY_WALLET;
  }

  return (
    <WalletContext.Provider value={{
      wallet, withdrawalRequests, adminUpiId, adminUpiLoaded, setAdminUpiId,
      addEarnings, requestWithdrawal, markWithdrawalPaid,
      getWalletFor, refreshWallet,
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
