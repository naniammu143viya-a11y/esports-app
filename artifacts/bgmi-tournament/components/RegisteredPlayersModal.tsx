import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useWallet } from '@/context/WalletContext';
import type { EarningBreakdown } from '@/context/WalletContext';
import type { Registration, Tournament } from '@/context/TournamentContext';

// ─── Rank options ─────────────────────────────────────────────────────────────
type RankKey = '1st' | '2nd' | '3rd' | 'Qualifier' | 'None';

const RANK_LABELS: { key: RankKey; label: string }[] = [
  { key: '1st', label: '🥇 1st' },
  { key: '2nd', label: '🥈 2nd' },
  { key: '3rd', label: '🥉 3rd' },
  { key: 'Qualifier', label: '✅ Qualifier' },
  { key: 'None', label: '❌ None' },
];

function rankPrizeFor(rank: RankKey, rankPrizes: Tournament['rankPrizes']): number {
  if (rank === '1st') return rankPrizes.rank1;
  if (rank === '2nd') return rankPrizes.rank2;
  if (rank === '3rd') return rankPrizes.rank3;
  return 0;
}

// ─── Player Row ───────────────────────────────────────────────────────────────
function PlayerRow({
  reg,
  canDeclare,
  tournament,
  alreadyDeclared,
  onDeclare,
}: {
  reg: Registration;
  canDeclare: boolean;
  tournament: Tournament;
  alreadyDeclared: boolean;
  onDeclare: (reg: Registration, amount: number, breakdown: EarningBreakdown) => Promise<void>;
}) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  const [killsStr, setKillsStr] = useState('0');
  const [rank, setRank] = useState<RankKey>('None');
  const [declaring, setDeclaring] = useState(false);

  const kills = parseInt(killsStr, 10) || 0;
  const killPrize = kills * (tournament.perKillPrize ?? 0);
  const rankPrize = rankPrizeFor(rank, tournament.rankPrizes ?? { rank1: 0, rank2: 0, rank3: 0 });
  const total = killPrize + rankPrize;

  async function handleDeclare() {
    if (total <= 0) {
      Alert.alert('No Prize', 'Total prize is ₹0. Please enter kills or select a rank.');
      return;
    }
    setDeclaring(true);
    try {
      const breakdown: EarningBreakdown = { kills, killPrize, rank, rankPrize };
      await onDeclare(reg, total, breakdown);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExpanded(false);
    } finally {
      setDeclaring(false);
    }
  }

  const gameColor = reg.gameType === 'BGMI' ? '#FF6B00' : '#FF2D78';

  return (
    <View style={[styles.playerCard, { backgroundColor: c.card, borderColor: alreadyDeclared ? 'rgba(234,179,8,0.4)' : c.border }]}>
      {alreadyDeclared && (
        <View style={styles.winnerBanner}>
          <Ionicons name="trophy" size={13} color="#EAB308" />
          <Text style={styles.winnerBannerText}>Winner declared</Text>
        </View>
      )}

      <View style={styles.playerRow}>
        <View style={[styles.avatar, { backgroundColor: reg.gameType === 'BGMI' ? 'rgba(255,107,0,0.15)' : 'rgba(255,45,120,0.15)' }]}>
          <MaterialCommunityIcons name="account-circle" size={26} color={gameColor} />
        </View>

        <View style={styles.playerInfo}>
          <Text style={[styles.playerName, { color: c.foreground }]}>{reg.username}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="call-outline" size={11} color={c.mutedForeground} />
            <Text style={[styles.metaText, { color: c.mutedForeground }]}>{reg.mobile}</Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="identifier" size={11} color={c.mutedForeground} />
            <Text style={[styles.metaText, { color: c.mutedForeground }]}>{reg.gameId}</Text>
          </View>
          {reg.amount > 0 && (
            <View style={styles.metaRow}>
              <Ionicons name="card-outline" size={11} color={c.mutedForeground} />
              <Text style={[styles.metaText, { color: c.mutedForeground }]}>Paid ₹{reg.amount}</Text>
            </View>
          )}
          {reg.amount === 0 && (
            <View style={[styles.freeBadge]}>
              <Text style={styles.freeBadgeText}>FREE</Text>
            </View>
          )}
        </View>

        <View style={styles.playerRight}>
          <View style={[styles.gamePill, { backgroundColor: reg.gameType === 'BGMI' ? 'rgba(255,107,0,0.12)' : 'rgba(255,45,120,0.12)' }]}>
            <Text style={[styles.gamePillText, { color: gameColor }]}>
              {reg.gameType === 'FreeFire' ? 'FF' : 'BGMI'}
            </Text>
          </View>
          {canDeclare && !alreadyDeclared && (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              style={({ pressed }) => [
                styles.declareBtn,
                { backgroundColor: expanded ? c.muted : 'rgba(234,179,8,0.15)', opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name={expanded ? 'close' : 'trophy-outline'} size={13} color={expanded ? c.mutedForeground : '#EAB308'} />
              <Text style={[styles.declareBtnText, { color: expanded ? c.mutedForeground : '#EAB308' }]}>
                {expanded ? 'Cancel' : 'Declare'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Expanded Prize Declaration Panel ─────────────────────────────── */}
      {expanded && (
        <View style={[styles.declareBox, { borderTopColor: c.border }]}>
          <Text style={[styles.declareFor, { color: c.mutedForeground }]}>
            Declaring prize for{' '}
            <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{reg.username}</Text>
          </Text>

          {/* Kill count */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldLeft}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>KILLS</Text>
              <View style={[styles.killWrap, { backgroundColor: c.input, borderColor: c.border }]}>
                <Pressable
                  onPress={() => setKillsStr((v) => String(Math.max(0, (parseInt(v, 10) || 0) - 1)))}
                  style={[styles.killStep, { backgroundColor: c.muted }]}
                >
                  <Ionicons name="remove" size={16} color={c.foreground} />
                </Pressable>
                <TextInput
                  style={[styles.killInput, { color: c.foreground }]}
                  value={killsStr}
                  onChangeText={(v) => setKillsStr(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  textAlign="center"
                />
                <Pressable
                  onPress={() => setKillsStr((v) => String((parseInt(v, 10) || 0) + 1))}
                  style={[styles.killStep, { backgroundColor: c.muted }]}
                >
                  <Ionicons name="add" size={16} color={c.foreground} />
                </Pressable>
              </View>
              {tournament.perKillPrize > 0 && (
                <Text style={[styles.prizeHint, { color: c.mutedForeground }]}>
                  ₹{tournament.perKillPrize}/kill → <Text style={{ color: '#22C55E' }}>₹{killPrize}</Text>
                </Text>
              )}
            </View>

            <View style={styles.fieldRight}>
              <Text style={[styles.fieldLabel, { color: c.mutedForeground }]}>RANK</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.rankRow}>
                  {RANK_LABELS.map(({ key, label }) => {
                    const prize = rankPrizeFor(key, tournament.rankPrizes ?? { rank1: 0, rank2: 0, rank3: 0 });
                    const isActive = rank === key;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setRank(key)}
                        style={[
                          styles.rankChip,
                          {
                            backgroundColor: isActive ? 'rgba(234,179,8,0.2)' : c.muted,
                            borderColor: isActive ? '#EAB308' : 'transparent',
                          },
                        ]}
                      >
                        <Text style={[styles.rankChipLabel, { color: isActive ? '#EAB308' : c.mutedForeground }]}>
                          {label}
                        </Text>
                        {prize > 0 && (
                          <Text style={[styles.rankChipPrize, { color: isActive ? '#EAB308' : c.mutedForeground }]}>
                            ₹{prize}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
              {rankPrize > 0 && (
                <Text style={[styles.prizeHint, { color: c.mutedForeground, marginTop: 4 }]}>
                  Rank prize → <Text style={{ color: '#22C55E' }}>₹{rankPrize}</Text>
                </Text>
              )}
            </View>
          </View>

          {/* Breakdown preview */}
          <View style={[styles.totalBox, { backgroundColor: c.muted }]}>
            <View style={styles.totalRow}>
              {kills > 0 && tournament.perKillPrize > 0 && (
                <Text style={[styles.totalPart, { color: c.mutedForeground }]}>
                  Kills: {kills} [₹{killPrize}]
                </Text>
              )}
              {killPrize > 0 && rankPrize > 0 && (
                <Text style={[styles.totalSep, { color: c.mutedForeground }]}> + </Text>
              )}
              {rankPrize > 0 && (
                <Text style={[styles.totalPart, { color: c.mutedForeground }]}>
                  {rank} Place [₹{rankPrize}]
                </Text>
              )}
              {total === 0 && (
                <Text style={[styles.totalPart, { color: c.mutedForeground }]}>No prize yet</Text>
              )}
            </View>
            <Text style={[styles.totalAmount, { color: total > 0 ? '#22C55E' : c.mutedForeground }]}>
              = ₹{total.toLocaleString()}
            </Text>
          </View>

          <Pressable
            onPress={handleDeclare}
            disabled={declaring || total === 0}
            style={({ pressed }) => [
              styles.declareSubmit,
              { opacity: pressed || declaring || total === 0 ? 0.65 : 1 },
            ]}
          >
            {declaring ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.declareSubmitText}>Credit ₹{total.toLocaleString()} to Wallet</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
interface Props {
  tournament: Tournament;
  registrations: Registration[];
  onClose: () => void;
}

export function RegisteredPlayersModal({ tournament, registrations, onClose }: Props) {
  const c = useColors();
  const { addEarnings } = useWallet();
  const [declaredMap, setDeclaredMap] = useState<Record<string, number>>({});

  const canDeclare = tournament.status !== 'upcoming';

  async function handleDeclare(reg: Registration, amount: number, breakdown: EarningBreakdown) {
    await addEarnings(reg.username, amount, tournament.id, tournament.name, breakdown);
    setDeclaredMap((prev) => ({ ...prev, [reg.username]: amount }));
    Alert.alert(
      '🏆 Prize Credited!',
      `₹${amount.toLocaleString()} has been added to ${reg.username}'s wallet.`,
    );
  }

  // Prize structure info
  const hasPrizes = tournament.perKillPrize > 0 ||
    tournament.rankPrizes?.rank1 > 0 ||
    tournament.rankPrizes?.rank2 > 0 ||
    tournament.rankPrizes?.rank3 > 0;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: c.background }]}>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: c.foreground }]} numberOfLines={1}>
                {tournament.name}
              </Text>
              <Text style={[styles.headerSub, { color: c.mutedForeground }]}>
                {registrations.length} player{registrations.length !== 1 ? 's' : ''}
                {canDeclare ? ' · Tap "Declare" to award prizes' : ' · Match not started yet'}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={c.mutedForeground} />
            </Pressable>
          </View>

          {/* Prize structure banner */}
          {hasPrizes && (
            <View style={[styles.prizeBar, { backgroundColor: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.2)' }]}>
              <Ionicons name="trophy-outline" size={14} color="#EAB308" />
              <View style={styles.prizeBarItems}>
                {tournament.perKillPrize > 0 && (
                  <Text style={styles.prizeBarItem}>₹{tournament.perKillPrize}/kill</Text>
                )}
                {tournament.rankPrizes?.rank1 > 0 && (
                  <Text style={styles.prizeBarItem}>🥇₹{tournament.rankPrizes.rank1}</Text>
                )}
                {tournament.rankPrizes?.rank2 > 0 && (
                  <Text style={styles.prizeBarItem}>🥈₹{tournament.rankPrizes.rank2}</Text>
                )}
                {tournament.rankPrizes?.rank3 > 0 && (
                  <Text style={styles.prizeBarItem}>🥉₹{tournament.rankPrizes.rank3}</Text>
                )}
              </View>
            </View>
          )}

          {/* Player list */}
          <FlatList
            data={registrations}
            keyExtractor={(r) => r.paymentId}
            renderItem={({ item }) => (
              <PlayerRow
                reg={item}
                canDeclare={canDeclare}
                tournament={tournament}
                alreadyDeclared={!!declaredMap[item.username]}
                onDeclare={handleDeclare}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={44} color={c.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: c.foreground }]}>No players yet</Text>
                <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
                  {tournament.entryFee === 0
                    ? 'Players who join this free tournament will appear here.'
                    : 'Players who complete payment will appear here.'}
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', minHeight: '50%' },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', padding: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  closeBtn: { padding: 4, marginLeft: 12 },

  prizeBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  prizeBarItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  prizeBarItem: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#EAB308' },

  listContent: { padding: 14, paddingBottom: 48 },

  // Player card
  playerCard: { borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  winnerBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(234,179,8,0.12)',
  },
  winnerBannerText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#EAB308' },

  playerRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  playerInfo: { flex: 1, gap: 3 },
  playerName: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  freeBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2,
  },
  freeBadgeText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#22C55E', letterSpacing: 0.5 },

  playerRight: { alignItems: 'flex-end', gap: 6 },
  gamePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  gamePillText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  declareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
  },
  declareBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  // Declaration panel
  declareBox: { padding: 14, borderTopWidth: 1, gap: 12 },
  declareFor: { fontSize: 12, fontFamily: 'Inter_400Regular' },

  fieldRow: { gap: 12 },
  fieldLeft: { gap: 4 },
  fieldRight: { gap: 4 },
  fieldLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.7 },

  killWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1, overflow: 'hidden', alignSelf: 'flex-start',
  },
  killStep: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  killInput: { width: 52, height: 36, fontSize: 16, fontFamily: 'Inter_700Bold' },

  rankRow: { flexDirection: 'row', gap: 6 },
  rankChip: {
    alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1.5, gap: 2,
  },
  rankChipLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  rankChipPrize: { fontSize: 10, fontFamily: 'Inter_700Bold' },

  prizeHint: { fontSize: 11, fontFamily: 'Inter_400Regular' },

  totalBox: { borderRadius: 12, padding: 12, gap: 4 },
  totalRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  totalPart: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  totalSep: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  totalAmount: { fontSize: 20, fontFamily: 'Inter_700Bold' },

  declareSubmit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#22C55E', borderRadius: 12, paddingVertical: 12,
  },
  declareSubmitText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', paddingHorizontal: 16 },
});
