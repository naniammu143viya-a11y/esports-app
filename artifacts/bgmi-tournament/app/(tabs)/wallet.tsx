import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import { useWallet } from '@/context/WalletContext';
import type { EarningRecord } from '@/context/WalletContext';

// ─── Withdraw Modal ───────────────────────────────────────────────────────────
function WithdrawModal({
  balance,
  defaultUpiId,
  onClose,
  onSubmit,
}: {
  balance: number;
  defaultUpiId: string;
  onClose: () => void;
  onSubmit: (amount: number, upiId: string) => Promise<void>;
}) {
  const c = useColors();
  const [amountStr, setAmountStr] = useState(String(balance));
  const [upiId, setUpiId] = useState(defaultUpiId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    const amount = parseInt(amountStr, 10);
    if (!amount || amount <= 0) return setError('Enter a valid amount.');
    if (amount > balance) return setError(`Max withdrawal is ₹${balance}.`);
    if (!upiId.trim()) return setError('UPI ID / PhonePe number is required.');

    setLoading(true);
    try {
      await onSubmit(amount, upiId.trim());
    } catch (e: any) {
      setError(e?.message ?? 'Failed to submit request.');
      setLoading(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.wdBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.wdSheet, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.wdHeader}>
            <Text style={[styles.wdTitle, { color: c.foreground }]}>Withdraw Earnings</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color={c.mutedForeground} />
            </Pressable>
          </View>

          <Text style={[styles.wdLabel, { color: c.mutedForeground }]}>AMOUNT (₹)</Text>
          <View style={[styles.wdInputWrap, { backgroundColor: c.input, borderColor: c.border }]}>
            <Text style={[styles.rupee, { color: c.mutedForeground }]}>₹</Text>
            <TextInput
              style={[styles.wdInput, { color: c.foreground }]}
              value={amountStr}
              onChangeText={(v) => { setAmountStr(v.replace(/\D/g, '')); setError(''); }}
              keyboardType="number-pad"
              placeholder="Enter amount"
              placeholderTextColor={c.mutedForeground}
            />
            <Pressable onPress={() => setAmountStr(String(balance))}>
              <Text style={[styles.maxBtn, { color: c.primary }]}>MAX</Text>
            </Pressable>
          </View>

          <Text style={[styles.wdLabel, { color: c.mutedForeground }]}>UPI ID / PHONEPЕ NUMBER</Text>
          <View style={[styles.wdInputWrap, { backgroundColor: c.input, borderColor: c.border }]}>
            <Ionicons name="wallet-outline" size={16} color={c.mutedForeground} />
            <TextInput
              style={[styles.wdInput, { color: c.foreground }]}
              value={upiId}
              onChangeText={(v) => { setUpiId(v); setError(''); }}
              placeholder="yourname@upi or 9876543210"
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {!!error && (
            <Text style={[styles.wdError, { color: c.destructive }]}>{error}</Text>
          )}

          <Text style={[styles.wdHint, { color: c.mutedForeground }]}>
            Admin will verify and send the money to your UPI within 24 hours.
          </Text>

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => [styles.wdBtn, { backgroundColor: c.primary, opacity: pressed || loading ? 0.8 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={16} color="#fff" />
                <Text style={styles.wdBtnText}>Submit Request</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── UPI Edit Modal ───────────────────────────────────────────────────────────
function EditUpiModal({
  current,
  onClose,
  onSave,
}: {
  current: string;
  onClose: () => void;
  onSave: (upiId: string) => Promise<void>;
}) {
  const c = useColors();
  const [value, setValue] = useState(current);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!value.trim()) return;
    setLoading(true);
    try {
      await onSave(value.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.wdBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.wdSheet, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.wdHeader}>
            <Text style={[styles.wdTitle, { color: c.foreground }]}>Payout Details</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color={c.mutedForeground} />
            </Pressable>
          </View>

          <Text style={[styles.wdLabel, { color: c.mutedForeground }]}>UPI ID / PHONEPЕ NUMBER</Text>
          <View style={[styles.wdInputWrap, { backgroundColor: c.input, borderColor: c.border }]}>
            <Ionicons name="wallet-outline" size={16} color={c.mutedForeground} />
            <TextInput
              style={[styles.wdInput, { color: c.foreground }]}
              value={value}
              onChangeText={setValue}
              placeholder="yourname@upi or 9876543210"
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>

          <Pressable
            onPress={handleSave}
            disabled={loading}
            style={({ pressed }) => [styles.wdBtn, { backgroundColor: c.primary, opacity: pressed || loading ? 0.8 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.wdBtnText}>Save</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Earning Row ──────────────────────────────────────────────────────────────
function EarningRow({ record }: { record: EarningRecord }) {
  const c = useColors();
  const date = (() => {
    try {
      return new Date(record.declaredAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch {
      return '';
    }
  })();

  return (
    <View style={[styles.earningRow, { borderBottomColor: c.border }]}>
      <View style={[styles.earningIcon, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
        <Ionicons name="trophy" size={18} color="#22C55E" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.earningName, { color: c.foreground }]} numberOfLines={1}>
          {record.tournamentName}
        </Text>
        <Text style={[styles.earningDate, { color: c.mutedForeground }]}>{date}</Text>
      </View>
      <Text style={styles.earningAmount}>+₹{record.amount.toLocaleString()}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WalletScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const { wallet, requestWithdrawal, refreshWallet } = useWallet();

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showEditUpi, setShowEditUpi] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const upiId = user?.upiId ?? '';

  async function handleWithdraw(amount: number, upiIdVal: string) {
    // Also save the UPI ID to their profile if different
    if (upiIdVal !== upiId) {
      await updateProfile({ upiId: upiIdVal });
    }
    await requestWithdrawal(amount, upiIdVal);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowWithdraw(false);
    setWithdrawSuccess(true);
    setTimeout(() => setWithdrawSuccess(false), 4000);
    await refreshWallet();
  }

  async function handleSaveUpi(newUpiId: string) {
    await updateProfile({ upiId: newUpiId });
    setShowEditUpi(false);
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <FlatList
        data={wallet.earnings}
        keyExtractor={(r) => r.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={[styles.header, { paddingTop: topPad + 10 }]}>
              <Text style={[styles.headerTitle, { color: c.foreground }]}>My Earnings</Text>
              <MaterialCommunityIcons name="wallet" size={22} color={c.primary} />
            </View>

            {/* Balance card */}
            <View style={[styles.balanceCard, { backgroundColor: c.primary }]}>
              <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
              <Text style={styles.balanceAmount}>₹{wallet.balance.toLocaleString()}</Text>
              <Text style={styles.balanceSub}>Total won: ₹{wallet.totalEarned.toLocaleString()}</Text>

              {wallet.balance > 0 && (
                <Pressable
                  onPress={() => setShowWithdraw(true)}
                  style={({ pressed }) => [styles.withdrawBtn, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <Ionicons name="send-outline" size={15} color={c.primary} />
                  <Text style={[styles.withdrawBtnText, { color: c.primary }]}>Withdraw</Text>
                </Pressable>
              )}
            </View>

            {/* Withdraw success banner */}
            {withdrawSuccess && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                <Text style={styles.successBannerText}>
                  Withdrawal request sent! Admin will process it shortly.
                </Text>
              </View>
            )}

            {/* UPI ID section */}
            <View style={[styles.upiCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.upiCardLabel, { color: c.mutedForeground }]}>PAYOUT UPI ID</Text>
                <Text style={[styles.upiCardValue, { color: upiId ? c.foreground : c.mutedForeground }]}>
                  {upiId || 'Not set — add your UPI ID'}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowEditUpi(true)}
                style={[styles.editUpiBtn, { backgroundColor: c.muted }]}
              >
                <Ionicons name="pencil-outline" size={14} color={c.mutedForeground} />
                <Text style={[styles.editUpiBtnText, { color: c.mutedForeground }]}>
                  {upiId ? 'Edit' : 'Add'}
                </Text>
              </Pressable>
            </View>

            {/* Earnings history header */}
            {wallet.earnings.length > 0 && (
              <Text style={[styles.sectionLabel, { color: c.mutedForeground }]}>
                PRIZE HISTORY
              </Text>
            )}
          </>
        }
        renderItem={({ item }) => <EarningRow record={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="trophy-outline" size={48} color={c.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: c.foreground }]}>No Earnings Yet</Text>
            <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
              Win tournaments to see your prize history here.
            </Text>
          </View>
        }
      />

      {/* Modals */}
      {showWithdraw && (
        <WithdrawModal
          balance={wallet.balance}
          defaultUpiId={upiId}
          onClose={() => setShowWithdraw(false)}
          onSubmit={handleWithdraw}
        />
      )}
      {showEditUpi && (
        <EditUpiModal
          current={upiId}
          onClose={() => setShowEditUpi(false)}
          onSave={handleSaveUpi}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  listContent: { paddingHorizontal: 16 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontFamily: 'Inter_700Bold' },

  // Balance card
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 14,
    alignItems: 'center',
    gap: 4,
  },
  balanceLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.8,
  },
  balanceAmount: {
    fontSize: 42,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
    marginVertical: 4,
  },
  balanceSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 8,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  withdrawBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold' },

  // Success banner
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  successBannerText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: '#22C55E' },

  // UPI card
  upiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  upiCardLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.8, marginBottom: 4 },
  upiCardValue: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  editUpiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  editUpiBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  // Earning row
  earningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  earningIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earningName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  earningDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  earningAmount: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#22C55E',
  },

  // Empty
  empty: { alignItems: 'center', paddingTop: 40, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  // Withdraw modal
  wdBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  wdSheet: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 0,
  },
  wdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  wdTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  wdLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 14,
  },
  wdInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rupee: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  wdInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  maxBtn: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  wdError: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6 },
  wdHint: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 10, lineHeight: 16 },
  wdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 16,
  },
  wdBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
});
