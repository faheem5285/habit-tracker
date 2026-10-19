import * as Clipboard from 'expo-clipboard';

const CLIPBOARD_CLEAR_AFTER_MS = 30_000;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

export async function copySecretTemporarily(value: string) {
  await Clipboard.setStringAsync(value);
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    void (async () => {
      try {
        if ((await Clipboard.getStringAsync()) === value) {
          await Clipboard.setStringAsync('');
        }
      } catch {
        // Clipboard access can be restricted by the operating system.
      } finally {
        clearTimer = null;
      }
    })();
  }, CLIPBOARD_CLEAR_AFTER_MS);
}
