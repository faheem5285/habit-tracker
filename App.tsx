import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import RecoveryStartScreen from './src/screens/RecoveryStartScreen';
import { HabitProvider, useHabits } from './src/context/HabitContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasLocalAppData, RECOVERY_STARTED_KEY } from './src/utils/storage';
import { syncRecoveryData } from './src/utils/recovery';

function Gate() {
  const { settings, loaded, isDark } = useSettings();
  const { habits, logs, dailyNotes, loaded: habitsLoaded } = useHabits();
  useEffect(() => {
    if (!loaded || !habitsLoaded) return;
    const timer = setTimeout(() => {
      void syncRecoveryData().catch((error) => console.warn('Recovery backup sync failed:', error));
    }, 900);
    return () => clearTimeout(timer);
  }, [loaded, habitsLoaded, habits, logs, dailyNotes, settings]);
  if (!loaded || !habitsLoaded) return null;
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
  if (checking) return null;
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
  return <SettingsProvider><HabitProvider><Gate /></HabitProvider></SettingsProvider>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StartupGate />
    </SafeAreaProvider>
  );
}
