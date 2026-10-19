import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSettings } from '../context/SettingsContext';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export default function Card({ children, onPress, disabled = false, accessibilityLabel, style }: Props) {
  const { colors } = useSettings();
  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      shadowColor: colors.cardShadow,
      shadowOpacity: Platform.OS === 'ios' ? 0.22 : 0,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: Platform.OS === 'android' ? 1 : 0,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 17 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  disabled: { opacity: 0.55 },
});
