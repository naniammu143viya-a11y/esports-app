import React, { useState } from 'react';
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
import { useColors } from '@/hooks/useColors';
import { useTournaments } from '@/context/TournamentContext';
import type { Tournament } from '@/context/TournamentContext';

// ─── Config ─────────────────────────────────────────────────────────────────
const UPI_ID = 'battlezone@upi';
const UPI_NAME = 'BattleZone Tournaments';

function buildUpiUrl(amount: number, note: string) {
  return (
    `upi://pay?pa=${encodeURIComponent(UPI_ID)}` +
    `&pn=${encodeURIComponent(UPI_NAME)}` +
    `&am=${amount}.00` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(note)}`
  );
}

// ─── UPI App Intent Buttons ──────────────────────────────────────────────────
const UPI_APPS = [
  {
    label: 'PhonePe',
    icon: 'phone-portrait-outline' as const,
    color: '#5F259F',
    bg: 'rgba(95,37,159,0.12)',
    getUrl: (upiUrl: string) => upiUrl.replace('upi://', 'phonepe://'),
  },
  {
    label: 'Google Pay',
    icon: 'logo-google' as const,
    color: '#1A73E8',
    bg: 'rgba(26,115,232,0.12)',
    getUrl: (upiUrl: string) => upiUrl.replace('upi://pay', 'tez://upi/pay'),
  },
  {
    label: 'Paytm',
    icon: 'wallet-outline' as const,
    color: '#00BAF2',
    bg: 'rgba(0,186,242,0.12)',
    getUrl: (upiUrl: string) => upiUrl.replace('upi://', 'paytmmp://'),
  },
  {
    label: 'Any UPI',
    icon: 'apps-outline' as const,
    color: '#FF6B00',
    bg: 'rgba(255,107,0,0.12)',
    getUrl: (upiUrl: string) => upiUrl,
  },
];

// ─── Step types ───────────────────────────────────────────────────────────────
type Step = 'payment' | 'verifying' | 'success';

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  tournament: Tournament;
  onClose: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PaymentModal({ tournament, onClose }: Props) {
  const c = useColors();
  const { confirmPayment } = useTournaments();
  const [step, setStep] = useState<Step>('payment');
  const [paymentId, setPaymentId] = useState('');
  const [intentLaunched, setIntentLaunched] = useState(false);

  const upiUrl = buildUpiUrl(
    tournament.entryFee,
    `Entry: ${tournament.name}`
  );

  async function openUpiApp(getUrl: (u: string) => string) {
    const url = getUrl(upiUrl);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        setIntentLaunched(true);
      } else {
        // Fallback to generic UPI URL
        const can = await Linking.canOpenURL(upiUrl);
        if (can) {
          await Linking.openURL(upiUrl);
          setIntentLaunched(true);
        } else {
          Alert.alert(
            'No UPI App Found',
            'Please install PhonePe, Google Pay, or Paytm and try again, or scan the QR code above.'
          );
        }
      }
    } catch {
      Alert.alert('Error', 'Could not open the payment app. Please scan the QR code instead.');
    }
  }

  async function handleConfirmPayment() {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setStep('verifying');

    // Simulate 2s payment verification
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const id = await confirmPayment(tournament.id, tournament.entryFee);
      setPaymentId(id);
      setStep('success');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // Auto-close after showing success
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

          {/* ── Close button ── */}
          {step === 'payment' && (
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={c.mutedForeground} />
            </Pressable>
          )}

          {/* ═══════════════════ PAYMENT STEP ═══════════════════ */}
          {step === 'payment' && (
            <>
              {/* Tournament header */}
              <View style={styles.tourneyHeader}>
                <View style={[styles.gameDot, {
                  backgroundColor: tournament.game === 'BGMI' ? '#FF6B00' : '#FF2D78'
                }]} />
                <Text style={[styles.tourneyName, { color: c.foreground }]} numberOfLines={1}>
                  {tournament.name}
                </Text>
              </View>

              {/* Amount */}
              <View style={styles.amountRow}>
                <Text style={[styles.amountLabel, { color: c.mutedForeground }]}>ENTRY FEE</Text>
                <Text style={[styles.amount, { color: c.primary }]}>₹{tournament.entryFee}</Text>
              </View>

              {/* Seat alert */}
              {availableSeats <= 5 && availableSeats > 0 && (
                <View style={styles.seatAlert}>
                  <Ionicons name="alert-circle-outline" size={13} color="#EAB308" />
                  <Text style={styles.seatAlertText}>Only {availableSeats} seat{availableSeats > 1 ? 's' : ''} left!</Text>
                </View>
              )}

              {/* Divider */}
              <View style={[styles.divider, { backgroundColor: c.border }]} />

              {/* QR Code */}
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>SCAN QR CODE</Text>
              <View style={styles.qrWrap}>
                <View style={styles.qrPad}>
                  <QRCode
                    value={upiUrl}
                    size={160}
                    backgroundColor="#ffffff"
                    color="#000000"
                  />
                </View>
                <Text style={[styles.upiIdText, { color: c.mutedForeground }]}>UPI: {UPI_ID}</Text>
              </View>

              {/* OR divider */}
              <View style={styles.orRow}>
                <View style={[styles.orLine, { backgroundColor: c.border }]} />
                <Text style={[styles.orText, { color: c.mutedForeground }]}>OR PAY WITH</Text>
                <View style={[styles.orLine, { backgroundColor: c.border }]} />
              </View>

              {/* UPI app buttons */}
              <View style={styles.appGrid}>
                {UPI_APPS.map((app) => (
                  <Pressable
                    key={app.label}
                    onPress={() => openUpiApp(app.getUrl)}
                    style={({ pressed }) => [
                      styles.appBtn,
                      { backgroundColor: app.bg, opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <Ionicons name={app.icon} size={20} color={app.color} />
                    <Text style={[styles.appBtnText, { color: app.color }]}>{app.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Divider */}
              <View style={[styles.divider, { backgroundColor: c.border }]} />

              {/* Confirm button */}
              <Pressable
                onPress={handleConfirmPayment}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  {
                    backgroundColor: intentLaunched ? '#22C55E' : c.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    paddingBottom: 40,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 10,
    padding: 4,
  },
  // Tournament header
  tourneyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingRight: 36,
  },
  gameDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tourneyName: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  // Amount
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  amount: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  // Seat alert
  seatAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  seatAlertText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#EAB308',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 12,
  },
  // QR
  qrWrap: {
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  qrPad: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
  },
  upiIdText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  // OR row
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
  },
  orLine: { flex: 1, height: 1 },
  orText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  // UPI app grid
  appGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  appBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 12,
    paddingVertical: 10,
  },
  appBtnText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  // Confirm button
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 10,
  },
  confirmBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  disclaimer: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 16,
  },
  // Centered steps (verifying / success)
  centeredStep: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  stepTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginTop: 8,
  },
  stepSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payIdBox: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  payIdLabel: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
  },
  payIdValue: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
});
