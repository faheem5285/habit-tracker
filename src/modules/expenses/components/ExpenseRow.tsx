import { memo } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../components/Themed';
import type { AppPalette } from '../../../theme';
import type { Expense } from '../storage';
import { formatMoney } from '../../../utils/currency';
import { formatShortDateKey } from '../../../utils/dates';
import Card from '../../../components/Card';

type Props = {
  expense: Expense;
  colors: AppPalette;
  onEdit: (expense: Expense) => void;
  onDelete: (expenseId: string) => void;
};

function ExpenseRow({ expense, colors, onEdit, onDelete }: Props) {
  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${expense.category} expense of ${formatMoney(expense.amount)}`}
        onPress={() => onEdit(expense)}
        style={styles.details}
      >
        <Text style={styles.category}>{expense.category}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {formatShortDateKey(expense.date)}{expense.note ? ` · ${expense.note}` : ''}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit expense of ${formatMoney(expense.amount)}`}
        onPress={() => onEdit(expense)}
        style={styles.amount}
      >
        <Text style={styles.amountText}>{formatMoney(expense.amount)}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete expense"
        hitSlop={4}
        style={[styles.delete, { backgroundColor: colors.dangerSoft }]}
        onPress={() => Alert.alert('Delete expense?', 'This entry will be removed.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => onDelete(expense.id) },
        ])}
      >
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
      </Pressable>
    </Card>
  );
}

export default memo(ExpenseRow);

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  details: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  category: { fontWeight: '800', fontSize: 15 },
  description: { fontSize: 12, marginTop: 3 },
  amount: { minHeight: 44, justifyContent: 'center' },
  amountText: { fontWeight: '900', fontSize: 15 },
  delete: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});
