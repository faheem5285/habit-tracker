import type { HabitInput } from '../../../context/HabitContext';
import { Ionicons } from '@expo/vector-icons';

type Seed = [
  string,
  string,
  keyof typeof Ionicons.glyphMap,
  string,
  string,
  string,
  HabitInput['timeOfDay'],
  'daily' | 'weekdays' | 'three' | 'weekly',
];

const seeds: Seed[] = [
  ['Prepare a balanced breakfast', 'Start the day with a meal that keeps your energy steady.', 'restaurant-outline', '#D97706', 'Health', 'health', 'morning', 'daily'],
  ['Add vegetables to lunch', 'Make one nourishing choice at your midday meal.', 'nutrition-outline', '#16A34A', 'Health', 'health', 'afternoon', 'weekdays'],
  ['Take prescribed medication', 'Keep a consistent routine for medication you already use.', 'medkit-outline', '#2563EB', 'Health', 'health', 'morning', 'daily'],
  ['Step outside for daylight', 'Spend a few minutes outdoors during the day.', 'sunny-outline', '#EAB308', 'Health', 'health', 'morning', 'daily'],
  ['Unplug before bed', 'Give yourself a quieter transition into sleep.', 'moon-outline', '#6366F1', 'Health', 'health', 'evening', 'daily'],
  ['Drink water with each meal', 'Pair hydration with a routine already in your day.', 'water-outline', '#0891B2', 'Health', 'health', 'any', 'daily'],
  ['Walk for 15 minutes', 'A short walk makes movement easier to repeat.', 'walk-outline', '#F97316', 'Fitness', 'fitness', 'afternoon', 'daily'],
  ['Strength training', 'Complete a manageable strength session at your pace.', 'barbell-outline', '#DC2626', 'Fitness', 'fitness', 'morning', 'three'],
  ['Cycle or ride', 'Add an easy cycling session to your weekly routine.', 'bicycle-outline', '#2563EB', 'Fitness', 'fitness', 'any', 'three'],
  ['Take the stairs', 'Choose the stairs when they fit your day.', 'footsteps-outline', '#EA580C', 'Fitness', 'fitness', 'any', 'weekdays'],
  ['Practice balance', 'Spend a few minutes on balance and steady movement.', 'body-outline', '#7C3AED', 'Fitness', 'fitness', 'morning', 'daily'],
  ['Cool down after exercise', 'Finish activity with a short, comfortable cooldown.', 'fitness-outline', '#0D9488', 'Fitness', 'fitness', 'evening', 'three'],
  ['Name one feeling', 'Pause to notice and name how you feel without judging it.', 'heart-outline', '#8B5CF6', 'Mental Wellness', 'mind', 'any', 'daily'],
  ['Take a screen break', 'Look away from screens and reset your attention.', 'eye-outline', '#0F766E', 'Mental Wellness', 'mind', 'afternoon', 'weekdays'],
  ['Write down a worry', 'Move a looping thought onto paper, then choose one next step.', 'create-outline', '#6366F1', 'Mental Wellness', 'mind', 'evening', 'daily'],
  ['Reach out to someone', 'Send a message or make time for a supportive connection.', 'heart-outline', '#DB2777', 'Mental Wellness', 'mind', 'any', 'three'],
  ['Spend time on a calming activity', 'Make a little room for something that helps you settle.', 'leaf-outline', '#059669', 'Mental Wellness', 'mind', 'evening', 'daily'],
  ['Ask for support', 'Take one practical step toward support when you need it.', 'heart-outline', '#2563EB', 'Mental Wellness', 'mind', 'any', 'weekdays'],
  ['Choose tomorrow’s priority', 'Write down the one task you want to make room for.', 'calendar-outline', '#4F46E5', 'Productivity', 'productivity', 'evening', 'weekdays'],
  ['Clear your workspace', 'Reset one small area so it is easier to begin.', 'home-outline', '#0D9488', 'Productivity', 'productivity', 'evening', 'weekdays'],
  ['Take a focused 25-minute block', 'Work on one task with distractions set aside.', 'flash-outline', '#7C3AED', 'Productivity', 'productivity', 'morning', 'weekdays'],
  ['Review your task list', 'Choose what matters and let go of tasks that can wait.', 'checkmark-done-outline', '#2563EB', 'Productivity', 'productivity', 'morning', 'weekdays'],
  ['Finish one open task', 'Close a small loop before starting another.', 'checkmark-circle-outline', '#16A34A', 'Productivity', 'productivity', 'any', 'weekdays'],
  ['Take a proper lunch break', 'Step away from work while you eat.', 'restaurant-outline', '#EA580C', 'Productivity', 'productivity', 'afternoon', 'weekdays'],
  ['Study a language', 'Practice vocabulary or listening for a short session.', 'book-outline', '#2563EB', 'Learning', 'learning', 'evening', 'weekdays'],
  ['Review your notes', 'Revisit one idea so it is easier to remember later.', 'book-outline', '#7C3AED', 'Learning', 'learning', 'evening', 'weekdays'],
  ['Practice an instrument', 'Spend a short session building comfort with your instrument.', 'sparkles-outline', '#DB2777', 'Learning', 'learning', 'evening', 'three'],
  ['Watch a learning lesson', 'Work through one focused lesson on a subject you care about.', 'school-outline', '#0891B2', 'Learning', 'learning', 'any', 'weekdays'],
  ['Solve one practice problem', 'Build skill by working through one useful example.', 'checkmark-done-outline', '#D97706', 'Learning', 'learning', 'any', 'weekdays'],
  ['Teach back one idea', 'Explain something you learned in your own words.', 'sparkles-outline', '#16A34A', 'Learning', 'learning', 'evening', 'weekdays'],
  ['Read a few pages', 'Make reading easy to return to with a small daily target.', 'book-outline', '#DB2777', 'Personal Growth', 'other', 'evening', 'daily'],
  ['Write a short journal entry', 'Capture one thing you noticed or want to remember.', 'create-outline', '#8B5CF6', 'Personal Growth', 'other', 'evening', 'daily'],
  ['Practice saying no', 'Protect time for a priority by declining one nonessential request.', 'shield-checkmark-outline', '#475569', 'Personal Growth', 'other', 'any', 'weekdays'],
  ['Do one thing outside your comfort zone', 'Choose a small, safe step that helps you grow.', 'trending-up-outline', '#16A34A', 'Personal Growth', 'other', 'any', 'three'],
  ['Review a personal goal', 'Check whether your next step still fits what matters to you.', 'locate-outline', '#0D9488', 'Personal Growth', 'other', 'evening', 'weekly'],
  ['Start with the hardest small task', 'Give an important task your attention before distractions build.', 'flash-outline', '#DC2626', 'Discipline', 'other', 'morning', 'weekdays'],
  ['Keep a small promise to yourself', 'Choose one realistic commitment and follow it through.', 'checkmark-circle-outline', '#4F46E5', 'Discipline', 'other', 'any', 'daily'],
  ['Wait before an impulse purchase', 'Give a nonessential purchase a day before deciding.', 'time-outline', '#D97706', 'Discipline', 'other', 'any', 'daily'],
  ['Put your phone away during a task', 'Make one focused block easier by moving your phone aside.', 'phone-portrait-outline', '#475569', 'Discipline', 'other', 'morning', 'weekdays'],
  ['Complete a task before entertainment', 'Finish one chosen responsibility before leisure time.', 'checkmark-done-outline', '#EA580C', 'Discipline', 'other', 'evening', 'weekdays'],
  ['Take five slow breaths', 'Pause for a few steady breaths between activities.', 'leaf-outline', '#0D9488', 'Mindfulness', 'mind', 'any', 'daily'],
  ['Eat one meal without a screen', 'Give a meal your attention and notice when you feel satisfied.', 'restaurant-outline', '#16A34A', 'Mindfulness', 'mind', 'afternoon', 'daily'],
  ['Notice something you appreciate', 'Name one ordinary thing that made today better.', 'flower-outline', '#D97706', 'Mindfulness', 'mind', 'evening', 'daily'],
  ['Pause between tasks', 'Take a brief transition instead of rushing into the next thing.', 'time-outline', '#0891B2', 'Mindfulness', 'mind', 'any', 'weekdays'],
  ['Track one day of spending', 'Record purchases without judgment to understand your patterns.', 'pie-chart-outline', '#059669', 'Financial Wellness', 'other', 'evening', 'daily'],
  ['Review your weekly budget', 'Check upcoming costs and adjust your plan if needed.', 'pie-chart-outline', '#2563EB', 'Financial Wellness', 'other', 'evening', 'weekly'],
  ['Move a set amount to savings', 'Build a savings habit with an amount that fits your budget.', 'cash-outline', '#16A34A', 'Financial Wellness', 'other', 'any', 'weekly'],
  ['Review subscriptions', 'Check for a recurring charge you no longer need.', 'search-outline', '#7C3AED', 'Financial Wellness', 'other', 'any', 'weekly'],
];

const daysFor = (frequency: Seed[7]) => {
  if (frequency === 'weekdays') return [1, 2, 3, 4, 5];
  if (frequency === 'three') return [1, 3, 5];
  if (frequency === 'weekly') return [0];
  return [0, 1, 2, 3, 4, 5, 6];
};

export const EXTRA_TEMPLATES: (HabitInput & { categoryName: string; desc: string })[] = seeds.map(
  ([name, desc, icon, color, categoryName, category, timeOfDay, frequency]) => ({
    name,
    desc,
    icon,
    color,
    category,
    categoryName,
    type: 'yesno',
    target: 1,
    unit: 'check-in',
    timeOfDay,
    days: daysFor(frequency),
    reminderTimes: [],
  })
);
