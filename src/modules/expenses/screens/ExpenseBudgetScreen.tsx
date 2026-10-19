import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Text } from '../../../components/Themed';
import { useSettings } from '../../../context/SettingsContext';
import { Expense, ExpenseData, loadExpenses, saveExpenses } from '../storage';
import { syncRecoveryModule } from '../../../utils/recovery';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SCREEN_PADDING, SPACING } from '../../../ui';
import ScreenHeader from '../../../components/ScreenHeader';
import { ScreenLoader } from '../../../components/ScreenLoader';
import ExpenseRow from '../components/ExpenseRow';
import { formatShortDateKey, toLocalISODate, toLocalISOMonth } from '../../../utils/dates';
import AppSheet from '../../../components/AppSheet';
import HorizontalChips from '../../../components/HorizontalChips';
import EmptyState from '../../../components/EmptyState';
import { formatMoney } from '../../../utils/currency';
import Chip from '../../../components/Chip';
import Card from '../../../components/Card';
import Button from '../../../components/Button';
import TextField from '../../../components/TextField';

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const month = (date = new Date()) => toLocalISOMonth(date);
const today = (date = new Date()) => toLocalISODate(date);
const CATEGORIES = ['Food', 'Transport', 'Home', 'Health', 'Shopping', 'Bills', 'Other'];

export default function ExpenseBudgetScreen() {
  const { colors } = useSettings();
  const [data, setData] = useState<ExpenseData>({ version: 1, expenses: [], budgets: [] });
  const [selectedMonth, setSelectedMonth] = useState(month());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<'expense' | 'budget' | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const retryLoad = async () => {
    setLoaded(false);
    setLoadError(null);
    try {
      setData(await loadExpenses());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load saved expense data.');
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => {
    let active = true;
    void loadExpenses()
      .then((storedData) => { if (active) setData(storedData); })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load saved expense data.'); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!loaded || loadError) return;
    void saveExpenses(data)
      .then(() => syncRecoveryModule('expenses').catch((error) => console.warn('Expense backup sync failed:', error)))
      .catch((error) => Alert.alert('Could not save expense data', error instanceof Error ? error.message : 'Please try again.'));
  }, [data, loaded, loadError]);
  const currentExpenses = useMemo(() => data.expenses.filter((expense) => expense.date.startsWith(selectedMonth)), [data.expenses, selectedMonth]);
  const monthDate = useMemo(() => {
    const [year, monthNumber] = selectedMonth.split('-').map(Number);
    return new Date(year, monthNumber - 1, 1);
  }, [selectedMonth]);
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shiftMonth = (offset: number) => setSelectedMonth((current) => {
    const [year, monthNumber] = current.split('-').map(Number);
    return month(new Date(year, monthNumber - 1 + offset, 1));
  });
  const totalSpent = useMemo(() => currentExpenses.reduce((sum, expense) => sum + expense.amount, 0), [currentExpenses]);
  const previousMonth = useMemo(() => month(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1)), [monthDate]);
  const previousMonthLabel = useMemo(
    () => new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [monthDate]
  );
  const previousMonthTotal = useMemo(
    () => data.expenses.filter((expense) => expense.date.startsWith(previousMonth)).reduce((sum, expense) => sum + expense.amount, 0),
    [data.expenses, previousMonth]
  );
  const budgetTotal = useMemo(
    () => data.budgets.length ? data.budgets.reduce((sum, budget) => sum + budget.amount, 0) : null,
    [data.budgets]
  );
  const categoryTotal = useCallback((name: string) => currentExpenses.filter((expense) => expense.category === name).reduce((sum, expense) => sum + expense.amount, 0), [currentExpenses]);
  const budgetBreakdown = useMemo(() => {
    if (budgetTotal === null) return null;
    return data.budgets.reduce((summary, budget) => {
      const categorySpent = categoryTotal(budget.category);
      summary.remaining += Math.max(0, budget.amount - categorySpent);
      summary.over += Math.max(0, categorySpent - budget.amount);
      return summary;
    }, { remaining: 0, over: 0 });
  }, [budgetTotal, data.budgets, categoryTotal]);
  const categorySpending = useMemo(() => CATEGORIES.map((name) => ({ name, total: categoryTotal(name) })), [categoryTotal]);
  const maxCategorySpending = Math.max(0, ...categorySpending.map((item) => item.total));
  const visibleCategorySpending = categorySpending.filter((item) => item.total > 0);
  const visibleExpenses = useMemo(() => currentExpenses
    .filter((expense) =>
      (categoryFilter === 'All' || expense.category === categoryFilter) &&
      `${expense.category} ${expense.note} ${expense.date}`.toLowerCase().includes(search.trim().toLowerCase())
    )
    .sort((left, right) => sortBy === 'amount'
      ? right.amount - left.amount || right.date.localeCompare(left.date)
      : right.date.localeCompare(left.date) || right.id.localeCompare(left.id)),
  [currentExpenses, categoryFilter, search, sortBy]);
  const save = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return Alert.alert('Check amount', 'Enter an amount greater than zero.');
    if (modal === 'expense') {
      const expense: Expense = { id: editingExpenseId || newId(), amount: value, category, date: date || today(), note: note.trim() };
      setData((prev) => ({ ...prev, expenses: editingExpenseId ? prev.expenses.map((item) => item.id === expense.id ? expense : item) : [expense, ...prev.expenses] }));
    }
    setModal(null); setEditingExpenseId(null); setAmount(''); setNote(''); setDate(today());
  };
  const saveBudget = () => {
    const value = Number(budgetAmount);
    if (!Number.isFinite(value) || value <= 0) return Alert.alert('Check budget', 'Enter a budget greater than zero.');
    setData((prev) => ({ ...prev, budgets: [...prev.budgets.filter((budget) => budget.category !== category), { category, amount: value }] }));
    setModal(null); setBudgetAmount('');
  };
  const open = (kind: 'expense' | 'budget', selected = CATEGORIES[0]) => { setEditingExpenseId(null); setCategory(selected); setModal(kind); setBudgetAmount(String(data.budgets.find((b) => b.category === selected)?.amount || '')); };
  const closeModal = () => { setModal(null); setEditingExpenseId(null); setShowDatePicker(false); };
  const editExpense = useCallback((expense: Expense) => { setEditingExpenseId(expense.id); setCategory(expense.category); setAmount(String(expense.amount)); setDate(expense.date); setNote(expense.note); setModal('expense'); }, []);
  const deleteExpense = useCallback((expenseId: string) => {
    setData((prev) => ({ ...prev, expenses: prev.expenses.filter((item) => item.id !== expenseId) }));
  }, []);
  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type !== 'set' || !selected) { setShowDatePicker(false); return; }
    setDate(toLocalISODate(selected));
    setShowDatePicker(false);
  };
  const listHeader = (
    <View>
      <View style={styles.monthNav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => shiftMonth(-1)} style={[styles.monthButton, { borderColor: colors.border }]}><Ionicons name="chevron-back" size={20} color={colors.primary} /></Pressable>
        <Text style={styles.monthTitle}>{monthLabel}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => shiftMonth(1)} style={[styles.monthButton, { borderColor: colors.border }]}><Ionicons name="chevron-forward" size={20} color={colors.primary} /></Pressable>
      </View>
      <Card style={styles.total}>
        <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>SPENT IN {monthLabel.toUpperCase()}</Text>
        <Text style={styles.totalAmount}>{formatMoney(totalSpent)}</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
          {budgetBreakdown === null
            ? 'No category budgets set'
            : budgetBreakdown.over > 0 && budgetBreakdown.remaining > 0
              ? `${formatMoney(budgetBreakdown.over)} over budget · ${formatMoney(budgetBreakdown.remaining)} left in other categories`
              : budgetBreakdown.over > 0
                ? `${formatMoney(budgetBreakdown.over)} over budget`
                : `${formatMoney(budgetBreakdown.remaining)} remaining across categories`}
        </Text>
      </Card>
      {previousMonthTotal > 0 && (
        <Text style={[styles.comparison, { color: colors.textSecondary }]}>
            {totalSpent === previousMonthTotal
              ? `Spending is the same as ${previousMonthLabel}`
              : `${Math.abs(Math.round(((totalSpent - previousMonthTotal) / previousMonthTotal) * 100))}% ${totalSpent > previousMonthTotal ? 'more' : 'less'} than ${previousMonthLabel}`}
          </Text>
        )}
      <View style={styles.actions}>
        <Button label="+ Add expense" onPress={() => open('expense')} style={styles.flexButton} />
        <Button label="Set budget" variant="secondary" onPress={() => open('budget')} style={styles.flexButton} />
      </View>
      <Text style={styles.heading}>Spending by category</Text>
      {maxCategorySpending === 0
        ? <EmptyState icon="pie-chart-outline" title="No category spending yet" hint="Add expenses to see totals by category." />
        : <Card style={styles.breakdown}>
          {visibleCategorySpending.map((item, index) => (
            <View key={item.name} style={[styles.breakdownItem, index === visibleCategorySpending.length - 1 && styles.lastBreakdownItem]}>
              <View style={styles.budgetRow}><Text style={styles.category}>{item.name}</Text><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{formatMoney(item.total)} · {Math.round((item.total / totalSpent) * 100)}%</Text></View>
              <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}><View style={[styles.fill, { width: `${(item.total / totalSpent) * 100}%`, backgroundColor: colors.primary }]} /></View>
            </View>
          ))}
        </Card>}
      <Text style={styles.heading}>Monthly budgets</Text>
      {data.budgets.length === 0
        ? <EmptyState icon="speedometer-outline" title="No budgets set" hint="Set a monthly limit to track category spending." />
        : data.budgets.map((budget) => {
          const spent = categoryTotal(budget.category);
          const progress = budget.amount > 0 ? Math.min(1, spent / budget.amount) : 0;
          const over = spent > budget.amount;
          return <Card key={budget.category} onPress={() => open('budget', budget.category)} style={styles.card}>
            <View style={styles.budgetRow}><Text style={styles.category}>{budget.category}</Text><Text style={{ color: over ? colors.danger : colors.textSecondary, fontWeight: '700' }}>{formatMoney(spent)} / {formatMoney(budget.amount)}</Text></View>
            <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}><View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: over ? colors.danger : colors.primary }]} /></View>
            <Text style={{ color: over ? colors.danger : colors.muted, fontSize: 12, marginTop: 6 }}>{over ? `${formatMoney(spent - budget.amount)} over budget` : `${Math.round(progress * 100)}% used · Tap to edit`}</Text>
          </Card>;
        })}
      <Text style={styles.heading}>Expenses</Text>
      <TextField
        accessibilityLabel="Search expenses"
        value={search}
        onChangeText={setSearch}
        placeholder="Search category, note, or date"
        returnKeyType="search"
        style={styles.search}
      />
      <HorizontalChips style={styles.filters}>
        {['All', ...CATEGORIES].map((item) => (
          <Chip key={item} label={item} selected={categoryFilter === item} onPress={() => setCategoryFilter(item)} style={styles.chip} />
        ))}
      </HorizontalChips>
      <View style={styles.sortRow}>
        <Text style={{ color: colors.textSecondary }}>Sort by</Text>
        {(['date', 'amount'] as const).map((item) => (
          <Chip
            key={item}
            label={item === 'date' ? 'Newest' : 'Amount'}
            selected={sortBy === item}
            onPress={() => setSortBy(item)}
          />
        ))}
      </View>
    </View>
  );
  if (!loaded) {
    return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}><ScreenLoader label="Loading your expenses" /></SafeAreaView>;
  }
  if (loadError) {
    return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Expenses" subtitle="Spend with intention." />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SCREEN_PADDING, gap: 12 }}>
        <Text style={{ color: colors.danger, textAlign: 'center' }}>{loadError}</Text>
        <Button label="Try again" size="compact" onPress={retryLoad} />
      </View>
    </SafeAreaView>;
  }
  return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
    <FlatList
      data={visibleExpenses}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ExpenseRow expense={item} colors={colors} onEdit={editExpense} onDelete={deleteExpense} />}
      ListHeaderComponent={(
        <View>
          <ScreenHeader title="Expenses" subtitle="Spend with intention." style={styles.pageHeading} />
          {listHeader}
        </View>
      )}
      ListEmptyComponent={<EmptyState icon="receipt-outline" title={currentExpenses.length === 0 ? 'No expenses this month' : 'No matching expenses'} hint={currentExpenses.length === 0 ? 'Add an expense to start tracking your spending.' : 'Try another search or filter.'} />}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={Platform.OS === 'android'}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={7}
    />
    <AppSheet
      visible={modal !== null}
      title={modal === 'expense' ? editingExpenseId ? 'Edit expense' : 'Add expense' : `Monthly ${category} budget`}
      onClose={closeModal}
      onSave={() => modal === 'expense' ? save() : saveBudget()}
    >
      <Text style={styles.label}>Category</Text>
      <HorizontalChips style={{ marginBottom: 12 }}>
        {CATEGORIES.map((item) => (
          <Chip key={item} label={item} selected={category === item} onPress={() => setCategory(item)} style={styles.chip} />
        ))}
      </HorizontalChips>
      {modal === 'expense' ? (
        <>
          <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 250" containerStyle={styles.fieldContainer} />
          <Pressable onPress={() => setShowDatePicker(true)} style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
            <Text style={{ color: colors.text }}>{formatShortDateKey(date)}</Text><Ionicons name="calendar-outline" size={18} color={colors.primary} />
          </Pressable>
          {showDatePicker && <DateTimePicker value={new Date(`${date}T12:00:00`)} mode="date" display={Platform.OS === 'ios' ? 'compact' : 'default'} onChange={onDateChange} />}
          <TextField label="Note" value={note} onChangeText={setNote} placeholder="e.g. Lunch with friends" containerStyle={styles.fieldContainer} />
        </>
      ) : (
        <>
          <TextField label="Monthly limit" value={budgetAmount} onChangeText={setBudgetAmount} keyboardType="decimal-pad" placeholder="e.g. 10000" containerStyle={styles.fieldContainer} />
        </>
      )}
    </AppSheet>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 64, flexGrow: 1 },
  pageHeading: { marginHorizontal: -SCREEN_PADDING },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, marginBottom: 4 },
  monthButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12 },
  monthTitle: { fontSize: 16, fontWeight: '800' },
  total: { marginTop: 8 },
  totalAmount: { fontSize: 32, fontWeight: '900', marginVertical: 7 },
  comparison: { fontSize: 13, marginTop: 8 },
  actions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  flexButton: { flex: 1 },
  heading: { fontSize: 18, fontWeight: '900', marginTop: SPACING.xxl, marginBottom: SPACING.md },
  empty: { padding: 16, lineHeight: 21 },
  breakdown: { paddingHorizontal: 14, paddingVertical: 16, marginBottom: SPACING.md },
  breakdownItem: { marginBottom: 12 },
  lastBreakdownItem: { marginBottom: 0 },
  card: { marginBottom: SPACING.md },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  category: { fontWeight: '800', fontSize: 15 },
  track: { height: 8, borderRadius: 8, overflow: 'hidden', marginTop: 12 },
  fill: { height: '100%', borderRadius: 8 },
  search: { marginBottom: SPACING.md },
  filters: { paddingVertical: 2 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.md },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12 },
  fieldContainer: { marginBottom: 12 },
  chip: { marginRight: 8 },
});
