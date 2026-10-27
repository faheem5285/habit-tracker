import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import RecoveryStartScreen from './src/screens/RecoveryStartScreen';
import { HabitProvider, useHabits } from './src/context/HabitContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import {
  hasLocalAppData,
  RECOVERY_BACKUP_READY_KEY,
  RECOVERY_PROMPT_SEEN_KEY,
  RECOVERY_RESTORED_KEY,
  RECOVERY_STARTED_KEY,
} from './src/utils/storage';
import { syncRecoveryData } from './src/utils/recovery';
import { LoaderScreen } from './src/components/AppLoader';
import { useColorScheme } from 'react-native';
import { PasswordVaultProvider } from './src/modules/passwords/PasswordVaultContext';
import AppLockGate from './src/components/AppLockGate';

function Gate() {
  const { settings, loaded, isDark } = useSettings();
  const { habits, logs, dailyNotes, loaded: habitsLoaded } = useHabits();
  const [recoveryPromptChecked, setRecoveryPromptChecked] = useState(false);
  const [needsRecoveryPrompt, setNeedsRecoveryPrompt] = useState(false);
  const [recoveredBackup, setRecoveredBackup] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    let active = true;
    if (!settings.hasOnboarded) {
      setNeedsRecoveryPrompt(false);
      setRecoveryPromptChecked(true);
      return () => { active = false; };
    }
    void Promise.all([
      AsyncStorage.getItem(RECOVERY_BACKUP_READY_KEY),
      AsyncStorage.getItem(RECOVERY_PROMPT_SEEN_KEY),
      AsyncStorage.getItem(RECOVERY_RESTORED_KEY),
    ]).then(([backupReady, promptSeen, restored]) => {
      if (!active) return;
      setNeedsRecoveryPrompt(backupReady !== 'true' && promptSeen !== 'true');
      setRecoveredBackup(restored === 'true');
      setRecoveryPromptChecked(true);
    }).catch((error) => {
      console.warn('Could not read recovery prompt status:', error);
      if (active) setRecoveryPromptChecked(true);
    });
    return () => { active = false; };
  }, [loaded, settings.hasOnboarded]);

  useEffect(() => {
    if (!loaded || !habitsLoaded) return;
    const timeout = setTimeout(() => {
      void syncRecoveryData(undefined, { habits, logs, dailyNotes, settings })
        .catch((error) => console.warn('Recovery backup sync failed:', error));
    }, 1200);
    return () => clearTimeout(timeout);
  }, [loaded, habitsLoaded, settings, habits, logs, dailyNotes]);
  if (!loaded || !habitsLoaded || !recoveryPromptChecked) return <LoaderScreen scheme={isDark ? 'dark' : 'light'} />;
  const dismissRecoveryPrompt = async () => {
    try {
      await AsyncStorage.setItem(RECOVERY_PROMPT_SEEN_KEY, 'true');
      setNeedsRecoveryPrompt(false);
    } catch (error) {
      console.warn('Could not save recovery prompt status:', error);
      Alert.alert('Could not save this choice', 'Please try again. Your data has not been deleted.');
    }
  };
  return (
    <>
      {settings.hasOnboarded
        ? needsRecoveryPrompt
          ? <OnboardingScreen recoveryPromptOnly onRecoveryPromptDone={dismissRecoveryPrompt} />
          : <AppLockGate><RootNavigator /></AppLockGate>
        : <OnboardingScreen skipRecoverySlide={recoveredBackup} />}
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

function StartupGate() {
  const [checking, setChecking] = useState(true);
  const [needsRecoveryChoice, setNeedsRecoveryChoice] = useState(false);
  useEffect(() => {
    void hasLocalAppData().then((hasData) => {
      setNeedsRecoveryChoice(!hasData);
      setChecking(false);
    });
  }, []);
  const system = useColorScheme();
  if (checking) return <LoaderScreen scheme={system === 'dark' ? 'dark' : 'light'} label="Loading your habits" />;
  if (needsRecoveryChoice) {
    return (
      <SettingsProvider>
        <RecoveryStartScreen
          onStartFresh={() => { void AsyncStorage.setItem(RECOVERY_STARTED_KEY, 'true'); setNeedsRecoveryChoice(false); }}
          onRestored={() => setNeedsRecoveryChoice(false)}
        />
      </SettingsProvider>
    );
  }
  return (
    <SettingsProvider>
      <HabitProvider>
        <PasswordVaultProvider>
          <Gate />
        </PasswordVaultProvider>
      </HabitProvider>
    </SettingsProvider>
  );
}

export default function App() {
  return <StartupGate />;
}
