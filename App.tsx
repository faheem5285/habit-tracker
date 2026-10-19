import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import RecoveryStartScreen from './src/screens/RecoveryStartScreen';
import { HabitProvider, useHabits } from './src/context/HabitContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasLocalAppData, RECOVERY_STARTED_KEY } from './src/utils/storage';
import { syncRecoveryData } from './src/utils/recovery';
import { LoaderScreen } from './src/components/AppLoader';
import { useColorScheme } from 'react-native';
import { PasswordVaultProvider } from './src/modules/passwords/PasswordVaultContext';

function Gate() {
  const { settings, loaded, isDark } = useSettings();
  const { habits, logs, dailyNotes, loaded: habitsLoaded } = useHabits();
  useEffect(() => {
    if (!loaded || !habitsLoaded) return;
    const timeout = setTimeout(() => {
      void syncRecoveryData(undefined, { habits, logs, dailyNotes, settings })
        .catch((error) => console.warn('Recovery backup sync failed:', error));
    }, 1200);
    return () => clearTimeout(timeout);
  }, [loaded, habitsLoaded, settings, habits, logs, dailyNotes]);
  if (!loaded || !habitsLoaded) return <LoaderScreen scheme={isDark ? 'dark' : 'light'} />;
  return (
    <>
      {settings.hasOnboarded ? <RootNavigator /> : <OnboardingScreen />}
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
