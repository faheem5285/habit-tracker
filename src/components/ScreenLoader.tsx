import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from './Themed';
import { useSettings } from '../context/SettingsContext';

export function ScreenLoader({ label = 'Loading your momentum', visible = true }: { label?: string; visible?: boolean }) {
  const { colors } = useSettings();

  if (!visible) return null;

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }]}
      pointerEvents="auto"
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
