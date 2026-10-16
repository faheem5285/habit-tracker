import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_LEDGER, LoanLedgerData } from './types';
const KEY = 'module:loans';
export async function loadLedger(): Promise<LoanLedgerData> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    if (!value) return EMPTY_LEDGER;
    const parsed = JSON.parse(value) as LoanLedgerData;
    if (parsed.version !== 1 || !Array.isArray(parsed.people) || !Array.isArray(parsed.loans)) return EMPTY_LEDGER;
    return { ...parsed, purchaseReminders: Array.isArray(parsed.purchaseReminders) ? parsed.purchaseReminders : [] };
  } catch { return EMPTY_LEDGER; }
}
export async function saveLedger(value: LoanLedgerData) { await AsyncStorage.setItem(KEY, JSON.stringify(value)); }
