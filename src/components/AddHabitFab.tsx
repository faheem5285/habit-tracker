import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { Text } from './Themed';

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  fallbackLabel: string;
};

export default function AddHabitFab({ onPress, accessibilityLabel, fallbackLabel }: Props) {
  const { colors } = useSettings();
  const { width } = useWindowDimensions();
  const useFullWidthButton = width <= 320;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        useFullWidthButton && styles.fallback,
        { backgroundColor: colors.primary, opacity: pressed ? 0.84 : 1 },
      ]}
    >
      <Ionicons name="add" size={useFullWidthButton ? 22 : 28} color={colors.onPrimary} />
      {useFullWidthButton && <Text style={[styles.fallbackText, { color: colors.onPrimary }]}>{fallbackLabel}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    zIndex: 2,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fallback: {
    left: 20,
    right: 20,
    bottom: 12,
    width: undefined,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
  },
  fallbackText: { fontSize: 16, fontWeight: '700' },
});
