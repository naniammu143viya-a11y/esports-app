import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useWallet } from '@/context/WalletContext';
import type { Registration, Tournament } from '@/context/TournamentContext';

interface Props {
  tournament: Tournament;
  registrations: Registration[];
  onClose: () => void;
}

// ─── Winner declaration row ───────────────────────────────────────────────────
function PlayerRow({
  reg,
  isCompleted,
  tournament,
  onDeclare,
}: {
  reg: Registration;
  isCompleted: boolean;
  tournament: Tournament;
  onDeclare: (reg: Registration, amount: number) => Promise<void>;
}) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [declaring, setDeclaring] = useState(false);

  async function handleDeclare() {
    const amount = parseInt(amountStr, 10);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid prize amount.');
      return;
    }
    setDeclaring(true);
    try {
      await onDeclare(reg, amount);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExpanded(false);
      setAmountStr('');
    } finally {
      setDeclaring(false);
    }
  }

  return (
    <View style={[styles.playerCard, { backgroundColor: c.card, borderColor: c.border }]}>
      {/* Player info row */}
      <View style={styles.playerRow}>
        <View style={[styles.avatar, { backgroundColor: reg.gameType === 'BGMI' ? 'rgba(255,107,0,0.15)' : 'rgba(255,45,120,0.15)' }]}>
          <MaterialCommunityIcons
            name="account-circle"
            size={26}
            color={reg.gameType === 'BGMI' ? '#FF6B00' : '#FF2D78'}
          />
        </View>

        <View style={styles.playerInfo}>
          <Text style={[styles.playerName, { color: c.foreground }]}>{reg.username}</Text>
          <View style={styles.playerMeta}>
            <Ionicons name="call-outline" size={11} color={c.mutedForeground} />
            <Text style={[styles.playerMetaText, { color: c.mutedForeground }]}>{reg.mobile}</Text>
          </View>
          <View style={styles.playerMeta}>
            <MaterialCommunityIcons name="identifier" size={11} color={c.mutedForeground} />
            <Text style={[styles.playerMetaText, { color: c.mutedForeground }]}>{reg.gameId}</Text>
          </View>
        </View>

        <View style={styles.playerRight}>
          <View style={[styles.gamePill, { backgroundColor: reg.gameType === 'BGMI' ? 'rgba(255,107,0,0.12)' : 'rgba(255,45,120,0.12)' }]}>
            <Text style={[styles.gamePillText, { color: reg.gameType === 'BGMI' ? '#FF6B00' : '#FF2D78' }]}>
              {reg.gameType === 'FreeFire' ? 'FF' : reg.gameType}
            </Text>
          </View>
          {/* Declare winner button — only for completed tournaments */}
          {isCompleted && (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              style={({ pressed }) => [
                styles.declareBtn,
                { backgroundColor: expanded ? c.muted : 'rgba(234,179,8,0.15)', opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name={expanded ? 'close' : 'trophy-outline'} size={13} color={expanded ? c.mutedForeground : '#EAB308'} />
              <Text style={[styles.declareBtnText, { color: expanded ? c.mutedForeground : '#EAB308' }]}>
                {expanded ? 'Cancel' : 'Winner'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Expanded winner declaration */}
      {expanded && (
        <View style={[styles.declareBox, { borderTopColor: c.border }]}>
          <Text style={[styles.declareLabel, { color: c.mutedForeground }]}>
            Prize amount for <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>{reg.username}</Text>
          </Text>
          <View style={styles.declareInputRow}>
            <View style={[styles.declareInputWrap, { backgroundColor: c.input, borderColor: c.border }]}>
              <Text style={[styles.rupeeSign, { color: c.mutedForeground }]}>₹</Text>
              <TextInput
                style={[styles.declareInput, { color: c.foreground }]}
                placeholder="Enter amount"
                placeholderTextColor={c.mutedForeground}
                value={amountStr}
                onChangeText={(v) => setAmountStr(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
              />
            </View>
            <Pressable
              onPress={handleDeclare}
              disabled={declaring}
              style={({ pressed }) => [styles.declareSubmit, { opacity: pressed || declaring ? 0.8 : 1 }]}
            >
              {declaring ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={15} color="#fff" />
                  <Text style={styles.declareSubmitText}>Declare</Text>
                </>
              )}
            </Pressable>
          </View>
          <Text style={[styles.declareHint, { color: c.mutedForeground }]}>
            Funds will be credited to {reg.username}'s wallet immediately.
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function RegisteredPlayersModal({ tournament, registrations, onClose }: Props) {
  const c = useColors();
  const { addEarnings } = useWallet();
  const [declaredIds, setDeclaredIds] = useState<Set<string>>(new Set());

  async function handleDeclare(reg: Registration, amount: number) {
    await addEarnings(reg.username, amount, tournament.id, tournament.name);
    setDeclaredIds((prev) => new Set(prev).add(reg.username));
    Alert.alert(
      '🏆 Winner Declared!',
      `₹${amount.toLocaleString()} has been credited to ${reg.username}'s wallet.`,
    );
  }

  const isCompleted = tournament.status === 'completed';

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
                {registrations.length} registered player{registrations.length !== 1 ? 's' : ''}
                {isCompleted ? ' · Tap "Winner" to declare prize' : ''}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={c.mutedForeground} />
            </Pressable>
          </View>

          {/* Players list */}
          <FlatList
            data={registrations}
            keyExtractor={(r) => r.paymentId}
            renderItem={({ item }) => (
              <View>
                {declaredIds.has(item.username) && (
                  <View style={styles.winnerBanner}>
                    <Ionicons name="trophy" size={13} color="#EAB308" />
                    <Text style={styles.winnerBannerText}>Winner declared</Text>
                  </View>
                )}
                <PlayerRow
                  reg={item}
                  isCompleted={isCompleted}
                  tournament={tournament}
                  onDeclare={handleDeclare}
                />
              </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={44} color={c.mutedForeground} />
                <Text style={[styles.emptyTitle, { color: c.foreground }]}>No paid players yet</Text>
                <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
                  Players who pay the entry fee will appear here.
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  closeBtn: { padding: 4, marginLeft: 12 },
  listContent: { padding: 16, paddingBottom: 48 },

  playerCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerInfo: { flex: 1, gap: 3 },
  playerName: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  playerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  playerMetaText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  playerRight: { alignItems: 'flex-end', gap: 6 },
  gamePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gamePillText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  declareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  declareBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  // Expanded declare box
  declareBox: {
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  declareLabel: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  declareInputRow: { flexDirection: 'row', gap: 8 },
  declareInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  rupeeSign: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  declareInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  declareSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#22C55E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  declareSubmitText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' },
  declareHint: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15 },

  winnerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(234,179,8,0.12)',
  },
  winnerBannerText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#EAB308' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
