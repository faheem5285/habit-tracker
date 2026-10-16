export type ModuleId = 'loans' | 'habits' | 'expenses';
export type ModuleDefinition = { id: ModuleId; title: string; icon: string; route: 'LoanLedger' | 'HabitTracker' | 'Expenses' };

export const MODULES: ModuleDefinition[] = [
  { id: 'loans', title: 'Loan Ledger', icon: 'cash-outline', route: 'LoanLedger' },
  { id: 'habits', title: 'Habit Tracker', icon: 'leaf-outline', route: 'HabitTracker' },
  { id: 'expenses', title: 'Expense & Budget', icon: 'pie-chart-outline', route: 'Expenses' },
];
