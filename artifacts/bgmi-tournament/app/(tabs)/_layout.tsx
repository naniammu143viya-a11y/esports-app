import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

function NativeTabLayout() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === true;

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'trophy', selected: 'trophy.fill' }} />
        <NativeTabs.Trigger.Label>Lobby</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-matches">
        <NativeTabs.Trigger.Icon sf={{ default: 'gamecontroller', selected: 'gamecontroller.fill' }} />
        <NativeTabs.Trigger.Label>My Matches</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {!isAdmin && (
        <NativeTabs.Trigger name="wallet">
          <NativeTabs.Trigger.Icon sf={{ default: 'creditcard', selected: 'creditcard.fill' }} />
          <NativeTabs.Trigger.Label>Earnings</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      )}
      {isAdmin && (
        <NativeTabs.Trigger name="admin">
          <NativeTabs.Trigger.Icon sf={{ default: 'shield', selected: 'shield.fill' }} />
          <NativeTabs.Trigger.Label>Admin</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      )}
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin === true;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          paddingBottom: isWeb ? 0 : insets.bottom,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint={isDark ? 'dark' : 'dark'}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]}
            />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Lobby',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="trophy.fill" tintColor={color} size={22} />
            ) : (
              <Ionicons name="trophy" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="my-matches"
        options={{
          title: 'My Matches',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="gamecontroller.fill" tintColor={color} size={22} />
            ) : (
              <MaterialCommunityIcons name="gamepad-variant" size={22} color={color} />
            ),
        }}
      />
      {/* Wallet tab — shown to regular users only */}
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Earnings',
          href: isAdmin ? null : undefined,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="creditcard.fill" tintColor={color} size={22} />
            ) : (
              <Ionicons name="wallet" size={22} color={color} />
            ),
        }}
      />
      {/* Admin tab — shown to admin only */}
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="shield.fill" tintColor={color} size={22} />
            ) : (
              <Ionicons name="shield" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
