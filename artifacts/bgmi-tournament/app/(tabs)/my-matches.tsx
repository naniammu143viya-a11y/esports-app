import React, { useEffect, useState } from "react";
import { FlatList, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  isTournamentHiddenFromPlayers,
  useTournaments,
} from "@/context/TournamentContext";
import { GameBadge } from "@/components/GameBadge";
import type { Tournament } from "@/context/TournamentContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse tournament date+time into a Date object (local time). */
function parseMatchTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

/** Time (ms) until 15 minutes before the match starts. Negative = already in window. */
function msUntilReveal(tournament: Tournament): number {
  const matchMs = parseMatchTime(tournament.date, tournament.time).getTime();
  const revealMs = matchMs - 15 * 60 * 1000;
  return revealMs - Date.now();
}

/** Format a millisecond duration as "Xh Ym Zs" or "Ym Zs" */
function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Room Details Box (with live countdown) ───────────────────────────────────

function RoomDetailsBox({
  tournament,
  isPaid,
}: {
  tournament: Tournament;
  isPaid: boolean;
}) {
  const c = useColors();
  const [now, setNow] = useState(() => Date.now());

  // Tick every second to update countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Non-paid users: hide completely — show lock message
  if (!isPaid) {
    return (
      <View
        style={[
          styles.lockBox,
          {
            backgroundColor: "rgba(107,114,128,0.08)",
            borderColor: "rgba(107,114,128,0.25)",
          },
        ]}
      >
        <Ionicons name="lock-closed-outline" size={16} color="#6B7280" />
        <Text style={[styles.lockText, { color: "#6B7280" }]}>
          Complete payment to unlock room details
        </Text>
      </View>
    );
  }

  // Paid users: check 15-minute window
  const matchMs = parseMatchTime(tournament.date, tournament.time).getTime();
  const revealMs = matchMs - 15 * 60 * 1000;
  const shouldReveal = now >= revealMs;

  // Paid + before window → show countdown
  if (!shouldReveal) {
    const remaining = revealMs - now;
    const countdown = formatCountdown(remaining);

    return (
      <View
        style={[
          styles.countdownBox,
          {
            backgroundColor: "rgba(234,179,8,0.08)",
            borderColor: "rgba(234,179,8,0.3)",
          },
        ]}
      >
        <View style={styles.countdownHeader}>
          <Ionicons name="lock-closed" size={14} color="#EAB308" />
          <Text style={[styles.countdownTitle, { color: "#EAB308" }]}>
            Room details will be revealed 15 min before match
          </Text>
        </View>
        <View
          style={[
            styles.timerChip,
            { backgroundColor: "rgba(234,179,8,0.15)" },
          ]}
        >
          <Ionicons name="timer-outline" size={14} color="#EAB308" />
          <Text style={styles.timerText}>{countdown}</Text>
        </View>
        <Text style={[styles.countdownSub, { color: "#EAB308" }]}>
          Reveals at{" "}
          {new Date(revealMs).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  }

  // Paid + in window → check if admin has set room details
  if (!tournament.roomId) {
    return (
      <View
        style={[
          styles.pendingBox,
          {
            backgroundColor: "rgba(234,179,8,0.08)",
            borderColor: "rgba(234,179,8,0.3)",
          },
        ]}
      >
        <Ionicons name="time-outline" size={14} color="#EAB308" />
        <Text style={[styles.pendingText, { color: "#EAB308" }]}>
          Room details will be posted by admin shortly
        </Text>
      </View>
    );
  }

  // Paid + in window + room set → show details
  return (
    <View
      style={[
        styles.roomBox,
        {
          backgroundColor: "rgba(34,197,94,0.08)",
          borderColor: "rgba(34,197,94,0.3)",
        },
      ]}
    >
      <View style={styles.roomLive}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>ROOM LIVE</Text>
      </View>
      <View style={styles.roomRow}>
        <Text style={[styles.roomLabel, { color: c.mutedForeground }]}>
          ROOM ID
        </Text>
        <Text style={[styles.roomValue, { color: "#22C55E" }]}>
          {tournament.roomId}
        </Text>
      </View>
      <View
        style={[styles.roomDivider, { backgroundColor: "rgba(34,197,94,0.2)" }]}
      />
      <View style={styles.roomRow}>
        <Text style={[styles.roomLabel, { color: c.mutedForeground }]}>
          PASSWORD
        </Text>
        <Text style={[styles.roomValue, { color: "#22C55E" }]}>
          {tournament.password ?? "—"}
        </Text>
      </View>
    </View>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({
  tournament,
  isPaid,
}: {
  tournament: Tournament;
  isPaid: boolean;
}) {
  const c = useColors();
  const statusColor =
    tournament.status === "live"
      ? "#22C55E"
      : tournament.status === "upcoming"
        ? "#EAB308"
        : "#6B7280";

  const formattedDate = (() => {
    try {
      return new Date(tournament.date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return tournament.date;
    }
  })();

  const formattedTime = (() => {
    try {
      const [h, m] = tournament.time.split(":");
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayH = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayH}:${m} ${ampm}`;
    } catch {
      return tournament.time;
    }
  })();

  return (
    <View
      style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
    >
      <View style={styles.cardTop}>
        <GameBadge game={tournament.game} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {isPaid && (
            <View style={styles.paidBadge}>
              <Ionicons name="shield-checkmark" size={11} color="#22C55E" />
              <Text style={styles.paidBadgeText}>PAID</Text>
            </View>
          )}
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>
      </View>

      <Text style={[styles.tourneyName, { color: c.foreground }]}>
        {tournament.name}
      </Text>

      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Ionicons name="map-outline" size={12} color={c.mutedForeground} />
          <Text style={[styles.infoText, { color: c.mutedForeground }]}>
            {tournament.map}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons
            name="calendar-outline"
            size={12}
            color={c.mutedForeground}
          />
          <Text style={[styles.infoText, { color: c.mutedForeground }]}>
            {formattedDate} · {formattedTime}
          </Text>
        </View>
      </View>

      <View style={styles.prizeRow}>
        <View style={styles.prizeItem}>
          <Text style={[styles.prizeLabel, { color: c.mutedForeground }]}>
            ENTRY
          </Text>
          <Text style={[styles.prizeVal, { color: c.foreground }]}>
            {tournament.entryFee === 0
              ? "FREE"
              : `₹${tournament.entryFee.toLocaleString("en-IN")}`}
          </Text>
        </View>
        <View style={styles.prizeItem}>
          <Text style={[styles.prizeLabel, { color: c.mutedForeground }]}>
            PRIZE POOL
          </Text>
          <Text style={[styles.prizeVal, { color: c.accent }]}>
            ₹{tournament.prizePool.toLocaleString("en-IN")}
          </Text>
        </View>
        <View style={styles.prizeItem}>
          <Text style={[styles.prizeLabel, { color: c.mutedForeground }]}>
            SEATS LEFT
          </Text>
          <Text style={[styles.prizeVal, { color: c.foreground }]}>
            {tournament.maxTeams - tournament.registeredTeams}/
            {tournament.maxTeams}
          </Text>
        </View>
      </View>

      <View style={[styles.sectionDivider, { backgroundColor: c.border }]} />

      <Text style={[styles.roomTitle, { color: c.mutedForeground }]}>
        ROOM DETAILS
      </Text>
      <RoomDetailsBox tournament={tournament} isPaid={isPaid} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MyMatchesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { tournaments, joinedIds, payments } = useTournaments();

  const joined = tournaments.filter(
    (t) => joinedIds.includes(t.id) && !isTournamentHiddenFromPlayers(t),
  );
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  /**
   * Determine if user has "paid" access for a tournament.
   * Free tournaments (entryFee === 0): always paid.
   * Paid tournaments: must have a PAID payment record.
   */
  function isPaidFor(tournament: Tournament): boolean {
    if (tournament.entryFee === 0) return true;
    return !!payments[tournament.id];
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Text style={[styles.headerTitle, { color: c.foreground }]}>
          My Matches
        </Text>
        {user && (
          <View style={[styles.idBadge, { backgroundColor: c.muted }]}>
            <MaterialCommunityIcons
              name="identifier"
              size={12}
              color={c.mutedForeground}
            />
            <Text style={[styles.idText, { color: c.mutedForeground }]}>
              {user.gameId}
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={joined}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <MatchCard tournament={item} isPaid={isPaidFor(item)} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="controller-off"
              size={48}
              color={c.mutedForeground}
            />
            <Text style={[styles.emptyTitle, { color: c.foreground }]}>
              No Matches Yet
            </Text>
            <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
              Join tournaments from the Lobby tab
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  idBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  idText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  listContent: { paddingHorizontal: 16, paddingBottom: 120, paddingTop: 4 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  paidBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#22C55E",
    letterSpacing: 0.5,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  tourneyName: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 8 },
  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
  },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  prizeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  prizeItem: {
    flex: 1,
    minWidth: 88,
    paddingHorizontal: 6,
  },
  prizeLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  prizeVal: {
    paddingHorizontal: 4,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  sectionDivider: { height: 1, marginBottom: 12 },
  roomTitle: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  // Lock (non-paid)
  lockBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  lockText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  // Countdown (paid, before window)
  countdownBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  countdownHeader: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  countdownTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    lineHeight: 17,
  },
  timerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  timerText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#EAB308",
    letterSpacing: 0.5,
  },
  countdownSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  // Pending (admin hasn't posted yet)
  pendingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  pendingText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  // Room revealed
  roomBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  roomLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22C55E",
  },
  liveText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#22C55E",
    letterSpacing: 1,
  },
  roomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  roomDivider: { height: 1, marginVertical: 4 },
  roomLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  roomValue: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  // Empty state
  empty: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
