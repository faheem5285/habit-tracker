import { Text as RNText, TextInput as RNTextInput, TextProps, TextInputProps } from 'react-native';
import { useSettings } from '../context/SettingsContext';

export function Text({ style, ...rest }: TextProps) {
  const { colors } = useSettings();
  return <RNText style={[{ color: colors.text }, style]} {...rest} />;
}

export function TextInput({ style, ...rest }: TextInputProps) {
  const { colors } = useSettings();
  return (
    <RNTextInput
      placeholderTextColor={colors.muted}
      style={[{ color: colors.text }, style]}
      {...rest}
    />
  );
}
