import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../../components/Themed';
import { useSettings } from '../../../context/SettingsContext';
import { AppStackParams } from '../../../navigation/types';
import { Expense, ExpenseData, loadExpenses, saveExpenses } from '../storage';
import { syncRecoveryModule } from '../../../utils/recovery';

type Props = { navigation: { navigate: (route: keyof AppStackParams) => void } };
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const month = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const CATEGORIES = ['Food', 'Transport', 'Home', 'Health', 'Shopping', 'Bills', 'Other'];

export default function ExpenseBudgetScreen({ navigation }: Props) {
  const { colors } = useSettings();
  const [data, setData] = useState<ExpenseData>({ version: 1, expenses: [], budgets: [] });
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<'expense' | 'budget' | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  useEffect(() => { void loadExpenses().then((value) => { setData(value); setLoaded(true); }); }, []);
  useEffect(() => { if (loaded) void saveExpenses(data).then(() => syncRecoveryModule('expenses')).catch((error) => console.warn('Expense backup sync failed:', error)); }, [data, loaded]);
  const currentExpenses = useMemo(() => data.expenses.filter((expense) => expense.date.startsWith(month())), [data.expenses]);
  const categoryTotal = (name: string) => currentExpenses.filter((expense) => expense.category === name).reduce((sum, expense) => sum + expense.amount, 0);
  const save = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return Alert.alert('Check amount', 'Enter an amount greater than zero.');
    if (modal === 'expense') {
      const expense: Expense = { id: newId(), amount: value, category, date: date || today(), note: note.trim() };
      setData((prev) => ({ ...prev, expenses: [expense, ...prev.expenses] }));
    }
    setModal(null); setAmount(''); setNote(''); setDate(today());
  };
  const saveBudget = () => {
    const value = Number(budgetAmount);
    if (!Number.isFinite(value) || value <= 0) return Alert.alert('Check budget', 'Enter a budget greater than zero.');
    setData((prev) => ({ ...prev, budgets: [...prev.budgets.filter((budget) => budget.category !== category), { category, amount: value }] }));
    setModal(null); setBudgetAmount('');
  };
  const open = (kind: 'expense' | 'budget', selected = CATEGORIES[0]) => { setCategory(selected); setModal(kind); setBudgetAmount(String(data.budgets.find((b) => b.category === selected)?.amount || '')); };
  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <View style={styles.top}><Pressable onPress={() => navigation.navigate('ModuleLauncher')} style={styles.home}><Ionicons name="grid-outline" size={17} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '700' }}>Modules</Text></Pressable><Text style={styles.title}>Expense & Budget</Text><View style={{ width: 70 }} /></View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.total, { backgroundColor: colors.surface }]}><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>SPENT THIS MONTH</Text><Text style={styles.totalAmount}>{currentExpenses.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}</Text><Text style={{ color: colors.textSecondary }}>{new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text></View>
      <View style={styles.actions}><Pressable onPress={() => open('expense')} style={[styles.button, { backgroundColor: colors.primary }]}><Text style={styles.buttonText}>+ Add expense</Text></Pressable><Pressable onPress={() => open('budget')} style={[styles.button, { backgroundColor: colors.surfaceMuted }]}><Text style={[styles.buttonText, { color: colors.text }]}>Set budget</Text></Pressable></View>
      <Text style={styles.heading}>Monthly budgets</Text>
      {data.budgets.length === 0 ? <Text style={[styles.empty, { color: colors.muted }]}>Set a monthly limit for a category to track progress.</Text> : data.budgets.map((budget) => { const spent = categoryTotal(budget.category); const progress = Math.min(1, spent / budget.amount); const over = spent > budget.amount; return <Pressable key={budget.category} onPress={() => open('budget', budget.category)} style={[styles.card, { backgroundColor: colors.surface }]}><View style={styles.budgetRow}><Text style={styles.category}>{budget.category}</Text><Text style={{ color: over ? colors.danger : colors.textSecondary, fontWeight: '700' }}>{spent.toLocaleString()} / {budget.amount.toLocaleString()}</Text></View><View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}><View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: over ? colors.danger : colors.primary }]} /></View><Text style={{ color: over ? colors.danger : colors.muted, fontSize: 12, marginTop: 6 }}>{over ? `${(spent - budget.amount).toLocaleString()} over budget` : `${Math.round(progress * 100)}% used · Tap to edit`}</Text></Pressable>; })}
      <Text style={styles.heading}>Recent expenses</Text>
      {currentExpenses.length === 0 ? <Text style={[styles.empty, { color: colors.muted }]}>Your expenses for this month will show here.</Text> : currentExpenses.map((expense) => <View key={expense.id} style={[styles.card, styles.expenseRow, { backgroundColor: colors.surface }]}><View style={{ flex: 1 }}><Text style={styles.category}>{expense.category}</Text><Text style={{ color: colors.textSecondary }}>{expense.date}{expense.note ? ` · ${expense.note}` : ''}</Text></View><Text style={styles.expenseAmount}>{expense.amount.toLocaleString()}</Text><Pressable onPress={() => Alert.alert('Delete expense?', 'This entry will be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => setData((prev) => ({ ...prev, expenses: prev.expenses.filter((item) => item.id !== expense.id) })) }])}><Ionicons name="trash-outline" size={18} color={colors.muted} /></Pressable></View>)}
    </ScrollView>
    <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={() => setModal(null)}><View style={styles.shade}><View style={[styles.modal, { backgroundColor: colors.surface }]}><Text style={styles.modalTitle}>{modal === 'expense' ? 'Add expense' : `Monthly ${category} budget`}</Text><Text style={styles.label}>Category</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>{CATEGORIES.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, { backgroundColor: category === item ? colors.primarySoft : colors.background, borderColor: category === item ? colors.primary : colors.border }]}><Text>{item}</Text></Pressable>)}</ScrollView>{modal === 'expense' ? <><Text style={styles.label}>Amount</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} /><Text style={styles.label}>Date (YYYY-MM-DD)</Text><TextInput value={date} onChangeText={setDate} placeholder="2026-01-01" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} /><Text style={styles.label}>Note</Text><TextInput value={note} onChangeText={setNote} placeholder="Optional" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} /></> : <><Text style={styles.label}>Monthly limit</Text><TextInput value={budgetAmount} onChangeText={setBudgetAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} /></>}<View style={[styles.actions, { marginTop: 18 }]}><Pressable onPress={() => setModal(null)} style={[styles.button, { backgroundColor: colors.surfaceMuted }]}><Text style={styles.buttonText}>Cancel</Text></Pressable><Pressable onPress={modal === 'expense' ? save : saveBudget} style={[styles.button, { backgroundColor: colors.primary }]}><Text style={styles.buttonText}>Save</Text></Pressable></View></View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, top: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, home: { width: 70, flexDirection: 'row', gap: 5, alignItems: 'center' }, title: { fontSize: 18, fontWeight: '900' }, content: { paddingHorizontal: 18, paddingBottom: 32 }, total: { marginTop: 8, borderRadius: 18, padding: 20 }, totalAmount: { fontSize: 32, fontWeight: '900', marginVertical: 7 }, actions: { flexDirection: 'row', gap: 10, marginTop: 14 }, button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 13, alignItems: 'center' }, buttonText: { color: '#FFFFFF', fontWeight: '800' }, heading: { fontSize: 18, fontWeight: '900', marginTop: 24, marginBottom: 12 }, empty: { padding: 16, lineHeight: 21 }, card: { borderRadius: 16, padding: 14, marginBottom: 10 }, budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, category: { fontWeight: '800', fontSize: 15 }, track: { height: 8, borderRadius: 8, overflow: 'hidden', marginTop: 12 }, fill: { height: '100%', borderRadius: 8 }, expenseRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, expenseAmount: { fontWeight: '900', fontSize: 16 }, shade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.45)' }, modal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22 }, modalTitle: { fontSize: 21, fontWeight: '900', marginBottom: 16 }, label: { fontSize: 13, fontWeight: '700', marginBottom: 6 }, input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 }, chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, marginRight: 8 } });
