import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import {
  createEncryptedVault,
  decryptVaultEnvelope,
  reencryptVaultEntries,
  validatePasswordEntries,
} from './crypto';
import {
  loadVaultTimeout,
  readVaultEnvelope,
  saveVaultTimeout,
  writeVaultEnvelope,
} from './storage';
import type { PasswordEntry, VaultEnvelope } from './types';
import { syncRecoveryData } from '../../utils/recovery';

type PasswordVaultContextValue = {
  ready: boolean;
  vaultExists: boolean;
  unlocked: boolean;
  entries: PasswordEntry[];
  timeoutMinutes: number;
  loadError: string | null;
  createVault: (passphrase: string) => Promise<void>;
  unlockVault: (passphrase: string) => Promise<void>;
  lockVault: () => void;
  touch: () => void;
  saveEntry: (entry: PasswordEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  setFavorite: (id: string, favorite: boolean) => Promise<void>;
  changeMasterPassphrase: (passphrase: string) => Promise<void>;
  mergeImportedEntries: (entries: PasswordEntry[]) => Promise<number>;
  exportEncryptedBackup: () => string;
  setTimeoutMinutes: (minutes: number) => Promise<void>;
  refresh: () => Promise<void>;
};

const PasswordVaultContext = createContext<PasswordVaultContextValue | null>(null);

export function PasswordVaultProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [vaultExists, setVaultExists] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [timeoutMinutes, setTimeoutMinutesState] = useState(5);
  const [loadError, setLoadError] = useState<string | null>(null);
  const keyRef = useRef<Uint8Array | null>(null);
  const envelopeRef = useRef<VaultEnvelope | null>(null);
  const entriesRef = useRef<PasswordEntry[]>([]);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  const refresh = useCallback(async () => {
    try {
      const [envelope, timeout] = await Promise.all([
        readVaultEnvelope(),
        loadVaultTimeout(),
      ]);
      envelopeRef.current = envelope;
      setVaultExists(Boolean(envelope));
      setTimeoutMinutesState(timeout);
      setLoadError(null);
      setReady(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not read the encrypted vault.');
      setReady(true);
    }
  }, []);

  const lockVault = useCallback(() => {
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = null;
    keyRef.current?.fill(0);
    keyRef.current = null;
    entriesRef.current = [];
    setEntries([]);
    setUnlocked(false);
  }, []);

  const touch = useCallback(() => {
    if (!keyRef.current) return;
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(lockVault, timeoutMinutes * 60_000);
  }, [lockVault, timeoutMinutes]);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') lockVault();
      else touch();
    });
    return () => {
      subscription.remove();
      if (lockTimer.current) clearTimeout(lockTimer.current);
      keyRef.current?.fill(0);
    };
  }, [lockVault, refresh, touch]);

  const createVault = useCallback(async (passphrase: string) => {
    const existing = await readVaultEnvelope();
    if (existing) {
      envelopeRef.current = existing;
      setVaultExists(true);
      throw new Error('A vault already exists. Unlock it to continue.');
    }
    const created = await createEncryptedVault(passphrase);
    try {
      await writeVaultEnvelope(created.envelope);
    } catch (error) {
      created.key.fill(0);
      throw error;
    }
    envelopeRef.current = created.envelope;
    setVaultExists(true);
    void syncRecoveryData().catch((error) => console.warn('Password vault backup sync failed:', error));
    if (AppState.currentState !== 'active') {
      created.key.fill(0);
      keyRef.current?.fill(0);
      keyRef.current = null;
      entriesRef.current = [];
      setEntries([]);
      setUnlocked(false);
      return;
    }
    keyRef.current?.fill(0);
    keyRef.current = created.key;
    entriesRef.current = [];
    setEntries([]);
    setUnlocked(true);
    setLoadError(null);
    touch();
  }, [touch]);

  const unlockVault = useCallback(async (passphrase: string) => {
    await writeQueue.current.catch(() => undefined);
    const envelope = await readVaultEnvelope();
    if (!envelope) {
      setVaultExists(false);
      throw new Error('No password vault is set up on this device.');
    }
    const decrypted = await decryptVaultEnvelope(envelope, passphrase);
    if (AppState.currentState !== 'active') {
      decrypted.key.fill(0);
      throw new Error('Return to Momentum to unlock the vault.');
    }
    keyRef.current?.fill(0);
    keyRef.current = decrypted.key;
    envelopeRef.current = decrypted.envelope;
    entriesRef.current = decrypted.entries;
    setEntries(decrypted.entries);
    setVaultExists(true);
    setUnlocked(true);
    setLoadError(null);
    touch();
  }, [touch]);

  const persistChange = useCallback((mutate: (current: PasswordEntry[]) => PasswordEntry[]) => {
    const operation = writeQueue.current.catch(() => undefined).then(async () => {
      const key = keyRef.current;
      const envelope = envelopeRef.current;
      if (!key || !envelope) throw new Error('Unlock the vault before changing entries.');
      const workingKey = new Uint8Array(key);
      try {
        const nextEntries = validatePasswordEntries(mutate(entriesRef.current));
        const nextEnvelope = await reencryptVaultEntries(envelope, workingKey, nextEntries);
        await writeVaultEnvelope(nextEnvelope);
        envelopeRef.current = nextEnvelope;
        if (keyRef.current === key && AppState.currentState === 'active') {
          entriesRef.current = nextEntries;
          setEntries(nextEntries);
          touch();
        }
        void syncRecoveryData().catch((error) => console.warn('Password vault backup sync failed:', error));
      } finally {
        workingKey.fill(0);
      }
    });
    writeQueue.current = operation;
    return operation;
  }, [touch]);

  const saveEntry = useCallback((entry: PasswordEntry) => {
    return persistChange((current) => [
      entry,
      ...current.filter((item) => item.id !== entry.id),
    ]);
  }, [persistChange]);

  const deleteEntry = useCallback((id: string) => {
    return persistChange((current) => current.filter((item) => item.id !== id));
  }, [persistChange]);

  const setFavorite = useCallback((id: string, favorite: boolean) => {
    return persistChange((current) => current.map((item) => (
      item.id === id ? { ...item, favorite, updatedAt: Date.now() } : item
    )));
  }, [persistChange]);

  const changeMasterPassphrase = useCallback((passphrase: string) => {
    const operation = writeQueue.current.catch(() => undefined).then(async () => {
      const oldKey = keyRef.current;
      if (!oldKey || !envelopeRef.current) {
        throw new Error('Unlock the vault before changing its passphrase.');
      }
      const currentEntries = entriesRef.current;
      const created = await createEncryptedVault(passphrase, currentEntries);
      try {
        await writeVaultEnvelope(created.envelope);
        envelopeRef.current = created.envelope;
        setVaultExists(true);
        void syncRecoveryData().catch((error) => console.warn('Password vault backup sync failed:', error));
        if (keyRef.current === oldKey && AppState.currentState === 'active') {
          keyRef.current = created.key;
          oldKey.fill(0);
          entriesRef.current = currentEntries;
          setEntries(currentEntries);
          setUnlocked(true);
          touch();
        } else {
          oldKey.fill(0);
          created.key.fill(0);
          if (keyRef.current === oldKey) keyRef.current = null;
          entriesRef.current = [];
          setEntries([]);
          setUnlocked(false);
        }
      } catch (error) {
        created.key.fill(0);
        throw error;
      }
    });
    writeQueue.current = operation;
    return operation;
  }, [touch]);

  const mergeImportedEntries = useCallback((importedEntries: PasswordEntry[]) => {
    return persistChange((current) => {
      const merged = new Map(current.map((entry) => [entry.id, entry]));
      importedEntries.forEach((entry) => merged.set(entry.id, entry));
      return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    }).then(() => importedEntries.length);
  }, [persistChange]);

  const exportEncryptedBackup = useCallback(() => {
    if (!keyRef.current || !envelopeRef.current) {
      throw new Error('Unlock the vault before exporting an encrypted backup.');
    }
    return JSON.stringify(envelopeRef.current, null, 2);
  }, []);

  const setTimeoutMinutes = useCallback(async (minutes: number) => {
    await saveVaultTimeout(minutes);
    setTimeoutMinutesState(minutes);
    void syncRecoveryData().catch((error) => console.warn('Password vault backup sync failed:', error));
    if (keyRef.current) {
      if (lockTimer.current) clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(lockVault, minutes * 60_000);
    }
  }, [lockVault]);

  const value = useMemo<PasswordVaultContextValue>(() => ({
    ready,
    vaultExists,
    unlocked,
    entries,
    timeoutMinutes,
    loadError,
    createVault,
    unlockVault,
    lockVault,
    touch,
    saveEntry,
    deleteEntry,
    setFavorite,
    changeMasterPassphrase,
    mergeImportedEntries,
    exportEncryptedBackup,
    setTimeoutMinutes,
    refresh,
  }), [
    ready,
    vaultExists,
    unlocked,
    entries,
    timeoutMinutes,
    loadError,
    createVault,
    unlockVault,
    lockVault,
    touch,
    saveEntry,
    deleteEntry,
    setFavorite,
    changeMasterPassphrase,
    mergeImportedEntries,
    exportEncryptedBackup,
    setTimeoutMinutes,
    refresh,
  ]);

  return <PasswordVaultContext.Provider value={value}>{children}</PasswordVaultContext.Provider>;
}

export function usePasswordVault() {
  const context = useContext(PasswordVaultContext);
  if (!context) throw new Error('usePasswordVault must be used within PasswordVaultProvider.');
  return context;
}
