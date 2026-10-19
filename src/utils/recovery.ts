import AsyncStorage from '@react-native-async-storage/async-storage';
import { fromByteArray, toByteArray } from 'base64-js';
import { gcm } from '@noble/ciphers/aes';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { DEFAULT_SETTINGS, type Habit, type Log, type Settings } from '../types';
import {
  RECOVERY_BACKUP_READY_KEY,
  RECOVERY_CODE_KEY,
  readAllAppData,
  restoreAllAppData,
  type DailyNotes,
} from './storage';
import { isLoanLedgerData, loadLedger, saveLedger } from '../modules/loans/storage';
import { isExpenseData, loadExpenses, saveExpenses } from '../modules/expenses/storage';
import { isManagedFile, loadManagedFiles, readManagedFileBytes, restoreManagedFiles, type ManagedFile } from '../modules/files/storage';
import { PASSWORD_VAULT_STORAGE_KEY, validateVaultEnvelope } from '../modules/passwords/crypto';
import { loadVaultTimeout, readVaultEnvelope, saveVaultTimeout, writeVaultEnvelope } from '../modules/passwords/storage';
import type { VaultEnvelope } from '../modules/passwords/types';

const API_URL = process.env.EXPO_PUBLIC_BACKUP_API_URL?.trim().replace(/\/$/, '');
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
export const RECOVERY_CODE_PATTERN = /^[A-Za-z0-9_-]{6,80}$/;
type AppBackup = {
  habits: Habit[];
  logs: Log[];
  dailyNotes: DailyNotes;
  settings: Settings;
};
type RestorableBackup = Omit<AppBackup, 'settings'> & { settings: Partial<Settings> };
type BackupFile = { file: ManagedFile; publicId: string; nonce: string };
type FullBackupData = {
  version: 1;
  app: AppBackup;
  loans: Awaited<ReturnType<typeof loadLedger>>;
  expenses: Awaited<ReturnType<typeof loadExpenses>>;
  passwordVault: VaultEnvelope | null;
  passwordVaultTimeout: number;
  files: BackupFile[];
};
type EncryptedBackup = {
  format: 'momentum.full-backup';
  version: 1;
  salt: string;
  iterations?: number;
  nonce: string;
  ciphertext: string;
};
type CachedFileAsset = { updatedAt: number; size: number; storedName: string; publicId: string; nonce: string };
const BACKUP_SALT_PREFIX = 'momentum.recovery.backup-salt.';
const FILE_ASSET_CACHE_PREFIX = 'momentum.recovery.file-assets.';
const BACKUP_KDF_ITERATIONS = 25_000;
const LEGACY_BACKUP_KDF_ITERATIONS = 600_000;
const RECOVERY_REQUEST_TIMEOUT_MS = 10_000;
const BACKUP_UPLOAD_TIMEOUT_MS = 25_000;
const BACKUP_AAD = utf8ToBytes('Momentum full recovery backup v1');

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try { controller.abort(); } catch {}
      reject(new Error('The recovery service took too long to respond. Check your connection and try again.'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      fetch(url, { ...options, signal: controller.signal }),
      timeoutPromise,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function request<T>(path: string, body: unknown): Promise<T> {
  if (!API_URL) throw new Error('Recovery service is not configured. Set EXPO_PUBLIC_BACKUP_API_URL and rebuild the app.');
  const response = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, RECOVERY_REQUEST_TIMEOUT_MS);
  let result: (T & { error?: string }) | undefined;
  try {
    result = await response.json() as T & { error?: string };
  } catch {
    // A proxy or server can return an empty/non-JSON error page.
  }
  if (!response.ok) throw new Error(result?.error || 'Recovery service request failed.');
  if (!result || typeof result !== 'object') throw new Error('The recovery service returned an invalid response.');
  return result;
}

async function backupKey(code: string, salt?: string, iterations?: number) {
  const storedSalt = salt ?? await AsyncStorage.getItem(`${BACKUP_SALT_PREFIX}${code}`);
  let saltHex = storedSalt;
  if (!saltHex) {
    saltHex = bytesToHex(await Crypto.getRandomBytesAsync(16));
    await AsyncStorage.setItem(`${BACKUP_SALT_PREFIX}${code}`, saltHex);
  }
  if (!/^[0-9a-f]{32}$/i.test(saltHex)) {
    throw new Error('The local recovery encryption key is damaged. Create a new recovery code before syncing.');
  }
  const key = await pbkdf2Async(sha256, utf8ToBytes(code), hexToBytes(saltHex), {
    c: iterations ?? BACKUP_KDF_ITERATIONS,
    dkLen: 32,
  });
  return { key, salt: saltHex };
}

async function signedAsset(code: string, kind: 'manifest' | 'file', fileId?: string) {
  const result = await request<{
    apiKey?: unknown;
    cloudName?: unknown;
    publicId?: unknown;
    timestamp?: unknown;
    signature?: unknown;
  }>('/recovery/upload-signature', { code, kind, ...(fileId ? { fileId } : {}) });
  if (
    typeof result.apiKey !== 'string' ||
    typeof result.cloudName !== 'string' ||
    typeof result.publicId !== 'string' ||
    typeof result.timestamp !== 'string' ||
    typeof result.signature !== 'string' ||
    !/^[0-9a-f]{40}$/i.test(result.signature)
  ) {
    throw new Error('The recovery service returned invalid Cloudinary upload credentials.');
  }
  return result as { apiKey: string; cloudName: string; publicId: string; timestamp: string; signature: string };
}

async function uploadEncryptedAsset(code: string, kind: 'manifest' | 'file', bytes: Uint8Array, fileId?: string) {
  const signed = await signedAsset(code, kind, fileId);
  const url = `https://api.cloudinary.com/v1_1/${signed.cloudName}/raw/upload`;
  const parameters = {
    api_key: signed.apiKey,
    invalidate: 'true',
    overwrite: 'true',
    public_id: signed.publicId,
    signature: signed.signature,
    timestamp: signed.timestamp,
  };

  if (Platform.OS === 'web') {
    const form = new FormData();
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    form.append('file', new Blob([buffer], { type: 'application/octet-stream' }), kind === 'manifest' ? 'full.json' : 'file.json');
    Object.entries(parameters).forEach(([key, value]) => form.append(key, value));
    const response = await fetchWithTimeout(url, { method: 'POST', body: form }, BACKUP_UPLOAD_TIMEOUT_MS);
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(typeof result?.error?.message === 'string' ? result.error.message : 'Cloudinary could not upload an encrypted backup asset.');
    }
  } else {
    if (!FileSystem.cacheDirectory) throw new Error('Temporary storage is unavailable for the encrypted backup upload.');
    const tempUri = `${FileSystem.cacheDirectory}momentum-backup-${bytesToHex(await Crypto.getRandomBytesAsync(12))}.json`;
    try {
      await FileSystem.writeAsStringAsync(tempUri, fromByteArray(bytes), {
        encoding: FileSystem.EncodingType.Base64,
      });
      const uploadTask = FileSystem.createUploadTask(url, tempUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: 'application/octet-stream',
        parameters,
      });
      let timeoutHandle: ReturnType<typeof setTimeout>;
      const timeout = new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          void uploadTask.cancelAsync();
          reject(new Error('The encrypted backup upload timed out. Check your connection and try again.'));
        }, BACKUP_UPLOAD_TIMEOUT_MS);
      });
      let response;
      try {
        response = await Promise.race([uploadTask.uploadAsync(), timeout]);
      } finally {
        clearTimeout(timeoutHandle!);
      }
      if (!response) {
        throw new Error('The encrypted backup upload was cancelled. Please try again.');
      }
      if (response.status < 200 || response.status >= 300) {
        let message = 'Cloudinary could not upload an encrypted backup asset.';
        try {
          const result: unknown = JSON.parse(response.body);
          if (isRecord(result) && isRecord(result.error) && typeof result.error.message === 'string') {
            message = result.error.message;
          }
        } catch {}
        throw new Error(message);
      }
    } finally {
      await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch((error) => {
        console.warn('Could not remove a temporary encrypted backup file:', error);
      });
    }
  }
  return signed.publicId;
}

async function downloadAsset(publicId: string) {
  if (!CLOUD_NAME) throw new Error('Cloudinary cloud name is missing from the app environment.');
  const path = publicId.split('/').map(encodeURIComponent).join('/');
  const url = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${path}?refresh=${Date.now()}`;
  if (Platform.OS === 'web') {
    const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error(`Could not download a recovery file (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  }
  if (!FileSystem.cacheDirectory) throw new Error('Temporary storage is unavailable for recovery downloads.');
  const tempUri = `${FileSystem.cacheDirectory}momentum-restore-${bytesToHex(await Crypto.getRandomBytesAsync(12))}.bin`;
  try {
    const response = await FileSystem.downloadAsync(url, tempUri, { headers: { 'Cache-Control': 'no-cache' } });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Could not download a recovery file (${response.status}).`);
    }
    const encoded = await FileSystem.readAsStringAsync(tempUri, { encoding: FileSystem.EncodingType.Base64 });
    return toByteArray(encoded);
  } finally {
    await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch((error) => {
      console.warn('Could not remove a temporary recovery download:', error);
    });
  }
}

function generateLocalRecoveryCode(): string {
  const bytes = Crypto.getRandomBytes(24);
  return fromByteArray(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createRecoveryCode(customCode?: string) {
  let code: string;
  if (customCode !== undefined) {
    code = customCode.trim();
    if (!RECOVERY_CODE_PATTERN.test(code)) {
      throw new Error('Choose a recovery code with 6–80 letters, numbers, hyphens, or underscores.');
    }
  } else {
    try {
      code = generateLocalRecoveryCode();
    } catch {
      const result = await request<{ code?: unknown }>('/recovery/create', {});
      if (typeof result.code !== 'string' || !RECOVERY_CODE_PATTERN.test(result.code)) {
        throw new Error('The recovery service returned an invalid recovery code.');
      }
      code = result.code;
    }
  }
  const previousCode = await AsyncStorage.getItem(RECOVERY_CODE_KEY);
  if (previousCode) {
    await AsyncStorage.removeItem(`${BACKUP_SALT_PREFIX}${previousCode}`);
    await AsyncStorage.removeItem(`${FILE_ASSET_CACHE_PREFIX}${previousCode}`);
  }
  await AsyncStorage.removeItem(`${BACKUP_SALT_PREFIX}${code}`);
  await AsyncStorage.removeItem(`${FILE_ASSET_CACHE_PREFIX}${code}`);
  await AsyncStorage.removeItem(RECOVERY_BACKUP_READY_KEY);
  await AsyncStorage.setItem(RECOVERY_CODE_KEY, code);
  return code;
}

async function syncFullBackup(code: string, snapshot?: AppBackup) {
  const [app, loans, expenses, passwordVault, passwordVaultTimeout, files] = await Promise.all([
    snapshot ? Promise.resolve(snapshot) : readAllAppData(),
    loadLedger(),
    loadExpenses(),
    readVaultEnvelope(),
    loadVaultTimeout(),
    loadManagedFiles(),
  ]);
  const { key, salt } = await backupKey(code);
  const cacheKey = `${FILE_ASSET_CACHE_PREFIX}${code}`;
  const cachedRaw = await AsyncStorage.getItem(cacheKey);
  let cache: Record<string, CachedFileAsset> = {};
  if (cachedRaw) {
    try {
      const parsed: unknown = JSON.parse(cachedRaw);
      if (!isRecord(parsed)) throw new Error('invalid file asset cache');
      cache = parsed as Record<string, CachedFileAsset>;
    } catch (error) {
      key.fill(0);
      throw new Error('The local recovery file index is damaged. Recreate your recovery code before syncing.', { cause: error });
    }
  }

  try {
    const fileBackups: BackupFile[] = new Array(files.length);
    const nextCache: Record<string, CachedFileAsset> = {};
    let nextFileIndex = 0;
    let firstFailure: unknown;
    let hasFailure = false;

    const uploadNextFile = async () => {
      while (!hasFailure) {
        const index = nextFileIndex++;
        const file = files[index];
        if (!file) return;

        try {
          const cached = cache[file.id];
          let asset: CachedFileAsset;
          if (
            cached &&
            cached.updatedAt === file.updatedAt &&
            cached.size === file.size &&
            cached.storedName === file.storedName &&
            typeof cached.publicId === 'string' &&
            cached.publicId.startsWith(`habit-tracker/backups/${code}/files/`) &&
            /^[0-9a-f]{32}\.json$/i.test(cached.publicId.slice(`habit-tracker/backups/${code}/files/`.length)) &&
            typeof cached.nonce === 'string' &&
            /^[0-9a-f]{24}$/i.test(cached.nonce)
          ) {
            asset = cached;
          } else {
            const fileId = bytesToHex(await Crypto.getRandomBytesAsync(16));
            const nonce = bytesToHex(await Crypto.getRandomBytesAsync(12));
            const bytes = await readManagedFileBytes(file);
            const encrypted = gcm(key, hexToBytes(nonce), utf8ToBytes(`Momentum recovery file ${file.id}`)).encrypt(bytes);
            const publicId = await uploadEncryptedAsset(code, 'file', encrypted, fileId);
            asset = { updatedAt: file.updatedAt, size: file.size, storedName: file.storedName, publicId, nonce };
          }
          nextCache[file.id] = asset;
          fileBackups[index] = { file, publicId: asset.publicId, nonce: asset.nonce };
        } catch (error) {
          if (!hasFailure) {
            firstFailure = error;
            hasFailure = true;
          }
        }
      }
    };

    const workerCount = Math.min(3, files.length);
    await Promise.all(Array.from({ length: workerCount }, () => uploadNextFile()));
    if (hasFailure) throw firstFailure;

    const data: FullBackupData = {
      version: 1,
      app,
      loans,
      expenses,
      passwordVault,
      passwordVaultTimeout,
      files: fileBackups,
    };
    const nonce = await Crypto.getRandomBytesAsync(12);
    const ciphertext = gcm(key, nonce, BACKUP_AAD).encrypt(utf8ToBytes(JSON.stringify(data)));
    const envelope: EncryptedBackup = {
      format: 'momentum.full-backup',
      version: 1,
      salt,
      iterations: BACKUP_KDF_ITERATIONS,
      nonce: bytesToHex(nonce),
      ciphertext: bytesToHex(ciphertext),
    };
    await uploadEncryptedAsset(code, 'manifest', utf8ToBytes(JSON.stringify(envelope)));
    await AsyncStorage.setItem(cacheKey, JSON.stringify(nextCache));
    await AsyncStorage.setItem(RECOVERY_BACKUP_READY_KEY, 'true');
  } finally {
    key.fill(0);
  }
}

let activeSyncPromise: Promise<void> | null = null;
let queuedSyncRequest: { code?: string; snapshot?: AppBackup; resolve: () => void; reject: (err: unknown) => void } | null = null;

async function executeSync(code?: string, snapshot?: AppBackup) {
  const recoveryCode = code || await AsyncStorage.getItem(RECOVERY_CODE_KEY);
  if (!recoveryCode) return;
  if (!RECOVERY_CODE_PATTERN.test(recoveryCode)) throw new Error('The saved recovery code is invalid.');
  await syncFullBackup(recoveryCode, snapshot);
}

export function syncRecoveryData(code?: string, snapshot?: AppBackup): Promise<void> {
  if (!activeSyncPromise) {
    activeSyncPromise = executeSync(code, snapshot).finally(() => {
      activeSyncPromise = null;
      if (queuedSyncRequest) {
        const next = queuedSyncRequest;
        queuedSyncRequest = null;
        syncRecoveryData(next.code, next.snapshot).then(next.resolve, next.reject);
      }
    });
    return activeSyncPromise;
  }

  return new Promise<void>((resolve, reject) => {
    if (queuedSyncRequest) {
      queuedSyncRequest.resolve();
    }
    queuedSyncRequest = { code, snapshot, resolve, reject };
  });
}

export async function syncRecoveryModule(_module: 'loans' | 'expenses') {
  await syncRecoveryData();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isHabit(value: unknown): value is Habit {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.icon === 'string' &&
    typeof value.color === 'string' &&
    (value.type === 'yesno' || value.type === 'count') &&
    typeof value.target === 'number' && Number.isFinite(value.target) && value.target > 0 &&
    (value.weeklyGoal === undefined || (typeof value.weeklyGoal === 'number' && Number.isFinite(value.weeklyGoal) && value.weeklyGoal > 0)) &&
    Array.isArray(value.days) && value.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
    isStringArray(value.reminderTimes) &&
    (value.scheduledReminders === undefined || isStringArray(value.scheduledReminders)) &&
    isStringArray(value.notificationIds) &&
    typeof value.archived === 'boolean' &&
    typeof value.createdAt === 'string'
  );
}

function isLog(value: unknown): value is Log {
  return isRecord(value) &&
    typeof value.habitId === 'string' &&
    typeof value.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    typeof value.value === 'number' && Number.isFinite(value.value) && value.value >= 0;
}

function isSettings(value: unknown): value is Partial<Settings> {
  return isRecord(value) &&
    (value.theme === undefined || value.theme === 'light' || value.theme === 'dark' || value.theme === 'system') &&
    (value.weekStartsOn === undefined || value.weekStartsOn === 0 || value.weekStartsOn === 1) &&
    (value.notificationsEnabled === undefined || typeof value.notificationsEnabled === 'boolean') &&
    (value.soundEnabled === undefined || typeof value.soundEnabled === 'boolean') &&
    (value.hasOnboarded === undefined || typeof value.hasOnboarded === 'boolean');
}

function isAppBackup(data: unknown): data is RestorableBackup {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const backup = data as Record<string, unknown>;
  const notes = backup.dailyNotes;
  return (
    Array.isArray(backup.habits) && backup.habits.every(isHabit) &&
    Array.isArray(backup.logs) && backup.logs.every(isLog) &&
    isRecord(notes) && Object.values(notes).every((note) => typeof note === 'string') &&
    isSettings(backup.settings)
  );
}

function isEncryptedBackup(value: unknown): value is EncryptedBackup {
  return isRecord(value) &&
    value.format === 'momentum.full-backup' &&
    value.version === 1 &&
    typeof value.salt === 'string' && /^[0-9a-f]{32}$/i.test(value.salt) &&
    (value.iterations === undefined || (typeof value.iterations === 'number' && Number.isInteger(value.iterations) && value.iterations > 0 && value.iterations <= 2_000_000)) &&
    typeof value.nonce === 'string' && /^[0-9a-f]{24}$/i.test(value.nonce) &&
    typeof value.ciphertext === 'string' &&
    /^[0-9a-f]+$/i.test(value.ciphertext) &&
    value.ciphertext.length >= 32 &&
    value.ciphertext.length <= 32 * 1024 * 1024;
}

function isFullBackupData(value: unknown, code: string): value is FullBackupData {
  if (!isRecord(value) || value.version !== 1 || !isAppBackup(value.app)) return false;
  if (!isLoanLedgerData(value.loans) || !isExpenseData(value.expenses)) return false;
  if (
    value.passwordVault !== null &&
    (!isRecord(value.passwordVault) || (() => {
      try {
        validateVaultEnvelope(value.passwordVault);
        return false;
      } catch {
        return true;
      }
    })())
  ) return false;
  if (![1, 5, 15].includes(value.passwordVaultTimeout as number)) return false;
  if (!Array.isArray(value.files) || value.files.length > 500) return false;
  const expectedPrefix = `habit-tracker/backups/${code}/files/`;
  return value.files.every((candidate) =>
    isRecord(candidate) &&
    isManagedFile(candidate.file) &&
    typeof candidate.publicId === 'string' &&
    candidate.publicId.startsWith(expectedPrefix) &&
    /^[0-9a-f]{32}\.(?:bin|json)$/i.test(candidate.publicId.slice(expectedPrefix.length)) &&
    typeof candidate.nonce === 'string' &&
    /^[0-9a-f]{24}$/i.test(candidate.nonce)
  );
}

async function restoreEncryptedBackup(envelopeValue: unknown, code: string) {
  if (!isEncryptedBackup(envelopeValue)) throw new Error('The encrypted full backup is invalid.');
  const iterations = envelopeValue.iterations || LEGACY_BACKUP_KDF_ITERATIONS;
  const { key } = await backupKey(code, envelopeValue.salt, iterations);
  try {
    let parsed: unknown;
    try {
      const plaintext = gcm(key, hexToBytes(envelopeValue.nonce), BACKUP_AAD)
        .decrypt(hexToBytes(envelopeValue.ciphertext));
      parsed = JSON.parse(new TextDecoder().decode(plaintext));
    } catch {
      throw new Error('This recovery code could not decrypt the backup. Check the code and try again.');
    }
    if (!isFullBackupData(parsed, code)) throw new Error('The full recovery backup contains invalid data.');

    const restoredAssets: Record<string, CachedFileAsset> = {};
    for (const entry of parsed.files) {
      const encrypted = await downloadAsset(entry.publicId);
      let bytes: Uint8Array;
      try {
        bytes = gcm(key, hexToBytes(entry.nonce), utf8ToBytes(`Momentum recovery file ${entry.file.id}`))
          .decrypt(encrypted);
      } catch {
        throw new Error(`The backup file "${entry.file.name}" could not be decrypted.`);
      }
      if (bytes.byteLength !== entry.file.size) {
        throw new Error(`The backup file "${entry.file.name}" is incomplete.`);
      }
      await restoreManagedFiles([{ file: entry.file, bytes }]);
      restoredAssets[entry.file.id] = {
        updatedAt: entry.file.updatedAt,
        size: entry.file.size,
        storedName: entry.file.storedName,
        publicId: entry.publicId,
        nonce: entry.nonce,
      };
    }

    await restoreAllAppData({
      ...parsed.app,
      settings: { ...DEFAULT_SETTINGS, ...parsed.app.settings },
    });
    await Promise.all([saveLedger(parsed.loans), saveExpenses(parsed.expenses)]);
    if (parsed.passwordVault) await writeVaultEnvelope(parsed.passwordVault);
    else await AsyncStorage.removeItem(PASSWORD_VAULT_STORAGE_KEY);
    await saveVaultTimeout(parsed.passwordVaultTimeout);
    await AsyncStorage.setItem(`${BACKUP_SALT_PREFIX}${code}`, envelopeValue.salt);
    await AsyncStorage.setItem(`${FILE_ASSET_CACHE_PREFIX}${code}`, JSON.stringify(restoredAssets));
    await AsyncStorage.setItem(RECOVERY_CODE_KEY, code);
    await AsyncStorage.setItem(RECOVERY_BACKUP_READY_KEY, 'true');
  } finally {
    key.fill(0);
  }
}

export async function restoreWithRecoveryCode(code: string) {
  if (!CLOUD_NAME) throw new Error('Cloudinary cloud name is missing from the app environment.');
  const normalizedCode = code.trim();
  if (!RECOVERY_CODE_PATTERN.test(normalizedCode)) {
    throw new Error('Enter a valid recovery code (6–80 letters, numbers, hyphens, or underscores).');
  }
  const fetchModule = async (module: string) => fetch(`https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/habit-tracker/backups/${normalizedCode}/${module}.json?refresh=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
  const fullResponse = await fetchModule('full');
  if (fullResponse.ok) {
    await restoreEncryptedBackup(await fullResponse.json(), normalizedCode);
    return;
  }
  if (fullResponse.status !== 404) {
    throw new Error('Could not fetch the full backup. Check your internet connection and try again.');
  }
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
    await restoreAllAppData({
      ...habitsData,
      settings: { ...DEFAULT_SETTINGS, ...habitsData.settings },
    });
    restoredAny = true;
  } catch (error) {
    firstFailure = error instanceof Error ? error.message : firstFailure;
    console.warn('Could not restore habits backup; other modules will still be checked:', error);
  }
  const moduleRestorers = [
    {
      module: 'loans',
      restore: async (value: unknown) => {
        if (!isLoanLedgerData(value)) throw new Error('The loans backup is invalid.');
        await saveLedger(value);
      },
    },
    {
      module: 'expenses',
      restore: async (value: unknown) => {
        if (!isExpenseData(value)) throw new Error('The expenses backup is invalid.');
        await saveExpenses(value);
      },
    },
  ] as const;

  for (const { module, restore } of moduleRestorers) {
    try {
      const moduleResponse = await fetchModule(module);
      if (moduleResponse.ok) {
        await restore(await moduleResponse.json());
        restoredAny = true;
      }
      else if (moduleResponse.status !== 404) throw new Error(`Could not fetch ${module} backup.`);
    } catch (error) {
      console.warn(`Could not restore ${module} backup; other modules remain available:`, error);
    }
  }
  if (!restoredAny) throw new Error(firstFailure);
  await AsyncStorage.setItem(RECOVERY_CODE_KEY, normalizedCode);
  await AsyncStorage.setItem(RECOVERY_BACKUP_READY_KEY, 'true');
}
