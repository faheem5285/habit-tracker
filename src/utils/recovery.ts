import AsyncStorage from '@react-native-async-storage/async-storage';
import { RECOVERY_CODE_KEY, readAllAppData, restoreAllAppData } from './storage';
import { loadLedger, saveLedger } from '../modules/loans/storage';
import { loadExpenses, saveExpenses } from '../modules/expenses/storage';
import type { LoanLedgerData } from '../modules/loans/types';
import type { ExpenseData } from '../modules/expenses/storage';

const API_URL = process.env.EXPO_PUBLIC_BACKUP_API_URL?.trim().replace(/\/$/, '');
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
const RECOVERY_CODE_PATTERN = /^[A-Za-z0-9_-]{20,80}$/;
type AppBackup = Awaited<ReturnType<typeof readAllAppData>>;

async function request<T>(path: string, body: unknown): Promise<T> {
  if (!API_URL) throw new Error('Recovery service is not configured. Set EXPO_PUBLIC_BACKUP_API_URL and rebuild the app.');
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || 'Recovery service request failed.');
  return result;
}

export async function createRecoveryCode() {
  const { code } = await request<{ code?: unknown }>('/recovery/create', {});
  if (typeof code !== 'string' || !RECOVERY_CODE_PATTERN.test(code)) {
    throw new Error('The recovery service returned an invalid recovery code.');
  }
  await AsyncStorage.setItem(RECOVERY_CODE_KEY, code);
  return code;
}

export async function syncRecoveryData(code?: string) {
  const recoveryCode = code || await AsyncStorage.getItem(RECOVERY_CODE_KEY);
  if (!recoveryCode) return;
  const [habits, loans, expenses] = await Promise.all([readAllAppData(), loadLedger(), loadExpenses()]);
  const results = await Promise.allSettled([
    syncModule(recoveryCode, 'habits', habits),
    syncModule(recoveryCode, 'loans', loans),
    syncModule(recoveryCode, 'expenses', expenses),
  ]);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}

async function syncModule(code: string, module: 'habits' | 'loans' | 'expenses', data: unknown) {
  return request<{ ok: boolean }>('/recovery/sync', { code, module, data });
}

export async function syncRecoveryModule(module: 'loans' | 'expenses') {
  const code = await AsyncStorage.getItem(RECOVERY_CODE_KEY);
  if (!code) return;
  const data = module === 'loans' ? await loadLedger() : await loadExpenses();
  await syncModule(code, module, data);
}

function isAppBackup(data: unknown): data is AppBackup {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const backup = data as Record<string, unknown>;
  return (
    Array.isArray(backup.habits) &&
    Array.isArray(backup.logs) &&
    !!backup.dailyNotes &&
    typeof backup.dailyNotes === 'object' &&
    !Array.isArray(backup.dailyNotes) &&
    !!backup.settings &&
    typeof backup.settings === 'object' &&
    !Array.isArray(backup.settings)
  );
}

export async function restoreWithRecoveryCode(code: string) {
  if (!CLOUD_NAME) throw new Error('Cloudinary cloud name is missing from the app environment.');
  const normalizedCode = code.trim();
  if (!RECOVERY_CODE_PATTERN.test(normalizedCode)) {
    throw new Error('Enter a valid recovery code (20–80 letters, numbers, hyphens, or underscores).');
  }
  const fetchModule = async (module: string) => fetch(`https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/habit-tracker/backups/${normalizedCode}/${module}.json?refresh=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
  let restoredAny = false;
  let firstFailure = 'No backup was found for this recovery code.';
  try {
    let response = await fetchModule('habits');
    if (response.status === 404) {
      // Backups created before module folders used this single habits file.
      response = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/recovery_${normalizedCode}.json?refresh=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
    }
    if (!response.ok) throw new Error(response.status === 404 ? firstFailure : 'Could not fetch the habits backup. Check your internet connection and try again.');
    const habitsData: unknown = await response.json();
    if (!isAppBackup(habitsData)) throw new Error('The habits backup is invalid.');
    await restoreAllAppData(habitsData);
    restoredAny = true;
  } catch (error) {
    firstFailure = error instanceof Error ? error.message : firstFailure;
    console.warn('Could not restore habits backup; other modules will still be checked:', error);
  }
  for (const [module, restore] of [
    ['loans', async (value: unknown) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const ledger = value as LoanLedgerData;
        if (ledger.version === 1 && Array.isArray(ledger.people) && Array.isArray(ledger.loans)) await saveLedger(ledger);
      }
    }],
    ['expenses', async (value: unknown) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const expenses = value as ExpenseData;
        if (expenses.version === 1 && Array.isArray(expenses.expenses) && Array.isArray(expenses.budgets)) await saveExpenses(expenses);
      }
    }],
  ] as const) {
    try {
      const moduleResponse = await fetchModule(module);
      if (moduleResponse.ok) { await restore(await moduleResponse.json()); restoredAny = true; }
      else if (moduleResponse.status !== 404) throw new Error(`Could not fetch ${module} backup.`);
    } catch (error) {
      console.warn(`Could not restore ${module} backup; other modules remain available:`, error);
    }
  }
  if (!restoredAny) throw new Error(firstFailure);
  await AsyncStorage.setItem(RECOVERY_CODE_KEY, normalizedCode);
}
