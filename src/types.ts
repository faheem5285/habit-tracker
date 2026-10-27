export type HabitType = 'yesno' | 'count';

export type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'evening';

export type Habit = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: HabitType;
  target: number; // 1 for yesno, e.g. 5 for count/prayers
  weeklyGoal?: number;
  unit?: string; // e.g. 'glasses', 'pages', 'mins', 'times'
  category?: string; // 'health' | 'fitness' | 'productivity' | 'mind' | 'learning' | 'other'
  timeOfDay?: TimeOfDay;
  days: number[]; // 0 = Sun ... 6 = Sat
  reminderTimes: string[]; // ['08:00', '18:00']
  scheduledReminders?: string[]; // ISO datetimes for one-time future reminders
  notificationIds: string[];
  archived: boolean;
  createdAt: string;
};

export type Log = {
  habitId: string;
  date: string; // 'YYYY-MM-DD'
  value: number;
};

export type Settings = {
  theme: 'light' | 'dark' | 'system';
  weekStartsOn: 0 | 1;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  hasOnboarded: boolean;
  appLockEnabled: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  weekStartsOn: 1,
  notificationsEnabled: false,
  soundEnabled: true,
  hasOnboarded: false,
  appLockEnabled: false,
};

export type Challenge = {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  targetDays: number;
  color: string;
};

export type Badge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progressText?: string;
};
