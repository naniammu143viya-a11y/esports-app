import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { GameBadge } from "@/components/GameBadge";
import type { Tournament } from "@/context/TournamentContext";

interface Props {
  tournament: Tournament;
  isJoined: boolean;
  /** Called when user wants to join. Screen decides free-join vs payment modal. */
  onJoin: (tournament: Tournament) => void;
}

function StatusPill({ status }: { status: Tournament["status"] }) {
  const label =
    status === "live" ? "LIVE" : status === "upcoming" ? "UPCOMING" : "ENDED";
  const color =
    status === "live"
      ? "#22C55E"
      : status === "upcoming"
        ? "#EAB308"
        : "#6B7280";
  const bg =
    status === "live"
      ? "rgba(34,197,94,0.15)"
      : status === "upcoming"
        ? "rgba(234,179,8,0.15)"
        : "rgba(107,114,128,0.15)";

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: color }]}>
      {status === "live" && (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

export function TournamentCard({ tournament, isJoined, onJoin }: Props) {
  const c = useColors();
  const isFull = tournament.registeredTeams >= tournament.maxTeams;
  const canJoin = !isJoined && !isFull && tournament.status !== "completed";
  const availableSeats = tournament.maxTeams - tournament.registeredTeams;

  function handleJoin() {
    if (!canJoin) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onJoin(tournament);
  }

  const formattedDate = (() => {
    try {
      return new Date(tournament.date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
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
      {/* Top row */}
      <View style={styles.topRow}>
        <GameBadge game={tournament.game} />
        <StatusPill status={tournament.status} />
      </View>

      {/* Name */}
      <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>
        {tournament.name}
      </Text>

      {tournament.status === "completed" && tournament.winnerNote && (
        <View style={styles.winnerBanner}>
          <Ionicons name="trophy-outline" size={13} color="#EAB308" />
          <Text style={styles.winnerText} numberOfLines={2}>
            {tournament.winnerNote}
          </Text>
        </View>
      )}

      {/* Map + team info */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="map-outline" size={12} color={c.mutedForeground} />
          <Text style={[styles.metaText, { color: c.mutedForeground }]}>
            {tournament.map}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons
            name="account-group"
            size={12}
            color={c.mutedForeground}
          />
          <Text style={[styles.metaText, { color: c.mutedForeground }]}>
            Squad {tournament.teamSize}v{tournament.teamSize}
          </Text>
        </View>
        {availableSeats <= 5 && availableSeats > 0 && !isJoined && !isFull && (
          <View style={styles.metaItem}>
            <Ionicons name="alert-circle-outline" size={12} color="#EAB308" />
            <Text style={[styles.metaText, { color: "#EAB308" }]}>
              {availableSeats} left!
            </Text>
          </View>
        )}
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: c.border }]} />

      {/* Fee / Prize / Teams row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: c.mutedForeground }]}>
            ENTRY
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[
              styles.statValue,
              { color: tournament.entryFee > 0 ? c.primary : "#22C55E" },
            ]}
          >
            {tournament.entryFee === 0
              ? "FREE"
              : `₹${tournament.entryFee.toLocaleString("en-IN")}`}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: c.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: c.mutedForeground }]}>
            PRIZE POOL
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[styles.statValue, { color: c.accent }]}
          >
            ₹{tournament.prizePool.toLocaleString("en-IN")}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: c.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: c.mutedForeground }]}>
            SEATS
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[
              styles.statValue,
              { color: isFull ? "#EF4444" : c.foreground },
            ]}
          >
            {tournament.maxTeams - tournament.registeredTeams}/
            {tournament.maxTeams}
          </Text>
        </View>
      </View>

      {/* Date/time + Join button */}
      <View style={styles.bottomRow}>
        <View style={styles.dateRow}>
          <Ionicons
            name="calendar-outline"
            size={13}
            color={c.mutedForeground}
          />
          <Text style={[styles.dateText, { color: c.mutedForeground }]}>
            {formattedDate} · {formattedTime}
          </Text>
        </View>

        <Pressable
          onPress={handleJoin}
          disabled={!canJoin}
          style={({ pressed }) => [
            styles.joinBtn,
            {
              backgroundColor: isJoined
                ? "rgba(34,197,94,0.15)"
                : isFull || tournament.status === "completed"
                  ? c.muted
                  : c.primary,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          {tournament.entryFee > 0 && canJoin && (
            <MaterialCommunityIcons
              name="currency-inr"
              size={13}
              color={c.primaryForeground}
            />
          )}
          <Text
            style={[
              styles.joinText,
              {
                color: isJoined
                  ? "#22C55E"
                  : isFull || tournament.status === "completed"
                    ? c.mutedForeground
                    : c.primaryForeground,
              },
            ]}
          >
            {isJoined
              ? "✓ Registered"
              : isFull
                ? "Match Full"
                : tournament.status === "completed"
                  ? "Ended"
                  : "Join Now"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  pillText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  name: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 6 },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  divider: { height: 1, marginBottom: 12 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  statItem: {
    flex: 1.5,
    minWidth: 0,
    alignItems: "center",
    paddingHorizontal: 6,
  },
  statDivider: { width: 1, height: 28 },
  statLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: {
    paddingHorizontal: 4,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dateText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  joinBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  joinText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  winnerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginBottom: 10,
    backgroundColor: "rgba(234,179,8,0.10)",
  },
  winnerText: {
    flex: 1.5,
    color: "#EAB308",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
