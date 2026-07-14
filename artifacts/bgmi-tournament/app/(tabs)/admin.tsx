import React, { useState } from 'react';
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
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useTournaments } from '@/context/TournamentContext';
import { GameBadge } from '@/components/GameBadge';
import type { GameType, TournamentStatus, Tournament } from '@/context/TournamentContext';

// ─── Room Editor Card ────────────────────────────────────────────────────────
function RoomEditorCard({ tournament, onSave }: { tournament: Tournament; onSave: (id: string, roomId: string, pw: string) => void }) {
  const c = useColors();
  const [roomId, setRoomId] = useState(tournament.roomId ?? '');
  const [password, setPassword] = useState(tournament.password ?? '');
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!roomId.trim()) {
      Alert.alert('Error', 'Room ID cannot be empty');
      return;
    }
    onSave(tournament.id, roomId.trim(), password.trim());
    setSaved(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <View style={[styles.roomCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.roomCardTop}>
        <GameBadge game={tournament.game} />
        <View style={[styles.statusPill, {
          backgroundColor: tournament.status === 'ongoing' ? 'rgba(34,197,94,0.15)' : tournament.status === 'upcoming' ? 'rgba(234,179,8,0.15)' : 'rgba(107,114,128,0.15)',
        }]}>
          <Text style={[styles.statusText, {
            color: tournament.status === 'ongoing' ? '#22C55E' : tournament.status === 'upcoming' ? '#EAB308' : '#6B7280',
          }]}>
            {tournament.status === 'ongoing' ? 'LIVE' : tournament.status === 'upcoming' ? 'UPCOMING' : 'ENDED'}
          </Text>
        </View>
      </View>

      <Text style={[styles.roomCardName, { color: c.foreground }]} numberOfLines={1}>
        {tournament.name}
      </Text>
      <Text style={[styles.roomCardMeta, { color: c.mutedForeground }]}>
        {tournament.map} · {tournament.registeredTeams}/{tournament.maxTeams} teams
      </Text>

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
          { backgroundColor: saved ? 'rgba(34,197,94,0.15)' : c.primary, opacity: pressed ? 0.8 : 1 },
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

// ─── Add Tournament Form ─────────────────────────────────────────────────────
function AddTournamentForm({ onAdd, onClose }: { onAdd: (data: any) => void; onClose: () => void }) {
  const c = useColors();
  const [game, setGame] = useState<GameType>('BGMI');
  const [name, setName] = useState('');
  const [map, setMap] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [prizePool, setPrizePool] = useState('');
  const [status, setStatus] = useState<TournamentStatus>('upcoming');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  function handleAdd() {
    if (!name.trim() || !map.trim() || !date.trim() || !time.trim()) {
      Alert.alert('Error', 'Please fill Name, Map, Date and Time');
      return;
    }
    onAdd({
      game,
      name: name.trim(),
      map: map.trim(),
      entryFee: parseInt(entryFee, 10) || 0,
      prizePool: parseInt(prizePool, 10) || 0,
      status,
      teamSize: 4,
      maxTeams: 20,
      date: date.trim(),
      time: time.trim(),
    });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }

  const statusOpts: TournamentStatus[] = ['upcoming', 'ongoing', 'completed'];

  return (
    <ScrollView style={[styles.formCard, { backgroundColor: c.card, borderColor: c.border }]} keyboardShouldPersistTaps="handled">
      <View style={styles.formHeader}>
        <Text style={[styles.formTitle, { color: c.foreground }]}>New Tournament</Text>
        <Pressable onPress={onClose}>
          <Ionicons name="close" size={22} color={c.mutedForeground} />
        </Pressable>
      </View>

      {/* Game picker */}
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

      {/* Status picker */}
      <Text style={[styles.fLabel, { color: c.mutedForeground }]}>STATUS</Text>
      <View style={styles.statusRow}>
        {statusOpts.map((s) => {
          const active = status === s;
          return (
            <Pressable key={s} onPress={() => setStatus(s)}
              style={[styles.statusChip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? 'rgba(255,107,0,0.15)' : 'transparent' }]}>
              <Text style={[styles.statusChipText, { color: active ? c.primary : c.mutedForeground }]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {[
        { label: 'TOURNAMENT NAME', val: name, set: setName, placeholder: 'e.g. Clash Royale Cup', key: 'name' },
        { label: 'MAP', val: map, set: setMap, placeholder: 'e.g. Erangel', key: 'map' },
        { label: 'DATE (YYYY-MM-DD)', val: date, set: setDate, placeholder: '2026-07-20', key: 'date' },
        { label: 'TIME (HH:MM)', val: time, set: setTime, placeholder: '20:00', key: 'time' },
        { label: 'ENTRY FEE (₹)', val: entryFee, set: setEntryFee, placeholder: '0 for free', key: 'fee', numeric: true },
        { label: 'PRIZE POOL (₹)', val: prizePool, set: setPrizePool, placeholder: '5000', key: 'prize', numeric: true },
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
              keyboardType={(field as any).numeric ? 'number-pad' : 'default'}
              autoCorrect={false}
            />
          </View>
        </View>
      ))}

      <Pressable onPress={handleAdd}
        style={({ pressed }) => [styles.addSubmitBtn, { backgroundColor: c.primary, opacity: pressed ? 0.8 : 1 }]}>
        <Text style={styles.addSubmitText}>Create Tournament</Text>
      </Pressable>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

// ─── Main Admin Screen ───────────────────────────────────────────────────────
export default function AdminScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tournaments, updateRoomDetails, addTournament } = useTournaments();
  const [showAddForm, setShowAddForm] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (!user?.isAdmin) {
    return (
      <View style={[styles.root, { backgroundColor: c.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }]}>
        <Ionicons name="shield-outline" size={56} color={c.mutedForeground} />
        <Text style={[styles.accessTitle, { color: c.foreground }]}>Admin Only</Text>
        <Text style={[styles.accessText, { color: c.mutedForeground }]}>
          Log in with username "admin" to access the admin panel
        </Text>
      </View>
    );
  }

  const activeTournaments = tournaments.filter((t) => t.status !== 'completed');
  const completedTournaments = tournaments.filter((t) => t.status === 'completed');

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: c.foreground }]}>Admin Panel</Text>
          <Text style={[styles.headerSub, { color: c.mutedForeground }]}>Manage tournaments & room details</Text>
        </View>
        <Pressable
          onPress={() => setShowAddForm((v) => !v)}
          style={({ pressed }) => [styles.addBtn, { backgroundColor: showAddForm ? c.muted : c.primary, opacity: pressed ? 0.8 : 1 }]}
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
          data={[...activeTournaments, ...completedTournaments]}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <RoomEditorCard tournament={item} onSave={updateRoomDetails} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>
              {tournaments.length} TOURNAMENT{tournaments.length !== 1 ? 'S' : ''}
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="trophy-outline" size={44} color={c.mutedForeground} />
              <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No tournaments yet</Text>
            </View>
          }
        />
      )}
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
  headerTitle: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 120 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  roomCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  roomCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  roomCardName: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 3 },
  roomCardMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 12 },
  roomInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  roomInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  saveBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  // Add form
  formCard: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  fLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
  },
  gameToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  gameToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  gameToggleText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  fInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  fInputText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  addSubmitBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  addSubmitText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  // Access denied
  accessTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 16, marginBottom: 8 },
  accessText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
});
