import { gcm } from '@noble/ciphers/aes';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import {
  bytesToHex,
  hexToBytes,
  utf8ToBytes,
} from '@noble/hashes/utils.js';
import * as Crypto from 'expo-crypto';
import {
  PASSWORD_VAULT_FORMAT,
  PASSWORD_VAULT_VERSION,
  type GeneratorOptions,
  type PasswordEntry,
  type PasswordStrength,
  type VaultEnvelope,
} from './types';

export const PASSWORD_VAULT_STORAGE_KEY = 'momentum.passwords.encrypted.v1';
export const PASSWORD_VAULT_TIMEOUT_KEY = 'momentum.passwords.timeout.v1';
export const VAULT_KDF_ITERATIONS = 600_000;
const NATIVE_VAULT_KDF_ITERATIONS = 210_000;
export const MIN_MASTER_PASSPHRASE_LENGTH = 12;
const MAX_BACKUP_LENGTH = 2_000_000;
const MAX_VAULT_PLAINTEXT_LENGTH = 900_000;
const VAULT_AAD = utf8ToBytes('Momentum encrypted password vault v1');

export function validatePasswordEntries(value: unknown): PasswordEntry[] {
  if (!Array.isArray(value) || value.length > 5_000) {
    throw new Error('This vault contains an unsupported number of entries.');
  }

  const ids = new Set<string>();
  const entries = value.map((candidate): PasswordEntry => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error('This vault contains an invalid entry.');
    }
    const entry = candidate as Record<string, unknown>;
    const text = (key: string, max: number, required = false) => {
      const item = entry[key];
      if (typeof item !== 'string' || item.length > max || (required && !item.trim())) {
        throw new Error('This vault contains an invalid entry.');
      }
      return item;
    };
    const id = text('id', 80, true);
    if (ids.has(id)) throw new Error('This vault contains duplicate entry identifiers.');
    ids.add(id);

    const tags = entry.tags;
    if (
      !Array.isArray(tags) ||
      tags.length > 20 ||
      tags.some((tag) => typeof tag !== 'string' || tag.length > 40)
    ) {
      throw new Error('This vault contains invalid tags.');
    }
    if (
      typeof entry.favorite !== 'boolean' ||
      typeof entry.createdAt !== 'number' ||
      !Number.isFinite(entry.createdAt) ||
      typeof entry.updatedAt !== 'number' ||
      !Number.isFinite(entry.updatedAt)
    ) {
      throw new Error('This vault contains invalid entry metadata.');
    }

    return {
      id,
      title: text('title', 120, true),
      website: text('website', 2_048),
      username: text('username', 250),
      password: text('password', 4_096, true),
      notes: text('notes', 10_000),
      category: text('category', 40, true),
      tags: [...tags] as string[],
      favorite: entry.favorite,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  });

  const serialized = JSON.stringify(entries);
  if (serialized.length > MAX_VAULT_PLAINTEXT_LENGTH) {
    throw new Error('This vault is too large to save or import safely.');
  }
  return entries;
}

export function validateVaultEnvelope(value: unknown): VaultEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('This is not a valid Momentum encrypted vault file.');
  }
  const envelope = value as Record<string, unknown>;
  const isHex = (input: unknown, exactLength?: number): input is string =>
    typeof input === 'string' &&
    /^[0-9a-f]+$/i.test(input) &&
    input.length % 2 === 0 &&
    (exactLength === undefined || input.length === exactLength);

  if (
    envelope.format !== PASSWORD_VAULT_FORMAT ||
    envelope.version !== PASSWORD_VAULT_VERSION ||
    envelope.kdf !== 'PBKDF2-HMAC-SHA-256' ||
    envelope.cipher !== 'AES-256-GCM' ||
    typeof envelope.iterations !== 'number' ||
    !Number.isInteger(envelope.iterations) ||
    envelope.iterations < 100_000 ||
    envelope.iterations > 1_000_000 ||
    !isHex(envelope.salt, 32) ||
    !isHex(envelope.nonce, 24) ||
    !isHex(envelope.ciphertext) ||
    envelope.ciphertext.length < 32 ||
    envelope.ciphertext.length > MAX_BACKUP_LENGTH
  ) {
    throw new Error('This is not a supported Momentum encrypted vault file.');
  }

  return envelope as VaultEnvelope;
}

async function deriveKey(passphrase: string, saltHex: string, iterations: number) {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const derivedBits = await Promise.race([
        (async () => {
          const passphraseKey = await subtle.importKey(
            'raw',
            utf8ToBytes(passphrase),
            'PBKDF2',
            false,
            ['deriveBits'],
          );
          return subtle.deriveBits(
            {
              name: 'PBKDF2',
              hash: 'SHA-256',
              salt: hexToBytes(saltHex),
              iterations,
            },
            passphraseKey,
            256,
          );
        })(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error('Native key derivation timed out.')), 5_000);
        }),
      ]);
      return new Uint8Array(derivedBits);
    } catch {
      // Fall back to the bundled implementation when native Web Crypto is unavailable or stalls.
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  return pbkdf2Async(
    sha256,
    utf8ToBytes(passphrase),
    hexToBytes(saltHex),
    { c: iterations, dkLen: 32 },
  );
}

async function encryptEntries(
  entries: PasswordEntry[],
  key: Uint8Array,
  envelope: Pick<VaultEnvelope, 'salt' | 'iterations'>,
): Promise<VaultEnvelope> {
  const nonce = Crypto.getRandomBytes(12);
  const plaintext = utf8ToBytes(JSON.stringify(validatePasswordEntries(entries)));
  const ciphertext = gcm(key, nonce, VAULT_AAD).encrypt(plaintext);
  return {
    format: PASSWORD_VAULT_FORMAT,
    version: PASSWORD_VAULT_VERSION,
    kdf: 'PBKDF2-HMAC-SHA-256',
    iterations: envelope.iterations,
    salt: envelope.salt,
    cipher: 'AES-256-GCM',
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(ciphertext),
  };
}

export async function createEncryptedVault(passphrase: string, entries: PasswordEntry[] = []) {
  if (passphrase.length < MIN_MASTER_PASSPHRASE_LENGTH) {
    throw new Error(`Use a master passphrase with at least ${MIN_MASTER_PASSPHRASE_LENGTH} characters.`);
  }
  const salt = Crypto.getRandomBytes(16);
  const saltHex = bytesToHex(salt);
  const iterations = globalThis.crypto?.subtle
    ? VAULT_KDF_ITERATIONS
    : NATIVE_VAULT_KDF_ITERATIONS;
  const key = await deriveKey(passphrase, saltHex, iterations);
  try {
    const envelope = await encryptEntries(entries, key, {
      salt: saltHex,
      iterations,
    });
    return { envelope, key };
  } catch (error) {
    key.fill(0);
    throw error;
  }
}

export async function reencryptVaultEntries(
  envelope: VaultEnvelope,
  key: Uint8Array,
  entries: PasswordEntry[],
) {
  return encryptEntries(entries, key, envelope);
}

export async function decryptVaultEnvelope(value: unknown, passphrase: string) {
  const envelope = validateVaultEnvelope(value);
  const key = await deriveKey(passphrase, envelope.salt, envelope.iterations);
  try {
    const plaintext = gcm(
      key,
      hexToBytes(envelope.nonce),
      VAULT_AAD,
    ).decrypt(hexToBytes(envelope.ciphertext));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));
    const entries = validatePasswordEntries(parsed);
    return { envelope, entries, key };
  } catch {
    key.fill(0);
    throw new Error('Could not unlock this vault. Check the passphrase and file.');
  }
}

async function unbiasedIndex(max: number, random: () => Promise<number>) {
  const ceiling = Math.floor(256 / max) * max;
  let value = await random();
  while (value >= ceiling) value = await random();
  return value % max;
}

export async function generatePassword(options: GeneratorOptions) {
  const length = Math.min(64, Math.max(8, Math.floor(options.length)));
  const groups = [
    options.lowercase ? 'abcdefghijkmnopqrstuvwxyz' : '',
    options.uppercase ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : '',
    options.numbers ? '23456789' : '',
    options.symbols ? '!@#$%^&*()-_=+[]{}:,.?' : '',
  ].filter(Boolean);
  if (!groups.length) throw new Error('Choose at least one character type.');

  let randomBytes: number[] = [];
  let cursor = 0;
  const refill = async () => {
    randomBytes = Array.from(await Crypto.getRandomBytesAsync(128));
    cursor = 0;
  };
  const nextByte = async () => {
    if (cursor >= randomBytes.length) await refill();
    const value = randomBytes[cursor++];
    return value ?? 0;
  };
  const pick = async (alphabet: string) => {
    const selected = await unbiasedIndex(alphabet.length, nextByte);
    return alphabet[selected];
  };

  await refill();
  const result: string[] = [];
  for (const group of groups) result.push(await pick(group));
  const pool = groups.join('');
  while (result.length < length) result.push(await pick(pool));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = await unbiasedIndex(index + 1, nextByte);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  randomBytes.fill(0);
  return result.join('');
}

export function measurePasswordStrength(password: string): PasswordStrength {
  const normalized = password.toLowerCase();
  const common = ['password', 'qwerty', 'letmein', 'welcome', '123456'];
  if (!password || common.some((part) => normalized.includes(part))) {
    return { score: 0, label: 'Very weak' };
  }

  const variety = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;
  let score = Math.min(3, Math.floor(password.length / 8)) + (variety >= 3 ? 1 : 0);
  if (password.length < 12) score = Math.min(score, 1);
  const labels: PasswordStrength['label'][] = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'];
  const safeScore = Math.min(4, Math.max(0, score)) as PasswordStrength['score'];
  return { score: safeScore, label: labels[safeScore] };
}
