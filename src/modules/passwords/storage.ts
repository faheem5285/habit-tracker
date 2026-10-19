import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateVaultEnvelope } from './crypto';
import type { VaultEnvelope } from './types';
import {
  PASSWORD_VAULT_STORAGE_KEY,
  PASSWORD_VAULT_TIMEOUT_KEY,
} from './crypto';

export async function readVaultEnvelope(): Promise<VaultEnvelope | null> {
  const raw = await AsyncStorage.getItem(PASSWORD_VAULT_STORAGE_KEY);
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('The encrypted vault file on this device is damaged.');
  }
  return validateVaultEnvelope(value);
}

export async function writeVaultEnvelope(envelope: VaultEnvelope) {
  await AsyncStorage.setItem(PASSWORD_VAULT_STORAGE_KEY, JSON.stringify(envelope));
}

export async function loadVaultTimeout() {
  const raw = await AsyncStorage.getItem(PASSWORD_VAULT_TIMEOUT_KEY);
  const minutes = Number(raw);
  return minutes === 1 || minutes === 5 || minutes === 15 ? minutes : 5;
}

export async function saveVaultTimeout(minutes: number) {
  if (minutes !== 1 && minutes !== 5 && minutes !== 15) {
    throw new Error('Choose a supported vault lock timeout.');
  }
  await AsyncStorage.setItem(PASSWORD_VAULT_TIMEOUT_KEY, String(minutes));
}
