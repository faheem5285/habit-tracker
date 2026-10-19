import { useState } from 'react';
import { TextInput as RNTextInput, View, StyleSheet, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { Text } from './Themed';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function TextField({ label, error, containerStyle, multiline, style, ...inputProps }: Props) {
  const { colors } = useSettings();
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label ? <Text style={[styles.label, { color: colors.text }]}>{label}</Text> : null}
      <RNTextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
          },
          focused && !error && styles.focused,
          multiline && styles.multiline,
          style,
        ]}
      />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  focused: { borderWidth: 1.5 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  error: { fontSize: 12, marginTop: 4 },
});
