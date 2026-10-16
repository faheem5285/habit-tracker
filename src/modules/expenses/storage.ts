import AsyncStorage from '@react-native-async-storage/async-storage';
export type Expense = { id: string; amount: number; category: string; date: string; note: string };
export type Budget = { category: string; amount: number };
export type ExpenseData = { version: 1; expenses: Expense[]; budgets: Budget[] };
const KEY = 'module:expenses';
export async function loadExpenses(): Promise<ExpenseData> {
  try { const raw = await AsyncStorage.getItem(KEY); const v = raw ? JSON.parse(raw) as ExpenseData : null; return v?.version === 1 && Array.isArray(v.expenses) && Array.isArray(v.budgets) ? v : { version: 1, expenses: [], budgets: [] }; }
  catch { return { version: 1, expenses: [], budgets: [] }; }
}
export async function saveExpenses(data: ExpenseData) { await AsyncStorage.setItem(KEY, JSON.stringify(data)); }
