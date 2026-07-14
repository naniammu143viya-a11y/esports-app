import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameType } from '@/context/TournamentContext';

// ─── Constants ───────────────────────────────────────────────────────────────
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Admin@9988';

const SESSION_KEY = '@bgmi_session';
const ACCOUNTS_KEY = '@bgmi_accounts';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface User {
  username: string;
  mobile: string;
  gameId: string;
  gameType: GameType;
  isAdmin: boolean;
}

/** Stored account record — includes password (local mock only, never sent anywhere) */
interface Account {
  username: string;
  mobile: string;
  gameId: string;
  gameType: GameType;
  password: string;
}

export interface RegisterData {
  username: string;
  mobile: string;
  gameId: string;
  gameType: GameType;
  password: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function loadAccounts(): Promise<Account[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveAccounts(accounts: Account[]): Promise<void> {
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (raw) setUser(JSON.parse(raw));
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function persistSession(u: User) {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(u));
    setUser(u);
  }

  /**
   * Login — checks admin credentials first, then registered accounts.
   * Throws a string error message on failure.
   */
  async function login(username: string, password: string): Promise<void> {
    const uname = username.trim().toLowerCase();

    // ── Admin path ──────────────────────────────────────────────────────────
    if (uname === ADMIN_USERNAME.toLowerCase()) {
      if (password !== ADMIN_PASSWORD) {
        throw new Error('Incorrect admin password.');
      }
      await persistSession({
        username: ADMIN_USERNAME,
        mobile: '',
        gameId: '',
        gameType: 'BGMI',
        isAdmin: true,
      });
      return;
    }

    // ── Regular user path ───────────────────────────────────────────────────
    const accounts = await loadAccounts();
    const account = accounts.find(
      (a) => a.username.trim().toLowerCase() === uname,
    );

    if (!account) {
      throw new Error('Account not found. Please sign up first.');
    }
    if (account.password !== password) {
      throw new Error('Incorrect password.');
    }

    await persistSession({
      username: account.username,
      mobile: account.mobile,
      gameId: account.gameId,
      gameType: account.gameType,
      isAdmin: false,
    });
  }

  /**
   * Register a new gamer account.
   * Throws a string error message on conflict / validation failures.
   */
  async function register(data: RegisterData): Promise<void> {
    const uname = data.username.trim().toLowerCase();

    // Block the reserved admin username
    if (uname === ADMIN_USERNAME.toLowerCase()) {
      throw new Error('This username is reserved. Choose a different one.');
    }

    const accounts = await loadAccounts();
    const exists = accounts.some(
      (a) => a.username.trim().toLowerCase() === uname,
    );
    if (exists) {
      throw new Error('Username already taken. Try another one.');
    }

    const newAccount: Account = {
      username: data.username.trim(),
      mobile: data.mobile.trim(),
      gameId: data.gameId.trim(),
      gameType: data.gameType,
      password: data.password,
    };

    await saveAccounts([...accounts, newAccount]);

    // Auto-login after successful registration
    await persistSession({
      username: newAccount.username,
      mobile: newAccount.mobile,
      gameId: newAccount.gameId,
      gameType: newAccount.gameType,
      isAdmin: false,
    });
  }

  async function logout(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoggedIn: !!user, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
