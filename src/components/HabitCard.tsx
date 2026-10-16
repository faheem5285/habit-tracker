import { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './Themed';
import { Ionicons } from '@expo/vector-icons';
import { HabitGlyph } from './HabitGlyph';
import { Habit } from '../types';
import { useSettings } from '../context/SettingsContext';

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
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: done ? colors.primary + '45' : colors.border }]}>
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
          {streak > 0 && (
            <>
              <Ionicons name="flame-outline" size={13} color={colors.primary} />
              <Text style={[styles.streak, { color: colors.muted }]}>{streak} day streak</Text>
            </>
          )}
          {habit.type === 'count' && <Text style={[styles.target, { color: colors.textSecondary }]}>{value} of {habit.target} {habit.unit || 'today'}</Text>}
          {streak === 0 && habit.type === 'yesno' && (
            <Text style={[styles.target, { color: colors.muted }]}>Daily habit</Text>
          )}
        </View>
      </TouchableOpacity>
      {habit.type === 'yesno' ? (
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`${done ? 'Mark incomplete' : 'Complete'} ${habit.name}`}
          style={[
            styles.checkButton,
            {
              borderColor: done ? colors.primary : colors.borderStrong,
              backgroundColor: done ? colors.primary : colors.surfaceMuted,
            },
          ]}
          onPress={() => onChange(habit.id, done ? 0 : 1)}
        >
          {done && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
        </TouchableOpacity>
      ) : (
        <View style={styles.counter}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Decrease ${habit.name}`} onPress={() => onChange(habit.id, Math.max(0, value - 1))} hitSlop={8}>
            <Ionicons name="remove-circle-outline" size={29} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.count, { color: done ? colors.primary : colors.text }]}>
            {value}
          </Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Increase ${habit.name}`} onPress={() => onChange(habit.id, Math.min(habit.target, value + 1))} hitSlop={8}>
            <Ionicons name="add-circle" size={29} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default memo(HabitCard);

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, padding: 14, marginBottom: 10, minHeight: 78 },
  iconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  icon: { fontSize: 24 },
  details: { flex: 1, minHeight: 44, justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  streak: { fontSize: 11, fontWeight: '500' },
  target: { fontSize: 11 },
  checkButton: { width: 42, height: 42, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent' },
  count: { fontSize: 17, fontWeight: '700', minWidth: 24, textAlign: 'center' },
});
