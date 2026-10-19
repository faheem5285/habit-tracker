import { useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { Text } from '../../../components/Themed';
import TextField from '../../../components/TextField';
import Chip from '../../../components/Chip';
import Button from '../../../components/Button';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HabitsStackParams } from '../../../navigation/types';
import { useHabits } from '../../../context/HabitContext';
import { HabitType } from '../../../types';
import { DAY_LABELS, formatTime } from '../../../utils/dates';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSettings } from '../../../context/SettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { HabitGlyph, resolveHabitGlyph } from '../components/HabitGlyph';
import { SCREEN_PADDING } from '../../../ui';
import HorizontalChips from '../../../components/HorizontalChips';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ICONS = [
  'water-outline', 'bed-outline', 'restaurant-outline', 'walk-outline', 'barbell-outline',
  'body-outline', 'heart-outline', 'leaf-outline', 'sunny-outline', 'book-outline',
  'create-outline', 'flash-outline', 'school-outline', 'cash-outline', 'calendar-outline',
  'home-outline', 'medkit-outline', 'bicycle-outline', 'eye-outline', 'star-outline',
] as const satisfies readonly (keyof typeof Ionicons.glyphMap)[];

const COLORS = [
  '#25634D', // Primary Forest Green
  '#24805D', // Success Green
  '#288A91', // Cyan
  '#59A37B', // Mint
  '#C77C24', // Accent Amber
  '#8B5CF6', // Purple
  '#CF6573', // Rose
  '#EF4444', // Danger Red
  '#20382D', // Deep Navy
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

const formatScheduledReminder = (value: string) => new Date(value).toLocaleString(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

type Props = NativeStackScreenProps<HabitsStackParams, 'HabitForm'>;

export default function HabitFormScreen({ route, navigation }: Props) {
  const { habits, addHabit, updateHabit } = useHabits();
  const { colors, settings } = useSettings();
  const insets = useSafeAreaInsets();
  const habitId = route.params?.habitId;
  const existing = habits.find((h) => h.id === habitId);
  const template = route.params?.template;

  const [name, setName] = useState(existing?.name ?? template?.name ?? '');
  const [icon, setIcon] = useState(() => resolveHabitGlyph(
    existing?.icon ?? template?.icon,
    existing?.category ?? template?.category ?? 'health',
    existing?.name ?? template?.name ?? '',
  ));
  const [color, setColor] = useState(existing?.color ?? template?.color ?? colors.primary);
  const [category, setCategory] = useState(existing?.category ?? template?.category ?? 'health');
  const [type, setType] = useState<HabitType>(existing?.type ?? template?.type ?? 'yesno');
  const [target, setTarget] = useState(String(existing?.target ?? template?.target ?? 5));
  const [weeklyGoal, setWeeklyGoal] = useState(
    existing?.weeklyGoal !== undefined
      ? String(existing.weeklyGoal)
      : template?.weeklyGoal !== undefined
        ? String(template.weeklyGoal)
        : ''
  );
  const [unit, setUnit] = useState(existing?.unit ?? template?.unit ?? '');
  const [days, setDays] = useState<number[]>(existing?.days ?? template?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [reminders, setReminders] = useState<string[]>(existing?.reminderTimes ?? template?.reminderTimes ?? []);
  const [scheduledReminders, setScheduledReminders] = useState<string[]>(existing?.scheduledReminders ?? template?.scheduledReminders ?? []);
  const [showPicker, setShowPicker] = useState(false);
  const [pendingTime, setPendingTime] = useState(new Date());
  const [futurePickerMode, setFuturePickerMode] = useState<'date' | 'time' | null>(null);
  const [futureReminder, setFutureReminder] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const availableIcons: readonly (keyof typeof Ionicons.glyphMap)[] =
    ICONS.includes(icon as (typeof ICONS)[number]) ? ICONS : [icon, ...ICONS];
  const availableColors: readonly string[] = COLORS.includes(color as (typeof COLORS)[number]) ? COLORS : [color, ...COLORS];

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

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

  const addFutureReminder = (date: Date) => {
    if (date.getTime() <= Date.now()) {
      Alert.alert('Choose a future time', 'The reminder date and time must be later than now.');
      return;
    }
    const value = date.toISOString();
    setScheduledReminders((previous) => previous.includes(value) ? previous : [...previous, value].sort());
    setFuturePickerMode(null);
  };

  const onFuturePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type !== 'set' || !date) {
        setFuturePickerMode(null);
        return;
      }
      if (futurePickerMode === 'date') {
        setFutureReminder((current) => {
          const next = new Date(current);
          next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
          return next;
        });
        setFuturePickerMode('time');
      } else {
        const next = new Date(futureReminder);
        next.setHours(date.getHours(), date.getMinutes(), 0, 0);
        setFutureReminder(next);
        addFutureReminder(next);
      }
    } else if (date) {
      setFutureReminder(date);
    }
  };

  const save = async () => {
    const trimmed = name.trim();
    const targetNum = type === 'count' ? parseInt(target, 10) : 1;
    const weeklyGoalNum = weeklyGoal.trim() ? Number(weeklyGoal) : undefined;

    if (!trimmed) {
      return Alert.alert('Name Required', 'Please enter a name for your habit.');
    }
    if (days.length === 0) {
      return Alert.alert('Schedule Required', 'Please choose at least one day.');
    }
    if (!targetNum || targetNum < 1) {
      return Alert.alert('Invalid Target', 'Target must be 1 or higher.');
    }
    if (weeklyGoalNum !== undefined && (!Number.isInteger(weeklyGoalNum) || weeklyGoalNum < 1)) {
      return Alert.alert('Invalid Weekly Goal', 'Enter a whole number greater than zero, or leave it blank.');
    }

    const input = {
      name: trimmed,
      icon,
      color,
      category,
      type,
      target: targetNum,
      weeklyGoal: weeklyGoalNum,
      unit: unit.trim() || (type === 'count' ? 'times' : 'times'),
      days,
      reminderTimes: reminders,
      scheduledReminders,
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
      {/* Live Preview Card */}
      <View
        style={[
          styles.previewCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.previewIconWrap, { backgroundColor: color + '1A', borderColor: colors.border }]}>
          <HabitGlyph icon={icon} category={category} name={name} size={28} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.previewBadgeRow}>
            <Text style={[styles.previewCategory, { color }]}>
              {category.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.previewName, { color: name.trim() ? colors.text : colors.muted }]}>{name.trim() || 'Habit Name'}</Text>
          <Text style={[styles.previewDesc, { color: colors.muted }]}>
            {type === 'count' ? `Target: ${target} ${unit || 'times'} a day` : 'Daily Check-in'} · {days.length === 7 ? 'Every Day' : `${days.length} days / week`}
          </Text>
        </View>
      </View>

      {/* Habit Name */}
      <TextField
        label="Habit Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Read 20 pages"
        containerStyle={styles.field}
      />

      {/* Category Selection */}
      <Text style={styles.label}>Category</Text>
      <HorizontalChips style={styles.categoryRow}>
        {CATEGORIES.map((c) => {
          const isSelected = category === c.id;
          return (
            <Chip key={c.id} label={c.label} icon={c.icon as keyof typeof Ionicons.glyphMap} selected={isSelected} onPress={() => setCategory(c.id)} style={styles.chipSpacing} />
          );
        })}
      </HorizontalChips>

      {/* Icon Picker */}
      <Text style={styles.label}>Choose Icon</Text>
      <HorizontalChips style={styles.iconScroll}>
        {availableIcons.map((i) => {
          const isSelected = icon === i;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => setIcon(i)}
              style={[
                styles.iconBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isSelected && {
                  borderColor: colors.primary,
                  backgroundColor: colors.primarySoft,
                },
              ]}
            >
              <Ionicons name={i} size={24} color={isSelected ? colors.primary : colors.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </HorizontalChips>

      {/* Color Accent */}
      <Text style={styles.label}>Theme Color</Text>
      <View style={styles.colorRow}>
        {availableColors.map((c) => (
          <TouchableOpacity
            key={c}
            accessibilityRole="radio"
            accessibilityState={{ selected: color === c }}
            onPress={() => setColor(c)}
            style={[
              styles.colorDot,
              { backgroundColor: c },
              color === c && [styles.colorDotSelected, { borderColor: colors.text }],
            ]}
          >
            {color === c && <Ionicons name="checkmark" size={16} color="#FFF" />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Type & Target */}
      <Text style={styles.label}>Tracking Style</Text>
      <HorizontalChips style={styles.typeRow}>
        {(['yesno', 'count'] as HabitType[]).map((t) => {
          const isSelected = type === t;
          return (
            <Chip
              key={t}
              label={t === 'yesno' ? 'Yes / No Check-in' : 'Numeric Counter'}
              icon={t === 'yesno' ? 'checkmark-circle-outline' : 'calculator-outline'}
              selected={isSelected}
              onPress={() => setType(t)}
              style={styles.chipSpacing}
            />
          );
        })}
      </HorizontalChips>

      {type === 'count' && (
        <View style={styles.countRow}>
          <TextField label="Daily Target Value" value={target} onChangeText={setTarget} keyboardType="number-pad" placeholder="e.g. 5" containerStyle={styles.countField} />
          <TextField label="Unit Label" value={unit} onChangeText={setUnit} placeholder="e.g. glasses, pages" containerStyle={styles.countField} />
        </View>
      )}

      {/* Day Schedule */}
      <Text style={styles.label}>Frequency Schedule</Text>
      <HorizontalChips style={styles.frequencyPresets}>
        {[
          { label: 'Every day', value: [0, 1, 2, 3, 4, 5, 6] },
          { label: 'Weekdays', value: [1, 2, 3, 4, 5] },
          { label: 'Weekends', value: [0, 6] },
        ].map((preset) => {
          const selected = preset.value.length === days.length && preset.value.every((day) => days.includes(day));
          return (
            <Chip key={preset.label} label={preset.label} selected={selected} onPress={() => setDays(preset.value)} style={styles.chipSpacing} />
          );
        })}
      </HorizontalChips>
      <HorizontalChips style={styles.daysRow}>
        {DAY_LABELS.map((lbl, idx) => {
          const isSelected = days.includes(idx);
          return (
            <Chip key={lbl} label={lbl} selected={isSelected} onPress={() => toggleDay(idx)} style={styles.chipSpacing} />
          );
        })}
      </HorizontalChips>

      <TextField
        label="Optional Weekly Goal"
        value={weeklyGoal}
        onChangeText={setWeeklyGoal}
        keyboardType="number-pad"
        placeholder="e.g. 5 completions"
        containerStyle={styles.field}
      />
      <Text style={[styles.goalHint, { color: colors.textSecondary }]}>Leave empty for no weekly goal</Text>

      {/* Reminders & Notifications */}
      <Text style={styles.label}>Reminders & Notifications</Text>
      {!settings.notificationsEnabled && (
        <View style={[styles.reminderWarning, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.notifWarning, { color: colors.primary }]}>Reminders are currently disabled in Settings.</Text>
        </View>
      )}

      {/* Quick Reminder Time Presets */}
      <HorizontalChips style={styles.presetTimeRow}>
        {PRESET_TIMES.map((time) => {
          const isAdded = reminders.includes(time);
          return (
            <Chip
              key={time}
              label={formatTime(time)}
              selected={isAdded}
              onPress={() => {
                if (isAdded) setReminders(reminders.filter((t) => t !== time));
                else addTimeStr(time);
              }}
              style={styles.chipSpacing}
            />
          );
        })}

      </HorizontalChips>

      {/* Active Reminder Tags */}
      {reminders.length > 0 && (
        <>
        <Text style={styles.subLabel}>Your reminders</Text>
        <HorizontalChips style={styles.activeRemindersRow}>
          {reminders.map((t) => (
            <View key={t} style={[styles.activeReminderTag, { backgroundColor: colors.primary }]}>
              <Ionicons name="notifications" size={12} color={colors.onPrimary} />
              <Text style={[styles.activeReminderText, { color: colors.onPrimary }]}>{formatTime(t)}</Text>
              <TouchableOpacity onPress={() => setReminders(reminders.filter((x) => x !== t))}>
                <Ionicons name="close-circle" size={14} color={colors.onPrimary} />
              </TouchableOpacity>
            </View>
          ))}
        </HorizontalChips>
        </>
      )}

      <HorizontalChips style={styles.reminderActionRow}>
        <TouchableOpacity
          style={[styles.customTimeChip, styles.reminderAction, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="time-outline" size={14} color={colors.primary} />
          <Text style={[styles.customTimeText, { color: colors.primary }]}>+ Custom</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.customTimeChip, styles.reminderAction, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
          onPress={() => setFuturePickerMode('date')}
        >
          <Ionicons name="calendar-outline" size={15} color={colors.primary} />
          <Text style={[styles.customTimeText, { color: colors.primary }]}>+ Future date & time</Text>
        </TouchableOpacity>
      </HorizontalChips>

      {scheduledReminders.length > 0 && (
        <>
        <Text style={styles.subLabel}>Scheduled reminders</Text>
        <HorizontalChips style={styles.activeRemindersRow}>
          {scheduledReminders.map((value) => (
            <View key={value} style={[styles.activeReminderTag, { backgroundColor: colors.primary }]}>
              <Ionicons name="notifications" size={12} color={colors.onPrimary} />
              <Text style={[styles.activeReminderText, { color: colors.onPrimary }]}>{formatScheduledReminder(value)}</Text>
              <TouchableOpacity onPress={() => setScheduledReminders((previous) => previous.filter((item) => item !== value))}>
                <Ionicons name="close-circle" size={14} color={colors.onPrimary} />
              </TouchableOpacity>
            </View>
          ))}
        </HorizontalChips>
        </>
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
          style={[styles.iosDoneTimeBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            addTimeFromDate(pendingTime);
            setShowPicker(false);
          }}
        >
          <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>Confirm Time</Text>
        </TouchableOpacity>
      )}

      {futurePickerMode && Platform.OS === 'android' && (
        <DateTimePicker
          value={futureReminder}
          mode={futurePickerMode}
          display="default"
          minimumDate={futurePickerMode === 'date' ? new Date() : undefined}
          onChange={onFuturePickerChange}
        />
      )}

      {futurePickerMode && Platform.OS === 'ios' && (
        <View style={[styles.futurePickerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Choose reminder date and time</Text>
          <DateTimePicker
            value={futureReminder}
            mode="date"
            display="spinner"
            minimumDate={new Date()}
            onChange={(_, date) => { if (date) setFutureReminder(date); }}
          />
          <DateTimePicker
            value={futureReminder}
            mode="time"
            display="spinner"
            onChange={(_, date) => { if (date) setFutureReminder(date); }}
          />
          <View style={styles.futurePickerActions}>
            <TouchableOpacity onPress={() => setFuturePickerMode(null)}>
              <Text style={[styles.cancelPickerText, { color: colors.muted }]}>Cancel</Text>
            </TouchableOpacity>
            <Button label="Add reminder" size="compact" onPress={() => addFutureReminder(futureReminder)} />
          </View>
        </View>
      )}

      </ScrollView>
      <View style={[styles.formActions, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button label={habitId ? 'Save Changes' : template ? 'Add Habit' : 'Save Habit'} onPress={save} style={styles.formActionButton} />
        <Button label="Cancel" variant="secondary" onPress={() => navigation.goBack()} style={styles.formActionButton} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: SCREEN_PADDING, paddingTop: 14, paddingBottom: 50 },
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
  previewCategory: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  previewName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  previewDesc: { fontSize: 12, marginTop: 3 },
  label: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  subLabel: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  goalHint: { fontSize: 13, marginTop: 4 },
  field: { marginTop: 16 },
  countField: { flex: 1 },
  chipSpacing: { marginRight: 8 },
  categoryRow: { marginBottom: 4 },
  iconScroll: { marginBottom: 4 },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: { borderWidth: 3 },
  typeRow: { marginBottom: 4 },
  countRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  daysRow: { marginBottom: 8 },
  frequencyPresets: { marginBottom: 10 },
  cancelPickerText: { fontSize: 12, fontWeight: '700' },
  reminderWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, padding: 10, borderRadius: 12, borderWidth: 1 },
  notifWarning: { fontSize: 12 },
  presetTimeRow: { marginBottom: 4 },
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
  reminderActionRow: { marginTop: 10 },
  reminderAction: { minHeight: 44, justifyContent: 'center' },
  futurePickerCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 12 },
  futurePickerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  activeRemindersRow: { marginTop: 10 },
  activeReminderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  activeReminderText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  iosDoneTimeBtn: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  formActions: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SCREEN_PADDING, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  formActionButton: { flex: 1 },
});
