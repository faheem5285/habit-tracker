import { useState, useMemo } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../../../components/Themed';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { HabitGlyph } from '../components/HabitGlyph';
import { HabitsStackParams } from '../../../navigation/types';
import { useHabits, HabitInput } from '../../../context/HabitContext';
import { DAY_LABELS, formatTime, todayKey } from '../../../utils/dates';
import { currentStreak, getValue, isDone } from '../../../utils/streaks';
import { useSettings } from '../../../context/SettingsContext';
import { appCopy } from '../../../copy';
import { EXTRA_TEMPLATES } from '../data/habitTemplates';
import ScreenHeader from '../../../components/ScreenHeader';
import AddHabitFab from '../../../components/AddHabitFab';
import HorizontalChips from '../../../components/HorizontalChips';
import EmptyState from '../../../components/EmptyState';
import SegmentedControl from '../../../components/SegmentedControl';
import Chip from '../../../components/Chip';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
import { SCREEN_PADDING, SPACING } from '../../../ui';

type Props = NativeStackScreenProps<HabitsStackParams, 'HabitsList'>;
type HabitTemplate = Omit<HabitInput, 'icon'> & {
  icon: keyof typeof Ionicons.glyphMap;
  categoryName: string;
  desc: string;
};

const TEMPLATES: HabitTemplate[] = [
  // Health
  {
    name: 'Drink 8 Glasses of Water',
    desc: 'Hydrate your body across the day',
    icon: 'water-outline',
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
    icon: 'bed-outline',
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
    icon: 'restaurant-outline',
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
    icon: 'walk-outline',
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
    icon: 'barbell-outline',
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
    icon: 'body-outline',
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
    icon: 'leaf-outline',
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
    icon: 'heart-outline',
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
    icon: 'create-outline',
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
    icon: 'book-outline',
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
    icon: 'flash-outline',
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
  { name: 'Learn a New Skill', desc: 'Make steady progress with a focused 20-minute practice.', icon: 'school-outline', color: '#0EA5E9', type: 'yesno', target: 1, unit: 'session', category: 'learning', categoryName: 'Learning', timeOfDay: 'evening', days: [0, 1, 2, 3, 4, 5, 6], reminderTimes: ['19:00'] },
  { name: 'Write One Page', desc: 'Build a clear, consistent writing practice.', icon: 'create-outline', color: '#8B5CF6', type: 'yesno', target: 1, unit: 'page', category: 'productivity', categoryName: 'Productivity', timeOfDay: 'morning', days: [1, 2, 3, 4, 5], reminderTimes: ['08:30'] },
  { name: 'Take a Mindful Break', desc: 'Pause, breathe, and reset your attention.', icon: 'leaf-outline', color: '#14B8A6', type: 'yesno', target: 1, unit: 'break', category: 'mind', categoryName: 'Mindfulness', timeOfDay: 'afternoon', days: [0, 1, 2, 3, 4, 5, 6], reminderTimes: ['15:00'] },
  { name: 'Save a Little', desc: 'Record a small amount set aside for your goals.', icon: 'cash-outline', color: '#22C55E', type: 'yesno', target: 1, unit: 'deposit', category: 'other', categoryName: 'Financial Wellness', timeOfDay: 'evening', days: [1, 2, 3, 4, 5], reminderTimes: ['18:00'] },
  { name: 'Plan Tomorrow', desc: 'Choose one priority to make your next day clearer.', icon: 'calendar-outline', color: '#F97316', type: 'yesno', target: 1, unit: 'plan', category: 'productivity', categoryName: 'Personal Growth', timeOfDay: 'evening', days: [0, 1, 2, 3, 4, 5, 6], reminderTimes: ['20:30'] },
  { name: 'Practice Self-Discipline', desc: 'Complete one small task before reaching for a distraction.', icon: 'checkmark-circle-outline', color: '#EF4444', type: 'yesno', target: 1, unit: 'practice', category: 'other', categoryName: 'Discipline', timeOfDay: 'morning', days: [1, 2, 3, 4, 5], reminderTimes: ['09:00'] },
];

const scheduleText = (days: number[]) =>
  days.length === 7 ? 'Every day' : days.map((day) => DAY_LABELS[day]).join(' · ');

const TEMPLATE_LIBRARY = [...TEMPLATES, ...EXTRA_TEMPLATES];

export default function HabitsScreen({ navigation }: Props) {
  const { habits, logs, addHabit, setHabitArchived, deleteHabit } = useHabits();
  const { colors } = useSettings();

  const [activeTab, setActiveTab] = useState<'habits' | 'templates'>('habits');
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('All');
  const [templateSort, setTemplateSort] = useState<'Recommended' | 'AZ'>('Recommended');
  const [selectedTemplate, setSelectedTemplate] = useState<(typeof TEMPLATE_LIBRARY)[number] | null>(null);
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

  const templateForToday = (template: HabitInput): HabitInput => ({
    ...template,
    days: Array.from(new Set([...template.days, new Date().getDay()])).sort(),
  });

  const addTemplate = async (template: HabitInput) => {
    try {
      await addHabit(templateForToday(template));
      setSelectedTemplate(null);
    } catch (error) {
      Alert.alert('Could not add habit', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const chooseTemplateAction = (template: (typeof TEMPLATE_LIBRARY)[number]) => setSelectedTemplate(template);

  const previewTemplate = (item: (typeof TEMPLATE_LIBRARY)[number]) => setSelectedTemplate(item);

  const confirmDelete = (habitId: string, name: string) => Alert.alert(
    'Delete habit?',
    `Delete "${name}" and its history? This cannot be undone.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteHabit(habitId).catch((error) => {
            Alert.alert('Could not delete habit', error instanceof Error ? error.message : 'Please try again.');
          });
        },
      },
    ]
  );

  const toggleArchive = (habit: (typeof habits)[number]) => {
    void setHabitArchived(habit.id, !habit.archived).catch((error) => {
      Alert.alert(habit.archived ? 'Could not restore habit' : 'Could not archive habit', error instanceof Error ? error.message : 'Please try again.');
    });
  };
  const searchField = (
    <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="search" size={18} color={colors.primary} />
      <TextField
        accessibilityLabel={activeTab === 'habits' ? 'Search habits' : 'Search templates'}
        placeholder={activeTab === 'habits' ? 'Search your habits...' : 'Search templates...'}
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
      />
      {!!search && (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
  const habitsListHeader = (
    <View>
      {searchField}
      <View style={styles.subFilterRow}>
        <Chip label={`Active (${activeHabits.length})`} selected={!showArchived} onPress={() => setShowArchived(false)} />
        <Chip label={`Archived (${archivedHabits.length})`} selected={showArchived} onPress={() => setShowArchived(true)} />
      </View>
    </View>
  );
  const templatesListHeader = (
    <View>
      {searchField}
      <View style={styles.templateFilters}>
        <HorizontalChips>
          {['All', ...Array.from(new Set(TEMPLATE_LIBRARY.map((item) => item.categoryName)))].map((item) => (
            <Chip key={item} label={item} selected={templateCategory === item} onPress={() => setTemplateCategory(item)} />
          ))}
        </HorizontalChips>
        <TouchableOpacity onPress={() => setTemplateSort((sort) => sort === 'Recommended' ? 'AZ' : 'Recommended')} style={styles.sortButton}>
          <Ionicons name="swap-vertical" size={14} color={colors.primary} />
          <Text style={[styles.sortText, { color: colors.primary }]}>{templateSort}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const screenHeader = (
    <View style={styles.header}>
      <ScreenHeader title="Habit Hub" style={styles.headerTitleRow} />
      <SegmentedControl
        colors={colors}
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'habits', label: `My habits (${activeHabits.length})` },
          { value: 'templates', label: 'Quick starts', icon: 'library-outline' },
        ]}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Content */}
      {activeTab === 'habits' ? (
        <FlatList
          data={displayedHabits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={<>{screenHeader}{habitsListHeader}</>}
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
                    {currentStreak(item, logs, today) > 0 ? (
                      <>
                        <Ionicons name="flame" size={12} color={colors.accent} />
                        <Text style={[styles.habitProgressText, { color: colors.accent }]}>{currentStreak(item, logs, today)} day streak</Text>
                      </>
                    ) : null}
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
              <View style={styles.cardActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}`}
                  accessibilityHint="Opens the habit editor"
                  onPress={() => navigation.navigate('HabitForm', { habitId: item.id })}
                  activeOpacity={0.72}
                  style={styles.cardActionButton}
                >
                  <Ionicons name="pencil-outline" size={19} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${item.archived ? 'Restore' : 'Archive'} ${item.name}`}
                  accessibilityHint={item.archived ? 'Returns this habit to your active routine' : 'Keeps this habit and its history in Archived'}
                  onPress={() => toggleArchive(item)}
                  activeOpacity={0.72}
                  style={styles.cardActionButton}
                >
                  <Ionicons name={item.archived ? 'arrow-undo-outline' : 'archive-outline'} size={19} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                  accessibilityHint="Permanently deletes this habit and its history after confirmation"
                  onPress={() => confirmDelete(item.id, item.name)}
                  activeOpacity={0.72}
                  style={styles.cardActionButton}
                >
                  <Ionicons name="trash-outline" size={19} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )          }
          ListEmptyComponent={
            <EmptyState
              icon={showArchived ? 'archive-outline' : 'sparkles-outline'}
              title={showArchived ? appCopy.habits.archivedEmptyTitle : search ? 'No habits match your search' : 'No habits created yet'}
              hint={showArchived ? appCopy.habits.archivedEmptyHint : 'Create a habit or choose a ready-made template.'}
              actionLabel={!showArchived ? 'Create a habit' : undefined}
              onAction={!showArchived ? () => navigation.navigate('HabitForm') : undefined}
            />
          }
        />
      ) : (
        <>
        <FlatList
          data={displayedTemplates}
          keyExtractor={(t) => t.name}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={<>{screenHeader}{templatesListHeader}</>}
          ListEmptyComponent={<EmptyState icon="search-outline" title="No matching templates" hint="Try another category or search phrase." />}
          renderItem={({ item }) => (
            <View
              style={[
                styles.templateCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.templateTopRow}>
                <View style={[styles.templateIcon, { backgroundColor: item.color + '1A' }]}>
                  <HabitGlyph icon={item.icon} category={item.category} name={item.name} />
                </View>
                <Text style={[styles.templateBadgeText, { color: colors.primary }]}>
                  {item.categoryName.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.habitName} numberOfLines={2}>{item.name}</Text>
              <Text style={[styles.templateDesc, { color: colors.muted }]} numberOfLines={1}>{item.desc}</Text>
              <Text style={[styles.templateMeta, { color: colors.muted }]} numberOfLines={1}>{scheduleText(item.days)} · {item.type === 'count' ? `${item.target} ${item.unit || 'times'}/day` : 'Daily check-in'} · {item.days.length >= 6 ? 'Gentle start' : 'Focused'}</Text>
              <View style={styles.templateActions}>
                <TouchableOpacity style={styles.previewLinkButton} hitSlop={4} onPress={() => previewTemplate(item)}><Text style={[styles.previewLink, { color: colors.primary }]}>Preview details</Text></TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addTemplateBtn, { backgroundColor: colors.primary }]}
                  onPress={() => chooseTemplateAction(item)}
                >
                  <Ionicons name="add" size={18} color={colors.onPrimary} />
                  <Text style={[styles.addTemplateBtnText, { color: colors.onPrimary }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
        </>
      )}
      <Modal
        visible={selectedTemplate !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTemplate(null)}
      >
        <View style={styles.templateModal}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close quick start confirmation"
            onPress={() => setSelectedTemplate(null)}
            style={[StyleSheet.absoluteFill, styles.templateModalBackdrop, { backgroundColor: colors.text }]}
          />
          {selectedTemplate && (
            <View
              accessibilityViewIsModal
              style={[styles.templatePrompt, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setSelectedTemplate(null)}
                style={styles.templatePromptClose}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.templatePromptIcon, { backgroundColor: `${selectedTemplate.color}1A` }]}>
                <HabitGlyph icon={selectedTemplate.icon} category={selectedTemplate.category} name={selectedTemplate.name} size={28} />
              </View>
              <Text style={[styles.templatePromptEyebrow, { color: colors.primary }]}>{selectedTemplate.categoryName.toUpperCase()}</Text>
              <Text style={[styles.templatePromptTitle, { color: colors.text }]}>{selectedTemplate.name}</Text>
              <Text style={[styles.templatePromptDescription, { color: colors.textSecondary }]}>{selectedTemplate.desc}</Text>
              <View style={[styles.templatePromptDetails, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.templatePromptDetail, { color: colors.textSecondary }]}>
                  {scheduleText(selectedTemplate.days)} · {selectedTemplate.type === 'count' ? `${selectedTemplate.target} ${selectedTemplate.unit || 'times'} per day` : 'Daily check-in'}
                </Text>
                <Text style={[styles.templatePromptDetail, { color: colors.textSecondary }]}>
                  Adding includes today in the schedule.
                </Text>
              </View>
              <Button
                label="Add to Today"
                onPress={() => { void addTemplate(selectedTemplate); }}
                style={styles.templatePromptButton}
              />
              <Button
                label="Edit first"
                variant="secondary"
                onPress={() => {
                  const template = templateForToday(selectedTemplate);
                  setSelectedTemplate(null);
                  navigation.navigate('HabitForm', { template });
                }}
              />
            </View>
          )}
        </View>
      </Modal>
      <AddHabitFab
        accessibilityLabel="Add new habit"
        fallbackLabel="Add habit"
        onPress={() => navigation.navigate('HabitForm')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SCREEN_PADDING, paddingTop: 0, paddingBottom: 10 },
  headerTitleRow: { marginHorizontal: -SCREEN_PADDING },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: { flex: 1, minHeight: 40, paddingHorizontal: 0, paddingVertical: 0, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent', fontSize: 16 },
  subFilterRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  listContent: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACING.lg, paddingTop: 0 },
  templateFilters: { paddingBottom: 2 },
  sortButton: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 44, paddingHorizontal: 8 },
  sortText: { fontSize: 12, fontWeight: '700' },
  habitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 15,
    marginBottom: SPACING.md,
    minHeight: 78,
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
  habitProgressRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 5 },
  habitProgressText: { fontSize: 12, fontWeight: '700' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  reminderText: { fontSize: 12, fontWeight: '600' },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 6,
  },
  cardActionButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
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
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: SPACING.md,
  },
  templateTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  templateIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  templateBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  templateDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  templateMeta: { fontSize: 12, marginTop: 4 },
  templateActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  previewLinkButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  previewLink: { fontSize: 12, fontWeight: '700' },
  addTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 0,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 10,
    marginLeft: 8,
  },
  addTemplateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  templateModal: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  templateModalBackdrop: { opacity: 0.56 },
  templatePrompt: { width: '100%', maxWidth: 420, alignItems: 'center', borderWidth: 1, borderRadius: 24, padding: 24 },
  templatePromptClose: { position: 'absolute', top: 12, right: 12, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  templatePromptIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 14 },
  templatePromptEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  templatePromptTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  templatePromptDescription: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  templatePromptDetails: { alignSelf: 'stretch', alignItems: 'center', gap: 4, borderRadius: 14, padding: 12, marginTop: 16, marginBottom: 18 },
  templatePromptDetail: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  templatePromptButton: { alignSelf: 'stretch', marginBottom: 10 },
});
