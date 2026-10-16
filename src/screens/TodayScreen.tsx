import { useState, useMemo, useCallback } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Text, TextInput } from '../components/Themed';
import { useHabits } from '../context/HabitContext';
import HabitCard from '../components/HabitCard';
import ProgressRing from '../components/ProgressRing';
import { useSettings } from '../context/SettingsContext';
import { toDateKey } from '../utils/dates';
import { currentStreak, getValue, isDone } from '../utils/streaks';
import { motivation } from '../utils/motivationalContent';

type Filter = 'all' | 'remaining' | 'done' | 'morning' | 'afternoon' | 'evening';

const MOODS = ['😊 Great', '⚡ Energized', '🧘 Calm', '💪 Productive', '😴 Tired'];
const REFLECTION_PROMPTS = ['What helped you show up?', 'What felt easier today?', 'What would you like to try tomorrow?'];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Night Owl';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen() {
  const { habits, logs, setLog, dailyNotes, setDailyNote } = useHabits();
  const { colors } = useSettings();
  const navigation = useNavigation<any>();

  const [filter, setFilter] = useState<Filter>('all');
  const now = useMemo(() => new Date(), []);
  const key = toDateKey(now);

  // Habits scheduled for the selected day of the week
  const scheduledHabits = useMemo(
    () => habits.filter((h) => !h.archived && h.days.includes(now.getDay())),
    [habits, now]
  );

  const doneCount = useMemo(() => scheduledHabits.filter((h) => isDone(h, logs, key)).length, [scheduledHabits, logs, key]);
  const totalCount = scheduledHabits.length;
  const progress = totalCount > 0 ? doneCount / totalCount : 0;

  // Filtered habits
  const visibleHabits = useMemo(() => {
    return scheduledHabits.filter((h) => {
      const completed = isDone(h, logs, key);
      if (filter === 'remaining') return !completed;
      if (filter === 'done') return completed;
      if (filter === 'morning') return h.timeOfDay === 'morning';
      if (filter === 'afternoon') return h.timeOfDay === 'afternoon';
      if (filter === 'evening') return h.timeOfDay === 'evening';
      return true;
    });
  }, [scheduledHabits, logs, key, filter]);

  const currentNote = dailyNotes[key] ?? '';
  const handleHabitChange = useCallback((habitId: string, value: number) => {
    setLog(habitId, key, value);
  }, [key, setLog]);
  const openHabit = useCallback((habitId: string) => {
    navigation.navigate('Habits', { screen: 'HabitDetail', params: { habitId } });
  }, [navigation]);
  const addReflectionPrompt = (prompt: string) => {
    const separator = currentNote.trim() ? '\n\n' : '';
    setDailyNote(key, `${currentNote.trimEnd()}${separator}${prompt}\n`);
  };

  const header = (
    <View style={styles.headerContainer}>
      {/* Top Greeting Bar */}
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>DAY BY DAY</Text>
          <Text style={styles.greeting}>{getGreeting()} ✨</Text>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {now.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Add new habit"
          style={[styles.addTopBtn, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Habits', { screen: 'HabitForm' })}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Main Momentum Card */}
      <View
        style={[
          styles.momentumCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.momentumTextWrap}>
          <View style={styles.momentumBadge}>
            <Text style={[styles.momentumBadgeText, { color: colors.primary }]}>
              TODAY&apos;S MOMENTUM
            </Text>
          </View>

          <Text style={styles.momentumTitle}>
            {doneCount === totalCount && totalCount > 0
              ? 'All habits completed! 🎉'
              : `${doneCount} of ${totalCount} completed`}
          </Text>

          <Text style={[styles.motivationText, { color: colors.textSecondary }]}>
            {motivation.today(progress, totalCount)}
          </Text>
        </View>

        <ProgressRing
          progress={progress}
          size={74}
          stroke={7}
          color={colors.primary}
          backgroundColor={colors.surfaceMuted}
          textColor={colors.text}
        />
      </View>

      {/* Filter Tabs */}
      {totalCount > 0 && (
        <View style={styles.filterScroll}>
          {(
            [
              ['all', 'All'],
              ['remaining', 'To Do'],
              ['done', 'Done'],
              ['morning', '🌅 Morning'],
              ['afternoon', '☀️ Afternoon'],
              ['evening', '🌙 Evening'],
            ] as const
          ).map(([val, label]) => {
            const active = filter === val;
            return (
              <TouchableOpacity
                key={val}
                activeOpacity={0.7}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFilter(val)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: active ? '#FFFFFF' : colors.textSecondary },
                    active && styles.filterPillTextActive,
                  ]}
                >
                  {label}
                  {val === 'all'
                    ? ` (${totalCount})`
                    : val === 'done'
                    ? ` (${doneCount})`
                    : val === 'remaining'
                    ? ` (${totalCount - doneCount})`
                    : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <FlatList
        data={visibleHabits}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <HabitCard
            habit={item}
            value={getValue(logs, item.id, key)}
            streak={currentStreak(item, logs, now)}
            onChange={handleHabitChange}
            onPress={openHabit}
          />
        )}
        ListEmptyComponent={
          <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.primarySoft }]}>
              <Ionicons
                name={totalCount ? 'checkmark-circle-outline' : 'sparkles-outline'}
                size={32}
                color={colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {totalCount ? 'No habits in this filter' : 'No habits scheduled for today'}
            </Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>
              {totalCount
                ? 'Try switching to another filter or view all habits.'
                : 'Create a new daily habit to kickstart your journey!'}
            </Text>
            {!totalCount && (
              <TouchableOpacity
                style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('Habits', { screen: 'HabitForm' })}
              >
                <Text style={styles.emptyAddBtnText}>+ Add a Habit</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListFooterComponent={
          <View style={[styles.notesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.notesHeader}>
              <View style={[styles.notesIconWrap, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="journal-outline" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.notesTitle}>Daily reflection</Text>
                <Text style={[styles.notesSubtitle, { color: colors.muted }]}>
                  A sentence is enough to remember what moved you forward.
                </Text>
              </View>
              {!!currentNote.trim() && (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              )}
            </View>

            <Text style={[styles.reflectionPromptLabel, { color: colors.textSecondary }]}>Choose a prompt, or write freely</Text>
            <View style={styles.promptRow}>
              {REFLECTION_PROMPTS.map((prompt) => (
                <TouchableOpacity key={prompt} style={[styles.promptPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} onPress={() => addReflectionPrompt(prompt)}>
                  <Text style={[styles.promptText, { color: colors.textSecondary }]}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quick Mood Pills */}
            <View style={styles.moodRow}>
              {MOODS.map((mood) => (
                <TouchableOpacity
                  key={mood}
                  style={[
                    styles.moodPill,
                    { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                    currentNote.includes(mood) && {
                      backgroundColor: colors.primarySoft,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => {
                    const tag = `${mood} · `;
                    if (currentNote.includes(mood)) {
                      setDailyNote(key, currentNote.replace(tag, ''));
                    } else {
                      setDailyNote(key, tag + currentNote);
                    }
                  }}
                >
                  <Text style={[styles.moodText, { color: colors.textSecondary }]}>{mood}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              multiline
              maxLength={600}
              value={currentNote}
              onChangeText={(text) => setDailyNote(key, text)}
              placeholder="Write what you noticed, learned, or want to remember..."
              textAlignVertical="top"
              style={[
                styles.notesInput,
                {
                  color: colors.text,
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                },
              ]}
            />
            <Text style={[styles.characterCount, { color: colors.muted }]}>{currentNote.length}/600</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 60 },
  headerContainer: { marginBottom: 12 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  addTopBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  momentumCard: {
    borderRadius: 22,
    borderWidth: 1.5,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  momentumTextWrap: {
    flex: 1,
    paddingRight: 14,
  },
  momentumBadge: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  momentumBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  momentumTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  motivationText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  filterScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    fontWeight: '700',
  },
  emptyBox: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginVertical: 14,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 240,
  },
  emptyAddBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  notesCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  notesIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  notesSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  reflectionPromptLabel: { fontSize: 11, fontWeight: '700', marginBottom: 7 },
  promptRow: { gap: 6, marginBottom: 10 },
  promptPill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  promptText: { fontSize: 11, fontWeight: '600' },
  characterCount: { textAlign: 'right', fontSize: 10, marginTop: 4 },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  moodPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  moodText: {
    fontSize: 11,
    fontWeight: '600',
  },
  notesInput: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    lineHeight: 18,
    minHeight: 70,
  },
});
