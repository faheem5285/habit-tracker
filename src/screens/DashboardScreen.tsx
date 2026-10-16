import { useState, useMemo, useCallback, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/Themed';
import BarChart from '../components/BarChart';
import Heatmap from '../components/Heatmap';
import { AreaTrendChart, DonutChart, LineTrendChart, WeekdayChart } from '../components/InsightCharts';
import { useHabits } from '../context/HabitContext';
import { useSettings } from '../context/SettingsContext';
import { Habit } from '../types';
import { DAY_LABELS, addDays, fromDateKey, toDateKey, todayKey } from '../utils/dates';
import { completionRate, currentStreak, dayStat, isDone, isScheduled, pct } from '../utils/streaks';

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
  const getConsistencyGrade = (p: number) => {
    if (p >= 90) return { grade: 'A+', label: 'Elite', color: colors.success };
    if (p >= 80) return { grade: 'A', label: 'Strong', color: colors.primary };
    if (p >= 65) return { grade: 'B', label: 'Consistent', color: colors.cyan };
    if (p >= 50) return { grade: 'C', label: 'Building', color: colors.accent };
    return { grade: 'D', label: 'Starting Out', color: colors.muted };
  };
  const gradeInfo = getConsistencyGrade(weekPct);

  // Week matrix
  const weekStart = useMemo(() => addDays(now, -((now.getDay() - settings.weekStartsOn + 7) % 7)), [now, settings.weekStartsOn]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const mark = (h: Habit, d: Date) => {
    const key = toDateKey(d);
    if (key > tKey) return '';
    if (!isScheduled(h, d)) return '–';
    return isDone(h, logs, key) ? '✓' : '✗';
  };

  // Completion bar chart
  const days = useMemo(() => Array.from({ length: range }, (_, i) => addDays(now, -(range - 1 - i))), [range, now]);
  const values = useMemo(() => isFocused ? days.map((d) => { const stat = dayStat(list, logs, d); return stat.total ? pct(stat) : -1; }) : [], [isFocused, days, list, logs]);
  const labels = useMemo(() => days.map((d) => (range === 7 ? DAY_LABELS[d.getDay()] : String(d.getDate()))), [days, range]);
  const weekTrendDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(now, i - 6)), [now]);
  const weekTrendValues = useMemo(() => isFocused ? weekTrendDays.map((day) => { const stat = dayStat(list, logs, day); return stat.total ? pct(stat) : -1; }) : [], [isFocused, weekTrendDays, list, logs]);
  const weekTrendLabels = useMemo(() => weekTrendDays.map((day) => DAY_LABELS[day.getDay()]), [weekTrendDays]);
  const weekdayTotals = useMemo(() => !isFocused ? [] : DAY_LABELS.map((_, weekday) => {
    const matchingDays = Array.from({ length: 28 }, (_, i) => addDays(now, -i)).filter((day) => day.getDay() === weekday);
    const total = matchingDays.map((day) => dayStat(list, logs, day)).reduce((sum, stat) => ({ done: sum.done + stat.done, total: sum.total + stat.total }), { done: 0, total: 0 });
    return total.total ? total.done / total.total : -1;
  }), [isFocused, list, logs, now]);
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
  const filters = useMemo(() => [{ id: 'all', name: 'All Habits' }, ...active.map((h) => ({ id: h.id, name: `${h.icon} ${h.name}` }))], [active]);
  const monthTrendValues = useMemo(() => isFocused ? Array.from({ length: 30 }, (_, i) => {
    const stat = dayStat(list, logs, addDays(now, i - 29));
    return stat.total ? pct(stat) : -1;
  }) : [], [isFocused, list, logs, now]);

  if (!isFocused) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  if (active.length === 0) {
    return (
      <SafeAreaView style={[styles.emptyState, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="analytics-outline" size={32} color={colors.primary} /></View>
        <Text style={styles.emptyTitle}>Insights & Analytics</Text>
        <Text style={[styles.emptySub, { color: colors.muted }]}>Add a habit and start checking in to see your completion rates, heatmaps, and trends.</Text>
        <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('Habits', { screen: 'HabitForm' })}><Text style={styles.emptyBtnText}>+ Add First Habit</Text></TouchableOpacity>
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
        <View style={styles.pageHeading}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>EFFORT & MOMENTUM</Text>
          <Text style={styles.title}>Analytics & Insights</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Consistency compounds over time. Celebrate your showing up.
          </Text>
        </View>

        <TouchableOpacity activeOpacity={0.78} accessibilityRole="button" accessibilityLabel={nextHabit ? `Open ${nextHabit.name}` : 'Review completed habits'} onPress={() => nextHabit ? navigation.navigate('Habits', { screen: 'HabitDetail', params: { habitId: nextHabit.id } }) : navigation.navigate('Today')} style={[styles.suggestionCard, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
          <View style={styles.suggestionIcon}><Ionicons name={nextHabit ? 'compass-outline' : 'leaf-outline'} size={20} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.suggestionTitle, { color: colors.text }]}>{nextHabit ? 'A useful next step' : 'A moment to take it in'}</Text>
            <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{nextHabit ? `Try ${nextHabit.name}. A small check-in is enough to keep your day moving.` : 'Your scheduled habits are complete. Notice what helped you follow through today.'}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Your journey this week</Text>
        <Text style={[styles.chartCaption, { color: colors.muted }]}>Daily completion, based on habits scheduled each day.</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LineTrendChart values={weekTrendValues} labels={weekTrendLabels} />
        </View>

        {/* Habit Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {filters.map((f) => {
            const isSelected = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFilter(f.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                    isSelected && { fontWeight: '700' },
                  ]}
                >
                  {f.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* KPI Grid */}
        <View style={styles.grid}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statIconRow}>
              <Ionicons name="today-outline" size={18} color={colors.primary} />
              <Text style={[styles.statBadge, { color: colors.primary }]}>TODAY</Text>
            </View>
            <Text style={styles.statValue}>{Math.round(pct(today) * 100)}%</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Daily Target</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statIconRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.success} />
              <Text style={[styles.statBadge, { color: colors.success }]}>WEEK</Text>
            </View>
            <Text style={styles.statValue}>{weekPct}%</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>7-Day Rate</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statIconRow}>
              <Ionicons name="flame" size={18} color={colors.accent} />
              <Text style={[styles.statBadge, { color: colors.accent }]}>STREAK</Text>
            </View>
            <Text style={styles.statValue}>{bestNow}d</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Active Record</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statIconRow}>
              <Ionicons name="ribbon-outline" size={18} color={gradeInfo.color} />
              <Text style={[styles.statBadge, { color: gradeInfo.color }]}>GRADE</Text>
            </View>
            <Text style={[styles.statValue, { color: gradeInfo.color }]}>{gradeInfo.grade}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>{gradeInfo.label} Pace</Text>
          </View>
        </View>

        {/* Weekly Matrix Checklist */}
        <Text style={styles.sectionTitle}>Weekly Check-in Matrix</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
              <Text style={styles.nameCol} numberOfLines={1}>
                {h.icon} {h.name}
              </Text>
              {weekDays.map((d) => {
                const m = mark(h, d);
                return (
                  <Text
                    key={toDateKey(d)}
                    style={[
                      styles.matrixDayCol,
                      {
                        color:
                          m === '✓'
                            ? colors.success
                            : m === '✗'
                            ? colors.danger
                            : colors.muted,
                        fontWeight: m === '✓' ? '800' : '500',
                      },
                    ]}
                  >
                    {m}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>

        {/* Completion Bar Chart */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Completion Trend</Text>
          <View style={styles.rangeRow}>
            {([7, 14, 30] as const).map((r) => {
              const active = range === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.rangePill,
                    {
                      backgroundColor: active ? colors.primary : colors.surfaceMuted,
                    },
                  ]}
                  onPress={() => setRange(r)}
                >
                  <Text
                    style={[
                      styles.rangePillText,
                      { color: active ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    {r}d
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <BarChart values={values} labels={labels} color={colors.primary} />
        </View>

        <Text style={styles.sectionTitle}>Where your check-ins go</Text>
        <Text style={[styles.chartCaption, { color: colors.muted }]}>Completed habits by category across your saved history.</Text>
        <View style={[styles.card, styles.donutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <DonutChart values={categoryMix} />
        </View>

        <Text style={styles.sectionTitle}>A wider view</Text>
        <Text style={[styles.chartCaption, { color: colors.muted }]}>Your daily completion rate over the last 30 days.</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AreaTrendChart values={monthTrendValues} />
        </View>

        <Text style={styles.sectionTitle}>Your week at a glance</Text>
        <Text style={[styles.chartCaption, { color: colors.muted }]}>Average completion by weekday over the last four weeks.</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <WeekdayChart values={weekdayTotals} labels={DAY_LABELS} />
        </View>

        {/* Monthly Calendar Heatmap */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Monthly Consistency</Text>
          <View style={styles.monthNavRow}>
            <TouchableOpacity onPress={() => shift(-1)} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={colors.muted} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {new Date(cursor.y, cursor.m).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            </Text>
            <TouchableOpacity onPress={() => shift(1)} hitSlop={10}>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Heatmap
            year={cursor.y}
            month={cursor.m}
            weekStartsOn={settings.weekStartsOn}
            color={colors.primary}
            level={level}
          />
        </View>

        {/* Consistency Leaderboard */}
        <Text style={styles.sectionTitle}>Habit Consistency (Last 30 Days)</Text>
        {ranked.map((h) => {
          const rate = Math.round(completionRate(h, logs) * 100);
          return (
            <TouchableOpacity
              key={h.id}
              activeOpacity={0.85}
              style={[
                styles.rankCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() =>
                navigation.navigate('Habits', {
                  screen: 'HabitDetail',
                  params: { habitId: h.id },
                })
              }
            >
              <Text style={styles.rankIcon}>{h.icon}</Text>
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
              <Text style={[styles.rankStreak, { color: colors.accent }]}>
                🔥 {currentStreak(h, logs, now)}d
              </Text>
              <Text style={styles.rankRate}>{rate}%</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 50 },
  pageHeading: { marginBottom: 14 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 20, fontWeight: '800' },
  emptySub: { textAlign: 'center', marginTop: 8, fontSize: 13, lineHeight: 20, maxWidth: 280 },
  emptyBtn: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700' },
  filterScroll: { marginBottom: 14 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { width: '48%', borderWidth: 1.5, borderRadius: 18, padding: 14 },
  statIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  statBadge: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  statValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginTop: 10, marginBottom: 10 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 10,
  },
  rangeRow: { flexDirection: 'row', gap: 6 },
  rangePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  rangePillText: { fontSize: 11, fontWeight: '700' },
  monthNavRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthLabel: { fontSize: 13, fontWeight: '700' },
  card: { borderWidth: 1.5, borderRadius: 20, padding: 16, marginBottom: 14 },
  chartCaption: { fontSize: 12, lineHeight: 17, marginTop: -5, marginBottom: 8 },
  donutCard: { alignItems: 'center', paddingVertical: 12 },
  suggestionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 18 },
  suggestionIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(49,94,83,0.10)', alignItems: 'center', justifyContent: 'center' },
  suggestionTitle: { fontSize: 14, fontWeight: '800' },
  suggestionText: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  matrixRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  nameCol: { width: 120, fontSize: 13, fontWeight: '600' },
  matrixHeader: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  matrixDayCol: { flex: 1, textAlign: 'center', fontSize: 14 },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  rankIcon: { fontSize: 24, marginRight: 10 },
  rankInfo: { flex: 1, marginRight: 10 },
  rankName: { fontSize: 14, fontWeight: '700' },
  progressBarBg: { height: 5, borderRadius: 2.5, overflow: 'hidden', marginTop: 5 },
  progressBarFill: { height: '100%', borderRadius: 2.5 },
  rankStreak: { fontSize: 12, fontWeight: '700', marginRight: 10 },
  rankRate: { fontSize: 14, fontWeight: '800', minWidth: 38, textAlign: 'right' },
});
