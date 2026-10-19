import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { Text } from './Themed';
import Card from './Card';
import Button from './Button';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({ icon, title, hint, actionLabel, onAction }: Props) {
  const { colors } = useSettings();

  return (
    <Card style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text numberOfLines={2} style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text numberOfLines={3} style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', alignItems: 'center', paddingVertical: 22 },
  iconWrap: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { maxWidth: '100%', fontSize: 17, fontWeight: '800', lineHeight: 23, textAlign: 'center' },
  hint: { maxWidth: 300, fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 6 },
  action: { width: '100%', marginTop: 16 },
});
