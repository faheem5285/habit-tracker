import { useState, useMemo, useCallback, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { HabitGlyph } from '../components/HabitGlyph';
import { Text } from '../../../components/Themed';
import BarChart from '../components/BarChart';
import Heatmap from '../components/Heatmap';
import { AreaTrendChart, DonutChart, LineTrendChart, WeekdayChart } from '../components/InsightCharts';
import { useHabits } from '../../../context/HabitContext';
import { useSettings } from '../../../context/SettingsContext';
import { Habit } from '../../../types';
import { DAY_LABELS, addDays, fromDateKey, toDateKey, todayKey } from '../../../utils/dates';
import { completionRate, createdKey, currentStreak, dayStat, isDone, isScheduled, pct } from '../../../utils/streaks';
import ScreenHeader from '../../../components/ScreenHeader';
import HorizontalChips from '../../../components/HorizontalChips';
import { SCREEN_PADDING, SPACING } from '../../../ui';
import Card from '../../../components/Card';
import Chip from '../../../components/Chip';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { habits, logs } = useHabits();
  const { settings, colors } = useSettings();
  const scrollRef = useRef<ScrollView>(null);
  const scrollPosition = useRef(0);
  const now = useMemo(() => new Date(), []);
  const tKey = todayKey();

  const [range, setRange] = useState<7 | 14 | 30>(7);
  const [filter, setFilter] = useState('all');
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const active = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const list = useMemo(() => {
    return filter === 'all' ? active : active.filter((h) => h.id === filter);
  }, [filter, active]);

  const today = useMemo(() => isFocused ? dayStat(list, logs, now) : { done: 0, total: 0 }, [isFocused, list, logs, now]);
  const week = useMemo(() => !isFocused ? { done: 0, total: 0 } : Array.from({ length: 7 }, (_, i) => dayStat(list, logs, addDays(now, -i))).reduce(
    (a, s) => ({ done: a.done + s.done, total: a.total + s.total }), { done: 0, total: 0 }
  ), [isFocused, list, logs, now]);

  const bestNow = useMemo(() => isFocused ? Math.max(0, ...list.map((h) => currentStreak(h, logs, now))) : 0, [isFocused, list, logs, now]);
  const weekPct = Math.round(pct(week) * 100);
  const getWeeklyLevel = (rate: number) => {
    if (rate >= 75) return { label: 'Unstoppable', color: colors.success };
    if (rate >= 50) return { label: 'Strong', color: colors.primary };
    if (rate >= 25) return { label: 'Building', color: colors.accent };
    return { label: 'Getting started', color: colors.textSecondary };
  };
  const weeklyLevel = getWeeklyLevel(weekPct);

  // Week matrix
  const weekStart = useMemo(() => addDays(now, -((now.getDay() - settings.weekStartsOn + 7) % 7)), [now, settings.weekStartsOn]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const habitStartKeys = useMemo(() => new Map(list.map((habit): [string, string] => {
    const createdAt = new Date(habit.createdAt);
    const firstCheckIn = logs
      .filter((log) => log.habitId === habit.id && log.value > 0)
      .map((log) => log.date)
      .sort()[0];
    return [habit.id, Number.isFinite(createdAt.getTime()) ? createdKey(habit) : firstCheckIn ?? tKey];
  })), [list, logs, tKey]);
  const mark = (h: Habit, d: Date) => {
    const key = toDateKey(d);
    if (key > tKey) return 'future';
    if (key < (habitStartKeys.get(h.id) ?? tKey) || !isScheduled(h, d)) return 'not-applicable';
    if (isDone(h, logs, key)) return 'done';
    return key === tKey ? 'today' : 'missed';
  };

  // Completion bar chart
  const chartEndDate = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const days = useMemo(() => Array.from({ length: range }, (_, i) => addDays(chartEndDate, -(range - 1 - i))), [range, chartEndDate]);
  const values = useMemo(() => isFocused ? days.map((d) => {
    if (toDateKey(d) > tKey) return -1;
    const stat = dayStat(list, logs, d);
    return stat.total ? pct(stat) : -1;
  }) : [], [isFocused, days, list, logs, tKey]);
  const labels = useMemo(() => days.map((d) => (range === 7 ? DAY_LABELS[d.getDay()] : String(d.getDate()))), [days, range]);
  const weekTrendDays = weekDays;
  const weekTrendValues = useMemo(() => isFocused ? weekTrendDays.map((day) => {
    if (toDateKey(day) > tKey) return -1;
    const stat = dayStat(list, logs, day);
    return stat.total ? pct(stat) : -1;
  }) : [], [isFocused, weekTrendDays, list, logs, tKey]);
  const weekTrendLabels = useMemo(() => weekTrendDays.map((day) => DAY_LABELS[day.getDay()]), [weekTrendDays]);
  const orderedWeekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => (settings.weekStartsOn + index) % 7), [settings.weekStartsOn]);
  const weekdayLabels = useMemo(() => orderedWeekdays.map((weekday) => DAY_LABELS[weekday]), [orderedWeekdays]);
  const weekdayTotals = useMemo(() => !isFocused ? [] : orderedWeekdays.map((weekday) => {
    const matchingDays = Array.from({ length: 28 }, (_, i) => addDays(now, -i)).filter((day) => day.getDay() === weekday);
    const total = matchingDays.map((day) => dayStat(list, logs, day)).reduce((sum, stat) => ({ done: sum.done + stat.done, total: sum.total + stat.total }), { done: 0, total: 0 });
    return total.total ? total.done / total.total : -1;
  }), [isFocused, list, logs, now, orderedWeekdays]);
  const categoryMix = useMemo(() => {
    if (!isFocused) return [];
    const habitsById = new Map(list.map((habit) => [habit.id, habit]));
    const categoryMap = new Map<string, number>();
    logs.forEach((log) => {
      const habit = habitsById.get(log.habitId);
      if (habit && log.value >= habit.target) {
        const category = habit.category || 'other';
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      }
    });
    const sorted = [...categoryMap.entries()].map(([label, value], index) => ({ label: label[0].toUpperCase() + label.slice(1), value, color: ['#315E53', '#D08C60', '#6B7FA3', '#B36F86', '#8A9A5B', '#8A6CA8'][index % 6] })).sort((a, b) => b.value - a.value);
    return sorted.length > 5 ? [...sorted.slice(0, 4), { label: 'Other', value: sorted.slice(4).reduce((sum, item) => sum + item.value, 0), color: '#89958F' }] : sorted;
  }, [isFocused, list, logs]);
  const nextHabit = useMemo(() => isFocused ? list.find((habit) => !habit.archived && habit.days.includes(now.getDay()) && !isDone(habit, logs, tKey)) : undefined, [isFocused, list, now, logs, tKey]);

  const level = useCallback((key: string) => {
    if (!isFocused) return -1;
    if (key > tKey) return -1;
    const s = dayStat(list, logs, fromDateKey(key));
    return s.total ? s.done / s.total : -1;
  }, [isFocused, list, logs, tKey]);

  const shift = useCallback((n: number) => {
    const d = new Date(cursor.y, cursor.m + n, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  }, [cursor]);

  const ranked = useMemo(() => isFocused ? [...list].sort((a, b) => completionRate(b, logs) - completionRate(a, logs)) : [], [isFocused, list, logs]);
  const filters = useMemo(() => [{ id: 'all', name: 'All Habits' }, ...active.map((h) => ({ id: h.id, name: h.name }))], [active]);
  const monthTrendValues = useMemo(() => isFocused ? Array.from({ length: 30 }, (_, i) => {
    const stat = dayStat(list, logs, addDays(now, i - 29));
    return stat.total ? pct(stat) : -1;
  }) : [], [isFocused, list, logs, now]);
  const monthTrendLabels = useMemo(() => [0, 14, 29].map((offset) =>
    addDays(now, offset - 29).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  ), [now]);

  if (!isFocused) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  if (active.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <ScreenHeader title="Insights" subtitle="Consistency compounds. Celebrate progress." />
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="analytics-outline" size={32} color={colors.primary} /></View>
          <Text style={styles.emptyTitle}>Insights & Analytics</Text>
          <Text style={[styles.emptySub, { color: colors.muted }]}>Add a habit and start checking in to see your completion rates, heatmaps, and trends.</Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('Habits', { screen: 'HabitForm' })}><Text style={[styles.emptyBtnText, { color: colors.onPrimary }]}>+ Add First Habit</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={100}
        onScroll={(event) => { scrollPosition.current = event.nativeEvent.contentOffset.y; }}
        onContentSizeChange={() => scrollRef.current?.scrollTo({ y: scrollPosition.current, animated: false })}
      >
        {/* Header */}
        <ScreenHeader
          title="Insights"
          subtitle="Consistency compounds. Celebrate progress."
          style={styles.pageHeading}
        />

        <Card onPress={() => nextHabit ? navigation.navigate('Habits', { screen: 'HabitDetail', params: { habitId: nextHabit.id } }) : navigation.navigate('Today')} accessibilityLabel={nextHabit ? `Open ${nextHabit.name}` : 'Review completed habits'} style={[styles.suggestionCard, { backgroundColor: colors.primarySoft }]}>
          <View style={styles.suggestionIcon}><Ionicons name={nextHabit ? 'compass-outline' : 'leaf-outline'} size={20} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.suggestionTitle, { color: colors.text }]}>{nextHabit ? 'A useful next step' : 'A moment to take it in'}</Text>
            <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{nextHabit ? `Try ${nextHabit.name}. A small check-in is enough to keep your day moving.` : 'Your scheduled habits are complete. Notice what helped you follow through today.'}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </Card>

        <Card onPress={() => navigation.navigate('Challenges')} style={styles.challengeLink}>
          <View style={[styles.challengeIcon, { backgroundColor: colors.accentSoft }]}><Ionicons name="trophy-outline" size={18} color={colors.accent} /></View>
          <Text style={[styles.challengeLinkText, { color: colors.text }]}>Milestones & challenges</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Card>

        <Text style={styles.sectionTitle}>Your journey this week</Text>
        <Text style={[styles.chartCaption, { color: colors.muted }]}>Daily completion, based on habits scheduled each day.</Text>
        <Card style={styles.card}>
          <LineTrendChart values={weekTrendValues} labels={weekTrendLabels} />
        </Card>

        {/* Habit Filter Chips */}
        <HorizontalChips style={styles.filterScroll}>
          {filters.map((f) => {
            const isSelected = filter === f.id;
            return <Chip key={f.id} label={f.name} selected={isSelected} onPress={() => setFilter(f.id)} style={styles.chipSpacing} />;
          })}
        </HorizontalChips>

        {/* KPI Grid */}
        <View style={styles.grid}>
          <Card style={styles.statCard}>
            <View style={styles.statIconRow}>
              <Ionicons name="today-outline" size={18} color={colors.primary} />
              <Text style={[styles.statBadge, { color: colors.primary }]}>TODAY</Text>
            </View>
            <Text style={styles.statValue}>{Math.round(pct(today) * 100)}%</Text>
            <Text style={[styles.statLabel, { color: colors.primary }]}>Daily Target</Text>
          </Card>

          <Card style={styles.statCard}>
            <View style={styles.statIconRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={[styles.statBadge, { color: colors.primary }]}>WEEK</Text>
            </View>
            <Text style={styles.statValue}>{weekPct}%</Text>
            <Text style={[styles.statLabel, { color: colors.primary }]}>7-Day Rate</Text>
          </Card>

          <Card style={styles.statCard}>
            <View style={styles.statIconRow}>
              <Ionicons name="flame" size={18} color={colors.primary} />
              <Text style={[styles.statBadge, { color: colors.primary }]}>STREAK</Text>
            </View>
            <Text style={styles.statValue}>{bestNow}d</Text>
            <Text style={[styles.statLabel, { color: colors.primary }]}>Active Record</Text>
          </Card>

          <Card style={styles.statCard}>
            <View style={styles.statIconRow}>
              <Ionicons name="ribbon-outline" size={18} color={colors.primary} />
              <Text style={[styles.statBadge, { color: colors.primary }]}>LEVEL</Text>
            </View>
            <Text numberOfLines={1} style={[styles.levelValue, { color: weeklyLevel.color }]}>{weeklyLevel.label}</Text>
            <Text style={[styles.statLabel, { color: colors.primary }]}>7-Day Pace</Text>
          </Card>
        </View>

        {/* Weekly Matrix Checklist */}
        <Text style={styles.sectionTitle}>Weekly Check-in Matrix</Text>
        <Card style={styles.card}>
          <View style={styles.matrixRow}>
            <View style={styles.nameCol}>
              <Text style={[styles.matrixHeader, { color: colors.muted }]}>HABIT</Text>
            </View>
            {weekDays.map((d) => (
              <Text key={toDateKey(d)} style={[styles.matrixDayCol, { color: colors.muted }]}>
                {DAY_LABELS[d.getDay()][0]}
              </Text>
            ))}
          </View>
          {list.map((h) => (
            <View key={h.id} style={styles.matrixRow}>
              <Text style={[styles.nameCol, { color: colors.text }]} numberOfLines={1}>
                {h.name}
              </Text>
              {weekDays.map((d) => {
                const m = mark(h, d);
                return (
                  <View key={toDateKey(d)} style={styles.matrixStatusCol}>
                    {m === 'done' ? <Ionicons name="checkmark" size={15} color={colors.success} /> : null}
                    {m === 'today' ? <Ionicons name="ellipse-outline" size={14} color={colors.primary} /> : null}
                    {m === 'missed' ? <View style={[styles.missedDot, { backgroundColor: colors.borderStrong }]} /> : null}
                    {m === 'not-applicable' ? <Text style={[styles.matrixDash, { color: colors.mutedText }]}>–</Text> : null}
                  </View>
                );
              })}
            </View>
          ))}
        </Card>

        {/* Completion Bar Chart */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Completion Trend</Text>
          <View style={styles.rangeRow}>
            {([7, 14, 30] as const).map((r) => {
              const active = range === r;
              return <Chip key={r} label={`${r}d`} selected={active} onPress={() => setRange(r)} />;
            })}
          </View>
        </View>
        <Card style={styles.card}>
          <BarChart values={values} labels={labels} color={colors.primary} />
        </Card>

        <Text style={styles.sectionTitle}>Where your check-ins go</Text>
        <Text style={[styles.chartCaption, { color: colors.muted }]}>Completed habits by category across your saved history.</Text>
        <Card style={[styles.card, styles.donutCard]}>
          <DonutChart values={categoryMix} />
        </Card>

        <Text style={styles.sectionTitle}>A wider view</Text>
        <Text style={[styles.chartCaption, { color: colors.muted }]}>Your daily completion rate over the last 30 days.</Text>
        <Card style={styles.card}>
          <AreaTrendChart values={monthTrendValues} labels={monthTrendLabels} />
        </Card>

        <Text style={styles.sectionTitle}>Your week at a glance</Text>
        <Text style={[styles.chartCaption, { color: colors.muted }]}>Average completion by weekday over the last four weeks.</Text>
        <Card style={styles.card}>
          <WeekdayChart values={weekdayTotals} labels={weekdayLabels} />
        </Card>

        {/* Monthly Calendar Heatmap */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Monthly Consistency</Text>
          <View style={styles.monthNavRow}>
            <TouchableOpacity onPress={() => shift(-1)} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {new Date(cursor.y, cursor.m).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            </Text>
            <TouchableOpacity onPress={() => shift(1)} hitSlop={10}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <Card style={styles.card}>
          <Heatmap
            year={cursor.y}
            month={cursor.m}
            weekStartsOn={settings.weekStartsOn}
            color={colors.primary}
            level={level}
          />
        </Card>
        <View style={styles.calendarLegend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.primary }]} /><Text style={[styles.legendText, { color: colors.textSecondary }]}>Done</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.surfaceMuted }]} /><Text style={[styles.legendText, { color: colors.textSecondary }]}>Missed</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, styles.legendToday, { backgroundColor: colors.primary, borderColor: colors.primary }]} /><Text style={[styles.legendText, { color: colors.textSecondary }]}>Today</Text></View>
        </View>

        {/* Consistency Leaderboard */}
        <Text style={styles.sectionTitle}>Habit Consistency (Last 30 Days)</Text>
        {ranked.map((h) => {
          const rate = Math.round(completionRate(h, logs) * 100);
          return (
            <Card
              key={h.id}
              onPress={() =>
                navigation.navigate('Habits', {
                  screen: 'HabitDetail',
                  params: { habitId: h.id },
                })
              }
              style={styles.rankCard}
            >
              <View style={[styles.rankIconTile, { backgroundColor: h.color + '1A' }]}>
                <HabitGlyph icon={h.icon} category={h.category} size={22} />
              </View>
              <View style={styles.rankInfo}>
                <Text style={styles.rankName} numberOfLines={1}>
                  {h.name}
                </Text>
                <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceMuted }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${rate}%`, backgroundColor: h.color },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.rankStreakRow}>
                <Ionicons name="flame-outline" size={13} color={colors.primary} />
                <Text style={[styles.rankStreak, { color: colors.accent }]}>{currentStreak(h, logs, now)}d</Text>
              </View>
              <Text style={styles.rankRate}>{rate}%</Text>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { paddingHorizontal: SCREEN_PADDING, paddingTop: 0, paddingBottom: 64 },
  pageHeading: { marginHorizontal: -SCREEN_PADDING },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySub: { textAlign: 'center', marginTop: 8, fontSize: 13, lineHeight: 20, maxWidth: 280 },
  emptyBtn: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700' },
  filterScroll: { marginBottom: SPACING.md },
  chipSpacing: { marginRight: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.xxl },
  statCard: { width: '48%' },
  statIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  statBadge: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  statValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  levelValue: { fontSize: 16, fontWeight: '800', minHeight: 24, textAlignVertical: 'center' },
  statLabel: { fontSize: 13, marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginTop: SPACING.xxl, marginBottom: SPACING.md },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xxl,
    marginBottom: SPACING.md,
  },
  rangeRow: { flexDirection: 'row', gap: 6 },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthLabel: { fontSize: 13, fontWeight: '700' },
  card: { marginBottom: SPACING.md },
  chartCaption: { fontSize: 12, lineHeight: 17, marginTop: -5, marginBottom: 8 },
  calendarLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 2, marginBottom: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendToday: { borderWidth: 1.5 },
  legendText: { fontSize: 12 },
  donutCard: { alignItems: 'center' },
  suggestionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.md },
  suggestionIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(49,94,83,0.10)', alignItems: 'center', justifyContent: 'center' },
  suggestionTitle: { fontSize: 14, fontWeight: '800' },
  suggestionText: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  challengeLink: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 0, marginBottom: SPACING.xxl },
  challengeIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  challengeLinkText: { flex: 1, fontSize: 13, fontWeight: '700' },
  matrixRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  nameCol: { width: 94, minWidth: 94, marginRight: 12, fontSize: 13, fontWeight: '600' },
  matrixHeader: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  matrixDayCol: { flex: 1, minWidth: 16, textAlign: 'center', fontSize: 14 },
  matrixStatusCol: { flex: 1, minWidth: 16, height: 22, alignItems: 'center', justifyContent: 'center' },
  matrixDash: { fontSize: 14, lineHeight: 18 },
  missedDot: { width: 7, height: 7, borderRadius: 4 },
  rankCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rankIconTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rankInfo: { flex: 1, marginRight: 10 },
  rankName: { fontSize: 14, fontWeight: '700' },
  progressBarBg: { height: 5, borderRadius: 2.5, overflow: 'hidden', marginTop: 5 },
  progressBarFill: { height: '100%', borderRadius: 2.5 },
  rankStreak: { fontSize: 12, fontWeight: '700', marginRight: 10 },
  rankStreakRow: { flexDirection: 'row', alignItems: 'center' },
  rankRate: { fontSize: 14, fontWeight: '800', minWidth: 38, textAlign: 'right' },
});
