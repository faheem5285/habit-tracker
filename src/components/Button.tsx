import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { Text } from './Themed';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'tonal' | 'destructive';
  size?: 'default' | 'compact';
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
  labelStyle,
}: Props) {
  const { colors } = useSettings();
  const variantStyle = {
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    secondary: { backgroundColor: colors.surface, borderColor: colors.border },
    tonal: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
    destructive: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft },
  }[variant];
  const labelColor = {
    primary: colors.onPrimary,
    secondary: colors.text,
    tonal: colors.primary,
    destructive: colors.danger,
  }[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        size === 'compact' && styles.compact,
        variantStyle,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={labelColor} /> : null}
      <Text style={[styles.label, { color: labelColor }, labelStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 16, borderWidth: 1, paddingHorizontal: 18 },
  compact: { minHeight: 44, paddingHorizontal: 14, borderRadius: 13 },
  label: { fontSize: 15, fontWeight: '700', textAlign: 'center', letterSpacing: 0.1 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
});
