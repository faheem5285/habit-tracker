import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Text } from './Themed';
import ModulesButton from './ModulesButton';
import { SCREEN_PADDING, TITLE_SIZE } from '../ui';
import { useSettings } from '../context/SettingsContext';

type Props = {
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
};

export default function ScreenHeader({ title, subtitle, style }: Props) {
  const { colors } = useSettings();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: colors.text }]}
        >
          {title}
        </Text>
        <ModulesButton />
      </View>
      {subtitle ? (
        <Text numberOfLines={2} style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 18,
    marginBottom: 18,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: TITLE_SIZE,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
  },
});
