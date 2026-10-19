import AsyncStorage from '@react-native-async-storage/async-storage';
export type Expense = { id: string; amount: number; category: string; date: string; note: string };
export type Budget = { category: string; amount: number };
export type ExpenseData = { version: 1; expenses: Expense[]; budgets: Budget[] };
const KEY = 'module:expenses';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isExpense(value: unknown): value is Expense {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount > 0 &&
    typeof value.category === 'string' &&
    typeof value.date === 'string' &&
    typeof value.note === 'string';
}

function isBudget(value: unknown): value is Budget {
  return isRecord(value) &&
    typeof value.category === 'string' &&
    typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount > 0;
}

export function isExpenseData(value: unknown): value is ExpenseData {
  return isRecord(value) && value.version === 1 &&
    Array.isArray(value.expenses) && value.expenses.every(isExpense) &&
    Array.isArray(value.budgets) && value.budgets.every(isBudget);
}

export async function loadExpenses(): Promise<ExpenseData> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { version: 1, expenses: [], budgets: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error('Saved expense data is unreadable. Your existing records have not been replaced.', { cause: error });
  }

  if (!isExpenseData(parsed)) {
    throw new Error('Saved expense data has an unsupported format. Your existing records have not been replaced.');
  }
  return { version: 1, expenses: parsed.expenses, budgets: parsed.budgets };
}

export async function saveExpenses(data: ExpenseData) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}
