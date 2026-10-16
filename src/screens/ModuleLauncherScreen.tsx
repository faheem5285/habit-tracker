import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Themed';
import { AppStackParams } from '../navigation/types';
import { MODULES } from '../modules/registry';
import { useSettings } from '../context/SettingsContext';

type Props = { navigation: { navigate: (route: keyof AppStackParams) => void } };
export default function ModuleLauncherScreen({ navigation }: Props) {
  const { colors } = useSettings();
  return <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
    <View style={styles.intro}><Text style={styles.eyebrow}>YOUR SPACE</Text><Text style={styles.title}>What would you like to manage?</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>Choose a module to get started.</Text></View>
    {MODULES.map((item, index) => <Pressable key={item.id} onPress={() => navigation.navigate(item.route)} style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.84 : 1 }, index === 0 && { borderColor: colors.primary }]}>
      <View style={[styles.icon, { backgroundColor: index === 0 ? colors.primarySoft : colors.surfaceMuted }]}><Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={25} color={colors.primary} /></View>
      <View style={styles.copy}><Text style={styles.cardTitle}>{item.title}</Text><Text style={[styles.cardHint, { color: colors.textSecondary }]}>{index === 0 ? 'Keep track of money lent and borrowed' : index === 1 ? 'Build routines and keep your momentum' : 'Track spending and monthly budgets'}</Text></View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>)}
    <Text style={[styles.footer, { color: colors.muted }]}>Your data stays on this device unless you enable backup.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({ container: { flexGrow: 1, padding: 22, paddingTop: 40 }, intro: { marginBottom: 28 }, eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.7, color: '#78857C' }, title: { fontSize: 29, fontWeight: '900', marginTop: 10, lineHeight: 35 }, subtitle: { fontSize: 15, marginTop: 8 }, card: { flexDirection: 'row', alignItems: 'center', padding: 17, borderRadius: 20, borderWidth: 1, marginBottom: 13, minHeight: 92 }, icon: { height: 52, width: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }, copy: { flex: 1, marginHorizontal: 14 }, cardTitle: { fontSize: 17, fontWeight: '800' }, cardHint: { fontSize: 13, marginTop: 5, lineHeight: 18 }, footer: { textAlign: 'center', fontSize: 12, marginTop: 18 } });
