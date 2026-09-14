import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useTournaments } from '@/context/TournamentContext';
import { useWallet, ADMIN_UPI_KEY } from '@/context/WalletContext';
import { GameBadge } from '@/components/GameBadge';
import { RegisteredPlayersModal } from '@/components/RegisteredPlayersModal';
import { PaymentReviewPanel } from '@/components/PaymentReviewPanel';
import type { GameType, TournamentStatus, Tournament } from '@/context/TournamentContext';
import type { WithdrawalRequest } from '@/context/WalletContext';

// ─── Admin UPI Settings Card ──────────────────────────────────────────────────
function AdminUpiCard() {
  const c = useColors();
  const [upiId, setUpiId] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftUpi, setDraftUpi] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ADMIN_UPI_KEY).then((v) => {
      if (v) { setUpiId(v); setDraftUpi(v); }
    });
  }, []);

  async function handleSave() {
    if (!draftUpi.trim()) { Alert.alert('Error', 'UPI ID cannot be empty.'); return; }
    await AsyncStorage.setItem(ADMIN_UPI_KEY, draftUpi.trim());
    setUpiId(draftUpi.trim());
    setEditing(false);
    setSaved(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <View style={[styles.upiCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.upiCardHeader}>
        <View style={[styles.upiIconWrap, { backgroundColor: 'rgba(255,107,0,0.12)' }]}>
          <Ionicons name="wallet-outline" size={18} color={c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.upiCardTitle, { color: c.foreground }]}>Payment UPI ID</Text>
          <Text style={[styles.upiCardSub, { color: c.mutedForeground }]}>
            Used in QR code & deep links for all players
          </Text>
        </View>
        {saved && (
          <View style={styles.savedBadge}>
            <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
            <Text style={styles.savedBadgeText}>Saved</Text>
          </View>
        )}
      </View>

      {editing ? (
        <View style={styles.upiEditRow}>
          <View style={[styles.upiInput, { backgroundColor: c.input, borderColor: c.primary }]}>
            <TextInput
              style={[styles.upiInputText, { color: c.foreground }]}
              value={draftUpi}
              onChangeText={setDraftUpi}
              placeholder="yourname@upi or 9876543210"
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [styles.upiSaveBtn, { backgroundColor: c.primary, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.upiSaveBtnText}>Save</Text>
          </Pressable>
          <Pressable onPress={() => { setEditing(false); setDraftUpi(upiId); }} style={styles.upiCancelBtn}>
            <Ionicons name="close" size={18} color={c.mutedForeground} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => setEditing(true)}
          style={[styles.upiDisplay, { backgroundColor: c.muted }]}
        >
          <Text style={[styles.upiDisplayText, { color: upiId ? c.foreground : c.mutedForeground }]} numberOfLines={1}>
            {upiId || 'Tap to set your UPI ID…'}
          </Text>
          <Ionicons name="pencil-outline" size={15} color={c.mutedForeground} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Room Editor Card ─────────────────────────────────────────────────────────
function RoomEditorCard({
  tournament,
  registrationCount,
  onSave,
  onViewPlayers,
}: {
  tournament: Tournament;
  registrationCount: number;
  onSave: (id: string, roomId: string, pw: string) => void;
  onViewPlayers: (t: Tournament) => void;
}) {
  const c = useColors();
  const { updateTournamentSlots } = useTournaments();
  const [roomId, setRoomId] = useState(tournament.roomId ?? '');
  const [password, setPassword] = useState(tournament.password ?? '');
  const [saved, setSaved] = useState(false);
  const [slots, setSlots] = useState(tournament.maxTeams);

  function handleSave() {
    if (!roomId.trim()) { Alert.alert('Error', 'Room ID cannot be empty'); return; }
    onSave(tournament.id, roomId.trim(), password.trim());
    setSaved(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setSaved(false), 2000);
  }

  function changeSlots(delta: number) {
    const next = Math.max(tournament.registeredTeams, slots + delta);
    setSlots(next);
    updateTournamentSlots(tournament.id, next);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const statusColor =
    tournament.status === 'ongoing' ? '#22C55E'
    : tournament.status === 'upcoming' ? '#EAB308'
    : '#6B7280';

  const hasPrizeStructure = tournament.perKillPrize > 0 || tournament.rankPrizes?.rank1 > 0;

  return (
    <View style={[styles.roomCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.roomCardTop}>
        <GameBadge game={tournament.game} />
        <View style={[styles.statusPill, {
          backgroundColor: tournament.status === 'ongoing'
            ? 'rgba(34,197,94,0.15)'
            : tournament.status === 'upcoming'
            ? 'rgba(234,179,8,0.15)'
            : 'rgba(107,114,128,0.15)',
        }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {tournament.status === 'ongoing' ? 'LIVE' : tournament.status === 'upcoming' ? 'UPCOMING' : 'ENDED'}
          </Text>
        </View>
        {tournament.entryFee === 0 && (
          <View style={styles.freePill}>
            <Text style={styles.freePillText}>FREE</Text>
          </View>
        )}
      </View>

      <Text style={[styles.roomCardName, { color: c.foreground }]} numberOfLines={1}>
        {tournament.name}
      </Text>
      <Text style={[styles.roomCardMeta, { color: c.mutedForeground }]}>
        {tournament.map} · {tournament.entryFee > 0 ? `₹${tournament.entryFee} entry` : 'Free entry'}
      </Text>

      {/* Slot manager */}
      <View style={[styles.slotRow, { backgroundColor: c.muted }]}>
        <View style={styles.slotLeft}>
          <Ionicons name="people-outline" size={14} color={c.mutedForeground} />
          <Text style={[styles.slotLabel, { color: c.mutedForeground }]}>Player Slots</Text>
        </View>
        <View style={styles.slotControls}>
          <Pressable onPress={() => changeSlots(-5)} style={[styles.slotBtn, { backgroundColor: c.card }]}>
            <Text style={[styles.slotBtnText, { color: c.mutedForeground }]}>−5</Text>
          </Pressable>
          <View style={styles.slotCountWrap}>
            <Text style={[styles.slotFilled, { color: tournament.registeredTeams >= slots ? '#EF4444' : '#22C55E' }]}>
              {tournament.registeredTeams}
            </Text>
            <Text style={[styles.slotSep, { color: c.mutedForeground }]}>/</Text>
            <Text style={[styles.slotMax, { color: c.foreground }]}>{slots}</Text>
          </View>
          <Pressable onPress={() => changeSlots(5)} style={[styles.slotBtn, { backgroundColor: c.card }]}>
            <Text style={[styles.slotBtnText, { color: c.primary }]}>+5</Text>
          </Pressable>
        </View>
        {tournament.registeredTeams >= slots && (
          <View style={styles.fullPill}>
            <Text style={styles.fullPillText}>FULL</Text>
          </View>
        )}
      </View>

      {/* Prize structure summary */}
      {hasPrizeStructure && (
        <View style={[styles.prizeBar, { backgroundColor: 'rgba(234,179,8,0.06)', borderColor: 'rgba(234,179,8,0.2)' }]}>
          <Ionicons name="trophy-outline" size={12} color="#EAB308" />
          <Text style={styles.prizeBarText}>
            {tournament.perKillPrize > 0 ? `₹${tournament.perKillPrize}/kill` : ''}
            {tournament.perKillPrize > 0 && tournament.rankPrizes?.rank1 > 0 ? '  ·  ' : ''}
            {tournament.rankPrizes?.rank1 > 0 ? `🥇₹${tournament.rankPrizes.rank1}` : ''}
            {tournament.rankPrizes?.rank2 > 0 ? `  🥈₹${tournament.rankPrizes.rank2}` : ''}
            {tournament.rankPrizes?.rank3 > 0 ? `  🥉₹${tournament.rankPrizes.rank3}` : ''}
          </Text>
        </View>
      )}

      {/* View Players button */}
      <Pressable
        onPress={() => onViewPlayers(tournament)}
        style={({ pressed }) => [
          styles.viewPlayersBtn,
          {
            backgroundColor: registrationCount > 0 ? 'rgba(255,107,0,0.12)' : 'rgba(107,114,128,0.08)',
            borderColor: registrationCount > 0 ? 'rgba(255,107,0,0.3)' : 'rgba(107,114,128,0.2)',
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Ionicons name="people-outline" size={14} color={registrationCount > 0 ? c.primary : c.mutedForeground} />
        <Text style={[styles.viewPlayersBtnText, { color: registrationCount > 0 ? c.primary : c.mutedForeground }]}>
          {registrationCount > 0
            ? `View ${registrationCount} Player${registrationCount !== 1 ? 's' : ''}`
            : 'No players yet'}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={registrationCount > 0 ? c.primary : c.mutedForeground} />
      </Pressable>

      {/* Room ID */}
      <View style={[styles.roomInputWrap, { backgroundColor: c.input, borderColor: c.border }]}>
        <MaterialCommunityIcons name="door-open" size={14} color={c.mutedForeground} />
        <TextInput
          style={[styles.roomInput, { color: c.foreground }]}
          placeholder="Room ID"
          placeholderTextColor={c.mutedForeground}
          value={roomId}
          onChangeText={setRoomId}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>
      <View style={[styles.roomInputWrap, { backgroundColor: c.input, borderColor: c.border }]}>
        <MaterialCommunityIcons name="lock-outline" size={14} color={c.mutedForeground} />
        <TextInput
          style={[styles.roomInput, { color: c.foreground }]}
          placeholder="Password"
          placeholderTextColor={c.mutedForeground}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <Pressable
        onPress={handleSave}
        style={({ pressed }) => [
          styles.saveBtn,
          {
            backgroundColor: saved ? 'rgba(34,197,94,0.15)' : c.primary,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Ionicons name={saved ? 'checkmark' : 'save-outline'} size={14} color={saved ? '#22C55E' : '#fff'} />
        <Text style={[styles.saveBtnText, { color: saved ? '#22C55E' : '#fff' }]}>
          {saved ? 'Saved!' : 'Save Room Details'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Add Tournament Form ──────────────────────────────────────────────────────
type EntryType = 'FREE' | 'PAID';

function AddTournamentForm({ onAdd, onClose }: { onAdd: (data: any) => void; onClose: () => void }) {
  const c = useColors();
  const [game, setGame] = useState<GameType>('BGMI');
  const [name, setName] = useState('');
  const [map, setMap] = useState('');
  const [status, setStatus] = useState<TournamentStatus>('upcoming');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [entryType, setEntryType] = useState<EntryType>('PAID');
  const [entryFee, setEntryFee] = useState('');
  const [prizePool, setPrizePool] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(20);
  // Prize structure
  const [perKillPrize, setPerKillPrize] = useState('');
  const [rank1Prize, setRank1Prize] = useState('');
  const [rank2Prize, setRank2Prize] = useState('');
  const [rank3Prize, setRank3Prize] = useState('');

  function handleAdd() {
    if (!name.trim() || !map.trim() || !date.trim() || !time.trim()) {
      Alert.alert('Error', 'Please fill Name, Map, Date and Time');
      return;
    }
    onAdd({
      game,
      name: name.trim(),
      map: map.trim(),
      entryFee: entryType === 'FREE' ? 0 : (parseInt(entryFee, 10) || 0),
      prizePool: parseInt(prizePool, 10) || 0,
      status,
      teamSize: 4,
      maxTeams: maxPlayers,
      date: date.trim(),
      time: time.trim(),
      perKillPrize: parseInt(perKillPrize, 10) || 0,
      rankPrizes: {
        rank1: parseInt(rank1Prize, 10) || 0,
        rank2: parseInt(rank2Prize, 10) || 0,
        rank3: parseInt(rank3Prize, 10) || 0,
      },
    });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }

  const statusOpts: TournamentStatus[] = ['upcoming', 'ongoing', 'completed'];

  return (
    <ScrollView
      style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.formHeader}>
        <Text style={[styles.formTitle, { color: c.foreground }]}>New Tournament</Text>
        <Pressable onPress={onClose}>
          <Ionicons name="close" size={22} color={c.mutedForeground} />
        </Pressable>
      </View>

      {/* Game */}
      <Text style={[styles.fLabel, { color: c.mutedForeground }]}>GAME</Text>
      <View style={[styles.gameToggle, { backgroundColor: c.muted }]}>
        {(['BGMI', 'FreeFire'] as GameType[]).map((g) => {
          const active = game === g;
          const col = g === 'BGMI' ? '#FF6B00' : '#FF2D78';
          return (
            <Pressable key={g} onPress={() => setGame(g)}
              style={[styles.gameToggleBtn, active && { backgroundColor: col }]}>
              <Text style={[styles.gameToggleText, { color: active ? '#fff' : c.mutedForeground }]}>
                {g === 'FreeFire' ? 'Free Fire' : g}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Status */}
      <Text style={[styles.fLabel, { color: c.mutedForeground }]}>STATUS</Text>
      <View style={styles.chipRow}>
        {statusOpts.map((s) => {
          const active = status === s;
          return (
            <Pressable key={s} onPress={() => setStatus(s)}
              style={[styles.chip, {
                borderColor: active ? c.primary : c.border,
                backgroundColor: active ? 'rgba(255,107,0,0.15)' : 'transparent',
              }]}>
              <Text style={[styles.chipText, { color: active ? c.primary : c.mutedForeground }]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Entry Type */}
      <Text style={[styles.fLabel, { color: c.mutedForeground }]}>ENTRY TYPE</Text>
      <View style={[styles.entryToggle, { backgroundColor: c.muted }]}>
        {(['FREE', 'PAID'] as EntryType[]).map((et) => {
          const active = entryType === et;
          return (
            <Pressable
              key={et}
              onPress={() => setEntryType(et)}
              style={[
                styles.entryToggleBtn,
                active && {
                  backgroundColor: et === 'FREE' ? 'rgba(34,197,94,0.85)' : c.primary,
                },
              ]}
            >
              <Ionicons
                name={et === 'FREE' ? 'gift-outline' : 'card-outline'}
                size={14}
                color={active ? '#fff' : c.mutedForeground}
              />
              <Text style={[styles.entryToggleText, { color: active ? '#fff' : c.mutedForeground }]}>
                {et}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Core fields */}
      {[
        { label: 'TOURNAMENT NAME', val: name, set: setName, placeholder: 'e.g. Clash Royale Cup', key: 'name' },
        { label: 'MAP', val: map, set: setMap, placeholder: 'e.g. Erangel', key: 'map' },
        { label: 'DATE (YYYY-MM-DD)', val: date, set: setDate, placeholder: '2026-07-20', key: 'date' },
        { label: 'TIME (HH:MM)', val: time, set: setTime, placeholder: '20:00', key: 'time' },
      ].map((field) => (
        <View key={field.key}>
          <Text style={[styles.fLabel, { color: c.mutedForeground }]}>{field.label}</Text>
          <View style={[styles.fInput, { backgroundColor: c.input, borderColor: c.border }]}>
            <TextInput
              style={[styles.fInputText, { color: c.foreground }]}
              placeholder={field.placeholder}
              placeholderTextColor={c.mutedForeground}
              value={field.val}
              onChangeText={field.set}
              autoCorrect={false}
            />
          </View>
        </View>
      ))}

      {/* Entry fee — only for PAID */}
      {entryType === 'PAID' && (
        <View>
          <Text style={[styles.fLabel, { color: c.mutedForeground }]}>ENTRY FEE (₹)</Text>
          <View style={[styles.fInput, { backgroundColor: c.input, borderColor: c.border }]}>
            <TextInput
              style={[styles.fInputText, { color: c.foreground }]}
              placeholder="e.g. 50"
              placeholderTextColor={c.mutedForeground}
              value={entryFee}
              onChangeText={setEntryFee}
              keyboardType="number-pad"
            />
          </View>
        </View>
      )}

      <View>
        <Text style={[styles.fLabel, { color: c.mutedForeground }]}>PRIZE POOL (₹)</Text>
        <View style={[styles.fInput, { backgroundColor: c.input, borderColor: c.border }]}>
          <TextInput
            style={[styles.fInputText, { color: c.foreground }]}
            placeholder="e.g. 5000"
            placeholderTextColor={c.mutedForeground}
            value={prizePool}
            onChangeText={setPrizePool}
            keyboardType="number-pad"
          />
        </View>
      </View>

      {/* Player slots stepper */}
      <Text style={[styles.fLabel, { color: c.mutedForeground }]}>PLAYER SLOTS (TOTAL LIMIT)</Text>
      <View style={[styles.slotFormRow, { backgroundColor: c.muted }]}>
        <Pressable
          onPress={() => setMaxPlayers((v) => Math.max(1, v - 5))}
          style={[styles.slotFormBtn, { backgroundColor: c.card }]}
        >
          <Text style={[styles.slotFormBtnText, { color: c.mutedForeground }]}>−5</Text>
        </Pressable>
        <Pressable
          onPress={() => setMaxPlayers((v) => Math.max(1, v - 1))}
          style={[styles.slotFormBtn, { backgroundColor: c.card }]}
        >
          <Text style={[styles.slotFormBtnText, { color: c.mutedForeground }]}>−1</Text>
        </Pressable>
        <Text style={[styles.slotFormCount, { color: c.foreground }]}>{maxPlayers}</Text>
        <Pressable
          onPress={() => setMaxPlayers((v) => v + 1)}
          style={[styles.slotFormBtn, { backgroundColor: c.card }]}
        >
          <Text style={[styles.slotFormBtnText, { color: c.primary }]}>+1</Text>
        </Pressable>
        <Pressable
          onPress={() => setMaxPlayers((v) => v + 5)}
          style={[styles.slotFormBtn, { backgroundColor: c.card }]}
        >
          <Text style={[styles.slotFormBtnText, { color: c.primary }]}>+5</Text>
        </Pressable>
      </View>
      {/* Quick presets */}
      <View style={styles.slotPresets}>
        {[10, 20, 30, 50, 100].map((n) => (
          <Pressable
            key={n}
            onPress={() => setMaxPlayers(n)}
            style={[
              styles.slotPreset,
              {
                backgroundColor: maxPlayers === n ? 'rgba(255,107,0,0.15)' : c.muted,
                borderColor: maxPlayers === n ? c.primary : 'transparent',
              },
            ]}
          >
            <Text style={[styles.slotPresetText, { color: maxPlayers === n ? c.primary : c.mutedForeground }]}>
              {n}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Prize Structure ── */}
      <View style={[styles.prizeSectionHeader, { borderColor: c.border }]}>
        <Ionicons name="trophy-outline" size={15} color="#EAB308" />
        <Text style={[styles.prizeSectionTitle, { color: c.foreground }]}>Prize Structure</Text>
        <Text style={[styles.prizeSectionSub, { color: c.mutedForeground }]}>optional</Text>
      </View>

      <Text style={[styles.fLabel, { color: c.mutedForeground }]}>PER KILL PRIZE (₹)</Text>
      <View style={[styles.fInput, { backgroundColor: c.input, borderColor: c.border }]}>
        <TextInput
          style={[styles.fInputText, { color: c.foreground }]}
          placeholder="e.g. 5 (₹5 per kill)"
          placeholderTextColor={c.mutedForeground}
          value={perKillPrize}
          onChangeText={setPerKillPrize}
          keyboardType="number-pad"
        />
      </View>

      <Text style={[styles.fLabel, { color: c.mutedForeground }]}>RANK PRIZES (₹)</Text>
      <View style={styles.rankPrizeRow}>
        {[
          { label: '🥇 1st', val: rank1Prize, set: setRank1Prize },
          { label: '🥈 2nd', val: rank2Prize, set: setRank2Prize },
          { label: '🥉 3rd', val: rank3Prize, set: setRank3Prize },
        ].map((r) => (
          <View key={r.label} style={{ flex: 1 }}>
            <Text style={[styles.rankPrizeLabel, { color: c.mutedForeground }]}>{r.label}</Text>
            <View style={[styles.fInput, { backgroundColor: c.input, borderColor: c.border }]}>
              <TextInput
                style={[styles.fInputText, { color: c.foreground }]}
                placeholder="₹0"
                placeholderTextColor={c.mutedForeground}
                value={r.val}
                onChangeText={r.set}
                keyboardType="number-pad"
              />
            </View>
          </View>
        ))}
      </View>

      <Pressable
        onPress={handleAdd}
        style={({ pressed }) => [styles.addSubmitBtn, { backgroundColor: c.primary, opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={styles.addSubmitText}>Create Tournament</Text>
      </Pressable>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

// ─── Withdrawal Card ──────────────────────────────────────────────────────────
function WithdrawalCard({ request, onMarkPaid }: { request: WithdrawalRequest; onMarkPaid: (id: string) => void }) {
  const c = useColors();
  const isPending = request.status === 'PENDING';
  const date = (() => {
    try {
      return new Date(request.requestedAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch { return ''; }
  })();

  return (
    <View style={[styles.wdCard, { backgroundColor: c.card, borderColor: isPending ? 'rgba(234,179,8,0.35)' : c.border }]}>
      <View style={styles.wdCardTop}>
        <View style={[styles.wdDot, { backgroundColor: isPending ? '#EAB308' : '#22C55E' }]} />
        <Text style={[styles.wdUsername, { color: c.foreground }]}>{request.username}</Text>
        <Text style={[styles.wdAmount, { color: isPending ? '#EAB308' : '#22C55E' }]}>₹{request.amount.toLocaleString()}</Text>
      </View>
      <View style={styles.wdMeta}>
        {[
          { icon: 'wallet-outline' as const, text: request.upiId },
          { icon: 'call-outline' as const, text: request.mobile || '—' },
          { icon: 'calendar-outline' as const, text: date },
        ].map((row) => (
          <View key={row.icon} style={styles.wdMetaRow}>
            <Ionicons name={row.icon} size={12} color={c.mutedForeground} />
            <Text style={[styles.wdMetaText, { color: c.mutedForeground }]}>{row.text}</Text>
          </View>
        ))}
      </View>
      {isPending ? (
        <Pressable
          onPress={() => onMarkPaid(request.id)}
          style={({ pressed }) => [styles.markPaidBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
          <Text style={styles.markPaidText}>Mark as Paid</Text>
        </Pressable>
      ) : (
        <View style={styles.paidBadge}>
          <Ionicons name="checkmark-circle" size={13} color="#22C55E" />
          <Text style={styles.paidBadgeText}>Paid</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Admin Screen ────────────────────────────────────────────────────────
export default function AdminScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const { tournaments, updateRoomDetails, updateTournamentSlots, addTournament, getRegistrations } = useTournaments();
  const { withdrawalRequests, markWithdrawalPaid } = useWallet();
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingTournament, setViewingTournament] = useState<Tournament | null>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  useEffect(() => {
    if (user !== null && !user.isAdmin) router.replace('/(tabs)');
  }, [user]);

  if (!user?.isAdmin) return <View style={[styles.root, { backgroundColor: c.background }]} />;

  const activeTournaments = tournaments.filter((t) => t.status !== 'completed');
  const completedTournaments = tournaments.filter((t) => t.status === 'completed');
  const allTournaments = [...activeTournaments, ...completedTournaments];

  const pendingWithdrawals = withdrawalRequests.filter((r) => r.status === 'PENDING');
  const paidWithdrawals = withdrawalRequests.filter((r) => r.status === 'PAID');

  async function handleMarkPaid(requestId: string) {
    await markWithdrawalPaid(requestId);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: c.foreground }]}>Admin Panel</Text>
          <Text style={[styles.headerSub, { color: c.mutedForeground }]}>
            Tournaments · Players · Payouts
          </Text>
        </View>
        <Pressable
          onPress={() => setShowAddForm((v) => !v)}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: showAddForm ? c.muted : c.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name={showAddForm ? 'close' : 'add'} size={20} color={showAddForm ? c.mutedForeground : '#fff'} />
        </Pressable>
      </View>

      {showAddForm ? (
        <AddTournamentForm
          onAdd={(data) => { addTournament(data); }}
          onClose={() => setShowAddForm(false)}
        />
      ) : (
        <FlatList
          data={allTournaments}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <RoomEditorCard
              tournament={item}
              registrationCount={getRegistrations(item.id).length}
              onSave={updateRoomDetails}
              onViewPlayers={setViewingTournament}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* UPI Settings */}
              <AdminUpiCard />
              <PaymentReviewPanel />

              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>
                {tournaments.length} TOURNAMENT{tournaments.length !== 1 ? 'S' : ''}
              </Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={44} color={c.mutedForeground} />
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No tournaments yet</Text>
            </View>
          }
          ListFooterComponent={
            withdrawalRequests.length > 0 ? (
              <View style={styles.withdrawSection}>
                <View style={[styles.withdrawHeader, { borderColor: c.border }]}>
                  <Ionicons name="send-outline" size={16} color={c.primary} />
                  <Text style={[styles.withdrawTitle, { color: c.foreground }]}>Withdrawal Requests</Text>
                  {pendingWithdrawals.length > 0 && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>{pendingWithdrawals.length}</Text>
                    </View>
                  )}
                </View>

                {pendingWithdrawals.length > 0 && (
                  <>
                    <Text style={[styles.withdrawSubLabel, { color: c.mutedForeground }]}>PENDING</Text>
                    {pendingWithdrawals.map((r) => (
                      <WithdrawalCard key={r.id} request={r} onMarkPaid={handleMarkPaid} />
                    ))}
                  </>
                )}

                {paidWithdrawals.length > 0 && (
                  <>
                    <Text style={[styles.withdrawSubLabel, { color: c.mutedForeground, marginTop: 16 }]}>COMPLETED</Text>
                    {paidWithdrawals.map((r) => (
                      <WithdrawalCard key={r.id} request={r} onMarkPaid={handleMarkPaid} />
                    ))}
                  </>
                )}
              </View>
            ) : null
          }
        />
      )}

      {viewingTournament && (
        <RegisteredPlayersModal
          tournament={viewingTournament}
          registrations={getRegistrations(viewingTournament.id)}
          onClose={() => setViewingTournament(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 120 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, marginBottom: 12, marginTop: 4 },

  // UPI card
  upiCard: {
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 20, gap: 12,
  },
  upiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  upiIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  upiCardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  upiCardSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  savedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  savedBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#22C55E' },
  upiEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  upiInput: { flex: 1, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10 },
  upiInputText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  upiSaveBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  upiSaveBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' },
  upiCancelBtn: { padding: 6 },
  upiDisplay: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  upiDisplayText: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1, marginRight: 8 },

  // Room card
  roomCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  roomCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  freePill: {
    backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  freePillText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#22C55E', letterSpacing: 0.5 },
  roomCardName: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  roomCardMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 8 },
  prizeBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10,
  },
  prizeBarText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#EAB308', flex: 1 },
  viewPlayersBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10,
  },
  viewPlayersBtnText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  roomInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
  },
  roomInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 10, paddingVertical: 10, marginTop: 4,
  },
  saveBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  // Add form
  formCard: { flex: 1, marginHorizontal: 16, borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 12 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  fLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, marginBottom: 6, marginTop: 14 },
  gameToggle: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  gameToggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  gameToggleText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  // Entry type toggle
  entryToggle: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  entryToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
  entryToggleText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  fInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  fInputText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  // Prize structure
  prizeSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, paddingTop: 18, marginTop: 10, marginBottom: -4,
  },
  prizeSectionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', flex: 1 },
  prizeSectionSub: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  rankPrizeRow: { flexDirection: 'row', gap: 8 },
  rankPrizeLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 5, marginTop: 0 },
  addSubmitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  // Slot form stepper
  slotFormRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 12,
    padding: 4, gap: 4, marginBottom: 8,
  },
  slotFormBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8,
  },
  slotFormBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  slotFormCount: {
    flex: 2, textAlign: 'center', fontSize: 22, fontFamily: 'Inter_700Bold',
  },
  slotPresets: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  slotPreset: {
    flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8, borderWidth: 1.5,
  },
  slotPresetText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  // Slot row on room card
  slotRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10, gap: 8,
  },
  slotLeft: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  slotLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  slotControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slotBtn: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7,
  },
  slotBtnText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  slotCountWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  slotFilled: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  slotSep: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  slotMax: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  fullPill: {
    backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  fullPillText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#EF4444', letterSpacing: 0.5 },
  addSubmitText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },

  // Withdrawal section
  withdrawSection: { marginTop: 24 },
  withdrawHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, paddingTop: 20, marginBottom: 16,
  },
  withdrawTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', flex: 1 },
  pendingBadge: {
    backgroundColor: '#EAB308', borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  pendingBadgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#000' },
  withdrawSubLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, marginBottom: 8 },
  wdCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  wdCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  wdDot: { width: 8, height: 8, borderRadius: 4 },
  wdUsername: { flex: 1, fontSize: 15, fontFamily: 'Inter_700Bold' },
  wdAmount: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  wdMeta: { gap: 5, marginBottom: 12 },
  wdMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wdMetaText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  markPaidBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#22C55E', borderRadius: 10, paddingVertical: 10,
  },
  markPaidText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#fff' },
  paidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  paidBadgeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#22C55E' },

  empty: { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
