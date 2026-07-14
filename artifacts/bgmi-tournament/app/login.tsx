import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import type { GameType } from '@/context/TournamentContext';

export default function LoginScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [mobile, setMobile] = useState('');
  const [gameId, setGameId] = useState('');
  const [gameType, setGameType] = useState<GameType>('BGMI');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!username.trim()) e.username = 'Username is required';
    if (!mobile.trim()) e.mobile = 'Mobile number is required';
    else if (!/^\d{10}$/.test(mobile.trim())) e.mobile = 'Enter a valid 10-digit number';
    if (!gameId.trim()) e.gameId = 'Game ID is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await login({
        username: username.trim(),
        mobile: mobile.trim(),
        gameId: gameId.trim(),
        gameType,
      });
      router.replace('/(tabs)');
    } catch {
      setLoading(false);
    }
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 20, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={[styles.logoCircle, { backgroundColor: 'rgba(255,107,0,0.12)', borderColor: 'rgba(255,107,0,0.3)' }]}>
            <MaterialCommunityIcons name="trophy-variant" size={44} color={c.primary} />
          </View>
          <Text style={[styles.appName, { color: c.foreground }]}>BattleZone</Text>
          <Text style={[styles.tagline, { color: c.mutedForeground }]}>
            BGMI & Free Fire Tournaments
          </Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.foreground }]}>Create Profile</Text>
          <Text style={[styles.cardSub, { color: c.mutedForeground }]}>
            Enter your details to enter the arena
          </Text>

          {/* Game selector */}
          <Text style={[styles.label, { color: c.mutedForeground }]}>SELECT GAME</Text>
          <View style={[styles.toggleRow, { backgroundColor: c.muted }]}>
            {(['BGMI', 'FreeFire'] as GameType[]).map((g) => {
              const isActive = gameType === g;
              const activeColor = g === 'BGMI' ? '#FF6B00' : '#FF2D78';
              return (
                <Pressable
                  key={g}
                  onPress={() => setGameType(g)}
                  style={[
                    styles.toggleBtn,
                    isActive && { backgroundColor: activeColor },
                  ]}
                >
                  <Text style={[styles.toggleText, { color: isActive ? '#fff' : c.mutedForeground }]}>
                    {g === 'FreeFire' ? 'Free Fire' : 'BGMI'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Username */}
          <Text style={[styles.label, { color: c.mutedForeground }]}>USERNAME</Text>
          <View style={[styles.inputWrap, { backgroundColor: c.input, borderColor: errors.username ? c.destructive : c.border }]}>
            <Ionicons name="person-outline" size={16} color={c.mutedForeground} />
            <TextInput
              style={[styles.input, { color: c.foreground }]}
              placeholder="Enter username"
              placeholderTextColor={c.mutedForeground}
              value={username}
              onChangeText={(v) => { setUsername(v); setErrors((e) => ({ ...e, username: '' })); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {!!errors.username && <Text style={[styles.errText, { color: c.destructive }]}>{errors.username}</Text>}

          {/* Mobile */}
          <Text style={[styles.label, { color: c.mutedForeground }]}>MOBILE NUMBER</Text>
          <View style={[styles.inputWrap, { backgroundColor: c.input, borderColor: errors.mobile ? c.destructive : c.border }]}>
            <Ionicons name="call-outline" size={16} color={c.mutedForeground} />
            <TextInput
              style={[styles.input, { color: c.foreground }]}
              placeholder="10-digit number"
              placeholderTextColor={c.mutedForeground}
              value={mobile}
              onChangeText={(v) => { setMobile(v.replace(/\D/g, '').slice(0, 10)); setErrors((e) => ({ ...e, mobile: '' })); }}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
          {!!errors.mobile && <Text style={[styles.errText, { color: c.destructive }]}>{errors.mobile}</Text>}

          {/* Game ID */}
          <Text style={[styles.label, { color: c.mutedForeground }]}>
            {gameType === 'BGMI' ? 'BGMI' : 'FREE FIRE'} GAME ID
          </Text>
          <View style={[styles.inputWrap, { backgroundColor: c.input, borderColor: errors.gameId ? c.destructive : c.border }]}>
            <MaterialCommunityIcons name="identifier" size={16} color={c.mutedForeground} />
            <TextInput
              style={[styles.input, { color: c.foreground }]}
              placeholder={`Enter your ${gameType === 'BGMI' ? 'BGMI' : 'Free Fire'} ID`}
              placeholderTextColor={c.mutedForeground}
              value={gameId}
              onChangeText={(v) => { setGameId(v); setErrors((e) => ({ ...e, gameId: '' })); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {!!errors.gameId && <Text style={[styles.errText, { color: c.destructive }]}>{errors.gameId}</Text>}

          {/* Admin hint */}
          <Text style={[styles.hint, { color: c.mutedForeground }]}>
            Tip: Use username "admin" to access Admin Panel
          </Text>

          {/* Login button */}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [
              styles.loginBtn,
              { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Enter Arena</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  logoArea: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  appName: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 20,
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 2,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  errText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
    marginLeft: 2,
  },
  hint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  loginBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  loginBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
