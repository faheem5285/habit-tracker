import { useMemo, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/Themed';
import { useHabits } from '../context/HabitContext';
import { useSettings } from '../context/SettingsContext';
import { bestPerfectDayStreak, bestStreak, dayStat, isDone, perfectDayStreak } from '../utils/streaks';
import { addDays, toDateKey } from '../utils/dates';
import { motivation } from '../utils/motivationalContent';

const challengeGlyphs = ['checkmark-done-outline', 'calendar-outline', 'trophy-outline', 'diamond-outline'] as const;
const badgeGlyphs = ['star-outline', 'flame-outline', 'flash-outline', 'locate-outline', 'ribbon-outline', 'diamond-outline', 'checkmark-circle-outline', 'trending-up-outline', 'sparkles-outline', 'walk-outline', 'list-outline', 'calendar-outline'] as const;

export default function ChallengesScreen() {
  const isFocused = useIsFocused();
  const { habits, logs } = useHabits();
  const { colors } = useSettings();
  const scrollRef = useRef<ScrollView>(null);
  const scrollPosition = useRef(0);

  const totalCompletions = useMemo(() => {
    if (!isFocused) return 0;
    return logs.filter((l) => {
      const h = habits.find((x) => x.id === l.habitId);
      return h && l.value >= h.target;
    }).length;
  }, [isFocused, logs, habits]);

  const today = useMemo(() => new Date(), []);
  const maxStreak = useMemo(() => {
    return isFocused ? Math.max(0, ...habits.filter((habit) => !habit.archived).map((h) => bestStreak(h, logs, today))) : 0;
  }, [isFocused, habits, logs, today]);

  const todayKey = toDateKey(today);
  const completedTodayCount = useMemo(() => {
    return isFocused ? habits.filter((h) => !h.archived && h.days.includes(today.getDay()) && isDone(h, logs, todayKey)).length : 0;
  }, [isFocused, habits, logs, today, todayKey]);
  const scheduledTodayCount = useMemo(() => isFocused ? habits.filter((habit) => !habit.archived && habit.days.includes(today.getDay())).length : 0, [isFocused, habits, today]);
  const dailyPerfectStreak = useMemo(() => isFocused ? perfectDayStreak(habits, logs, today) : 0, [isFocused, habits, logs, today]);
  const bestDailyPerfectStreak = useMemo(() => isFocused ? bestPerfectDayStreak(habits, logs, today) : 0, [isFocused, habits, logs, today]);
  const monthlyPerfectDays = useMemo(() => isFocused
    ? Array.from({ length: 30 }, (_, offset) => dayStat(habits, logs, addDays(today, -offset)))
      .filter((stat) => stat.total > 0 && stat.done === stat.total).length
    : 0, [isFocused, habits, logs, today]);

  if (!isFocused) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  // Challenges definitions with live computed progress
  const challenges = [
    {
      id: 'c1',
      timeframe: 'DAILY',
      title: "Today's 100% Day",
      desc: 'Complete every habit scheduled for today. A full day starts with one check-in.',
      icon: '⚡',
      target: Math.max(1, scheduledTodayCount),
      current: scheduledTodayCount > 0 ? Math.min(scheduledTodayCount, completedTodayCount) : 0,
      color: '#6366F1',
      unit: 'habits',
    },
    {
      id: 'c2',
      timeframe: 'WEEKLY',
      title: 'Three Scheduled Days at 100%',
      desc: 'Complete every planned habit for three scheduled days in succession.',
      icon: '🌱',
      target: 3,
      current: Math.min(3, dailyPerfectStreak),
      color: '#10B981',
      unit: 'perfect days',
    },
    {
      id: 'c3',
      timeframe: 'MONTHLY',
      title: 'Ten Full Days This Month',
      desc: 'Reach 100% on ten days this month, at your own pace.',
      icon: '🏆',
      target: 10,
      current: Math.min(10, monthlyPerfectDays),
      color: '#F59E0B',
      unit: 'perfect days',
    },
    {
      id: 'c4',
      timeframe: 'LONG TERM',
      title: '100 Check-ins',
      desc: 'Log 100 total habit completions across all your practices.',
      icon: '💎',
      target: 100,
      current: Math.min(100, totalCompletions),
      color: '#EC4899',
      unit: 'check-ins',
    },
  ];

  // Badges with live unlock conditions
  const badges = [
    {
      id: 'b1',
      title: 'First Step',
      desc: 'Completed your very first habit check-in.',
      icon: '🌟',
      unlocked: totalCompletions >= 1,
    },
    {
      id: 'b2',
      title: 'Three-Day Streak',
      desc: 'Complete one habit on three scheduled days in succession.',
      icon: '🔥',
      unlocked: maxStreak >= 3,
    },
    {
      id: 'b3',
      title: 'Seven-Day Streak',
      desc: 'Complete one habit on seven scheduled days in succession.',
      icon: '⚡',
      unlocked: maxStreak >= 7,
    },
    {
      id: 'b4',
      title: 'Triple Win',
      desc: 'Completed 3 or more habits in a single day.',
      icon: '🎯',
      unlocked: completedTodayCount >= 3,
    },
    {
      id: 'b5',
      title: 'Thirty-Day Streak',
      desc: 'Complete one habit on 30 scheduled days in succession.',
      icon: '👑',
      unlocked: maxStreak >= 30,
    },
    {
      id: 'b6',
      title: 'Centurion',
      desc: 'Reached 100 total habit completions.',
      icon: '💎',
      unlocked: totalCompletions >= 100,
    },
    { id: 'b7', title: 'A Full Day', desc: 'Complete every habit scheduled for a day.', icon: '✓', unlocked: bestDailyPerfectStreak >= 1 },
    { id: 'b8', title: 'Three in a Row', desc: 'Reach 100% daily progress three scheduled days in a row.', icon: '↗', unlocked: bestDailyPerfectStreak >= 3 },
    { id: 'b9', title: 'A Week of Follow-Through', desc: 'Complete all planned habits on seven scheduled days in succession.', icon: '✦', unlocked: bestDailyPerfectStreak >= 7 },
    { id: 'b10', title: 'Long Run', desc: 'Maintain a 14-day streak on one habit.', icon: '⌁', unlocked: maxStreak >= 14 },
    { id: 'b11', title: 'Five Hundred Check-ins', desc: 'Log 500 completed habits over time.', icon: '◇', unlocked: totalCompletions >= 500 },
    { id: 'b12', title: 'Two Weeks of Full Days', desc: 'Complete every planned habit on 14 scheduled days in succession.', icon: '◎', unlocked: bestDailyPerfectStreak >= 14 },
  ];

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={100}
        onScroll={(event) => { scrollPosition.current = event.nativeEvent.contentOffset.y; }}
        onContentSizeChange={() => scrollRef.current?.scrollTo({ y: scrollPosition.current, animated: false })}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR PROGRESS</Text>
          <Text style={styles.title}>Challenges & Badges</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Notice each milestone as it happens. Your progress belongs to you.
          </Text>
        </View>

        <View style={[styles.streakCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.streakIcon, { backgroundColor: colors.successSoft }]}><Ionicons name="checkmark-done-outline" size={22} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakTitle}>100% day streak</Text>
            <Text style={[styles.streakText, { color: colors.muted }]}>{dailyPerfectStreak ? `${dailyPerfectStreak} scheduled days in a row at 100%.` : 'Complete every habit scheduled today to begin your streak.'}</Text>
          </View>
          <View style={styles.streakRecord}><Text style={[styles.streakCount, { color: colors.primary }]}>{bestDailyPerfectStreak}</Text><Text style={[styles.streakCaption, { color: colors.muted }]}>best</Text></View>
        </View>

        {/* Milestone Banner */}
        <View style={[styles.milestoneCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.milestoneHeader}>
            <View style={[styles.milestoneIconWrap, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="trophy" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.milestoneTitle}>Achievements Unlocked</Text>
              <Text style={[styles.milestoneSub, { color: colors.muted }]}>
                {unlockedCount} of {badges.length} milestone badges earned
              </Text>
            </View>
            <Text style={[styles.milestoneScore, { color: colors.primary }]}>
              {Math.round((unlockedCount / badges.length) * 100)}%
            </Text>
          </View>
          <Text style={[styles.milestoneEncouragement, { color: colors.textSecondary }]}>
            {unlockedCount > 0 ? motivation.achievement(`${unlockedCount} ${unlockedCount === 1 ? 'milestone' : 'milestones'}`) : 'Every badge begins with one check-in. Your next step can be a small one.'}
          </Text>
        </View>

        {/* Challenges List */}
        <Text style={styles.sectionTitle}>Daily, weekly & monthly challenges</Text>
        {challenges.filter((c) => c.timeframe !== 'DAILY' || scheduledTodayCount > 0).map((c) => {
          const pct = Math.min(100, Math.round((c.current / c.target) * 100));
          const isFinished = c.current >= c.target;
          return (
            <View
              key={c.id}
              style={[
                styles.challengeCard,
                { backgroundColor: colors.surface, borderColor: isFinished ? c.color : colors.border },
              ]}
            >
              <View style={styles.challengeTop}>
                <View style={[styles.challengeIconWrap, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name={challengeGlyphs[Number(c.id.slice(1)) - 1]} size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.challengePeriod, { color: c.color }]}>{c.timeframe}</Text>
                  <Text style={styles.challengeTitle}>{c.title}</Text>
                  <Text style={[styles.challengeDesc, { color: colors.muted }]}>{c.desc}</Text>
                </View>
                {isFinished && (
                  <View style={[styles.doneBadge, { backgroundColor: c.color }]}>
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  </View>
                )}
              </View>

              {/* Progress bar */}
              <View style={styles.barWrap}>
                <View style={[styles.barBg, { backgroundColor: colors.surfaceMuted }]}>
                  <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: c.color }]} />
                </View>
                <View style={styles.barStats}>
                  <Text style={[styles.barStatText, { color: colors.muted }]}>
                    {c.current} / {c.target} {c.unit}
                  </Text>
                  <Text style={[styles.barStatText, { color: c.color, fontWeight: '700' }]}>
                    {pct}%
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* Badges Grid */}
        <Text style={styles.sectionTitle}>Achievement Badges</Text>
        <View style={styles.badgesGrid}>
          {badges.map((b) => (
            <View
              key={b.id}
              style={[
                styles.badgeCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: b.unlocked ? colors.accent : colors.border,
                  opacity: b.unlocked ? 1 : 0.5,
                },
              ]}
            >
              <Ionicons name={badgeGlyphs[Number(b.id.slice(1)) - 1]} size={26} color={colors.primary} />
              <Text style={styles.badgeTitle} numberOfLines={1}>{b.title}</Text>
              <Text style={[styles.badgeDesc, { color: colors.muted }]} numberOfLines={2}>
                {b.desc}
              </Text>
              <View
                style={[
                  styles.badgeStatusPill,
                  {
                    backgroundColor: b.unlocked ? colors.accentSoft : colors.surfaceMuted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeStatusText,
                    { color: b.unlocked ? colors.accent : colors.muted },
                  ]}
                >
                  {b.unlocked ? 'Earned' : 'To earn'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 50 },
  header: { marginBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  milestoneCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  milestoneHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  milestoneIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneTitle: { fontSize: 16, fontWeight: '700' },
  milestoneSub: { fontSize: 12, marginTop: 2 },
  milestoneScore: { fontSize: 20, fontWeight: '800' },
  milestoneEncouragement: { fontSize: 12, lineHeight: 17, marginTop: 12 },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1.5, borderRadius: 18, padding: 14, marginBottom: 20 },
  streakIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  streakTitle: { fontSize: 14, fontWeight: '800' },
  streakText: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  streakRecord: { alignItems: 'center', minWidth: 40 },
  streakCount: { fontSize: 19, fontWeight: '800' },
  streakCaption: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, marginTop: 8 },
  challengeCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
  },
  challengeTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  challengeIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeTitle: { fontSize: 15, fontWeight: '700' },
  challengePeriod: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  challengeDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  doneBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barWrap: { marginTop: 12 },
  barBg: { height: 7, borderRadius: 3.5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3.5 },
  barStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  barStatText: { fontSize: 11, fontWeight: '600' },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  badgeCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'center',
  },
  badgeEmoji: { fontSize: 32, marginBottom: 6 },
  badgeTitle: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  badgeDesc: { fontSize: 11, textAlign: 'center', marginTop: 3, lineHeight: 15, minHeight: 30 },
  badgeStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 8,
  },
  badgeStatusText: { fontSize: 10, fontWeight: '700' },
});

