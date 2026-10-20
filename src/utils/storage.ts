import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit, Log, Settings, DEFAULT_SETTINGS } from '../types';

const KEYS = { habits: 'habits', logs: 'logs', settings: 'settings', notes: 'dailyNotes' };
export const RECOVERY_CODE_KEY = 'recoveryCode';
export const RECOVERY_BACKUP_READY_KEY = 'recoveryBackupReady';
export const RECOVERY_RESTORED_KEY = 'recoveryRestored';
export const RECOVERY_STARTED_KEY = 'recoveryStarted';
export const RECOVERY_PROMPT_SEEN_KEY = 'momentum.recovery-prompt-seen.v1';

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function save<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const loadHabits = () => load<Habit[]>(KEYS.habits, []);
export const saveHabits = (v: Habit[]) => save(KEYS.habits, v);

export const loadLogs = () => load<Log[]>(KEYS.logs, []);
export const saveLogs = (v: Log[]) => save(KEYS.logs, v);

export type DailyNotes = Record<string, string>;
export const loadDailyNotes = () => load<DailyNotes>(KEYS.notes, {});
export const saveDailyNotes = (v: DailyNotes) => save(KEYS.notes, v);

export const loadSettings = () => load<Settings>(KEYS.settings, DEFAULT_SETTINGS);
export const saveSettings = (v: Settings) => save(KEYS.settings, v);

export async function readAllAppData() {
  const [habits, logs, dailyNotes, settings] = await Promise.all([
    loadHabits(), loadLogs(), loadDailyNotes(), loadSettings(),
  ]);
  return { habits, logs, dailyNotes, settings };
}

export async function restoreAllAppData(data: Awaited<ReturnType<typeof readAllAppData>>) {
  await Promise.all([
    saveHabits(data.habits), saveLogs(data.logs), saveDailyNotes(data.dailyNotes),
    saveSettings({ ...DEFAULT_SETTINGS, ...data.settings }),
    AsyncStorage.setItem(RECOVERY_STARTED_KEY, 'true'),
  ]);
}

export async function hasLocalAppData() {
  const [habits, logs, notes, settings, started, passwordVault] = await Promise.all([
    AsyncStorage.getItem(KEYS.habits), AsyncStorage.getItem(KEYS.logs),
    AsyncStorage.getItem(KEYS.notes), AsyncStorage.getItem(KEYS.settings),
    AsyncStorage.getItem(RECOVERY_STARTED_KEY),
    AsyncStorage.getItem('momentum.passwords.encrypted.v1'),
  ]);
  return Boolean(started || habits || logs || notes || settings || passwordVault);
}
