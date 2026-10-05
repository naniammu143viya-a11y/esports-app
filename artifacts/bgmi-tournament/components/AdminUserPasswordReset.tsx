import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { resetUserPassword } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

export function AdminUserPasswordReset() {
  const c = useColors();
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function confirmReset() {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      Alert.alert("Username required", "Enter the player's username.");
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 200) {
      Alert.alert(
        "Password length",
        "Use a new password between 6 and 200 characters.",
      );
      return;
    }

    Alert.alert(
      "Reset player password?",
      `This replaces the password for ${normalizedUsername} and signs out their existing sessions.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset password",
          style: "destructive",
          onPress: () => void submitReset(normalizedUsername),
        },
      ],
    );
  }

  async function submitReset(normalizedUsername: string) {
    setIsSaving(true);
    try {
      await resetUserPassword({ username: normalizedUsername, newPassword });
      setNewPassword("");
      Alert.alert(
        "Password updated",
        "Share the new password with the player through a secure channel.",
      );
    } catch (error) {
      Alert.alert(
        "Reset failed",
        error instanceof Error ? error.message : "Unable to reset the password.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: "rgba(248,113,113,0.12)" }]}>
          <Ionicons name="key-outline" size={18} color={c.warning} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: c.foreground }]}>
            Reset player password
          </Text>
          <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
            Resets the account password and ends existing sessions.
          </Text>
        </View>
      </View>

      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Player username"
        placeholderTextColor={c.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isSaving}
        style={[
          styles.input,
          { backgroundColor: c.input, borderColor: c.border, color: c.foreground },
        ]}
        accessibilityLabel="Player username"
      />
      <TextInput
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="New password (6–200 characters)"
        placeholderTextColor={c.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        editable={!isSaving}
        style={[
          styles.input,
          { backgroundColor: c.input, borderColor: c.border, color: c.foreground },
        ]}
        accessibilityLabel="New player password"
      />
      <Pressable
        onPress={confirmReset}
        disabled={isSaving}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: c.primary,
            opacity: isSaving ? 0.6 : pressed ? 0.82 : 1,
          },
        ]}
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="key" size={15} color="#fff" />
            <Text style={styles.buttonText}>Reset password</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    gap: 10,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 2 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headingCopy: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular" },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  button: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
});
