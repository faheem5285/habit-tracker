import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { AppPalette } from '../theme';
import { Text } from './Themed';

type Option<T extends string> = {
  label: string;
  value: T;
  icon?: keyof typeof Ionicons.glyphMap;
};

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  colors: AppPalette;
  style?: StyleProp<ViewStyle>;
};

export default function SegmentedControl<T extends string>({ options, value, onChange, colors, style }: Props<T>) {
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceMuted }, style]}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && { backgroundColor: colors.surface },
              { opacity: pressed ? 0.78 : 1 },
            ]}
          >
            {option.icon ? <Ionicons name={option.icon} size={16} color={selected ? colors.primary : colors.textSecondary} /> : null}
            <Text style={[styles.label, { color: selected ? colors.primary : colors.textSecondary }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: 16, padding: 4 },
  segment: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 12 },
  label: { fontSize: 13, fontWeight: '700' },
});
