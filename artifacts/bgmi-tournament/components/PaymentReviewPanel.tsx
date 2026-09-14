import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

type PaymentAttempt = {
  id: number;
  utr: string;
  amount: number;
  tournamentId: string;
  username: string;
  status: string;
  createdAt: string;
  reviewNote?: string | null;
};

function paymentsUrl(path = '') {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api/payments${path}` : '';
}

export function PaymentReviewPanel() {
  const c = useColors();
  const [payments, setPayments] = useState<PaymentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const loadPayments = useCallback(async () => {
    const url = paymentsUrl();
    if (!url) return;
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      const payload = await response.json() as { payments?: PaymentAttempt[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load payment status');
      setPayments(payload.payments ?? []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load payment status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
    const interval = setInterval(loadPayments, 5000);
    return () => clearInterval(interval);
  }, [loadPayments]);

  async function review(id: number, action: 'APPROVE' | 'REJECT') {
    setBusyId(id);
    try {
      const response = await fetch(paymentsUrl(`/${id}/review`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Unable to update payment');
      await loadPayments();
    } catch (err) {
      Alert.alert('Payment Review', err instanceof Error ? err.message : 'Unable to update payment');
    } finally {
      setBusyId(null);
    }
  }

  const flagged = payments.filter((payment) => ['FLAGGED', 'DUPLICATE'].includes(payment.status));
  const recentApproved = payments.filter((payment) =>
    ['APPROVED', 'MANUALLY_APPROVED'].includes(payment.status),
  ).length;

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,107,0,0.12)' }]}>
          <Ionicons name="pulse-outline" size={18} color={c.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: c.foreground }]}>Payment Verification</Text>
          <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
            Live status · refreshes every 5 seconds
          </Text>
        </View>
        {loading && <ActivityIndicator size="small" color={c.primary} />}
      </View>

      {error ? (
        <Text style={[styles.error, { color: c.warning }]}>
          {error}. Set PAYMENT_ADMIN_SECRET with backend auth before production use.
        </Text>
      ) : (
        <>
          <View style={styles.stats}>
            <View style={[styles.stat, { backgroundColor: c.muted }]}>
              <Text style={[styles.statValue, { color: '#EAB308' }]}>{flagged.length}</Text>
              <Text style={[styles.statLabel, { color: c.mutedForeground }]}>Needs review</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: c.muted }]}>
              <Text style={[styles.statValue, { color: '#22C55E' }]}>{recentApproved}</Text>
              <Text style={[styles.statLabel, { color: c.mutedForeground }]}>Approved</Text>
            </View>
          </View>

          {flagged.length === 0 ? (
            <Text style={[styles.empty, { color: c.mutedForeground }]}>No flagged UTR submissions.</Text>
          ) : (
            flagged.slice(0, 5).map((payment) => (
              <View key={payment.id} style={[styles.paymentRow, { borderColor: c.border }]}>
                <View style={styles.paymentCopy}>
                  <Text style={[styles.username, { color: c.foreground }]}>{payment.username}</Text>
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>
                    UTR {payment.utr} · ₹{payment.amount} · {payment.status}
                  </Text>
                  <Text style={[styles.meta, { color: c.mutedForeground }]}>
                    Tournament {payment.tournamentId}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    disabled={busyId === payment.id}
                    onPress={() => review(payment.id, 'APPROVE')}
                    style={[styles.action, { backgroundColor: 'rgba(34,197,94,0.16)' }]}
                  >
                    <Ionicons name="checkmark" size={15} color="#22C55E" />
                  </Pressable>
                  <Pressable
                    disabled={busyId === payment.id}
                    onPress={() => review(payment.id, 'REJECT')}
                    style={[styles.action, { backgroundColor: 'rgba(239,68,68,0.16)' }]}
                  >
                    <Ionicons name="close" size={15} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  error: { fontSize: 12, lineHeight: 17, marginTop: 12 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, borderRadius: 10, padding: 10 },
  statValue: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', marginTop: 2 },
  empty: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 14 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingVertical: 12 },
  paymentCopy: { flex: 1, gap: 3 },
  username: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  meta: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  actions: { flexDirection: 'row', gap: 7, marginLeft: 8 },
  action: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});