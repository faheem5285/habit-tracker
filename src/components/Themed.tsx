import { StyleSheet, Text as RNText, TextInput as RNTextInput, TextProps, TextInputProps } from 'react-native';
import { useSettings } from '../context/SettingsContext';

export function Text({ style, ...rest }: TextProps) {
  const { colors } = useSettings();
  const weight = String(StyleSheet.flatten(style)?.fontWeight ?? '400');
  const fontFamily = weight === '500'
    ? 'Inter_500Medium'
    : ['600', '700', '800', '900', 'bold'].includes(weight)
      ? 'Inter_700Bold'
      : 'Inter_400Regular';
  return <RNText style={[{ color: colors.text, fontFamily }, style]} {...rest} />;
}

export function TextInput({ style, ...rest }: TextInputProps) {
  const { colors } = useSettings();
  return (
    <RNTextInput
      placeholderTextColor={colors.muted}
      style={[{ color: colors.text, fontFamily: 'Inter_400Regular' }, style]}
      {...rest}
    />
  );
}
