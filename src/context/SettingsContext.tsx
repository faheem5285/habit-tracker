import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { Settings, DEFAULT_SETTINGS } from '../types';
import { loadSettings, saveSettings } from '../utils/storage';
import { setReminderSoundFlag, setRemindersFlag } from '../utils/notifications';
import { palette, AppPalette } from '../theme';
import { syncRecoveryData } from '../utils/recovery';

type Ctx = {
  settings: Settings;
  loaded: boolean;
  isDark: boolean;
  colors: AppPalette;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const system = useColorScheme();

  useEffect(() => {
    loadSettings().then((s) => {
      const merged = { ...DEFAULT_SETTINGS, ...s };
      setRemindersFlag(merged.notificationsEnabled);
      setReminderSoundFlag(merged.soundEnabled);
      setSettings(merged);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timeout = setTimeout(() => {
      void syncRecoveryData().catch((error) => console.warn('Settings backup sync failed:', error));
    }, 300);
    return () => clearTimeout(timeout);
  }, [loaded, settings]);

  const update = (patch: Partial<Settings>) => {
    if (patch.notificationsEnabled !== undefined) setRemindersFlag(patch.notificationsEnabled);
    if (patch.soundEnabled !== undefined) setReminderSoundFlag(patch.soundEnabled);
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const isDark = settings.theme === 'system' ? system === 'dark' : settings.theme === 'dark';

  const colors = isDark ? palette.dark : palette.light;

  return (
    <SettingsContext.Provider value={{ settings, loaded, isDark, colors, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
