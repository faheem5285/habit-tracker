import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Themed';
import { useHabits, HabitInput } from '../context/HabitContext';
import { useSettings } from '../context/SettingsContext';
import { ensurePermission } from '../utils/notifications';
import { appCopy } from '../utils/motivationalContent';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const STARTERS: HabitInput[] = [
  { name: 'Gym', icon: '💪', color: '#4f46e5', type: 'yesno', target: 1, days: ALL_DAYS, reminderTimes: [] },
  { name: 'Pray 5 times', icon: '🕌', color: '#16a34a', type: 'count', target: 5, days: ALL_DAYS, reminderTimes: [] },
  { name: 'Read book', icon: '📖', color: '#ea580c', type: 'yesno', target: 1, days: ALL_DAYS, reminderTimes: [] },
];
const SLIDES = appCopy.onboarding;

export default function OnboardingScreen() {
  const { addHabits } = useHabits();
  const { update, colors } = useSettings();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number[]>([0]);
  const [permissionGranted, setPermissionGranted] = useState(false);

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
          <Text style={{ fontSize: 18 }}>🌱</Text>
        </View>
        <Text style={[styles.brandName, { color: colors.muted }]}>DAY BY DAY</Text>
      </View>
      {step < 3 ? (
        <View style={[styles.center, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.illustration, { backgroundColor: colors.primarySoft }]}>
            <Text style={styles.emoji}>{slide.emoji}</Text>
          </View>
          <Text style={[styles.kicker, { color: colors.primary }]}>SMALL STEPS. REAL MOMENTUM.</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={[styles.body, { color: colors.muted }]}>{slide.body}</Text>
          {step === 2 && (
            <TouchableOpacity
              style={[styles.secondary, { borderColor: colors.primary }]}
              onPress={requestPermission}
            >
              <Text style={[styles.secondaryText, { color: colors.primary }]}>
                {permissionGranted ? 'Reminders enabled ✓' : 'Allow notifications'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={[styles.center, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.title}>Start with what feels doable</Text>
          <Text style={[styles.body, { color: colors.muted }]}>Pick a few gentle starting points. You can shape your routine any time.</Text>
          <View style={{ width: '100%', marginTop: 12 }}>
            {STARTERS.map((s, i) => (
              <TouchableOpacity
                key={s.name}
                style={[styles.pick, { backgroundColor: colors.surface, borderColor: colors.border }, picked.includes(i) && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
                onPress={() => toggle(i)}
              >
                <Text style={styles.pickText}>{s.icon}  {s.name}</Text>
                {picked.includes(i) && <Text style={{ color: s.color, fontSize: 18 }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

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

      {step < 3 ? (
        <TouchableOpacity
          style={[styles.primary, { backgroundColor: colors.primary }]}
          onPress={() => setStep(step + 1)}
        >
          <Text style={styles.primaryText}>Next</Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity style={[styles.primary, { backgroundColor: colors.primary }]} onPress={finish}>
            <Text style={styles.primaryText}>Get started</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 12, alignItems: 'center' }} onPress={() => update({ hasOnboarded: true })}>
            <Text style={{ color: colors.muted }}>Skip for now</Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 22 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 16 },
  brandIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 10, fontWeight: '700', letterSpacing: 1.7 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 28, borderWidth: 1, padding: 24 },
  illustration: { width: 116, height: 116, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emoji: { fontSize: 52 },
  kicker: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  title: { fontSize: 27, lineHeight: 33, fontWeight: '800', textAlign: 'center', letterSpacing: -0.7 },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 10, maxWidth: 275 },
  secondary: { marginTop: 22, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 13, borderWidth: 1 },
  secondaryText: { fontWeight: '700' },
  pick: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(128,128,128,0.3)',
    borderRadius: 15,
    padding: 16,
    marginBottom: 10,
  },
  pickText: { fontSize: 15, fontWeight: '600' },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { width: 22 },
  primary: { padding: 17, borderRadius: 16, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
