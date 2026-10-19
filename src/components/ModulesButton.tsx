import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { AppStackParams } from '../navigation/types';
import { useSettings } from '../context/SettingsContext';
import { TOUCH_MIN } from '../ui';

export default function ModulesButton() {
  const navigation = useNavigation<NavigationProp<AppStackParams>>();
  const { colors } = useSettings();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open modules"
      accessibilityHint="Returns to the module launcher"
      onPress={() => navigation.navigate('ModuleLauncher')}
      style={({ pressed }) => [
        styles.button,
        {
          opacity: pressed ? 0.75 : 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <Ionicons name="apps-outline" size={19} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
  },
});
