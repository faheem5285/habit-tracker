import { useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { Text, TextInput } from '../components/Themed';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HabitsStackParams } from '../navigation/types';
import { useHabits } from '../context/HabitContext';
import { HabitType, TimeOfDay } from '../types';
import { DAY_LABELS, formatTime } from '../utils/dates';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSettings } from '../context/SettingsContext';
import { Ionicons } from '@expo/vector-icons';

const ICONS = ['💧', '🏃', '💪', '📖', '🧘', '🕌', '😴', '🥗', '🎯', '✍️', '🧹', '💊', '🍎', '🚴', '💻', '🎨', '🚶', '🌱', '⭐', '🔥'];

const COLORS = [
  '#4F46E5', // Indigo
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#64748B', // Slate
];

const CATEGORIES = [
  { id: 'health', label: 'Health', icon: 'heart-outline' },
  { id: 'fitness', label: 'Fitness', icon: 'barbell-outline' },
  { id: 'productivity', label: 'Focus', icon: 'flash-outline' },
  { id: 'mind', label: 'Mind', icon: 'leaf-outline' },
  { id: 'learning', label: 'Learn', icon: 'book-outline' },
  { id: 'other', label: 'Other', icon: 'star-outline' },
];

const PRESET_TIMES = ['08:00', '12:00', '18:00', '21:00'];

type Props = NativeStackScreenProps<HabitsStackParams, 'HabitForm'>;

export default function HabitFormScreen({ route, navigation }: Props) {
  const { habits, addHabit, updateHabit } = useHabits();
  const { colors, settings } = useSettings();
  const habitId = route.params?.habitId;
  const existing = habits.find((h) => h.id === habitId);

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? ICONS[0]);
  const [color, setColor] = useState(existing?.color ?? COLORS[0]);
  const [category, setCategory] = useState(existing?.category ?? 'health');
  const [type, setType] = useState<HabitType>(existing?.type ?? 'yesno');
  const [target, setTarget] = useState(String(existing?.target ?? 5));
  const [unit, setUnit] = useState(existing?.unit ?? (type === 'count' ? 'times' : ''));
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(existing?.timeOfDay ?? 'any');
  const [days, setDays] = useState<number[]>(existing?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [reminders, setReminders] = useState<string[]>(existing?.reminderTimes ?? []);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingTime, setPendingTime] = useState(new Date());

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const selectEveryDay = () => setDays([0, 1, 2, 3, 4, 5, 6]);
  const selectWeekdays = () => setDays([1, 2, 3, 4, 5]);
  const selectWeekends = () => setDays([0, 6]);

  const addTimeStr = (t: string) => {
    setReminders((prev) => (prev.includes(t) ? prev : [...prev, t].sort()));
  };

  const addTimeFromDate = (d: Date) => {
    const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    addTimeStr(t);
  };

  const onTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && date) addTimeFromDate(date);
    } else if (date) {
      setPendingTime(date);
    }
  };

  const save = async () => {
    const trimmed = name.trim();
    const targetNum = type === 'count' ? parseInt(target, 10) : 1;

    if (!trimmed) {
      return Alert.alert('Name Required', 'Please enter a name for your habit.');
    }
    if (days.length === 0) {
      return Alert.alert('Schedule Required', 'Please choose at least one day.');
    }
    if (!targetNum || targetNum < 1) {
      return Alert.alert('Invalid Target', 'Target must be 1 or higher.');
    }

    const input = {
      name: trimmed,
      icon,
      color,
      category,
      type,
      target: targetNum,
      unit: unit.trim() || (type === 'count' ? 'times' : 'times'),
      timeOfDay,
      days,
      reminderTimes: reminders,
    };

    try {
      if (habitId) {
        await updateHabit(habitId, input);
      } else {
        await addHabit(input);
      }
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save habit.');
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Live Preview Card */}
      <View
        style={[
          styles.previewCard,
          {
            backgroundColor: colors.surface,
            borderColor: color + '55',
          },
        ]}
      >
        <View style={[styles.previewIconWrap, { backgroundColor: color + '1A', borderColor: color + '33' }]}>
          <Text style={{ fontSize: 28 }}>{icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.previewBadgeRow}>
            <Text style={[styles.previewCategory, { color }]}>
              {category.toUpperCase()} · {timeOfDay.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.previewName}>{name.trim() || 'Habit Name'}</Text>
          <Text style={[styles.previewDesc, { color: colors.muted }]}>
            {type === 'count' ? `Target: ${target} ${unit || 'times'} a day` : 'Daily Check-in'} · {days.length === 7 ? 'Every Day' : `${days.length} days / week`}
          </Text>
        </View>
      </View>

      {/* Habit Name */}
      <Text style={styles.label}>Habit Name</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Read 20 Pages, Drink 8 Glasses Water"
        placeholderTextColor={colors.muted}
      />

      {/* Category Selection */}
      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryRow}>
        {CATEGORIES.map((c) => {
          const isSelected = category === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.categoryPill,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setCategory(c.id)}
            >
              <Ionicons
                name={c.icon as any}
                size={14}
                color={isSelected ? '#FFFFFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.categoryText,
                  { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                  isSelected && { fontWeight: '700' },
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Icon Picker */}
      <Text style={styles.label}>Choose Icon</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconScroll}>
        {ICONS.map((i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setIcon(i)}
            style={[
              styles.iconBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
              icon === i && {
                borderColor: color,
                backgroundColor: color + '22',
              },
            ]}
          >
            <Text style={{ fontSize: 24 }}>{i}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Color Accent */}
      <Text style={styles.label}>Theme Color</Text>
      <View style={styles.colorRow}>
        {COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setColor(c)}
            style={[
              styles.colorDot,
              { backgroundColor: c },
              color === c && styles.colorDotSelected,
            ]}
          >
            {color === c && <Ionicons name="checkmark" size={16} color="#FFF" />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Type & Target */}
      <Text style={styles.label}>Tracking Style</Text>
      <View style={styles.typeRow}>
        {(['yesno', 'count'] as HabitType[]).map((t) => {
          const isSelected = type === t;
          return (
            <TouchableOpacity
              key={t}
              style={[
                styles.typePill,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setType(t)}
            >
              <Ionicons
                name={t === 'yesno' ? 'checkmark-circle-outline' : 'calculator-outline'}
                size={16}
                color={isSelected ? '#FFF' : colors.textSecondary}
              />
              <Text
                style={[
                  styles.typePillText,
                  { color: isSelected ? '#FFF' : colors.textSecondary },
                  isSelected && { fontWeight: '700' },
                ]}
              >
                {t === 'yesno' ? 'Yes / No Check-in' : 'Numeric Counter'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {type === 'count' && (
        <View style={styles.countRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.subLabel}>Daily Target Value</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}
              value={target}
              onChangeText={setTarget}
              keyboardType="number-pad"
              placeholder="e.g. 5"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.subLabel}>Unit Label</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}
              value={unit}
              onChangeText={setUnit}
              placeholder="e.g. glasses, pages"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>
      )}

      {/* Time of Day */}
      <Text style={styles.label}>Preferred Time of Day</Text>
      <View style={styles.typeRow}>
        {(['any', 'morning', 'afternoon', 'evening'] as TimeOfDay[]).map((t) => {
          const isSelected = timeOfDay === t;
          return (
            <TouchableOpacity
              key={t}
              style={[
                styles.timePill,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setTimeOfDay(t)}
            >
              <Text
                style={[
                  styles.timePillText,
                  { color: isSelected ? '#FFF' : colors.textSecondary },
                  isSelected && { fontWeight: '700' },
                ]}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Day Schedule */}
      <View style={styles.scheduleHeaderRow}>
        <Text style={styles.label}>Frequency Schedule</Text>
        <View style={styles.presetDaysRow}>
          <TouchableOpacity onPress={selectEveryDay}><Text style={[styles.presetDayText, { color: colors.primary }]}>Daily</Text></TouchableOpacity>
          <Text style={{ color: colors.muted }}>·</Text>
          <TouchableOpacity onPress={selectWeekdays}><Text style={[styles.presetDayText, { color: colors.primary }]}>Weekdays</Text></TouchableOpacity>
          <Text style={{ color: colors.muted }}>·</Text>
          <TouchableOpacity onPress={selectWeekends}><Text style={[styles.presetDayText, { color: colors.primary }]}>Weekends</Text></TouchableOpacity>
        </View>
      </View>
      <View style={styles.daysRow}>
        {DAY_LABELS.map((lbl, idx) => {
          const isSelected = days.includes(idx);
          return (
            <TouchableOpacity
              key={lbl}
              style={[
                styles.dayChip,
                {
                  backgroundColor: isSelected ? color : colors.surface,
                  borderColor: isSelected ? color : colors.border,
                },
              ]}
              onPress={() => toggleDay(idx)}
            >
              <Text
                style={[
                  styles.dayChipText,
                  { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                  isSelected && { fontWeight: '800' },
                ]}
              >
                {lbl}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Reminders & Notifications */}
      <Text style={styles.label}>Reminders & Notifications 🔔</Text>
      {!settings.notificationsEnabled && (
        <Text style={[styles.notifWarning, { color: colors.accent }]}>
          ⚠️ Reminders are currently disabled in Settings.
        </Text>
      )}

      {/* Quick Reminder Time Presets */}
      <View style={styles.presetTimeRow}>
        {PRESET_TIMES.map((time) => {
          const isAdded = reminders.includes(time);
          return (
            <TouchableOpacity
              key={time}
              style={[
                styles.presetTimeChip,
                {
                  backgroundColor: isAdded ? color : colors.surface,
                  borderColor: isAdded ? color : colors.border,
                },
              ]}
              onPress={() => {
                if (isAdded) setReminders(reminders.filter((t) => t !== time));
                else addTimeStr(time);
              }}
            >
              <Text
                style={[
                  styles.presetTimeChipText,
                  { color: isAdded ? '#FFF' : colors.textSecondary },
                  isAdded && { fontWeight: '700' },
                ]}
              >
                {formatTime(time)}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.customTimeChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="time-outline" size={14} color={colors.primary} />
          <Text style={[styles.customTimeText, { color: colors.primary }]}>+ Custom</Text>
        </TouchableOpacity>
      </View>

      {/* Active Reminder Tags */}
      {reminders.length > 0 && (
        <View style={styles.activeRemindersRow}>
          {reminders.map((t) => (
            <View key={t} style={[styles.activeReminderTag, { backgroundColor: color }]}>
              <Ionicons name="notifications" size={12} color="#FFF" />
              <Text style={styles.activeReminderText}>{formatTime(t)}</Text>
              <TouchableOpacity onPress={() => setReminders(reminders.filter((x) => x !== t))}>
                <Ionicons name="close-circle" size={14} color="#FFF" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {showPicker && (
        <DateTimePicker
          value={pendingTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
        />
      )}
      {showPicker && Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.iosDoneTimeBtn, { backgroundColor: color }]}
          onPress={() => {
            addTimeFromDate(pendingTime);
            setShowPicker(false);
          }}
        >
          <Text style={{ color: '#FFF', fontWeight: '700' }}>Confirm Time</Text>
        </TouchableOpacity>
      )}

      {/* Save Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.saveBtn, { backgroundColor: color }]}
        onPress={save}
      >
        <Text style={styles.saveBtnText}>Save Habit</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
        <Text style={[styles.cancelBtnText, { color: colors.muted }]}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 50 },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  previewIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  previewBadgeRow: { marginBottom: 2 },
  previewCategory: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  previewName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  previewDesc: { fontSize: 12, marginTop: 3 },
  label: { fontSize: 14, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  subLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryText: { fontSize: 12, fontWeight: '600' },
  iconScroll: { flexDirection: 'row', marginBottom: 4 },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: { borderWidth: 2.5, borderColor: '#FFFFFF' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  typePillText: { fontSize: 12, fontWeight: '600' },
  countRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  timePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  timePillText: { fontSize: 11, fontWeight: '600' },
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  presetDaysRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  presetDayText: { fontSize: 12, fontWeight: '700' },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayChip: {
    width: 42,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipText: { fontSize: 12, fontWeight: '600' },
  notifWarning: { fontSize: 12, marginBottom: 8 },
  presetTimeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetTimeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  presetTimeChipText: { fontSize: 12, fontWeight: '600' },
  customTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  customTimeText: { fontSize: 12, fontWeight: '700' },
  activeRemindersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  activeReminderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  activeReminderText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  iosDoneTimeBtn: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtn: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 26,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
});
