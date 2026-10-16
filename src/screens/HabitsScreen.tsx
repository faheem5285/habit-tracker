import { useState, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Themed';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { HabitGlyph } from '../components/HabitGlyph';
import { HabitsStackParams } from '../navigation/types';
import { useHabits, HabitInput } from '../context/HabitContext';
import { DAY_LABELS, formatTime, todayKey } from '../utils/dates';
import { currentStreak, getValue, isDone } from '../utils/streaks';
import { useSettings } from '../context/SettingsContext';
import { EXTRA_TEMPLATES } from '../data/habitTemplates';

type Props = NativeStackScreenProps<HabitsStackParams, 'HabitsList'>;

const TEMPLATES: (HabitInput & { categoryName: string; desc: string })[] = [
  // Health
  {
    name: 'Drink 8 Glasses of Water',
    desc: 'Hydrate your body across the day',
    icon: '💧',
    color: '#06B6D4',
    type: 'count',
    target: 8,
    unit: 'glasses',
    category: 'health',
    categoryName: 'Health',
    timeOfDay: 'any',
    days: [0, 1, 2, 3, 4, 5, 6],
    reminderTimes: ['09:00', '14:00', '19:00'],
  },
  {
    name: '8 Hours of Quality Sleep',
    desc: 'Rest and recover consistently',
    icon: '😴',
    color: '#6366F1',
    type: 'yesno',
    target: 1,
    unit: 'times',
    category: 'health',
    categoryName: 'Health',
    timeOfDay: 'evening',
    days: [0, 1, 2, 3, 4, 5, 6],
    reminderTimes: ['22:30'],
  },
  {
    name: 'Eat a Healthy Clean Meal',
    desc: 'Fuel your energy with whole foods',
    icon: '🥗',
    color: '#10B981',
    type: 'yesno',
    target: 1,
    unit: 'times',
    category: 'health',
    categoryName: 'Health',
    timeOfDay: 'afternoon',
    days: [0, 1, 2, 3, 4, 5, 6],
    reminderTimes: ['12:30'],
  },

  // Fitness
  {
    name: 'Daily 10,000 Steps',
    desc: 'Stay active and hit your daily movement goal',
    icon: '🏃',
    color: '#F97316',
    type: 'yesno',
    target: 1,
    unit: 'times',
    category: 'fitness',
    categoryName: 'Fitness',
    timeOfDay: 'any',
    days: [0, 1, 2, 3, 4, 5, 6],
    reminderTimes: ['17:00'],
  },
  {
    name: 'Full Body Workout',
    desc: 'Build strength and endurance',
    icon: '💪',
    color: '#EF4444',
    type: 'yesno',
    target: 1,
    unit: 'times',
    category: 'fitness',
    categoryName: 'Fitness',
    timeOfDay: 'morning',
    days: [1, 2, 3, 4, 5],
    reminderTimes: ['07:00'],
  },
  {
    name: 'Morning Stretching & Mobility',
    desc: 'Relieve stiffness and improve posture',
    icon: '🧘',
    color: '#8B5CF6',
    type: 'yesno',
    target: 1,
    unit: 'times',
    category: 'fitness',
    categoryName: 'Fitness',
    timeOfDay: 'morning',
    days: [0, 1, 2, 3, 4, 5, 6],
    reminderTimes: ['07:30'],
  },

  // Mindfulness & Spirit
  {
    name: '10 Minutes Meditation',
    desc: 'Clear mental clutter and find calm',
    icon: '🧘',
    color: '#8B5CF6',
    type: 'yesno',
    target: 1,
    unit: 'times',
    category: 'mind',
    categoryName: 'Mindfulness',
    timeOfDay: 'morning',
    days: [0, 1, 2, 3, 4, 5, 6],
    reminderTimes: ['08:00'],
  },
  {
    name: 'Daily Prayers / Gratitude',
    desc: 'Pause for spiritual peace and thankfulness',
    icon: '🕌',
    color: '#10B981',
    type: 'count',
    target: 5,
    unit: 'times',
    category: 'mind',
    categoryName: 'Mindfulness',
    timeOfDay: 'any',
    days: [0, 1, 2, 3, 4, 5, 6],
    reminderTimes: ['06:00', '13:00', '17:00', '19:00', '21:00'],
  },
  {
    name: 'Evening Reflection & Gratitude',
    desc: 'Write 3 things you are grateful for',
    icon: '✍️',
    color: '#F59E0B',
    type: 'yesno',
    target: 1,
    unit: 'times',
    category: 'mind',
    categoryName: 'Mindfulness',
    timeOfDay: 'evening',
    days: [0, 1, 2, 3, 4, 5, 6],
    reminderTimes: ['21:30'],
  },

  // Productivity & Learning
  {
    name: 'Read 20 Pages of a Book',
    desc: 'Expand your mind and knowledge daily',
    icon: '📖',
    color: '#EC4899',
    type: 'yesno',
    target: 1,
    unit: 'pages',
    category: 'learning',
    categoryName: 'Learning',
    timeOfDay: 'evening',
    days: [0, 1, 2, 3, 4, 5, 6],
    reminderTimes: ['21:00'],
  },
  {
    name: 'Deep Work Session (90 Mins)',
    desc: 'Focus without distraction on your highest priority',
    icon: '🎯',
    color: '#6366F1',
    type: 'count',
    target: 2,
    unit: 'sessions',
    category: 'productivity',
    categoryName: 'Productivity',
    timeOfDay: 'morning',
    days: [1, 2, 3, 4, 5],
    reminderTimes: ['09:30'],
  },
  { name: 'Learn a New Skill', desc: 'Make steady progress with a focused 20-minute practice.', icon: '🎓', color: '#0EA5E9', type: 'yesno', target: 1, unit: 'session', category: 'learning', categoryName: 'Learning', timeOfDay: 'evening', days: [0, 1, 2, 3, 4, 5, 6], reminderTimes: ['19:00'] },
  { name: 'Write One Page', desc: 'Build a clear, consistent writing practice.', icon: '✍️', color: '#8B5CF6', type: 'yesno', target: 1, unit: 'page', category: 'productivity', categoryName: 'Productivity', timeOfDay: 'morning', days: [1, 2, 3, 4, 5], reminderTimes: ['08:30'] },
  { name: 'Take a Mindful Break', desc: 'Pause, breathe, and reset your attention.', icon: '🌿', color: '#14B8A6', type: 'yesno', target: 1, unit: 'break', category: 'mind', categoryName: 'Mindfulness', timeOfDay: 'afternoon', days: [0, 1, 2, 3, 4, 5, 6], reminderTimes: ['15:00'] },
  { name: 'Save a Little', desc: 'Record a small amount set aside for your goals.', icon: '💰', color: '#22C55E', type: 'yesno', target: 1, unit: 'deposit', category: 'other', categoryName: 'Financial Wellness', timeOfDay: 'evening', days: [1, 2, 3, 4, 5], reminderTimes: ['18:00'] },
  { name: 'Plan Tomorrow', desc: 'Choose one priority to make your next day clearer.', icon: '🗓️', color: '#F97316', type: 'yesno', target: 1, unit: 'plan', category: 'productivity', categoryName: 'Personal Growth', timeOfDay: 'evening', days: [0, 1, 2, 3, 4, 5, 6], reminderTimes: ['20:30'] },
  { name: 'Practice Self-Discipline', desc: 'Complete one small task before reaching for a distraction.', icon: '🎯', color: '#EF4444', type: 'yesno', target: 1, unit: 'practice', category: 'other', categoryName: 'Discipline', timeOfDay: 'morning', days: [1, 2, 3, 4, 5], reminderTimes: ['09:00'] },
];

const scheduleText = (days: number[]) =>
  days.length === 7 ? 'Every day' : days.map((day) => DAY_LABELS[day]).join(' · ');

const TEMPLATE_LIBRARY = [...TEMPLATES, ...EXTRA_TEMPLATES];

export default function HabitsScreen({ navigation }: Props) {
  const { habits, logs, deleteHabit, toggleHabit, incrementHabit } = useHabits();
  const { colors } = useSettings();

  const [activeTab, setActiveTab] = useState<'habits' | 'templates'>('habits');
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('All');
  const [templateSort, setTemplateSort] = useState<'Recommended' | 'AZ'>('Recommended');
  const today = new Date();
  const todayDateKey = todayKey();

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const archivedHabits = useMemo(() => habits.filter((h) => h.archived), [habits]);

  const displayedHabits = useMemo(() => {
    const list = showArchived ? archivedHabits : activeHabits;
    if (!search.trim()) return list;
    return list.filter((h) =>
      h.name.toLowerCase().includes(search.toLowerCase().trim())
    );
  }, [showArchived, archivedHabits, activeHabits, search]);

  const displayedTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = TEMPLATE_LIBRARY.filter((item) =>
      (templateCategory === 'All' || item.categoryName === templateCategory) &&
      (!query || `${item.name} ${item.desc} ${item.categoryName}`.toLowerCase().includes(query))
    );
    return templateSort === 'AZ' ? [...matches].sort((a, b) => a.name.localeCompare(b.name)) : matches;
  }, [search, templateCategory, templateSort]);

  const confirmDelete = (id: string, name: string) => {
    Alert.alert('Delete Habit', `Are you sure you want to delete "${name}"? This will delete its history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHabit(id);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not delete habit.');
          }
        },
      },
    ]);
  };

  const handleAddTemplate = (template: HabitInput) => {
    navigation.navigate('HabitForm', { template });
  };

  const previewTemplate = (item: (typeof TEMPLATE_LIBRARY)[number]) => Alert.alert(
    item.name,
    `${item.desc}\n\n${item.categoryName} · ${item.target} ${item.unit || 'check-in'}${item.type === 'count' ? ' per day' : ''}\n${scheduleText(item.days)} · ${item.days.length >= 6 ? 'Gentle start' : 'Focused'}\n\nExpected benefit: ${item.desc} Start small and adjust the target to fit your routine.`,
    [{ text: 'Close', style: 'cancel' }, { text: 'Add this habit', onPress: () => { void handleAddTemplate(item); } }]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR ROUTINE</Text>
            <Text style={styles.title}>Habit Hub</Text>
          </View>

          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('HabitForm')}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addBtnText}>New Habit</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Switcher: My Habits vs Template Library */}
        <View style={[styles.segmentedBar, { backgroundColor: colors.surfaceMuted }]}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'habits' && { backgroundColor: colors.surface },
            ]}
            onPress={() => setActiveTab('habits')}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'habits' ? colors.text : colors.muted },
              ]}
            >
              My Habits ({activeHabits.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'templates' && { backgroundColor: colors.surface },
            ]}
            onPress={() => setActiveTab('templates')}
          >
            <Ionicons name="library-outline" size={15} color={activeTab === 'templates' ? colors.primary : colors.muted} />
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'templates' ? colors.primary : colors.muted },
                activeTab === 'templates' && { fontWeight: '700' },
              ]}
            >
              Templates Library
            </Text>
          </TouchableOpacity>
        </View>

        {(activeTab === 'habits' || activeTab === 'templates') && (
          <>
            {/* Search Input */}
            <View
              style={[
                styles.searchWrap,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="search" size={18} color={colors.primary} />
              <TextInput
                placeholder={activeTab === 'habits' ? 'Search your habits...' : 'Search templates...'}
                placeholderTextColor={colors.muted}
                value={search}
                onChangeText={setSearch}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {!!search && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Active vs Archived Sub-toggle */}
            {activeTab === 'habits' && <>
            <View style={styles.subFilterRow}>
              <TouchableOpacity
                style={[
                  styles.subFilterPill,
                  !showArchived && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                ]}
                onPress={() => setShowArchived(false)}
              >
                <Text
                  style={[
                    styles.subFilterText,
                    { color: !showArchived ? colors.primary : colors.muted },
                  ]}
                >
                  Active ({activeHabits.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.subFilterPill,
                  showArchived && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
                ]}
                onPress={() => setShowArchived(true)}
              >
                <Text
                  style={[
                    styles.subFilterText,
                    { color: showArchived ? colors.primary : colors.muted },
                  ]}
                >
                  Archived ({archivedHabits.length})
                </Text>
              </TouchableOpacity>
            </View>
            </>}
          </>
        )}
      </View>

      {/* Content */}
      {activeTab === 'habits' ? (
        <FlatList
          data={displayedHabits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View
              style={[
                styles.habitCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <TouchableOpacity activeOpacity={0.8} style={styles.habitMain} onPress={() => navigation.navigate('HabitDetail', { habitId: item.id })}>
                <View style={[styles.iconWrap, { backgroundColor: item.color + '1A' }]}>
                  <HabitGlyph icon={item.icon} category={item.category} name={item.name} />
                </View>

              <View style={styles.cardDetails}>
                <Text style={styles.habitName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.habitSchedule, { color: colors.muted }]} numberOfLines={1}>
                  {item.type === 'count' ? `${item.target} ${item.unit || 'times'} a day` : 'Daily check-in'} · {scheduleText(item.days)}
                </Text>
                {!item.archived && (
                  <View style={styles.habitProgressRow}>
                    <Ionicons name="flame" size={12} color={colors.primary} />
                    <Text style={[styles.habitProgressText, { color: colors.accent }]}>{currentStreak(item, logs, today)} day streak</Text>
                    <Text style={[styles.habitProgressText, { color: colors.muted }]}>
                      {item.type === 'count' ? `${getValue(logs, item.id, todayDateKey)}/${item.target} today` : isDone(item, logs, todayDateKey) ? 'Done today' : 'Ready for today'}
                    </Text>
                  </View>
                )}

                {item.reminderTimes.length > 0 && (
                  <View style={styles.reminderRow}>
                    <Ionicons name="notifications-outline" size={12} color={colors.primary} />
                    <Text style={[styles.reminderText, { color: colors.primary }]}>
                      {item.reminderTimes.map(formatTime).join(', ')}
                    </Text>
                  </View>
                )}
              </View>
              </TouchableOpacity>

              {!item.archived && <TouchableOpacity
                style={[styles.deleteBtn, !item.archived && { backgroundColor: colors.primarySoft, borderRadius: 10 }]}
                accessibilityRole="button"
                accessibilityLabel={item.type === 'count' ? `Add one ${item.unit || 'count'} to ${item.name}` : `${isDone(item, logs, todayDateKey) ? 'Undo' : 'Complete'} ${item.name} for today`}
                onPress={() => item.type === 'count' ? incrementHabit(item.id, todayDateKey) : toggleHabit(item.id, todayDateKey)}
                hitSlop={8}
              >
                {item.type === 'count' ? (
                  <Ionicons name="add" size={19} color={colors.primary} />
                ) : (
                  <HabitGlyph icon={item.icon} category={item.category} name={item.name} size={19} />
                )}
              </TouchableOpacity>}

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => confirmDelete(item.id, item.name)}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={[styles.emptyWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons
                name={showArchived ? 'archive-outline' : 'sparkles-outline'}
                size={36}
                color={colors.primary}
              />
              <Text style={styles.emptyTitle}>
                {showArchived
                  ? 'No archived habits'
                  : search
                  ? 'No habits match your search'
                  : 'No habits created yet'}
              </Text>
              <Text style={[styles.emptySub, { color: colors.muted }]}>
                {showArchived
                  ? 'Habits you pause will appear here.'
                  : 'Start by creating your first habit or pick a ready template!'}
              </Text>
              {!showArchived && (
                <TouchableOpacity
                  style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
                  onPress={() => navigation.navigate('HabitForm')}
                >
                  <Text style={styles.emptyAddBtnText}>+ Create a Habit</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      ) : (
        <>
        {/* Template Library List */}
        <View style={styles.templateFilters}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['All', ...Array.from(new Set(TEMPLATE_LIBRARY.map((item) => item.categoryName)))]}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setTemplateCategory(item)}
                style={[styles.subFilterPill, { backgroundColor: templateCategory === item ? colors.primarySoft : colors.surface, borderColor: templateCategory === item ? colors.primary : colors.border }]}
              >
                <Text style={[styles.subFilterText, { color: templateCategory === item ? colors.primary : colors.muted }]}>{item}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
          />
          <TouchableOpacity onPress={() => setTemplateSort((sort) => sort === 'Recommended' ? 'AZ' : 'Recommended')} style={styles.sortButton}>
            <Ionicons name="swap-vertical" size={14} color={colors.primary} />
            <Text style={[styles.sortText, { color: colors.primary }]}>{templateSort}</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={displayedTemplates}
          keyExtractor={(t) => t.name}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={[styles.emptySub, { color: colors.muted }]}>No templates match this search. Try another category or phrase.</Text>}
          renderItem={({ item }) => (
            <View
              style={[
                styles.templateCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: item.color + '1A' }]}>
                <HabitGlyph icon={item.icon} category={item.category} name={item.name} />
              </View>

              <View style={styles.cardDetails}>
                <View style={styles.templateBadge}>
                  <Text style={[styles.templateBadgeText, { color: item.color }]}>
                    {item.categoryName.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.habitName}>{item.name}</Text>
                <Text style={[styles.templateDesc, { color: colors.muted }]}>{item.desc}</Text>
                <Text style={[styles.templateMeta, { color: colors.muted }]}>{scheduleText(item.days)} · {item.type === 'count' ? `${item.target} ${item.unit || 'times'}/day` : 'Daily check-in'} · {item.days.length >= 6 ? 'Gentle start' : 'Focused'}</Text>
                <TouchableOpacity onPress={() => previewTemplate(item)}><Text style={[styles.previewLink, { color: colors.primary }]}>Preview details</Text></TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.addTemplateBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleAddTemplate(item)}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.addTemplateBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
        />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10 },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  segmentedBar: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 11,
  },
  segmentText: { fontSize: 13, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  subFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  subFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  subFilterText: { fontSize: 12, fontWeight: '600' },
  listContent: { paddingHorizontal: 18, paddingBottom: 40, paddingTop: 6 },
  templateFilters: { paddingHorizontal: 18, paddingBottom: 2 },
  sortButton: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 5 },
  sortText: { fontSize: 11, fontWeight: '700' },
  habitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 10,
  },
  habitMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 24 },
  cardDetails: { flex: 1, minWidth: 0 },
  habitName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  habitSchedule: { fontSize: 12, marginTop: 3 },
  habitProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  habitProgressText: { fontSize: 10, fontWeight: '700' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  reminderText: { fontSize: 11, fontWeight: '600' },
  deleteBtn: { padding: 6, marginLeft: 8 },
  emptyWrap: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 10 },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 4, maxWidth: 260 },
  emptyAddBtn: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  emptyAddBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  templateBadge: { alignSelf: 'flex-start', marginBottom: 2 },
  templateBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  templateDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  templateMeta: { fontSize: 10, marginTop: 5 },
  previewLink: { fontSize: 11, fontWeight: '700', marginTop: 6 },
  addTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginLeft: 8,
  },
  addTemplateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
});
