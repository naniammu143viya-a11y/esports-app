import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { useTournaments } from '@/context/TournamentContext';
import { ADMIN_UPI_KEY } from '@/context/WalletContext';
import type { Tournament } from '@/context/TournamentContext';

const UPI_NAME = 'BattleZone Tournaments';
const FALLBACK_UPI = 'battlezone@upi'; // shown only if admin hasn't set one

function buildUpiUrl(upiId: string, amount: number, note: string) {
  return (
    `upi://pay?pa=${encodeURIComponent(upiId)}` +
    `&pn=${encodeURIComponent(UPI_NAME)}` +
    `&am=${amount}.00` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(note)}`
  );
}

const UPI_APPS = [
  {
    label: 'PhonePe',
    icon: 'phone-portrait-outline' as const,
    color: '#5F259F',
    bg: 'rgba(95,37,159,0.12)',
    packageName: 'com.phonepe.app',
  },
  {
    label: 'Google Pay',
    icon: 'logo-google' as const,
    color: '#1A73E8',
    bg: 'rgba(26,115,232,0.12)',
    packageName: 'com.google.android.apps.nbu.paisa.user',
  },
  {
    label: 'Paytm',
    icon: 'wallet-outline' as const,
    color: '#00BAF2',
    bg: 'rgba(0,186,242,0.12)',
    packageName: 'net.one97.paytm',
  },
  {
    label: 'Any UPI',
    icon: 'apps-outline' as const,
    color: '#FF6B00',
    bg: 'rgba(255,107,0,0.12)',
    packageName: undefined,
  },
];

type Step = 'payment' | 'verifying' | 'success';

interface Props {
  tournament: Tournament;
  onClose: () => void;
}

export function PaymentModal({ tournament, onClose }: Props) {
  const c = useColors();
  const { user } = useAuth();
  const { confirmPayment } = useTournaments();
  const [step, setStep] = useState<Step>('payment');
  const [paymentId, setPaymentId] = useState('');
  const [intentLaunched, setIntentLaunched] = useState(false);
  const [adminUpiId, setAdminUpiId] = useState<string>(FALLBACK_UPI);
  const [upiLoaded, setUpiLoaded] = useState(false);

  // ── Load admin's UPI ID from storage ──
  useEffect(() => {
    AsyncStorage.getItem(ADMIN_UPI_KEY).then((stored) => {
      if (stored && stored.trim()) setAdminUpiId(stored.trim());
      setUpiLoaded(true);
    });
  }, []);

  const upiUrl = upiLoaded
    ? buildUpiUrl(adminUpiId, tournament.entryFee, `Entry: ${tournament.name}`)
    : '';

  async function openUpiApp(packageName?: string) {
    if (!upiUrl) return;

    try {
      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: upiUrl,
          ...(packageName ? { packageName } : {}),
        });
        setIntentLaunched(true);
        return;
      }

      if (await Linking.canOpenURL(upiUrl)) {
        await Linking.openURL(upiUrl);
        setIntentLaunched(true);
        return;
      }
    } catch {
      // A package-targeted Android intent can fail when that specific app is
      // not installed. Try the generic UPI handler before showing an error.
      if (Platform.OS === 'android' && packageName) {
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: upiUrl,
          });
          setIntentLaunched(true);
          return;
        } catch {
          // Fall through to the user-facing message below.
        }
      }
    }

    Alert.alert(
      'No UPI App Found',
      'Please install PhonePe, Google Pay, or Paytm and try again, or scan the QR code above.',
    );
  }

  async function handleConfirmPayment() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('verifying');
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const id = await confirmPayment(tournament.id, tournament.entryFee, {
        username: user?.username ?? 'Unknown',
        mobile: user?.mobile ?? '',
        gameId: user?.gameId ?? '',
        gameType: user?.gameType ?? 'BGMI',
      });
      setPaymentId(id);
      setStep('success');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(onClose, 2500);
    } catch {
      setStep('payment');
      Alert.alert('Error', 'Payment confirmation failed. Please try again.');
    }
  }

  const availableSeats = tournament.maxTeams - tournament.registeredTeams;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>

          {step === 'payment' && (
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={c.mutedForeground} />
            </Pressable>
          )}

          {/* ═══════════════════ PAYMENT STEP ═══════════════════ */}
          {step === 'payment' && (
            <>
              <View style={styles.tourneyHeader}>
                <View style={[styles.gameDot, {
                  backgroundColor: tournament.game === 'BGMI' ? '#FF6B00' : '#FF2D78',
                }]} />
                <Text style={[styles.tourneyName, { color: c.foreground }]} numberOfLines={1}>
                  {tournament.name}
                </Text>
              </View>

              <View style={styles.amountRow}>
                <Text style={[styles.amountLabel, { color: c.mutedForeground }]}>ENTRY FEE</Text>
                <Text style={[styles.amount, { color: c.primary }]}>₹{tournament.entryFee}</Text>
              </View>

              {/* Prize structure info */}
              {(tournament.perKillPrize > 0 || tournament.rankPrizes?.rank1 > 0) && (
                <View style={[styles.prizeRow, { backgroundColor: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.2)' }]}>
                  <Ionicons name="trophy-outline" size={13} color="#EAB308" />
                  <Text style={styles.prizeText}>
                    {tournament.perKillPrize > 0 ? `₹${tournament.perKillPrize}/kill` : ''}
                    {tournament.perKillPrize > 0 && tournament.rankPrizes?.rank1 > 0 ? '  ·  ' : ''}
                    {tournament.rankPrizes?.rank1 > 0 ? `🥇₹${tournament.rankPrizes.rank1}` : ''}
                    {tournament.rankPrizes?.rank2 > 0 ? `  🥈₹${tournament.rankPrizes.rank2}` : ''}
                    {tournament.rankPrizes?.rank3 > 0 ? `  🥉₹${tournament.rankPrizes.rank3}` : ''}
                  </Text>
                </View>
              )}

              {availableSeats <= 5 && availableSeats > 0 && (
                <View style={styles.seatAlert}>
                  <Ionicons name="alert-circle-outline" size={13} color="#EAB308" />
                  <Text style={styles.seatAlertText}>Only {availableSeats} seat{availableSeats > 1 ? 's' : ''} left!</Text>
                </View>
              )}

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              {!upiLoaded ? (
                <View style={styles.qrLoading}>
                  <ActivityIndicator size="small" color={c.primary} />
                  <Text style={[styles.qrLoadingText, { color: c.mutedForeground }]}>Loading payment details…</Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>SCAN QR CODE</Text>
                  <View style={styles.qrWrap}>
                    <View style={styles.qrPad}>
                      <QRCode value={upiUrl} size={160} backgroundColor="#ffffff" color="#000000" />
                    </View>
                    <Text style={[styles.upiIdText, { color: c.mutedForeground }]}>
                      UPI: {adminUpiId}
                    </Text>
                  </View>

                  <View style={styles.orRow}>
                    <View style={[styles.orLine, { backgroundColor: c.border }]} />
                    <Text style={[styles.orText, { color: c.mutedForeground }]}>OR PAY WITH</Text>
                    <View style={[styles.orLine, { backgroundColor: c.border }]} />
                  </View>

                  <View style={styles.appGrid}>
                    {UPI_APPS.map((app) => (
                      <Pressable
                        key={app.label}
                        onPress={() => openUpiApp(app.packageName)}
                        style={({ pressed }) => [styles.appBtn, { backgroundColor: app.bg, opacity: pressed ? 0.75 : 1 }]}
                      >
                        <Ionicons name={app.icon} size={20} color={app.color} />
                        <Text style={[styles.appBtnText, { color: app.color }]}>{app.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <View style={[styles.divider, { backgroundColor: c.border }]} />

              <Pressable
                onPress={handleConfirmPayment}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  { backgroundColor: intentLaunched ? '#22C55E' : c.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <MaterialCommunityIcons
                  name={intentLaunched ? 'check-circle-outline' : 'currency-inr'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.confirmBtnText}>
                  {intentLaunched ? "I've Paid — Confirm Registration" : 'I Have Paid'}
                </Text>
              </Pressable>

              <Text style={[styles.disclaimer, { color: c.mutedForeground }]}>
                Tap a UPI app or scan the QR, then confirm once payment is complete.
              </Text>
            </>
          )}

          {/* ═══════════════════ VERIFYING STEP ═══════════════════ */}
          {step === 'verifying' && (
            <View style={styles.centeredStep}>
              <ActivityIndicator size="large" color={c.primary} />
              <Text style={[styles.stepTitle, { color: c.foreground }]}>Verifying Payment</Text>
              <Text style={[styles.stepSub, { color: c.mutedForeground }]}>
                Please wait while we confirm your payment…
              </Text>
            </View>
          )}

          {/* ═══════════════════ SUCCESS STEP ═══════════════════ */}
          {step === 'success' && (
            <View style={styles.centeredStep}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={36} color="#22C55E" />
              </View>
              <Text style={[styles.stepTitle, { color: c.foreground }]}>Payment Confirmed!</Text>
              <Text style={[styles.stepSub, { color: c.mutedForeground }]}>
                You're registered for{'\n'}
                <Text style={{ color: c.foreground, fontFamily: 'Inter_700Bold' }}>
                  {tournament.name}
                </Text>
              </Text>
              <View style={[styles.payIdBox, { backgroundColor: c.muted }]}>
                <Text style={[styles.payIdLabel, { color: c.mutedForeground }]}>PAYMENT ID</Text>
                <Text style={[styles.payIdValue, { color: '#22C55E' }]}>{paymentId}</Text>
              </View>
              <Text style={[styles.stepSub, { color: c.mutedForeground, fontSize: 12 }]}>
                Room details unlock 15 minutes before the match.
              </Text>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0,
    padding: 24, paddingBottom: 40,
  },
  closeBtn: { position: 'absolute', top: 16, right: 20, zIndex: 10, padding: 4 },
  tourneyHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingRight: 36,
  },
  gameDot: { width: 10, height: 10, borderRadius: 5 },
  tourneyName: { fontSize: 16, fontFamily: 'Inter_700Bold', flex: 1 },
  amountRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  amountLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },
  amount: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  prizeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8,
  },
  prizeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#EAB308', flex: 1 },
  seatAlert: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  seatAlertText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#EAB308' },
  divider: { height: 1, marginVertical: 16 },
  qrLoading: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  qrLoadingText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  sectionLabel: {
    fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8,
    textAlign: 'center', marginBottom: 12,
  },
  qrWrap: { alignItems: 'center', marginBottom: 8, gap: 10 },
  qrPad: { padding: 12, backgroundColor: '#ffffff', borderRadius: 12 },
  upiIdText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },
  appGrid: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  appBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, paddingVertical: 10 },
  appBtnText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 15, marginBottom: 10,
  },
  confirmBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  disclaimer: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 16 },
  centeredStep: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  stepTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginTop: 8 },
  stepSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  successCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 2, borderColor: 'rgba(34,197,94,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  payIdBox: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, gap: 4 },
  payIdLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8 },
  payIdValue: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
});
