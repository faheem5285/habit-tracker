import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { Text } from './Themed';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export default function Chip({ label, selected = false, onPress, icon, accessibilityLabel, style }: Props) {
  const { colors } = useSettings();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={selected ? colors.onPrimary : colors.textSecondary} /> : null}
      <Text style={[styles.label, { color: selected ? colors.onPrimary : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  label: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
});
