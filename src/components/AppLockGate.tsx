import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, AppStateStatus, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { Text } from '../components/Themed';

export default function AppLockGate({ children }: { children: ReactNode }) {
  const { settings, colors } = useSettings();
  const [locked, setLocked] = useState(Boolean(settings.appLockEnabled));
  const [checking, setChecking] = useState(false);
  const authenticated = useRef(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const authenticate = useCallback(async () => {
    if (!settings.appLockEnabled || checking) return;
    setChecking(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Momentum',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use device passcode',
      });
      if (result.success) {
        authenticated.current = true;
        setLocked(false);
      } else {
        setLocked(true);
      }
    } catch {
      setLocked(true);
    } finally {
      setChecking(false);
    }
  }, [settings.appLockEnabled, checking]);

  useEffect(() => {
    if (!settings.appLockEnabled) {
      setLocked(false);
      authenticated.current = false;
      return;
    }
    setLocked(true);
    authenticated.current = false;
    void authenticate();
  // Authenticate when the setting is enabled; the app-state listener handles later returns.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.appLockEnabled]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = /inactive|background/.test(appState.current);
      appState.current = nextState;
      if (!settings.appLockEnabled) return;
      if (nextState === 'background' || nextState === 'inactive') {
        authenticated.current = false;
        setLocked(true);
      } else if (nextState === 'active' && wasBackgrounded) {
        setLocked(true);
        void authenticate();
      }
    });
    return () => subscription.remove();
  }, [authenticate, settings.appLockEnabled]);

  if (!settings.appLockEnabled || (!locked && authenticated.current)) return <>{children}</>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name="finger-print" size={56} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Momentum is locked</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>Use your fingerprint, face, or device passcode to protect your personal information.</Text>
      <TouchableOpacity accessibilityRole="button" disabled={checking} onPress={() => void authenticate()} style={[styles.button, { backgroundColor: colors.primary }]}>
        <Ionicons name="lock-open-outline" size={18} color={colors.onPrimary} />
        <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{checking ? 'Checking…' : 'Unlock Momentum'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject, zIndex: 10000, alignItems: 'center', justifyContent: 'center', padding: 28 },
  iconWrap: { width: 112, height: 112, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10, maxWidth: 300 },
  button: { minHeight: 50, borderRadius: 15, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 24 },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
