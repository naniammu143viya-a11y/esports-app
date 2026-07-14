import React, { useRef, useState } from 'react';
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

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('signin');

  // ── Sign-in fields ─────────────────────────────────────────────────────────
  const [siUsername, setSiUsername] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siShowPw, setSiShowPw] = useState(false);

  // ── Sign-up fields ─────────────────────────────────────────────────────────
  const [suUsername, setSuUsername] = useState('');
  const [suMobile, setSuMobile] = useState('');
  const [suGameId, setSuGameId] = useState('');
  const [suGameType, setSuGameType] = useState<GameType>('BGMI');
  const [suUpiId, setSuUpiId] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirm, setSuConfirm] = useState('');
  const [suShowPw, setSuShowPw] = useState(false);
  const [suShowConfirm, setSuShowConfirm] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  // refs for keyboard "next" flow
  const siPwRef = useRef<TextInput>(null);
  const suMobileRef = useRef<TextInput>(null);
  const suGameIdRef = useRef<TextInput>(null);
  const suPwRef = useRef<TextInput>(null);
  const suConfirmRef = useRef<TextInput>(null);

  function clearErrors() {
    setErrors({});
    setServerError('');
  }

  function switchMode(m: Mode) {
    setMode(m);
    clearErrors();
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validateSignIn(): boolean {
    const e: Record<string, string> = {};
    if (!siUsername.trim()) e.siUsername = 'Username is required';
    if (!siPassword) e.siPassword = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateSignUp(): boolean {
    const e: Record<string, string> = {};
    if (!suUsername.trim()) e.suUsername = 'Username is required';
    if (!suMobile.trim()) e.suMobile = 'Mobile number is required';
    else if (!/^\d{10}$/.test(suMobile.trim())) e.suMobile = 'Enter a valid 10-digit number';
    if (!suGameId.trim()) e.suGameId = 'Game ID is required';
    if (!suPassword) e.suPassword = 'Password is required';
    else if (suPassword.length < 6) e.suPassword = 'Password must be at least 6 characters';
    if (!suConfirm) e.suConfirm = 'Please confirm your password';
    else if (suConfirm !== suPassword) e.suConfirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit handlers ────────────────────────────────────────────────────────
  async function handleSignIn() {
    if (!validateSignIn()) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setServerError('');
    try {
      await login(siUsername.trim(), siPassword);
      router.replace('/(tabs)');
    } catch (err: any) {
      setServerError(err?.message ?? 'Login failed. Please try again.');
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!validateSignUp()) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setServerError('');
    try {
      await register({
        username: suUsername.trim(),
        mobile: suMobile.trim(),
        gameId: suGameId.trim(),
        gameType: suGameType,
        password: suPassword,
        upiId: suUpiId.trim() || undefined,
      });
      router.replace('/(tabs)');
    } catch (err: any) {
      setServerError(err?.message ?? 'Registration failed. Please try again.');
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
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 20, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo ── */}
        <View style={styles.logoArea}>
          <View
            style={[
              styles.logoCircle,
              {
                backgroundColor: 'rgba(255,107,0,0.12)',
                borderColor: 'rgba(255,107,0,0.3)',
              },
            ]}
          >
            <MaterialCommunityIcons name="trophy-variant" size={44} color={c.primary} />
          </View>
          <Text style={[styles.appName, { color: c.foreground }]}>BattleZone</Text>
          <Text style={[styles.tagline, { color: c.mutedForeground }]}>
            BGMI &amp; Free Fire Tournaments
          </Text>
        </View>

        {/* ── Mode switcher tabs ── */}
        <View style={[styles.modeTabs, { backgroundColor: c.muted, borderColor: c.border }]}>
          {(['signin', 'signup'] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => switchMode(m)}
                style={[
                  styles.modeTab,
                  active && { backgroundColor: c.card, borderColor: c.border },
                ]}
              >
                <Ionicons
                  name={m === 'signin' ? 'log-in-outline' : 'person-add-outline'}
                  size={15}
                  color={active ? c.primary : c.mutedForeground}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    { color: active ? c.primary : c.mutedForeground },
                  ]}
                >
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Card ── */}
        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
          {mode === 'signin' ? (
            <SignInForm
              c={c}
              username={siUsername}
              setUsername={(v) => { setSiUsername(v); clearErrors(); }}
              password={siPassword}
              setPassword={(v) => { setSiPassword(v); clearErrors(); }}
              showPw={siShowPw}
              toggleShowPw={() => setSiShowPw((p) => !p)}
              errors={errors}
              serverError={serverError}
              loading={loading}
              onSubmit={handleSignIn}
              pwRef={siPwRef}
            />
          ) : (
            <SignUpForm
              c={c}
              username={suUsername}
              setUsername={(v) => { setSuUsername(v); clearErrors(); }}
              mobile={suMobile}
              setMobile={(v) => { setSuMobile(v.replace(/\D/g, '').slice(0, 10)); clearErrors(); }}
              gameId={suGameId}
              setGameId={(v) => { setSuGameId(v); clearErrors(); }}
              gameType={suGameType}
              setGameType={setSuGameType}
              upiId={suUpiId}
              setUpiId={setSuUpiId}
              password={suPassword}
              setPassword={(v) => { setSuPassword(v); clearErrors(); }}
              confirm={suConfirm}
              setConfirm={(v) => { setSuConfirm(v); clearErrors(); }}
              showPw={suShowPw}
              toggleShowPw={() => setSuShowPw((p) => !p)}
              showConfirm={suShowConfirm}
              toggleShowConfirm={() => setSuShowConfirm((p) => !p)}
              errors={errors}
              serverError={serverError}
              loading={loading}
              onSubmit={handleSignUp}
              mobileRef={suMobileRef}
              gameIdRef={suGameIdRef}
              pwRef={suPwRef}
              confirmRef={suConfirmRef}
            />
          )}
        </View>

        {/* ── Switch mode hint ── */}
        <View style={styles.switchHintRow}>
          <Text style={[styles.switchHintText, { color: c.mutedForeground }]}>
            {mode === 'signin' ? "New to BattleZone? " : 'Already have an account? '}
          </Text>
          <Pressable onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
            <Text style={[styles.switchHintLink, { color: c.primary }]}>
              {mode === 'signin' ? 'Create account' : 'Sign in'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Sign-In Sub-form ─────────────────────────────────────────────────────────
function SignInForm({
  c, username, setUsername, password, setPassword,
  showPw, toggleShowPw, errors, serverError, loading, onSubmit, pwRef,
}: any) {
  return (
    <>
      <Text style={[styles.cardTitle, { color: c.foreground }]}>Welcome back</Text>
      <Text style={[styles.cardSub, { color: c.mutedForeground }]}>
        Sign in to your BattleZone account
      </Text>

      <FieldLabel c={c} label="USERNAME" />
      <InputWrap
        c={c}
        icon="person-outline"
        error={!!errors.siUsername}
        value={username}
        onChangeText={setUsername}
        placeholder="Enter your username"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => pwRef.current?.focus()}
      />
      {!!errors.siUsername && <ErrText c={c} msg={errors.siUsername} />}

      <FieldLabel c={c} label="PASSWORD" />
      <PasswordInput
        c={c}
        value={password}
        onChangeText={setPassword}
        show={showPw}
        toggleShow={toggleShowPw}
        error={!!errors.siPassword}
        placeholder="Enter your password"
        inputRef={pwRef}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      {!!errors.siPassword && <ErrText c={c} msg={errors.siPassword} />}

      {!!serverError && <ServerErr c={c} msg={serverError} />}

      <SubmitBtn c={c} loading={loading} onPress={onSubmit} label="Enter Arena" />
    </>
  );
}

// ─── Sign-Up Sub-form ─────────────────────────────────────────────────────────
function SignUpForm({
  c, username, setUsername, mobile, setMobile, gameId, setGameId,
  gameType, setGameType, upiId, setUpiId, password, setPassword, confirm, setConfirm,
  showPw, toggleShowPw, showConfirm, toggleShowConfirm,
  errors, serverError, loading, onSubmit,
  mobileRef, gameIdRef, pwRef, confirmRef,
}: any) {
  return (
    <>
      <Text style={[styles.cardTitle, { color: c.foreground }]}>Create account</Text>
      <Text style={[styles.cardSub, { color: c.mutedForeground }]}>
        Join the arena — set up your gamer profile
      </Text>

      {/* Game selector */}
      <FieldLabel c={c} label="SELECT GAME" />
      <View style={[styles.toggleRow, { backgroundColor: c.muted }]}>
        {(['BGMI', 'FreeFire'] as GameType[]).map((g) => {
          const isActive = gameType === g;
          const activeColor = g === 'BGMI' ? '#FF6B00' : '#FF2D78';
          return (
            <Pressable
              key={g}
              onPress={() => setGameType(g)}
              style={[styles.toggleBtn, isActive && { backgroundColor: activeColor }]}
            >
              <Text style={[styles.toggleText, { color: isActive ? '#fff' : c.mutedForeground }]}>
                {g === 'FreeFire' ? 'Free Fire' : 'BGMI'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FieldLabel c={c} label="USERNAME" />
      <InputWrap
        c={c}
        icon="person-outline"
        error={!!errors.suUsername}
        value={username}
        onChangeText={setUsername}
        placeholder="Choose a username"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => mobileRef.current?.focus()}
      />
      {!!errors.suUsername && <ErrText c={c} msg={errors.suUsername} />}

      <FieldLabel c={c} label="MOBILE NUMBER" />
      <InputWrap
        c={c}
        icon="call-outline"
        error={!!errors.suMobile}
        value={mobile}
        onChangeText={setMobile}
        placeholder="10-digit number"
        keyboardType="number-pad"
        maxLength={10}
        inputRef={mobileRef}
        returnKeyType="next"
        onSubmitEditing={() => gameIdRef.current?.focus()}
      />
      {!!errors.suMobile && <ErrText c={c} msg={errors.suMobile} />}

      <FieldLabel c={c} label={`${gameType === 'BGMI' ? 'BGMI' : 'FREE FIRE'} GAME ID`} />
      <InputWrap
        c={c}
        iconComponent={<MaterialCommunityIcons name="identifier" size={16} color={c.mutedForeground} />}
        error={!!errors.suGameId}
        value={gameId}
        onChangeText={setGameId}
        placeholder={`Your ${gameType === 'BGMI' ? 'BGMI' : 'Free Fire'} ID`}
        autoCapitalize="none"
        autoCorrect={false}
        inputRef={gameIdRef}
        returnKeyType="next"
        onSubmitEditing={() => pwRef.current?.focus()}
      />
      {!!errors.suGameId && <ErrText c={c} msg={errors.suGameId} />}

      {/* UPI ID — optional */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 6 }}>
        <Text style={[styles.label, { color: c.mutedForeground, marginTop: 0, marginBottom: 0, flex: 1 }]}>
          UPI ID / PHONEPЕ NUMBER
        </Text>
        <View style={{ backgroundColor: 'rgba(255,107,0,0.12)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Inter_600SemiBold', color: c.primary, letterSpacing: 0.5 }}>
            OPTIONAL
          </Text>
        </View>
      </View>
      <InputWrap
        c={c}
        icon="wallet-outline"
        value={upiId}
        onChangeText={setUpiId}
        placeholder="yourname@upi or 9876543210"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => pwRef.current?.focus()}
      />
      <Text style={[styles.errText, { color: c.mutedForeground, marginTop: 4, marginBottom: 4 }]}>
        For receiving prize payouts. Can also be set later in Earnings tab.
      </Text>

      <FieldLabel c={c} label="PASSWORD" />
      <PasswordInput
        c={c}
        value={password}
        onChangeText={setPassword}
        show={showPw}
        toggleShow={toggleShowPw}
        error={!!errors.suPassword}
        placeholder="Create a password (min. 6 chars)"
        inputRef={pwRef}
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      {!!errors.suPassword && <ErrText c={c} msg={errors.suPassword} />}

      <FieldLabel c={c} label="CONFIRM PASSWORD" />
      <PasswordInput
        c={c}
        value={confirm}
        onChangeText={setConfirm}
        show={showConfirm}
        toggleShow={toggleShowConfirm}
        error={!!errors.suConfirm}
        placeholder="Re-enter your password"
        inputRef={confirmRef}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      {!!errors.suConfirm && <ErrText c={c} msg={errors.suConfirm} />}

      {!!serverError && <ServerErr c={c} msg={serverError} />}

      <SubmitBtn c={c} loading={loading} onPress={onSubmit} label="Join the Arena" />
    </>
  );
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function FieldLabel({ c, label }: { c: any; label: string }) {
  return (
    <Text style={[styles.label, { color: c.mutedForeground }]}>{label}</Text>
  );
}

function InputWrap({
  c, icon, iconComponent, error, inputRef, ...props
}: any) {
  return (
    <View
      style={[
        styles.inputWrap,
        { backgroundColor: c.input, borderColor: error ? c.destructive : c.border },
      ]}
    >
      {iconComponent ?? (
        <Ionicons name={icon} size={16} color={c.mutedForeground} />
      )}
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: c.foreground }]}
        placeholderTextColor={c.mutedForeground}
        {...props}
      />
    </View>
  );
}

function PasswordInput({
  c, value, onChangeText, show, toggleShow, error, placeholder, inputRef,
  returnKeyType, onSubmitEditing,
}: any) {
  return (
    <View
      style={[
        styles.inputWrap,
        { backgroundColor: c.input, borderColor: error ? c.destructive : c.border },
      ]}
    >
      <Ionicons name="lock-closed-outline" size={16} color={c.mutedForeground} />
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: c.foreground }]}
        placeholder={placeholder}
        placeholderTextColor={c.mutedForeground}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      <Pressable onPress={toggleShow} hitSlop={8}>
        <Ionicons
          name={show ? 'eye-off-outline' : 'eye-outline'}
          size={18}
          color={c.mutedForeground}
        />
      </Pressable>
    </View>
  );
}

function ErrText({ c, msg }: { c: any; msg: string }) {
  return (
    <Text style={[styles.errText, { color: c.destructive }]}>{msg}</Text>
  );
}

function ServerErr({ c, msg }: { c: any; msg: string }) {
  return (
    <View style={[styles.serverErrBox, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }]}>
      <Ionicons name="alert-circle-outline" size={15} color={c.destructive} />
      <Text style={[styles.serverErrText, { color: c.destructive }]}>{msg}</Text>
    </View>
  );
}

function SubmitBtn({ c, loading, onPress, label }: { c: any; loading: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.submitBtn,
        { backgroundColor: c.primary, opacity: pressed || loading ? 0.8 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.submitBtnText}>{label}</Text>
      )}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },

  logoArea: { alignItems: 'center', marginBottom: 24 },
  logoCircle: {
    width: 84, height: 84, borderRadius: 42, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  appName: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  tagline: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 4, letterSpacing: 0.3 },

  modeTabs: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
  },
  modeTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'transparent',
  },
  modeTabText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  card: { borderRadius: 20, borderWidth: 1, padding: 24 },
  cardTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  cardSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 20 },

  label: {
    fontSize: 10, fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8, marginBottom: 6, marginTop: 14,
  },
  toggleRow: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 2 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  toggleText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },

  errText: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4, marginLeft: 2 },
  serverErrBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 16, padding: 12, borderRadius: 10, borderWidth: 1,
  },
  serverErrText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },

  submitBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  submitBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.5 },

  switchHintRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 20, gap: 4,
  },
  switchHintText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  switchHintLink: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});
