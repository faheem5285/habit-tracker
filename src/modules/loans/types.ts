export type LoanPayment = { id: string; amount: number; date: string; note: string };
export type LoanPerson = { id: string; name: string; phone: string; photoUrl: string; notes: string; createdAt: string };
export type Loan = {
  id: string; personId: string; direction: 'gave' | 'took'; amount: number; date: string; dueDate: string;
  note: string; attachmentUrl: string; reminderIds: string[]; payments: LoanPayment[]; reminderEnabled?: boolean;
};
export type PurchaseReminder = { id: string; title: string; targetMonth: string; reminderDate: string; note: string; notificationIds: string[] };
export type LoanLedgerData = { version: 1; people: LoanPerson[]; loans: Loan[]; purchaseReminders: PurchaseReminder[] };
export const EMPTY_LEDGER: LoanLedgerData = { version: 1, people: [], loans: [], purchaseReminders: [] };
export const paymentTotal = (loan: Loan) => loan.payments.reduce((sum, payment) => sum + payment.amount, 0);
export const remainingAmount = (loan: Loan) => Math.max(0, loan.amount - paymentTotal(loan));
export function loanStatus(loan: Loan): 'open' | 'partial' | 'paid' | 'overdue' {
  const remaining = remainingAmount(loan);
  if (remaining <= 0) return 'paid';
  if (new Date(`${loan.dueDate}T23:59:59`).getTime() < Date.now()) return 'overdue';
  return paymentTotal(loan) > 0 ? 'partial' : 'open';
}
export function newId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
