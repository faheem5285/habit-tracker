import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { fromByteArray, toByteArray } from 'base64-js';

export const FILE_CATEGORIES = [
  'Documents',
  'Images',
  'Audio',
  'Video',
  'Other',
] as const;

export type FileCategory = (typeof FILE_CATEGORIES)[number];
export type FileCategoryFilter = 'All' | FileCategory;

export type ManagedFile = {
  id: string;
  name: string;
  storedName: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  createdAt: number;
  updatedAt: number;
};

export type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  webFile?: Blob | null;
};

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_PREVIEW_BYTES = 512 * 1024;
export const MAX_IMAGE_PREVIEW_BYTES = 12 * 1024 * 1024;
const MAX_MANAGED_FILES = 500;
const INDEX_KEY = 'momentum.files.index.v1';
const WEB_DATABASE = 'momentum-private-files';
const WEB_STORE = 'file-blobs';
const DIRECTORY_NAME = 'momentum-files';

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function sanitizeFileName(value: string) {
  const safe = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, 180);
  return safe || 'untitled-file';
}

function isFileCategory(value: unknown): value is FileCategory {
  return FILE_CATEGORIES.includes(value as FileCategory);
}

export function isManagedFile(value: unknown): value is ManagedFile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    /^[a-z0-9-]{4,64}$/i.test(item.id) &&
    typeof item.name === 'string' &&
    item.name.length > 0 &&
    item.name.length <= 180 &&
    typeof item.storedName === 'string' &&
    item.storedName.startsWith(`${item.id}-`) &&
    item.storedName.length <= 245 &&
    !/[\\/\u0000-\u001f]/.test(item.storedName) &&
    typeof item.mimeType === 'string' &&
    item.mimeType.length <= 160 &&
    typeof item.size === 'number' &&
    Number.isFinite(item.size) &&
    item.size >= 0 &&
    isFileCategory(item.category) &&
    typeof item.createdAt === 'number' &&
    Number.isFinite(item.createdAt) &&
    typeof item.updatedAt === 'number' &&
    Number.isFinite(item.updatedAt)
  );
}

async function readIndex(): Promise<ManagedFile[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('The file library index is damaged. Your stored files were not changed.');
  }

  if (!Array.isArray(value) || value.length > MAX_MANAGED_FILES) {
    throw new Error('The file library index is invalid. Your stored files were not changed.');
  }
  const candidates: unknown[] = value;
  if (!candidates.every(isManagedFile)) {
    throw new Error('The file library index is invalid. Your stored files were not changed.');
  }
  const files = candidates as ManagedFile[];
  if (new Set(files.map((file) => file.id)).size !== files.length) {
    throw new Error('The file library index is invalid. Your stored files were not changed.');
  }
  return files;
}

async function writeIndex(files: ManagedFile[]) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(files));
}

function nativeDirectory() {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('Private file storage is not available on this device.');
  return `${base}${DIRECTORY_NAME}/`;
}

async function ensureNativeDirectory() {
  const directory = nativeDirectory();
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  }
  return directory;
}

function nativeUri(storedName: string) {
  return `${nativeDirectory()}${storedName}`;
}

function openWebDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Browser file storage is not available in this browser.'));
      return;
    }
    const request = indexedDB.open(WEB_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(WEB_STORE)) {
        request.result.createObjectStore(WEB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open browser file storage.'));
  });
}

async function putWebBlob(key: string, blob: Blob) {
  const db = await openWebDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(WEB_STORE, 'readwrite');
    transaction.objectStore(WEB_STORE).put(blob, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the file.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not save the file.'));
  }).finally(() => db.close());
}

async function getWebBlob(key: string) {
  const db = await openWebDatabase();
  return new Promise<Blob | null>((resolve, reject) => {
    const transaction = db.transaction(WEB_STORE, 'readonly');
    const request = transaction.objectStore(WEB_STORE).get(key);
    let result: Blob | null = null;
    request.onsuccess = () => {
      result = request.result instanceof Blob ? request.result : null;
    };
    request.onerror = () => reject(request.error ?? new Error('Could not read the file.'));
    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error('Could not read the file.'));
    };
  });
}

async function removeWebBlob(key: string) {
  const db = await openWebDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(WEB_STORE, 'readwrite');
    transaction.objectStore(WEB_STORE).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not remove the file.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not remove the file.'));
  }).finally(() => db.close());
}

export function loadManagedFiles() {
  return readIndex();
}

export async function readManagedFileBytes(file: ManagedFile) {
  if (Platform.OS === 'web') {
    const blob = await getWebBlob(file.storedName);
    if (!blob) throw new Error(`The file "${file.name}" is missing from browser storage.`);
    return new Uint8Array(await blob.arrayBuffer());
  }
  const uri = nativeUri(file.storedName);
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) throw new Error(`The file "${file.name}" is missing from device storage.`);
  const encoded = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return toByteArray(encoded);
}

export async function restoreManagedFiles(items: Array<{ file: ManagedFile; bytes: Uint8Array }>) {
  if (items.length > MAX_MANAGED_FILES || !items.every(({ file }) => isManagedFile(file))) {
    throw new Error('The file backup contains invalid file metadata.');
  }
  if (new Set(items.map(({ file }) => file.id)).size !== items.length) {
    throw new Error('The file backup contains duplicate file identifiers.');
  }

  const restored = items.map(({ file, bytes }) => ({ ...file, size: bytes.byteLength }));
  for (const [index, { bytes }] of items.entries()) {
    const file = restored[index];
    if (!file) throw new Error('The file backup could not be restored.');
    if (Platform.OS === 'web') {
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      await putWebBlob(file.storedName, new Blob([buffer], { type: file.mimeType }));
    } else {
      await ensureNativeDirectory();
      await FileSystem.writeAsStringAsync(
        nativeUri(file.storedName),
        fromByteArray(bytes),
        { encoding: FileSystem.EncodingType.Base64 },
      );
    }
  }

  const current = await readIndex();
  const byId = new Map(current.map((file) => [file.id, file]));
  restored.forEach((file) => byId.set(file.id, file));
  const next = [...byId.values()];
  if (next.length > MAX_MANAGED_FILES) {
    throw new Error(`The file library can hold up to ${MAX_MANAGED_FILES} items.`);
  }
  await writeIndex(next);
}

export async function importManagedFile(
  picked: PickedFile,
  category: FileCategory,
): Promise<ManagedFile> {
  const current = await readIndex();
  if (current.length >= MAX_MANAGED_FILES) {
    throw new Error(`The file library can hold up to ${MAX_MANAGED_FILES} items.`);
  }

  const name = sanitizeFileName(picked.name);
  const webBlob = picked.webFile ?? (
    Platform.OS === 'web' ? await (await fetch(picked.uri)).blob() : null
  );
  let size = webBlob?.size ?? picked.size ?? 0;
  if (Platform.OS !== 'web' && !size) {
    const info = await FileSystem.getInfoAsync(picked.uri);
    if (!info.exists) {
      throw new Error('The selected file is no longer available.');
    }
    size = info.size ?? 0;
  }
  if (size > MAX_FILE_BYTES) {
    throw new Error('This file is over the 100 MB per-file limit.');
  }

  const id = createId();
  const storedName = `${id}-${name}`;
  const record: ManagedFile = {
    id,
    name,
    storedName,
    mimeType: picked.mimeType?.slice(0, 160) || 'application/octet-stream',
    size,
    category,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (Platform.OS === 'web') {
    if (!webBlob) throw new Error('The browser did not provide access to this file.');
    await putWebBlob(storedName, webBlob);
  } else {
    const directory = await ensureNativeDirectory();
    await FileSystem.copyAsync({
      from: picked.uri,
      to: `${directory}${storedName}`,
    });
    const info = await FileSystem.getInfoAsync(`${directory}${storedName}`);
    if (!info.exists) throw new Error('The file could not be saved to private app storage.');
    record.size = info.size ?? size;
  }

  try {
    await writeIndex([record, ...current]);
  } catch (error) {
    if (Platform.OS === 'web') await removeWebBlob(storedName).catch(() => undefined);
    else await FileSystem.deleteAsync(nativeUri(storedName), { idempotent: true }).catch(() => undefined);
    throw error;
  }
  return record;
}

export async function getManagedFileUri(file: ManagedFile) {
  if (Platform.OS === 'web') {
    const blob = await getWebBlob(file.storedName);
    if (!blob) throw new Error('This file is no longer available in browser storage.');
    return URL.createObjectURL(blob);
  }
  const uri = nativeUri(file.storedName);
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) throw new Error('This file is missing from private app storage.');
  return uri;
}

export async function getManagedFileBlob(file: ManagedFile) {
  if (Platform.OS !== 'web') {
    throw new Error('File downloads from this device use the system share sheet.');
  }
  const blob = await getWebBlob(file.storedName);
  if (!blob) throw new Error('This file is no longer available in browser storage.');
  return blob;
}

export async function readManagedText(file: ManagedFile) {
  if (file.size > MAX_PREVIEW_BYTES) {
    throw new Error('This file is too large for an in-app text preview.');
  }
  if (Platform.OS === 'web') {
    const blob = await getWebBlob(file.storedName);
    if (!blob) throw new Error('This file is no longer available in browser storage.');
    return blob.text();
  }
  return FileSystem.readAsStringAsync(nativeUri(file.storedName), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function renameManagedFile(id: string, requestedName: string) {
  const current = await readIndex();
  const file = current.find((item) => item.id === id);
  if (!file) throw new Error('This file is no longer in the library.');
  const name = sanitizeFileName(requestedName);
  if (name.length > 180) throw new Error('Use a shorter file name.');
  if (name === file.name) return file;

  const nextFile = {
    ...file,
    name,
    storedName: `${file.id}-${name}`,
    updatedAt: Date.now(),
  };
  if (Platform.OS !== 'web') {
    await FileSystem.moveAsync({
      from: nativeUri(file.storedName),
      to: nativeUri(nextFile.storedName),
    });
  }
  try {
    await writeIndex(current.map((item) => item.id === id ? nextFile : item));
  } catch (error) {
    if (Platform.OS !== 'web') {
      await FileSystem.moveAsync({
        from: nativeUri(nextFile.storedName),
        to: nativeUri(file.storedName),
      }).catch(() => undefined);
    }
    throw error;
  }
  return nextFile;
}

export async function moveManagedFile(id: string, category: FileCategory) {
  const current = await readIndex();
  const file = current.find((item) => item.id === id);
  if (!file) throw new Error('This file is no longer in the library.');
  const nextFile = { ...file, category, updatedAt: Date.now() };
  await writeIndex(current.map((item) => item.id === id ? nextFile : item));
  return nextFile;
}

function copiedName(name: string) {
  const dot = name.lastIndexOf('.');
  const hasExtension = dot > 0;
  const stem = hasExtension ? name.slice(0, dot) : name;
  const extension = hasExtension ? name.slice(dot) : '';
  return sanitizeFileName(`${stem} copy${extension}`);
}

export async function copyManagedFile(id: string) {
  const current = await readIndex();
  if (current.length >= MAX_MANAGED_FILES) {
    throw new Error(`The file library can hold up to ${MAX_MANAGED_FILES} items.`);
  }
  const file = current.find((item) => item.id === id);
  if (!file) throw new Error('This file is no longer in the library.');
  const copiedId = createId();
  const name = copiedName(file.name);
  const storedName = `${copiedId}-${name}`;
  const nextFile: ManagedFile = {
    ...file,
    id: copiedId,
    name,
    storedName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (Platform.OS === 'web') {
    const blob = await getWebBlob(file.storedName);
    if (!blob) throw new Error('This file is no longer available in browser storage.');
    await putWebBlob(storedName, blob);
  } else {
    await FileSystem.copyAsync({
      from: nativeUri(file.storedName),
      to: nativeUri(storedName),
    });
  }

  try {
    await writeIndex([nextFile, ...current]);
  } catch (error) {
    if (Platform.OS === 'web') await removeWebBlob(storedName).catch(() => undefined);
    else await FileSystem.deleteAsync(nativeUri(storedName), { idempotent: true }).catch(() => undefined);
    throw error;
  }
  return nextFile;
}

export async function deleteManagedFile(id: string) {
  const current = await readIndex();
  const file = current.find((item) => item.id === id);
  if (!file) throw new Error('This file is no longer in the library.');
  const next = current.filter((item) => item.id !== id);

  if (Platform.OS === 'web') {
    await writeIndex(next);
    try {
      await removeWebBlob(file.storedName);
    } catch (error) {
      await writeIndex(current).catch(() => undefined);
      throw error;
    }
    return;
  }

  const source = nativeUri(file.storedName);
  const trashName = `${file.id}-deleting`;
  const trash = nativeUri(trashName);
  await FileSystem.moveAsync({ from: source, to: trash });
  try {
    await writeIndex(next);
  } catch (error) {
    await FileSystem.moveAsync({ from: trash, to: source }).catch(() => undefined);
    throw error;
  }
  try {
    await FileSystem.deleteAsync(trash);
  } catch (error) {
    await FileSystem.moveAsync({ from: trash, to: source }).catch(() => undefined);
    await writeIndex(current).catch(() => undefined);
    throw error;
  }
}
