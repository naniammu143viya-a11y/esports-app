import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameType } from '@/context/TournamentContext';
import {
  createAdminSession,
  getPlayerProfile,
  loginPlayerAccount,
  migratePlayerAccount,
  registerPlayerAccount,
  setAuthTokenGetter,
  updatePlayerProfile as apiUpdatePlayerProfile,
} from '@workspace/api-client-react';
import type { PlayerSession } from '@workspace/api-client-react';

// ─── Constants ───────────────────────────────────────────────────────────────
const ADMIN_USERNAME = 'admin';

const SESSION_KEY = '@bgmi_session';
const ACCOUNTS_KEY = '@bgmi_accounts';

setAuthTokenGetter(async () => {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as User;
    const token = session.isAdmin ? session.adminToken : session.playerToken;
    const expiresAt = session.isAdmin
      ? session.adminTokenExpiresAt
      : session.playerTokenExpiresAt;
    return token && expiresAt && Date.parse(expiresAt) > Date.now()
      ? token
      : null;
  } catch {
    return null;
  }
});

// ─── Types ────────────────────────────────────────────────────────────────────
export interface User {
  username: string;
  mobile: string;
  gameId: string;
  gameType: GameType;
  isAdmin: boolean;
  upiId?: string;
  adminToken?: string;
  adminTokenExpiresAt?: string;
  playerToken?: string;
  playerTokenExpiresAt?: string;
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

function apiStatus(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null &&
    'status' in error && typeof error.status === 'number'
    ? error.status
    : undefined;
}

function userFromPlayerSession(session: PlayerSession): User {
  return {
    ...session.user,
    isAdmin: false,
    playerToken: session.token,
    playerTokenExpiresAt: session.expiresAt,
  };
}

async function authenticateOrMigrate(
  username: string,
  password: string,
  legacyAccount?: Account,
): Promise<PlayerSession> {
  try {
    return await loginPlayerAccount({ username, password });
  } catch (error) {
    if (apiStatus(error) !== 404) throw error;
    if (!legacyAccount) {
      throw new Error('Account not found. Please sign up first.');
    }
    if (legacyAccount.password !== password) {
      throw new Error('Incorrect password.');
    }

    try {
      return await migratePlayerAccount({
        username: legacyAccount.username,
        mobile: legacyAccount.mobile,
        gameId: legacyAccount.gameId,
        gameType: legacyAccount.gameType,
        password,
        upiId: legacyAccount.upiId,
      });
    } catch (migrationError) {
      if (apiStatus(migrationError) === 409) {
        return loginPlayerAccount({ username, password });
      }
      throw migrationError;
    }
  }
}

async function removeLegacyAccount(username: string): Promise<void> {
  const accounts = await loadAccounts();
  await saveAccounts(
    accounts.filter((account) => account.username.trim().toLowerCase() !== username.trim().toLowerCase()),
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (raw) {
          const session = JSON.parse(raw) as User;
          const adminSessionIsValid =
            session.isAdmin &&
            !!session.adminToken &&
            !!session.adminTokenExpiresAt &&
            Date.parse(session.adminTokenExpiresAt) > Date.now();
          const playerSessionIsValid =
            !session.isAdmin &&
            !!session.playerToken &&
            !!session.playerTokenExpiresAt &&
            Date.parse(session.playerTokenExpiresAt) > Date.now();

          if (adminSessionIsValid || playerSessionIsValid) {
            if (playerSessionIsValid) {
              try {
                const profile = await getPlayerProfile();
                const verifiedSession = { ...session, ...profile };
                await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(verifiedSession));
                setUser(verifiedSession);
              } catch (error) {
                if (apiStatus(error) === 401) {
                  await AsyncStorage.removeItem(SESSION_KEY);
                } else {
                  setUser(session);
                }
              }
            } else {
              setUser(session);
            }
          } else if (session.isAdmin) {
            await AsyncStorage.removeItem(SESSION_KEY);
          } else {
            const accounts = await loadAccounts();
            const legacyAccount = accounts.find(
              (account) =>
                account.username.trim().toLowerCase() === session.username.trim().toLowerCase(),
            );
            if (!legacyAccount) {
              await AsyncStorage.removeItem(SESSION_KEY);
            } else {
              const playerSession = await authenticateOrMigrate(
                legacyAccount.username,
                legacyAccount.password,
                legacyAccount,
              );
              const migratedUser = userFromPlayerSession(playerSession);
              await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(migratedUser));
              await removeLegacyAccount(migratedUser.username);
              setUser(migratedUser);
            }
          }
        }
      } catch {
        // Keep the legacy account data so a failed network migration can retry.
        await AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);
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
      const adminSession = await createAdminSession({ password });
      await persistSession({
        username: ADMIN_USERNAME,
        mobile: '',
        gameId: '',
        gameType: 'BGMI',
        isAdmin: true,
        adminToken: adminSession.token,
        adminTokenExpiresAt: adminSession.expiresAt,
      });
      return;
    }

    const accounts = await loadAccounts();
    const account = accounts.find((a) => a.username.trim().toLowerCase() === uname);
    const playerSession = await authenticateOrMigrate(username.trim(), password, account);
    const playerUser = userFromPlayerSession(playerSession);
    await removeLegacyAccount(playerUser.username);
    await persistSession(playerUser);
  }

  async function register(data: RegisterData): Promise<void> {
    const uname = data.username.trim().toLowerCase();

    if (uname === ADMIN_USERNAME.toLowerCase()) {
      throw new Error('This username is reserved. Choose a different one.');
    }

    const playerSession = await registerPlayerAccount({
      username: data.username.trim(),
      mobile: data.mobile.trim(),
      gameId: data.gameId.trim(),
      gameType: data.gameType,
      password: data.password,
      upiId: data.upiId?.trim() || undefined,
    });
    await persistSession(userFromPlayerSession(playerSession));
  }

  /**
   * Update profile fields (upiId for now).
   * Syncs to both the session and the accounts store.
   */
  async function updateProfile(updates: Partial<Pick<User, 'upiId'>>): Promise<void> {
    if (!user || user.isAdmin) return;

    const profile = await apiUpdatePlayerProfile({ upiId: updates.upiId ?? '' });
    const updatedUser: User = { ...user, ...profile };
    await removeLegacyAccount(user.username);
    await persistSession(updatedUser);
  }

  async function logout(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoggedIn: !!user, isLoading, login, register, updateProfile, logout }}
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
