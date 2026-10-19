import { useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, PanResponder, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Themed';
import { useHabits, HabitInput } from '../context/HabitContext';
import { useSettings } from '../context/SettingsContext';
import { ensurePermission } from '../utils/notifications';
import { appCopy } from '../copy';
import { Ionicons } from '@expo/vector-icons';
import { HabitGlyph } from '../modules/habits/components/HabitGlyph';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const STARTERS: HabitInput[] = [
  { name: 'Gym', icon: 'barbell-outline', color: '#4f46e5', category: 'fitness', type: 'yesno', target: 1, days: ALL_DAYS, reminderTimes: [] },
  { name: 'Pray 5 times', icon: 'moon-outline', color: '#16a34a', category: 'mind', type: 'count', target: 5, days: ALL_DAYS, reminderTimes: [] },
  { name: 'Read book', icon: 'book-outline', color: '#ea580c', category: 'learning', type: 'yesno', target: 1, days: ALL_DAYS, reminderTimes: [] },
];
const SLIDES = appCopy.onboarding;

export default function OnboardingScreen() {
  const { addHabits } = useHabits();
  const { update, colors } = useSettings();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number[]>([0]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) =>
      Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx < -50) setStep((current) => Math.min(3, current + 1));
      if (gesture.dx > 50) setStep((current) => Math.max(0, current - 1));
    },
  }), []);

  const toggle = (i: number) =>
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const finish = () => {
    addHabits(picked.map((i) => STARTERS[i]));
    update({ hasOnboarded: true });
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.brand}>
        <View style={[styles.brandIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.brandName, { color: colors.muted }]}>Momentum</Text>
      </View>
      <View style={styles.cardFrame} {...panResponder.panHandlers}>
        {step < 3 ? (
          <ScrollView style={[styles.center, { backgroundColor: colors.surface, borderColor: colors.border }]} contentContainerStyle={styles.centerContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.illustration, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={(["sparkles-outline", "checkmark-circle-outline", "notifications-outline"] as const)[step]} size={48} color={colors.primary} />
            </View>
            <Text style={[styles.kicker, { color: colors.primary }]}>SMALL STEPS. REAL MOMENTUM.</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{slide.body}</Text>
            {step === 2 && (
              <>
                <TouchableOpacity
                  style={[styles.secondary, { borderColor: colors.primary }]}
                  onPress={requestPermission}
                >
                  <Text style={[styles.secondaryText, { color: colors.primary }]}>
                    {permissionGranted ? 'Reminders enabled ✓' : 'Allow notifications'}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.recoveryHint, { color: colors.muted }]}>
                  You can also create your own recovery code in Settings to back up your progress.
                </Text>
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
      </View>

      <View style={styles.footerActions}>
        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.footerAction} onPress={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>
            <Text style={[styles.footerActionText, { color: step === 0 ? colors.muted : colors.primary }]}>Back</Text>
          </TouchableOpacity>
          <View style={styles.dots}>
            {[0, 1, 2, 3].map((i) => (
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
          <TouchableOpacity style={styles.footerAction} onPress={() => update({ hasOnboarded: true })}>
            <Text style={[styles.footerActionText, { color: colors.primary }]}>Skip</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.primary, { backgroundColor: colors.primary }]}
          onPress={() => step < 3 ? setStep(step + 1) : finish()}
        >
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>{step < 3 ? 'Next' : 'Get started'}</Text>
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
  center: { flex: 1, borderRadius: 28, borderWidth: 1, overflow: 'hidden' },
  centerContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  illustration: { width: 116, height: 116, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  title: { fontSize: 27, lineHeight: 33, fontWeight: '800', textAlign: 'center', letterSpacing: -0.7 },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 10, maxWidth: 275 },
  secondary: { marginTop: 22, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 13, borderWidth: 1 },
  secondaryText: { fontWeight: '700' },
  recoveryHint: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 14, maxWidth: 275 },
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
