export const PASSWORD_VAULT_FORMAT = 'momentum.encrypted-password-vault' as const;
export const PASSWORD_VAULT_VERSION = 1 as const;

export const VAULT_CATEGORIES = [
  'Personal',
  'Finance',
  'Work',
  'Social',
  'Shopping',
  'Other',
] as const;

export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

export type PasswordEntry = {
  id: string;
  title: string;
  website: string;
  username: string;
  password: string;
  notes: string;
  category: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PasswordEntryDraft = Omit<PasswordEntry, 'id' | 'createdAt' | 'updatedAt'>;

export type VaultEnvelope = {
  format: typeof PASSWORD_VAULT_FORMAT;
  version: typeof PASSWORD_VAULT_VERSION;
  kdf: 'PBKDF2-HMAC-SHA-256';
  iterations: number;
  salt: string;
  cipher: 'AES-256-GCM';
  nonce: string;
  ciphertext: string;
};

export type GeneratorOptions = {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
};

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Excellent';
};
