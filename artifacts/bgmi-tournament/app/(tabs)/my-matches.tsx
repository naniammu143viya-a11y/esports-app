import React from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useTournaments } from '@/context/TournamentContext';
import { GameBadge } from '@/components/GameBadge';
import type { Tournament } from '@/context/TournamentContext';

function RoomDetailsBox({ roomId, password }: { roomId?: string; password?: string }) {
  const c = useColors();
  if (!roomId) {
    return (
      <View style={[styles.roomPending, { backgroundColor: 'rgba(234,179,8,0.1)', borderColor: 'rgba(234,179,8,0.3)' }]}>
        <Ionicons name="time-outline" size={14} color="#EAB308" />
        <Text style={[styles.roomPendingText, { color: '#EAB308' }]}>
          Room details pending — check back soon
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.roomBox, { backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)' }]}>
      <View style={styles.roomRow}>
        <Text style={[styles.roomLabel, { color: c.mutedForeground }]}>ROOM ID</Text>
        <Text style={[styles.roomValue, { color: '#22C55E' }]}>{roomId}</Text>
      </View>
      <View style={[styles.roomDivider, { backgroundColor: 'rgba(34,197,94,0.2)' }]} />
      <View style={styles.roomRow}>
        <Text style={[styles.roomLabel, { color: c.mutedForeground }]}>PASSWORD</Text>
        <Text style={[styles.roomValue, { color: '#22C55E' }]}>{password ?? '—'}</Text>
      </View>
    </View>
  );
}

function MatchCard({ tournament }: { tournament: Tournament }) {
  const c = useColors();
  const statusColor =
    tournament.status === 'ongoing'
      ? '#22C55E'
      : tournament.status === 'upcoming'
      ? '#EAB308'
      : '#6B7280';

  const formattedDate = (() => {
    try {
      const d = new Date(tournament.date);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return tournament.date;
    }
  })();

  const formattedTime = (() => {
    try {
      const [h, m] = tournament.time.split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayH = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayH}:${m} ${ampm}`;
    } catch {
      return tournament.time;
    }
  })();

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.cardTop}>
        <GameBadge game={tournament.game} />
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </View>

      <Text style={[styles.tourneyName, { color: c.foreground }]}>{tournament.name}</Text>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Ionicons name="map-outline" size={12} color={c.mutedForeground} />
          <Text style={[styles.infoText, { color: c.mutedForeground }]}>{tournament.map}</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="calendar-outline" size={12} color={c.mutedForeground} />
          <Text style={[styles.infoText, { color: c.mutedForeground }]}>
            {formattedDate} · {formattedTime}
          </Text>
        </View>
      </View>

      <View style={styles.prizeRow}>
        <View style={styles.prizeItem}>
          <Text style={[styles.prizeLabel, { color: c.mutedForeground }]}>ENTRY</Text>
          <Text style={[styles.prizeVal, { color: c.foreground }]}>
            {tournament.entryFee === 0 ? 'FREE' : `₹${tournament.entryFee}`}
          </Text>
        </View>
        <View style={styles.prizeItem}>
          <Text style={[styles.prizeLabel, { color: c.mutedForeground }]}>PRIZE POOL</Text>
          <Text style={[styles.prizeVal, { color: c.accent }]}>
            ₹{tournament.prizePool.toLocaleString()}
          </Text>
        </View>
      </View>

      <View style={[styles.sectionDivider, { backgroundColor: c.border }]} />

      <Text style={[styles.roomTitle, { color: c.mutedForeground }]}>ROOM DETAILS</Text>
      <RoomDetailsBox roomId={tournament.roomId} password={tournament.password} />
    </View>
  );
}

export default function MyMatchesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tournaments, joinedIds } = useTournaments();

  const joined = tournaments.filter((t) => joinedIds.includes(t.id));
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>My Matches</Text>
        {user && (
          <View style={[styles.idBadge, { backgroundColor: c.muted }]}>
            <MaterialCommunityIcons name="identifier" size={12} color={c.mutedForeground} />
            <Text style={[styles.idText, { color: c.mutedForeground }]}>{user.gameId}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={joined}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <MatchCard tournament={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="controller-off" size={48} color={c.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: c.foreground }]}>No Matches Yet</Text>
            <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
              Join tournaments from the Lobby tab
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  idText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 4 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tourneyName: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  prizeRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 14,
  },
  prizeItem: {},
  prizeLabel: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  prizeVal: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  sectionDivider: {
    height: 1,
    marginBottom: 12,
  },
  roomTitle: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  roomPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  roomPendingText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  roomBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  roomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  roomDivider: {
    height: 1,
    marginVertical: 4,
  },
  roomLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
  },
  roomValue: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
