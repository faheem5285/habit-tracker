import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/Themed';
import BarChart from '../components/BarChart';
import Heatmap from '../components/Heatmap';
import { HabitsStackParams } from '../navigation/types';
import { useHabits } from '../context/HabitContext';
import { useSettings } from '../context/SettingsContext';
import { DAY_LABELS, addDays, formatTime, fromDateKey, toDateKey, todayKey } from '../utils/dates';
import { bestStreak, completionRate, createdKey, currentStreak, getValue, isDone, isScheduled } from '../utils/streaks';
import { motivation } from '../utils/motivationalContent';
import { HabitGlyph } from '../components/HabitGlyph';

type Props = NativeStackScreenProps<HabitsStackParams, 'HabitDetail'>;

export default function HabitDetailScreen({ route, navigation }: Props) {
  const { habits, logs, setLog, deleteHabit, setHabitArchived } = useHabits();
  const { settings, colors } = useSettings();
  const habit = habits.find((h) => h.id === route.params.habitId);
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  if (!habit) return null;
  const tKey = todayKey();

  const level = (key: string) => {
    if (key > tKey || key < createdKey(habit) || !isScheduled(habit, fromDateKey(key))) return -1;
    const v = getValue(logs, habit.id, key);
    return v >= habit.target ? 1 : v > 0 ? 0.5 : 0;
  };
  const toggle = (key: string) => {
    const v = getValue(logs, habit.id, key);
    setLog(habit.id, key, v >= habit.target ? 0 : habit.type === 'count' ? v + 1 : 1);
  };
  const shift = (n: number) => {
    const d = new Date(cursor.y, cursor.m + n, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const confirmDelete = () =>
    Alert.alert('Delete habit', `Delete "${habit.name}" and its history?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHabit(habit.id);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Could not delete habit', error instanceof Error ? error.message : 'Please try again.');
          }
        },
      },
    ]);
  const toggleArchive = async () => {
    try {
      await setHabitArchived(habit.id, !habit.archived);
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        habit.archived ? 'Could not restore habit' : 'Could not archive habit',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  const total = logs.filter((l) => l.habitId === habit.id && l.value >= habit.target).length;
  const days = Array.from({ length: 30 }, (_, i) => addDays(now, -(29 - i)));
  const values = days.map((d) => (isDone(habit, logs, toDateKey(d)) ? 1 : 0));
  const labels = days.map((d) => String(d.getDate()));
  const schedule =
    habit.days.length === 7 ? 'Every day' : habit.days.map((d) => DAY_LABELS[d]).join(', ');

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
        <View style={[styles.iconTile, { backgroundColor: colors.surface }]}>
          <HabitGlyph icon={habit.icon} category={habit.category} size={31} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{habit.name}</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>
            {habit.type === 'count' ? `${habit.target} a day` : 'One thoughtful check-in'} · {schedule}
          </Text>
          {((habit.reminderTimes?.length ?? 0) > 0 || (habit.scheduledReminders?.length ?? 0) > 0) && (
            <View style={styles.reminder}>
              <Ionicons name="notifications-outline" size={13} color={colors.primary} />
              <Text style={[styles.sub, { color: colors.primary }]} numberOfLines={2}>
                {[
                  ...(habit.reminderTimes ?? []).map(formatTime),
                  ...(habit.scheduledReminders ?? []).map((value) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })),
                ].join(' · ')}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.grid}>
        {[
          { label: 'Current streak', value: String(currentStreak(habit, logs, now)), icon: 'flame-outline' },
          { label: 'Best streak', value: String(bestStreak(habit, logs, now)) },
          { label: '30-day rate', value: `${Math.round(completionRate(habit, logs) * 100)}%` },
          { label: 'Total completions', value: String(total) },
        ].map((c) => (
          <View key={c.label} style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statValueRow}>
              {c.icon && <Ionicons name={c.icon as keyof typeof Ionicons.glyphMap} size={17} color={colors.primary} />}
              <Text style={styles.statValue}>{c.value}</Text>
            </View>
            <Text style={[styles.statLabel, { color: colors.muted }]}>{c.label}</Text>
          </View>
        ))}
      </View>

      {total > 0 && currentStreak(habit, logs, now) === 0 && (
        <View style={[styles.encouragement, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="leaf-outline" size={18} color={colors.primary} />
          <Text style={[styles.encouragementText, { color: colors.textSecondary }]}>{motivation.streak(0)}</Text>
        </View>
      )}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>History</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => shift(-1)} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ marginHorizontal: 8, fontWeight: '600' }}>
            {new Date(cursor.y, cursor.m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => shift(1)} hitSlop={10}>
            <Ionicons name="chevron-forward" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Heatmap
          year={cursor.y}
          month={cursor.m}
          weekStartsOn={settings.weekStartsOn}
          color={habit.color}
          level={level}
          onPress={toggle}
        />
      </View>
      <Text style={[styles.hint, { color: colors.muted }]}>
        Your history is a record of showing up. Tap a day to edit it{habit.type === 'count' ? ' (each tap adds 1)' : ''}.
      </Text>

      <Text style={styles.section}>Last 30 days</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <BarChart values={values} labels={labels} color={habit.color} height={80} />
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.archiveButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={toggleArchive}
      >
        <Ionicons
          name={habit.archived ? 'arrow-undo-outline' : 'archive-outline'}
          size={19}
          color={colors.primary}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.archiveTitle}>{habit.archived ? 'Restore this habit' : 'Pause this habit'}</Text>
          <Text style={[styles.archiveHint, { color: colors.muted }]}>
            {habit.archived
              ? 'Bring it back to your routine and keep going.'
              : 'Keep your history safe. You can return anytime.'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.primary} />
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('HabitForm', { habitId: habit.id })}
        >
          <Text style={styles.btnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.danger }]} onPress={confirmDelete}>
          <Text style={styles.btnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, padding: 16, borderRadius: 22, borderWidth: 1 },
  iconTile: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  name: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 11, marginTop: 4 },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  stat: { width: '48%', borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 10 },
  statValue: { fontSize: 24, fontWeight: '800' },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  section: { fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 8 },
  hint: { fontSize: 11, marginBottom: 8 },
  encouragement: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, borderRadius: 14, marginBottom: 14 },
  encouragementText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  archiveButton: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 12 },
  archiveTitle: { fontSize: 13, fontWeight: '700' },
  archiveHint: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
