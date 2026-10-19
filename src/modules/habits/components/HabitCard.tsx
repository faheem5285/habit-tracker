import { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../../../components/Themed';
import { Ionicons } from '@expo/vector-icons';
import { HabitGlyph } from './HabitGlyph';
import { Habit } from '../../../types';
import { useSettings } from '../../../context/SettingsContext';
import Card from '../../../components/Card';

type Props = {
  habit: Habit;
  value: number;
  streak: number;
  onChange: (habitId: string, v: number) => void;
  onPress?: (habitId: string) => void;
};

function HabitCard({ habit, value, streak, onChange, onPress }: Props) {
  const { colors } = useSettings();
  const done = value >= habit.target;
  const progress = Math.min(1, Math.max(0, value / Math.max(1, habit.target)));
  return (
    <Card style={[styles.card, { borderColor: done ? colors.primary + '45' : colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: habit.color + '18' }]}>
        <HabitGlyph icon={habit.icon} category={habit.category} name={habit.name} />
      </View>
      <TouchableOpacity
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `${habit.name} details` : undefined}
        activeOpacity={onPress ? 0.75 : 1}
        disabled={!onPress}
        onPress={onPress ? () => onPress(habit.id) : undefined}
        style={styles.details}
      >
        <Text style={[styles.name, done && { color: colors.muted }]} numberOfLines={1}>{habit.name}</Text>
        <View style={styles.meta}>
          {streak > 0 ? (
            <View style={styles.streakMeta}>
              <Ionicons name="flame-outline" size={13} color={colors.primary} />
              <Text style={[styles.streak, { color: colors.muted }]} numberOfLines={1}>{streak} day streak</Text>
            </View>
          ) : null}
          {habit.type === 'count' ? (
            <>
              <Text style={[styles.target, { color: colors.textSecondary }]} numberOfLines={2}>
                {value} of {habit.target} {habit.unit || 'today'}
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
                <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: habit.color }]} />
              </View>
            </>
          ) : streak === 0 ? (
            <Text style={[styles.target, { color: colors.muted }]} numberOfLines={1}>Daily habit</Text>
          ) : null}
        </View>
      </TouchableOpacity>
      {habit.type === 'yesno' ? (
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`${done ? 'Mark incomplete' : 'Mark complete'}: ${habit.name}`}
          style={[
            styles.checkButton,
            {
              borderColor: done ? colors.primary : colors.borderStrong,
              backgroundColor: done ? colors.primary : colors.surfaceMuted,
            },
          ]}
          onPress={() => onChange(habit.id, done ? 0 : 1)}
        >
          {done && <Ionicons name="checkmark" size={20} color={colors.onPrimary} />}
        </TouchableOpacity>
      ) : (
        <View style={styles.counter}>
          <TouchableOpacity style={styles.counterButton} accessibilityRole="button" accessibilityLabel={`Decrease ${habit.name}`} accessibilityState={{ disabled: value <= 0 }} disabled={value <= 0} onPress={() => onChange(habit.id, Math.max(0, value - 1))}>
            <Ionicons name="remove-circle-outline" size={29} color={value <= 0 ? colors.muted : colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.count, { color: done ? colors.primary : colors.text }]} numberOfLines={1}>
            {value}
          </Text>
          <TouchableOpacity style={styles.counterButton} accessibilityRole="button" accessibilityLabel={`Increase ${habit.name}`} accessibilityState={{ disabled: value >= habit.target }} disabled={value >= habit.target} onPress={() => onChange(habit.id, Math.min(habit.target, value + 1))}>
            <Ionicons name="add-circle" size={29} color={value >= habit.target ? colors.muted : colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );
}

export default memo(HabitCard);

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, minHeight: 78 },
  iconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  icon: { fontSize: 24 },
  details: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center', marginRight: 12 },
  name: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  meta: { flexDirection: 'column', alignItems: 'flex-start', gap: 2, marginTop: 5, minWidth: 0 },
  streakMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  streak: { fontSize: 12, fontWeight: '500' },
  target: { fontSize: 12, minWidth: 0, flexShrink: 1 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6, width: '100%' },
  progressFill: { height: '100%', borderRadius: 2 },
  checkButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  counter: { width: 132, height: 44, flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  counterButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  count: { width: 44, fontSize: 17, fontWeight: '700', textAlign: 'center' },
});
