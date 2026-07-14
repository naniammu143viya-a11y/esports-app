import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GameType } from '@/context/TournamentContext';

interface GameBadgeProps {
  game: GameType;
  size?: 'sm' | 'md';
}

export function GameBadge({ game, size = 'md' }: GameBadgeProps) {
  const isBGMI = game === 'BGMI';
  const color = isBGMI ? '#FF6B00' : '#FF2D78';
  const bg = isBGMI ? 'rgba(255,107,0,0.15)' : 'rgba(255,45,120,0.15)';
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: color }]}>
      <Text
        style={[
          styles.text,
          { color },
          isSmall && styles.textSmall,
        ]}
      >
        {game === 'FreeFire' ? 'FREE FIRE' : 'BGMI'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  textSmall: {
    fontSize: 9,
    paddingHorizontal: 4,
  },
});
