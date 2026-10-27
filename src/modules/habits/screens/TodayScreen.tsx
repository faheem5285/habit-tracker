import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { AppState, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../../../components/Themed';
import { useHabits } from '../../../context/HabitContext';
import HabitCard from '../components/HabitCard';
import ProgressRing from '../components/ProgressRing';
import { useSettings } from '../../../context/SettingsContext';
import { toDateKey } from '../../../utils/dates';
import { currentStreak, getValue, isDone } from '../../../utils/streaks';
import { motivation } from '../../../utils/motivationalContent';
import ScreenHeader from '../../../components/ScreenHeader';
import AddHabitFab from '../../../components/AddHabitFab';
import HorizontalChips from '../../../components/HorizontalChips';
import { SCREEN_PADDING, SPACING } from '../../../ui';
import { appCopy, dailyBoostForDate, streakMilestoneCopy } from '../../../copy';
import TextField from '../../../components/TextField';

type Filter = 'all' | 'remaining' | 'done';

const MOODS = [
  { label: 'Great', icon: 'happy-outline' },
  { label: 'Energized', icon: 'flash-outline' },
  { label: 'Calm', icon: 'leaf-outline' },
  { label: 'Productive', icon: 'checkmark-circle-outline' },
  { label: 'Tired', icon: 'moon-outline' },
] as const;
const REFLECTION_PROMPTS = ['What helped you show up?', 'What felt easier today?', 'What would you like to try tomorrow?'];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Night Owl';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getClockKey(date: Date) {
  return `${toDateKey(date)}-${date.getHours()}`;
}

export default function TodayScreen() {
  const { habits, logs, setLog, dailyNotes, setDailyNote } = useHabits();
  const { colors } = useSettings();
  const navigation = useNavigation<any>();

  const [filter, setFilter] = useState<Filter>('all');
  const [showReflection, setShowReflection] = useState(false);
  const [undoEntry, setUndoEntry] = useState<{ habitId: string; date: string; previousValue: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [now, setNow] = useState(() => new Date());
  const clockKeyRef = useRef(getClockKey(new Date()));
  useEffect(() => {
    const refreshClock = () => {
      const current = new Date();
      const key = getClockKey(current);
      if (key !== clockKeyRef.current) {
        clockKeyRef.current = key;
        setNow(current);
      }
    };
    const timer = setInterval(refreshClock, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshClock();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const key = toDateKey(now);

  // Habits scheduled for the selected day of the week
  const scheduledHabits = useMemo(
    () => habits.filter((h) => !h.archived && h.days.includes(now.getDay())),
    [habits, now]
  );

  const doneCount = useMemo(() => scheduledHabits.filter((h) => isDone(h, logs, key)).length, [scheduledHabits, logs, key]);
  const totalCount = scheduledHabits.length;
  const progress = totalCount > 0 ? doneCount / totalCount : 0;
  const longestCurrentStreak = useMemo(
    () => Math.max(0, ...scheduledHabits.map((habit) => currentStreak(habit, logs, now))),
    [scheduledHabits, logs, now]
  );

  // Filtered habits
  const visibleHabits = useMemo(() => {
    return scheduledHabits.filter((h) => {
      const completed = isDone(h, logs, key);
      if (filter === 'remaining') return !completed;
      if (filter === 'done') return completed;
      return true;
    });
  }, [scheduledHabits, logs, key, filter]);

  const currentNote = dailyNotes[key] ?? '';
  const handleHabitChange = useCallback((habitId: string, value: number) => {
    const previousValue = getValue(logs, habitId, key);
    const habit = scheduledHabits.find((item) => item.id === habitId);
    setLog(habitId, key, value);
    if (habit && previousValue < habit.target && value >= habit.target) {
      setUndoEntry({ habitId, date: key, previousValue });
    }
  }, [key, logs, scheduledHabits, setLog]);
  useEffect(() => {
    if (!undoEntry) return;
    undoTimer.current = setTimeout(() => setUndoEntry(null), 4000);
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = null;
    };
  }, [undoEntry]);
  const undoCompletion = () => {
    if (!undoEntry) return;
    setLog(undoEntry.habitId, undoEntry.date, undoEntry.previousValue);
    setUndoEntry(null);
  };
  const openHabit = useCallback((habitId: string) => {
    navigation.navigate('Habits', { screen: 'HabitDetail', params: { habitId } });
  }, [navigation]);
  const addReflectionPrompt = (prompt: string) => {
    const separator = currentNote.trim() ? '\n\n' : '';
    setDailyNote(key, `${currentNote.trimEnd()}${separator}${prompt}\n`);
  };

  const header = (
    <View style={styles.headerContainer}>
      <ScreenHeader
        title={getGreeting()}
        subtitle={now.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })}
        style={styles.screenHeader}
      />
      {/* Main Momentum Card */}
      <View
        style={[
          styles.momentumCard,
          {
            backgroundColor: '#17382C',
            borderColor: '#17382C',
          },
        ]}
      >
        {/* Subtle decorative rings behind the card content */}
        <View pointerEvents="none" style={styles.momentumDecorativeRings}>
          {/* Two subtle outlines per cluster, distributed across the card background */}
          <View style={styles.momentumRingLeftOuter} />
          <View style={[styles.momentumRingLeftOuter, styles.momentumRingDoubleLine]} />
          <View style={styles.momentumRingLeftMiddle} />
          <View style={[styles.momentumRingLeftMiddle, styles.momentumRingDoubleLine]} />
          <View style={styles.momentumRingLeftInner} />
          <View style={[styles.momentumRingLeftInner, styles.momentumRingDoubleLine]} />
          <View style={styles.momentumRingTopOuter} />
          <View style={[styles.momentumRingTopOuter, styles.momentumRingDoubleLine]} />
          <View style={styles.momentumRingTopInner} />
          <View style={[styles.momentumRingTopInner, styles.momentumRingDoubleLine]} />
          <View style={styles.momentumRingLarge} />
          <View style={[styles.momentumRingLarge, styles.momentumRingDoubleLine]} />
          <View style={styles.momentumRingMedium} />
          <View style={[styles.momentumRingMedium, styles.momentumRingDoubleLine]} />
          <View style={styles.momentumRingSmall} />
          <View style={[styles.momentumRingSmall, styles.momentumRingDoubleLine]} />
          <View style={styles.momentumRingFarOuter} />
          <View style={[styles.momentumRingFarOuter, styles.momentumRingDoubleLine]} />
          <View style={styles.momentumRingFarInner} />
          <View style={[styles.momentumRingFarInner, styles.momentumRingDoubleLine]} />
        </View>
        <View style={styles.momentumTextWrap}>
          <View style={styles.momentumBadge}>
            <Text style={[styles.momentumBadgeText, { color: '#C8E2D1' }]}>
              TODAY&apos;S MOMENTUM
            </Text>
          </View>

          <View style={styles.momentumTitleRow}>
            <Text style={[styles.momentumTitle, { color: '#FFFFFF' }]}>
              {doneCount === totalCount && totalCount > 0
                ? 'All habits completed!'
                : `${doneCount} of ${totalCount} completed`}
            </Text>
            {doneCount === totalCount && totalCount > 0 && (
              <Ionicons name="checkmark-circle" size={20} color="#A6D8B8" />
            )}
          </View>

          <Text style={[styles.motivationText, { color: '#D7E4DB' }]}>
            {motivation.today(progress, totalCount)}
          </Text>

          {totalCount > 0 && (
            <View style={styles.habitProgressDots} accessibilityLabel="Individual habit completion">
              {scheduledHabits.map((habit) => {
                const completed = isDone(habit, logs, key);
                return (
                  <View key={habit.id} style={styles.habitProgressItem}>
                    <View
                      style={[
                        styles.habitProgressCircle,
                        completed
                          ? { backgroundColor: '#A6D8B8', borderColor: '#A6D8B8' }
                          : { backgroundColor: '#405249', borderColor: '#8CA095' },
                      ]}
                    >
                      {completed && <Ionicons name="checkmark" size={11} color="#173C2F" />}
                    </View>
                    <Text numberOfLines={1} style={styles.habitProgressLabel}>
                      {habit.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <ProgressRing
          progress={progress}
          size={94}
          stroke={8}
          color="#A6D8B8"
          backgroundColor="#405249"
          textColor="#FFFFFF"
        />
      </View>
      <View style={[styles.dailyBoost, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.dailyBoostIcon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="sunny-outline" size={18} color={colors.accent} />
        </View>
        <View style={styles.dailyBoostCopy}>
          <Text style={[styles.dailyBoostTitle, { color: colors.text }]}>Daily boost</Text>
          <Text style={[styles.dailyBoostText, { color: colors.textSecondary }]}>
            {dailyBoostForDate(key)}
          </Text>
        </View>
      </View>
      {streakMilestoneCopy(longestCurrentStreak) ? (
        <View style={[styles.streakMilestone, { backgroundColor: colors.successSoft }]}>
          <Ionicons name="flame-outline" size={18} color={colors.success} />
          <Text style={[styles.streakMilestoneText, { color: colors.text }]}>
            {streakMilestoneCopy(longestCurrentStreak)}
          </Text>
        </View>
      ) : null}

      {/* Filter Tabs */}
      {totalCount > 0 && (
        <HorizontalChips style={styles.filterScroll}>
          {(
            [
              ['all', 'All'],
              ['remaining', 'To Do'],
              ['done', 'Done'],
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
                    { color: active ? colors.onPrimary : colors.textSecondary },
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
        </HorizontalChips>
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
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
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
                <Text style={[styles.emptyAddBtnText, { color: colors.onPrimary }]}>+ Add a Habit</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListFooterComponent={
          <View style={[styles.notesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.notesHeader, !showReflection && { marginBottom: 0 }]}>
              <View style={[styles.notesIconWrap, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="journal-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.notesCopy}>
                <Text numberOfLines={1} style={styles.notesTitle}>{appCopy.habits.dailyReflection}</Text>
                <Text numberOfLines={1} style={[styles.notesSubtitle, { color: colors.muted }]}>
                  {appCopy.habits.reflectionSubtitle}
                </Text>
              </View>
              {showReflection && !!currentNote.trim() && (
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={{ marginRight: 6 }} />
              )}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={showReflection ? appCopy.habits.hideReflection : appCopy.habits.showReflection}
                style={[
                  styles.toggleReflectionBtn,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
                hitSlop={4}
                onPress={() => setShowReflection((prev) => !prev)}
              >
                <Text style={[styles.toggleReflectionText, { color: colors.textSecondary }]}>
                  {showReflection ? appCopy.habits.hide : appCopy.habits.show}
                </Text>
                <Ionicons
                  name={showReflection ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {showReflection && (
              <>
                <Text style={[styles.reflectionPromptLabel, { color: colors.textSecondary }]}>{appCopy.habits.reflectionPromptLabel}</Text>
                <View style={styles.promptRow}>
                  {REFLECTION_PROMPTS.map((prompt) => (
                    <TouchableOpacity key={prompt} style={[styles.promptPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} hitSlop={4} onPress={() => addReflectionPrompt(prompt)}>
                      <Text style={[styles.promptText, { color: colors.textSecondary }]}>{prompt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Quick Mood Pills */}
                <View style={styles.moodRow}>
                  {MOODS.map((mood) => (
                    <TouchableOpacity
                      key={mood.label}
                      style={[
                        styles.moodPill,
                        { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                        currentNote.includes(mood.label) && {
                          backgroundColor: colors.primarySoft,
                          borderColor: colors.primary,
                        },
                      ]}
                      hitSlop={4}
                      onPress={() => {
                        const tag = `${mood.label} · `;
                        if (currentNote.includes(mood.label)) {
                          setDailyNote(key, currentNote.replace(tag, ''));
                        } else {
                          setDailyNote(key, tag + currentNote);
                        }
                      }}
                    >
                      <Ionicons name={mood.icon} size={14} color={colors.primary} />
                      <Text style={[styles.moodText, { color: colors.textSecondary }]}>{mood.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextField
                  multiline
                  maxLength={600}
                  value={currentNote}
                  onChangeText={(text) => setDailyNote(key, text)}
                  placeholder={appCopy.habits.reflectionPlaceholder}
                  textAlignVertical="top"
                  style={[styles.notesInput, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                />
                <Text style={[styles.characterCount, { color: colors.muted }]}>{currentNote.length}/600</Text>
              </>
            )}
          </View>
        }
      />
      <AddHabitFab
        accessibilityLabel="Add new habit"
        fallbackLabel="Add habit"
        onPress={() => navigation.navigate('Habits', { screen: 'HabitForm' })}
      />
      {undoEntry && (
        <View style={[styles.undoToast, { backgroundColor: colors.text }]}>
          <Text style={[styles.undoText, { color: colors.background }]}>{appCopy.habits.completedToast}</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.undoButton} onPress={undoCompletion}>
            <Text style={[styles.undoButtonText, { color: colors.primary }]}>{appCopy.habits.undo}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  listContent: { paddingHorizontal: SCREEN_PADDING, paddingTop: 0, paddingBottom: 96 },
  undoToast: { position: 'absolute', left: SCREEN_PADDING, right: SCREEN_PADDING, bottom: 84, minHeight: 52, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 6 },
  undoText: { fontSize: 14, fontWeight: '700' },
  undoButton: { minWidth: 52, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  undoButtonText: { fontWeight: '800', fontSize: 14 },
  headerContainer: { marginBottom: SPACING.md },
  screenHeader: { marginHorizontal: -SCREEN_PADDING },
  momentumTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  momentumCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderWidth: 0,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  dailyBoost: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 16 },
  dailyBoostIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dailyBoostCopy: { flex: 1, minWidth: 0 },
  dailyBoostTitle: { fontSize: 13, fontWeight: '800' },
  dailyBoostText: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  streakMilestone: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, marginBottom: 12 },
  streakMilestoneText: { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  momentumDecorativeRings: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  momentumRingDoubleLine: {
    transform: [{ scale: 0.88 }],
    borderColor: 'rgba(166, 216, 184, 0.18)',
  },
  momentumRingLeftOuter: {
    position: 'absolute', width: 230, height: 230, borderRadius: 115,
    borderWidth: 1, borderColor: 'rgba(112, 213, 164, 0.13)',
    left: -118, top: -112,
  },
  momentumRingLeftMiddle: {
    position: 'absolute', width: 184, height: 184, borderRadius: 92,
    borderWidth: 1, borderColor: 'rgba(112, 213, 164, 0.16)',
    left: '7%', top: '35%',
  },
  momentumRingLeftInner: {
    position: 'absolute', width: 138, height: 138, borderRadius: 69,
    borderWidth: 1, borderColor: 'rgba(112, 213, 164, 0.18)',
    left: '25%', top: -108,
  },
  momentumRingTopOuter: {
    position: 'absolute', width: 190, height: 190, borderRadius: 95,
    borderWidth: 1, borderColor: 'rgba(52, 166, 119, 0.12)',
    left: '45%', top: '30%',
  },
  momentumRingTopInner: {
    position: 'absolute', width: 142, height: 142, borderRadius: 71,
    borderWidth: 1, borderColor: 'rgba(112, 213, 164, 0.12)',
    left: '65%', top: -104,
  },
  momentumRingLarge: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: 'rgba(52, 166, 119, 0.22)',
    right: -92,
    top: 28,
  },
  momentumRingMedium: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderRadius: 98,
    borderWidth: 1,
    borderColor: 'rgba(52, 166, 119, 0.18)',
    right: '18%',
    top: '38%',
  },
  momentumRingSmall: {
    position: 'absolute',
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 1,
    borderColor: 'rgba(112, 213, 164, 0.15)',
    right: -28,
    top: -18,
  },
  momentumRingFarOuter: {
    position: 'absolute', width: 290, height: 290, borderRadius: 145,
    borderWidth: 1, borderColor: 'rgba(112, 213, 164, 0.10)',
    right: -116, top: -112,
  },
  momentumRingFarInner: {
    position: 'absolute', width: 242, height: 242, borderRadius: 121,
    borderWidth: 1, borderColor: 'rgba(112, 213, 164, 0.12)',
    right: '36%', top: -126,
  },
  momentumTextWrap: {
    flex: 1,
    paddingRight: 14,
    zIndex: 1,
  },
  momentumBadge: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  momentumBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  momentumTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  motivationText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  habitProgressDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  habitProgressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  habitProgressCircle: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitProgressLabel: {
    color: '#E1EBE4',
    fontSize: 10,
    fontWeight: '600',
    maxWidth: 88,
  },
  filterScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 14,
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
  notesCopy: { flex: 1, minWidth: 0 },
  notesTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  notesSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  toggleReflectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleReflectionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reflectionPromptLabel: { fontSize: 12, fontWeight: '700', marginBottom: 7 },
  promptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  promptPill: { minHeight: 36, justifyContent: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  promptText: { fontSize: 12, fontWeight: '600' },
  characterCount: { textAlign: 'right', fontSize: 12, marginTop: 4 },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
  },
  moodText: {
    fontSize: 12,
    fontWeight: '600',
  },
  notesInput: {
    lineHeight: 22,
    minHeight: 96,
  },
});
