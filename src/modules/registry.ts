import { Ionicons } from '@expo/vector-icons';

export type ModuleId = 'loans' | 'habits' | 'expenses' | 'passwords' | 'files';
export type ModuleDefinition = {
  id: ModuleId;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: 'LoanLedger' | 'HabitTracker' | 'Expenses' | 'PasswordManager' | 'Files';
  hint: string;
};

export const MODULES: ModuleDefinition[] = [
  { id: 'habits', title: 'Habits', icon: 'checkmark-done-outline', route: 'HabitTracker', hint: 'Build routines and keep your momentum.' },
  { id: 'expenses', title: 'Expense & Budget', icon: 'pie-chart-outline', route: 'Expenses', hint: 'Track spending and monthly budgets.' },
  { id: 'loans', title: 'Loan Ledger', icon: 'swap-horizontal-outline', route: 'LoanLedger', hint: 'Keep track of money lent and borrowed.' },
  { id: 'passwords', title: 'Password Manager', icon: 'shield-checkmark-outline', route: 'PasswordManager', hint: 'Keep logins encrypted on this device.' },
  { id: 'files', title: 'File Library', icon: 'folder-open-outline', route: 'Files', hint: 'Keep, find, and organize files privately on this device.' },
];
