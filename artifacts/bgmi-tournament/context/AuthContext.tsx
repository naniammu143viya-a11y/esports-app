import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameType } from '@/context/TournamentContext';
import { updateAdminPassword } from '@workspace/api-client-react';

// ─── Constants ───────────────────────────────────────────────────────────────
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'Admin@9988';

const SESSION_KEY = '@bgmi_session';
const ACCOUNTS_KEY = '@bgmi_accounts';
const ADMIN_PASSWORD_KEY = '@bgmi_admin_password';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface User {
  username: string;
  mobile: string;
  gameId: string;
  gameType: GameType;
  isAdmin: boolean;
  upiId?: string;
}

interface Account {
  username: string;
  mobile: string;
  gameId: string;
  gameType: GameType;
  password: string;
  upiId?: string;
}

export interface RegisterData {
  username: string;
  mobile: string;
  gameId: string;
  gameType: GameType;
  password: string;
  upiId?: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  updateProfile: (updates: Partial<Pick<User, 'upiId'>>) => Promise<void>;
  changeAdminPassword: (currentPassword: string, newPassword: string) => Promise<void>;
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

  async function login(username: string, password: string): Promise<void> {
    const uname = username.trim().toLowerCase();

    if (uname === ADMIN_USERNAME.toLowerCase()) {
      const storedPassword = await AsyncStorage.getItem(ADMIN_PASSWORD_KEY);
      if (password !== (storedPassword ?? ADMIN_PASSWORD)) {
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

    const accounts = await loadAccounts();
    const account = accounts.find((a) => a.username.trim().toLowerCase() === uname);
    if (!account) throw new Error('Account not found. Please sign up first.');
    if (account.password !== password) throw new Error('Incorrect password.');

    await persistSession({
      username: account.username,
      mobile: account.mobile,
      gameId: account.gameId,
      gameType: account.gameType,
      isAdmin: false,
      upiId: account.upiId,
    });
  }

  async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!user?.isAdmin) throw new Error('Only an admin can change the admin password.');
    if (!currentPassword) throw new Error('Current password is required.');
    if (newPassword.length < 8) throw new Error('New password must be at least 8 characters.');
    if (currentPassword === newPassword) {
      throw new Error('New password must be different from the current password.');
    }

    await updateAdminPassword({ currentPassword, newPassword });
    await AsyncStorage.setItem(ADMIN_PASSWORD_KEY, newPassword);
  }

  async function register(data: RegisterData): Promise<void> {
    const uname = data.username.trim().toLowerCase();

    if (uname === ADMIN_USERNAME.toLowerCase()) {
      throw new Error('This username is reserved. Choose a different one.');
    }

    const accounts = await loadAccounts();
    if (accounts.some((a) => a.username.trim().toLowerCase() === uname)) {
      throw new Error('Username already taken. Try another one.');
    }

    const newAccount: Account = {
      username: data.username.trim(),
      mobile: data.mobile.trim(),
      gameId: data.gameId.trim(),
      gameType: data.gameType,
      password: data.password,
      upiId: data.upiId?.trim() || undefined,
    };

    await saveAccounts([...accounts, newAccount]);

    await persistSession({
      username: newAccount.username,
      mobile: newAccount.mobile,
      gameId: newAccount.gameId,
      gameType: newAccount.gameType,
      isAdmin: false,
      upiId: newAccount.upiId,
    });
  }

  /**
   * Update profile fields (upiId for now).
   * Syncs to both the session and the accounts store.
   */
  async function updateProfile(updates: Partial<Pick<User, 'upiId'>>): Promise<void> {
    if (!user || user.isAdmin) return;

    const updatedUser: User = { ...user, ...updates };

    // Update accounts store
    const accounts = await loadAccounts();
    const updatedAccounts = accounts.map((a) =>
      a.username.toLowerCase() === user.username.toLowerCase()
        ? { ...a, ...updates }
        : a,
    );
    await saveAccounts(updatedAccounts);

    await persistSession(updatedUser);
  }

  async function logout(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isLoading,
        login,
        register,
        updateProfile,
        changeAdminPassword,
        logout,
      }}
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
