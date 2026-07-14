import React, { useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useTournaments } from '@/context/TournamentContext';
import { TournamentCard } from '@/components/TournamentCard';
import type { GameType, TournamentStatus } from '@/context/TournamentContext';

type GameFilter = 'All' | GameType;
type StatusFilter = 'All' | TournamentStatus;

const GAME_FILTERS: GameFilter[] = ['All', 'BGMI', 'FreeFire'];
const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'All' },
  { label: 'Live', value: 'ongoing' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Ended', value: 'completed' },
];

export default function LobbyScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { tournaments, joinedIds, joinTournament } = useTournaments();
  const router = useRouter();

  const [gameFilter, setGameFilter] = useState<GameFilter>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = tournaments.filter((t) => {
    if (gameFilter !== 'All' && t.game !== gameFilter) return false;
    if (statusFilter !== 'All' && t.status !== statusFilter) return false;
    return true;
  });

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  function handleRefresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <View>
          <Text style={[styles.headerGreeting, { color: c.mutedForeground }]}>
            Welcome back,
          </Text>
          <Text style={[styles.headerName, { color: c.foreground }]}>
            {user?.username ?? 'Player'}
          </Text>
        </View>
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="log-out-outline" size={22} color={c.mutedForeground} />
        </Pressable>
      </View>

      {/* Game filter tabs */}
      <View style={styles.filterContainer}>
        <View style={[styles.gameFilterRow, { backgroundColor: c.muted }]}>
          {GAME_FILTERS.map((g) => {
            const active = gameFilter === g;
            const activeColor =
              g === 'BGMI' ? '#FF6B00' : g === 'FreeFire' ? '#FF2D78' : c.primary;
            return (
              <Pressable
                key={g}
                onPress={() => setGameFilter(g)}
                style={[
                  styles.gameTab,
                  active && { backgroundColor: activeColor },
                ]}
              >
                <Text style={[styles.gameTabText, { color: active ? '#fff' : c.mutedForeground }]}>
                  {g === 'FreeFire' ? 'Free Fire' : g}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Status filter chips */}
        <View style={styles.statusRow}>
          {STATUS_FILTERS.map((sf) => {
            const active = statusFilter === sf.value;
            return (
              <Pressable
                key={sf.value}
                onPress={() => setStatusFilter(sf.value)}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: active ? 'rgba(255,107,0,0.15)' : 'transparent',
                    borderColor: active ? c.primary : c.border,
                  },
                ]}
              >
                <Text style={[styles.statusChipText, { color: active ? c.primary : c.mutedForeground }]}>
                  {sf.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Tournament list */}
      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TournamentCard
            tournament={item}
            isJoined={joinedIds.includes(item.id)}
            onJoin={joinTournament}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={c.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={44} color={c.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: c.foreground }]}>No Tournaments</Text>
            <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
              No tournaments match your filters
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerGreeting: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  headerName: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  logoutBtn: {
    padding: 4,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  gameFilterRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
  },
  gameTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  gameTabText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 120,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
});
