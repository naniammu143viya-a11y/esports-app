import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCurrentUser,
  loginAccount,
  registerAccount,
  setAuthTokenGetter,
  updateCurrentUserProfile,
} from '@workspace/api-client-react';
import type { GameType } from '@/context/TournamentContext';

const SESSION_KEY = '@bgmi_session';
const ACCOUNTS_KEY = '@bgmi_accounts';
const TOKEN_KEY = '@bgmi_auth_token';

export interface User {
  id: string;
  username: string;
  mobile: string;
  gameId: string;
  gameType: GameType;
  isAdmin: boolean;
  upiId?: string | null;
}

interface LegacyAccount {
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
  logout: () => Promise<void>;
}

setAuthTokenGetter(() => AsyncStorage.getItem(TOKEN_KEY));

const AuthContext = createContext<AuthContextType | null>(null);

async function loadLegacyAccounts(): Promise<LegacyAccount[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(ACCOUNTS_KEY)) ?? '[]');
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) {
        // Old local-only sessions (including the former client-side admin
        // session) are never trusted as a sign-in to the database API.
        await AsyncStorage.removeItem(SESSION_KEY);
        if (active) setIsLoading(false);
        return;
      }
      try {
        const currentUser = await getCurrentUser();
        if (active) setUser(currentUser);
      } catch {
        await AsyncStorage.multiRemove([TOKEN_KEY, SESSION_KEY]);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function persistSession(token: string, currentUser: User) {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [SESSION_KEY, JSON.stringify(currentUser)],
    ]);
    setUser(currentUser);
  }

  async function login(username: string, password: string): Promise<void> {
    const normalized = username.trim().toLowerCase();
    await AsyncStorage.removeItem(TOKEN_KEY);
    try {
      const session = await loginAccount({ username: normalized, password });
      await persistSession(session.token, session.user);
      return;
    } catch (error) {
      // Migrate a previous on-device player account on its first successful
      // sign-in. The former admin account is intentionally never migrated.
      const status = (error as { status?: number })?.status;
      if (normalized === 'admin' || status !== 401) throw error;
      const accounts = await loadLegacyAccounts();
      const legacy = accounts.find((account) => account.username.toLowerCase() === normalized);
      if (!legacy || legacy.password !== password) throw error;
      const migrated = await registerAccount({
        username: legacy.username,
        mobile: legacy.mobile,
        gameId: legacy.gameId,
        gameType: legacy.gameType,
        password: legacy.password,
        upiId: legacy.upiId,
      });
      await AsyncStorage.setItem(
        ACCOUNTS_KEY,
        JSON.stringify(accounts.filter((account) => account.username.toLowerCase() !== normalized)),
      );
      await persistSession(migrated.token, migrated.user);
    }
  }

  async function register(data: RegisterData): Promise<void> {
    const session = await registerAccount({
      username: data.username.trim(),
      mobile: data.mobile.trim(),
      gameId: data.gameId.trim(),
      gameType: data.gameType,
      password: data.password,
      upiId: data.upiId?.trim() || null,
    });
    await persistSession(session.token, session.user);
  }

  async function updateProfile(updates: Partial<Pick<User, 'upiId'>>): Promise<void> {
    if (!user || user.isAdmin) return;
    const updated = await updateCurrentUserProfile({ upiId: updates.upiId?.trim() || null });
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    setUser(updated);
  }

  async function logout(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, SESSION_KEY]);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoggedIn: !!user,
      isLoading,
      login,
      register,
      updateProfile,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
