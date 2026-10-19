import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_LEDGER, Loan, LoanLedgerData, LoanPayment, LoanPerson, PurchaseReminder } from './types';
const KEY = 'module:loans';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLoanPayment(value: unknown): value is LoanPayment {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount > 0 &&
    typeof value.date === 'string' &&
    typeof value.note === 'string';
}

function isLoanPerson(value: unknown): value is LoanPerson {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.phone === 'string' &&
    typeof value.photoUrl === 'string' &&
    typeof value.notes === 'string' &&
    typeof value.createdAt === 'string';
}

function isLoan(value: unknown): value is Loan {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.personId === 'string' &&
    (value.direction === 'gave' || value.direction === 'took') &&
    typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount > 0 &&
    typeof value.date === 'string' &&
    typeof value.dueDate === 'string' &&
    typeof value.note === 'string' &&
    typeof value.attachmentUrl === 'string' &&
    Array.isArray(value.reminderIds) && value.reminderIds.every((id) => typeof id === 'string') &&
    Array.isArray(value.payments) && value.payments.every(isLoanPayment) &&
    (value.reminderEnabled === undefined || typeof value.reminderEnabled === 'boolean');
}

function isPurchaseReminder(value: unknown): value is PurchaseReminder {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.targetMonth === 'string' &&
    typeof value.reminderDate === 'string' &&
    typeof value.note === 'string' &&
    Array.isArray(value.notificationIds) && value.notificationIds.every((id) => typeof id === 'string');
}

export function isLoanLedgerData(value: unknown): value is LoanLedgerData {
  if (!isRecord(value) || value.version !== 1 ||
    !Array.isArray(value.people) || !value.people.every(isLoanPerson) ||
    !Array.isArray(value.loans) || !value.loans.every(isLoan)) return false;
  return value.purchaseReminders === undefined ||
    (Array.isArray(value.purchaseReminders) && value.purchaseReminders.every(isPurchaseReminder));
}

export async function loadLedger(): Promise<LoanLedgerData> {
  const value = await AsyncStorage.getItem(KEY);
  if (!value) return EMPTY_LEDGER;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error('Saved loan data is unreadable. Your existing records have not been replaced.', { cause: error });
  }

  if (!isLoanLedgerData(parsed)) {
    throw new Error('Saved loan data has an unsupported format. Your existing records have not been replaced.');
  }

  return {
    version: 1,
    people: parsed.people,
    loans: parsed.loans,
    purchaseReminders: parsed.purchaseReminders ?? [],
  };
}

export async function saveLedger(value: LoanLedgerData) {
  await AsyncStorage.setItem(KEY, JSON.stringify(value));
}
