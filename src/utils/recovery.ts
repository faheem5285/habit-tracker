import AsyncStorage from '@react-native-async-storage/async-storage';
import { RECOVERY_CODE_KEY, readAllAppData, restoreAllAppData } from './storage';

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
  await request<{ ok: boolean }>('/recovery/sync', { code: recoveryCode, data: await readAllAppData() });
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
  const publicId = `recovery_${normalizedCode}.json`;
  const url = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${publicId}?refresh=${Date.now()}`;
  const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (response.status === 404) throw new Error('No backup was found for this recovery code.');
  if (!response.ok) throw new Error('Could not fetch the Cloudinary backup. Check your internet connection and try again.');
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('The Cloudinary file is not a valid Habit Tracker backup.');
  }
  if (!isAppBackup(data)) {
    throw new Error('The Cloudinary file is not a valid Habit Tracker backup.');
  }
  await restoreAllAppData(data);
  await AsyncStorage.setItem(RECOVERY_CODE_KEY, normalizedCode);
}
