import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, View, TouchableOpacity, StyleSheet, Alert, PanResponder, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Themed';
import { useHabits, HabitInput } from '../context/HabitContext';
import { useSettings } from '../context/SettingsContext';
import { ensurePermission } from '../utils/notifications';
import { appCopy } from '../copy';
import { Ionicons } from '@expo/vector-icons';
import { HabitGlyph } from '../modules/habits/components/HabitGlyph';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../components/Button';
import { copySecretTemporarily } from '../modules/passwords/clipboard';
import { createRecoveryCode, syncRecoveryData } from '../utils/recovery';
import { RECOVERY_BACKUP_READY_KEY, RECOVERY_CODE_KEY } from '../utils/storage';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const STARTERS: HabitInput[] = [
  { name: 'Gym', icon: 'barbell-outline', color: '#4f46e5', category: 'fitness', type: 'yesno', target: 1, days: ALL_DAYS, reminderTimes: [] },
  { name: 'Pray 5 times', icon: 'moon-outline', color: '#16a34a', category: 'mind', type: 'count', target: 5, days: ALL_DAYS, reminderTimes: [] },
  { name: 'Read book', icon: 'book-outline', color: '#ea580c', category: 'learning', type: 'yesno', target: 1, days: ALL_DAYS, reminderTimes: [] },
];
const SLIDES = appCopy.onboarding;

export default function OnboardingScreen() {
  const { addHabits, habits, logs, dailyNotes } = useHabits();
  const { update, colors, settings } = useSettings();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number[]>([0]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const slideProgress = useRef(new Animated.Value(1)).current;
  const slideDirection = useRef(1);
  const lastStep = SLIDES.length;
  const moveStep = useCallback((change: number) => {
    setStep((current) => {
      const next = Math.max(0, Math.min(lastStep, current + change));
      slideDirection.current = next >= current ? 1 : -1;
      return next;
    });
  }, [lastStep]);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) =>
      Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx < -50) moveStep(1);
      if (gesture.dx > 50) moveStep(-1);
    },
  }), [moveStep]);

  useEffect(() => {
    slideProgress.setValue(0);
    Animated.parallel([
      Animated.timing(slideProgress, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideProgress, step]);

  const toggle = (i: number) =>
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const finish = () => {
    addHabits(picked.map((i) => STARTERS[i]));
    update({ hasOnboarded: true });
  };
  const setupRecovery = async () => {
    setRecoveryBusy(true);
    try {
      const savedCode = await AsyncStorage.getItem(RECOVERY_CODE_KEY);
      const code = savedCode || await createRecoveryCode();
      setRecoveryCode(code);
      await syncRecoveryData(code, { habits, logs, dailyNotes, settings });
      await AsyncStorage.setItem(RECOVERY_BACKUP_READY_KEY, 'true');
      setRecoveryReady(true);
      Alert.alert('Recovery backup ready', 'Keep your recovery code somewhere safe. You will need it to restore your data.');
    } catch (error) {
      Alert.alert('Could not create recovery backup', error instanceof Error ? error.message : 'Please try again in Settings.');
    } finally {
      setRecoveryBusy(false);
    }
  };
  const copyRecoveryCode = async () => {
    if (!recoveryCode) return;
    try {
      await copySecretTemporarily(recoveryCode);
      Alert.alert('Copied', 'Your recovery code was copied and will be cleared from the clipboard after 30 seconds if unchanged.');
    } catch (error) {
      Alert.alert('Could not copy recovery code', error instanceof Error ? error.message : 'Please try again.');
    }
  };
  const requestPermission = async () => {
    try {
      const granted = await ensurePermission();
      setPermissionGranted(granted);
      if (granted) update({ notificationsEnabled: true });
      if (!granted) {
        update({ notificationsEnabled: false });
        Alert.alert('Notifications are off', 'You can allow reminders later in Settings on your device.');
      }
    } catch (error) {
      Alert.alert('Could not enable notifications', error instanceof Error ? error.message : 'Please try again.');
    }
  };
  const slide = SLIDES[step];
  const slideTranslateX = slideProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [slideDirection.current * 36, 0],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.brand}>
        <View style={[styles.brandIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.brandName, { color: colors.muted }]}>Momentum</Text>
      </View>
      <View style={styles.cardFrame} {...panResponder.panHandlers}>
        <Animated.View
          key={step}
          style={[
            styles.animatedCard,
            { opacity: slideProgress, transform: [{ translateX: slideTranslateX }] },
          ]}
        >
        {step < SLIDES.length ? (
          <ScrollView style={[styles.center, { backgroundColor: colors.surface, borderColor: colors.border }]} contentContainerStyle={styles.centerContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.illustration, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={(["cloud-upload-outline", "sparkles-outline", "checkmark-circle-outline", "notifications-outline"] as const)[step]} size={48} color={colors.primary} />
            </View>
            <Text style={[styles.kicker, { color: colors.primary }]}>SMALL STEPS. REAL MOMENTUM.</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{slide.body}</Text>
            {step === 0 && (
              <View style={styles.recoveryActions}>
                {recoveryReady ? (
                  <>
                    <Text style={[styles.recoveryCode, { color: colors.text }]} selectable>{recoveryCode}</Text>
                    <Button label="Copy recovery code" onPress={() => void copyRecoveryCode()} />
                    <Text style={[styles.recoveryHint, { color: colors.primary }]}>Backup complete. Save this code before continuing.</Text>
                  </>
                ) : (
                  <>
                    <Button
                      label={recoveryBusy ? 'Creating encrypted backup…' : 'Create recovery backup'}
                      onPress={() => void setupRecovery()}
                      loading={recoveryBusy}
                      disabled={recoveryBusy}
                    />
                    {recoveryBusy ? (
                      <View style={styles.recoveryProgress}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.recoveryHint, { color: colors.muted }]}>Encrypting and uploading securely. Keep the app open.</Text>
                      </View>
                    ) : null}
                    <Text style={[styles.recoveryHint, { color: colors.muted }]}>
                      You can continue without a backup, but data cannot be restored if this app is lost or uninstalled.
                    </Text>
                  </>
                )}
              </View>
            )}
            {step === 3 && (
              <>
                <TouchableOpacity
                  style={[styles.secondary, { borderColor: colors.primary }]}
                  onPress={requestPermission}
                >
                  <Text style={[styles.secondaryText, { color: colors.primary }]}>
                    {permissionGranted ? 'Reminders enabled ✓' : 'Allow notifications'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        ) : (
          <ScrollView style={[styles.center, { backgroundColor: colors.surface, borderColor: colors.border }]} contentContainerStyle={styles.centerContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Start with what feels doable</Text>
            <Text style={[styles.body, { color: colors.muted }]}>Pick a few gentle starting points. You can shape your routine any time.</Text>
            <View style={{ width: '100%', marginTop: 12 }}>
              {STARTERS.map((s, i) => (
                <TouchableOpacity
                  key={s.name}
                  style={[styles.pick, { backgroundColor: colors.surface, borderColor: colors.border }, picked.includes(i) && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
                  onPress={() => toggle(i)}
                >
                  <HabitGlyph icon={s.icon} category={i === 0 ? "fitness" : i === 1 ? "mind" : "learning"} size={20} />
                  <Text style={styles.pickText}>{s.name}</Text>
                  <View style={styles.trailingSlot}>{picked.includes(i) && <Ionicons name="checkmark" size={18} color={colors.primary} />}</View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
        </Animated.View>

      </View>

      <View style={styles.footerActions}>
        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.footerAction} onPress={() => moveStep(-1)} disabled={step === 0}>
            <Text style={[styles.footerActionText, { color: step === 0 ? colors.muted : colors.primary }]}>Back</Text>
          </TouchableOpacity>
          <View style={styles.dots}>
            {Array.from({ length: lastStep + 1 }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === step ? colors.primary : colors.borderStrong },
                  i === step && styles.dotOn,
                ]}
              />
            ))}
          </View>
          <TouchableOpacity style={styles.footerAction} onPress={() => update({ hasOnboarded: true })} disabled={recoveryBusy}>
            <Text style={[styles.footerActionText, { color: colors.primary }]}>Skip</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.primary, { backgroundColor: colors.primary }]}
          onPress={() => step < lastStep ? moveStep(1) : finish()}
          disabled={recoveryBusy}
        >
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>{step < lastStep ? 'Next' : 'Get started'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 22 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 16 },
  brandIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 12, fontWeight: '700', letterSpacing: 1.7 },
  cardFrame: { flex: 1 },
  animatedCard: { flex: 1 },
  center: { flex: 1, borderRadius: 28, borderWidth: 1, overflow: 'hidden' },
  centerContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  illustration: { width: 116, height: 116, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  title: { fontSize: 27, lineHeight: 33, fontWeight: '800', textAlign: 'center', letterSpacing: -0.7 },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 10, maxWidth: 275 },
  secondary: { marginTop: 22, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 13, borderWidth: 1 },
  secondaryText: { fontWeight: '700' },
  recoveryHint: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 14, maxWidth: 275 },
  recoveryActions: { width: '100%', gap: 10, marginTop: 20 },
  recoveryCode: { fontSize: 15, fontWeight: '700', textAlign: 'center', padding: 12, borderRadius: 12, overflow: 'hidden' },
  recoveryProgress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(128,128,128,0.3)',
    borderRadius: 15,
    padding: 16,
    marginBottom: 10,
  },
  pickText: { flex: 1, fontSize: 15, fontWeight: '600', marginLeft: 12 },
  trailingSlot: { width: 24, alignItems: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { width: 22 },
  primary: { padding: 17, borderRadius: 16, alignItems: 'center' },
  primaryText: { fontSize: 15, fontWeight: '700' },
  footerActions: { gap: 8, paddingTop: 12 },
  secondaryActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerAction: { minWidth: 64, minHeight: 44, justifyContent: 'center' },
  footerActionText: { fontSize: 14, fontWeight: '700' },
});
