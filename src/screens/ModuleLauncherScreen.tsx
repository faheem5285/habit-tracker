import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Themed';
import { AppStackParams } from '../navigation/types';
import { MODULES } from '../modules/registry';
import { useSettings } from '../context/SettingsContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SCREEN_PADDING } from '../ui';
import { useCallback, useState } from 'react';
import { ScreenLoader } from '../components/ScreenLoader';
import { useFocusEffect } from '@react-navigation/native';
import { useHabits } from '../context/HabitContext';
import { isDone } from '../utils/streaks';
import { toDateKey } from '../utils/dates';
import { loadLedger } from '../modules/loans/storage';
import { loadExpenses } from '../modules/expenses/storage';
import { isDueWithinNextSevenDays } from '../modules/loans/types';
import { formatMoney } from '../utils/currency';
import Card from '../components/Card';
import { usePasswordVault } from '../modules/passwords/PasswordVaultContext';
import { loadManagedFiles } from '../modules/files/storage';

type Props = { navigation: { navigate: (route: keyof AppStackParams) => void } };
export default function ModuleLauncherScreen({ navigation }: Props) {
  const { colors } = useSettings();
  const { habits, logs } = useHabits();
  const passwordVault = usePasswordVault();
  const [loansDueThisWeek, setLoansDueThisWeek] = useState<number | null>(null);
  const [spentThisMonth, setSpentThisMonth] = useState<number | null>(null);
  const [fileCount, setFileCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    const today = new Date();
    const todayKey = toDateKey(today);
    const monthKey = todayKey.slice(0, 7);
    void Promise.allSettled([loadLedger(), loadExpenses(), loadManagedFiles()]).then(([ledgerResult, expensesResult, filesResult]) => {
      if (!active) return;
      if (ledgerResult.status === 'fulfilled') {
        setLoansDueThisWeek(ledgerResult.value.loans.filter((loan) => isDueWithinNextSevenDays(loan, today)).length);
      } else {
        console.warn('Could not load loan summary:', ledgerResult.reason);
        setLoansDueThisWeek(null);
      }
      if (expensesResult.status === 'fulfilled') {
        setSpentThisMonth(expensesResult.value.expenses
          .filter((expense) => expense.date.startsWith(monthKey))
          .reduce((total, expense) => total + expense.amount, 0));
      } else {
        console.warn('Could not load expense summary:', expensesResult.reason);
        setSpentThisMonth(null);
      }
      if (filesResult.status === 'fulfilled') {
        setFileCount(filesResult.value.length);
      } else {
        setFileCount(null);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []));
  const today = new Date();
  const todayKey = toDateKey(today);
  const scheduledToday = habits.filter((habit) => !habit.archived && habit.days.includes(today.getDay()));
  const completedToday = scheduledToday.filter((habit) => isDone(habit, logs, todayKey)).length;
  const summaryFor = (id: string) => {
    if (id === 'habits') return `${completedToday} of ${scheduledToday.length} done today`;
    if (id === 'loans') return loansDueThisWeek === null ? 'Due this week: —' : `Due this week: ${loansDueThisWeek}`;
    if (id === 'passwords') {
      if (!passwordVault.vaultExists) return 'Set up an encrypted vault';
      if (!passwordVault.unlocked) return 'Vault locked';
      return `${passwordVault.entries.length} ${passwordVault.entries.length === 1 ? 'login' : 'logins'} saved`;
    }
    if (id === 'files') {
      return fileCount === null
        ? 'Private file library'
        : `${fileCount} ${fileCount === 1 ? 'file' : 'files'} stored privately`;
    }
    return spentThisMonth === null ? 'Spent this month: —' : `Spent this month: ${formatMoney(spentThisMonth)}`;
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {loading || !passwordVault.ready ? (
        <ScreenLoader label="Loading module summary" />
      ) : (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.intro}>
            <View style={styles.brandRow}>
              <Ionicons name="trending-up-outline" size={18} color={colors.primary} />
              <Text style={styles.brandWordmark}>Momentum</Text>
            </View>
            <Text style={styles.eyebrow}>YOUR SPACE</Text>
            <Text style={styles.title}>Make today count.</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Build steady habits, stay on top of your money, protect your logins, and keep important files close.</Text>
          </View>
          {MODULES.map((item) => <Card key={item.id} onPress={() => navigation.navigate(item.route)} style={styles.card}>
            <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}><Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={25} color={colors.primary} /></View>
            <View style={styles.copy}><Text style={styles.cardTitle}>{item.title}</Text><Text style={[styles.cardHint, { color: colors.textSecondary }]}>{item.hint}</Text><Text style={[styles.cardSummary, { color: colors.primary }]}>{summaryFor(item.id)}</Text></View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Card>)}
          <Text style={[styles.footer, { color: colors.muted }]}>Habits, loans and expenses can use recovery sync. Passwords and files stay on this device and are never included in that backup.</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ container: { flexGrow: 1, padding: SCREEN_PADDING, paddingTop: 16 }, intro: { marginBottom: 28 }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 }, brandWordmark: { fontSize: 16, fontWeight: '800' }, eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.7, color: '#78857C' }, title: { fontSize: 28, fontWeight: '900', marginTop: 10, lineHeight: 35 }, subtitle: { fontSize: 15, marginTop: 8 }, card: { flexDirection: 'row', alignItems: 'center', marginBottom: 13, minHeight: 92 }, icon: { height: 52, width: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }, copy: { flex: 1, marginHorizontal: 14 }, cardTitle: { fontSize: 17, fontWeight: '800' }, cardHint: { fontSize: 13, marginTop: 5, lineHeight: 18 }, cardSummary: { fontSize: 12, fontWeight: '700', marginTop: 5 }, footer: { textAlign: 'center', fontSize: 12, marginTop: 18 } });
