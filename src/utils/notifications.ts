import { Platform } from 'react-native';
import { motivation } from './motivationalContent';
import type * as Notifications from 'expo-notifications';

let remindersEnabled = true;
let reminderSoundsEnabled = true;

export const setRemindersFlag = (v: boolean) => {
  remindersEnabled = v;
};

export const setReminderSoundFlag = (v: boolean) => {
  reminderSoundsEnabled = v;
};

type NotificationsModule = {
  setNotificationHandler: typeof import('expo-notifications/build/NotificationsHandler').setNotificationHandler;
  getPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').getPermissionsAsync;
  requestPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').requestPermissionsAsync;
  scheduleNotificationAsync: typeof import('expo-notifications/build/scheduleNotificationAsync').scheduleNotificationAsync;
  cancelScheduledNotificationAsync: typeof import('expo-notifications/build/cancelScheduledNotificationAsync').cancelScheduledNotificationAsync;
  setNotificationChannelAsync: typeof import('expo-notifications/build/setNotificationChannelAsync').setNotificationChannelAsync;
  SchedulableTriggerInputTypes: typeof import('expo-notifications/build/Notifications.types').SchedulableTriggerInputTypes;
  AndroidImportance: typeof import('expo-notifications/build/NotificationChannelManager.types').AndroidImportance;
  IosAuthorizationStatus: typeof import('expo-notifications/build/NotificationPermissions.types').IosAuthorizationStatus;
};
let notificationsModule: NotificationsModule | null = null;
let handlerInstalled = false;

async function getN(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  if (!notificationsModule) {
    const [handler, permissions, scheduler, cancel, channels, triggers, channelTypes, permissionTypes] = await Promise.all([
      import('expo-notifications/build/NotificationsHandler'),
      import('expo-notifications/build/NotificationPermissions'),
      import('expo-notifications/build/scheduleNotificationAsync'),
      import('expo-notifications/build/cancelScheduledNotificationAsync'),
      import('expo-notifications/build/setNotificationChannelAsync'),
      import('expo-notifications/build/Notifications.types'),
      import('expo-notifications/build/NotificationChannelManager.types'),
      import('expo-notifications/build/NotificationPermissions.types'),
    ]);
    notificationsModule = {
      setNotificationHandler: handler.setNotificationHandler,
      getPermissionsAsync: permissions.getPermissionsAsync,
      requestPermissionsAsync: permissions.requestPermissionsAsync,
      scheduleNotificationAsync: scheduler.scheduleNotificationAsync,
      cancelScheduledNotificationAsync: cancel.cancelScheduledNotificationAsync,
      setNotificationChannelAsync: channels.setNotificationChannelAsync,
      SchedulableTriggerInputTypes: triggers.SchedulableTriggerInputTypes,
      AndroidImportance: channelTypes.AndroidImportance,
      IosAuthorizationStatus: permissionTypes.IosAuthorizationStatus,
    };
  }
  if (!handlerInstalled) {
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: reminderSoundsEnabled,
        shouldSetBadge: true,
      }),
    });
    handlerInstalled = true;
  }
  return notificationsModule;
}

type Reminder = { id?: string; name: string; icon: string; days: number[]; reminderTimes: string[]; scheduledReminders?: string[] };

function getReminderChannelId() {
  return reminderSoundsEnabled ? 'habits-sound' : 'habits-silent';
}

/**
 * Configure Android notification channel with high priority
 */
export async function setupNotificationChannel(): Promise<void> {
  const N = await getN();
  if (!N) return;
  if (Platform.OS === 'android') {
    const channelId = getReminderChannelId();
    await N.setNotificationChannelAsync(channelId, {
      name: 'Habit Reminders',
      description: 'Daily reminders for scheduled habits',
      importance: N.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: '#6366F1',
      enableVibrate: true,
      ...(!reminderSoundsEnabled ? { sound: null } : {}),
    });
  }
}

/**
 * Check permission status
 */
export async function getNotificationPermissionStatus(): Promise<boolean> {
  const N = await getN();
  if (!N) return false;
  try {
    const current = await N.getPermissionsAsync();
    return !!(
      current.granted ||
      current.ios?.status === N.IosAuthorizationStatus.PROVISIONAL ||
      current.ios?.status === N.IosAuthorizationStatus.EPHEMERAL
    );
  } catch (error) {
    console.warn('Failed to check notification permissions:', error);
    return false;
  }
}

/**
 * Request notification permissions and initialize channels
 */
export async function ensurePermission(): Promise<boolean> {
  const N = await getN();
  if (!N) return false;
  try {
    await setupNotificationChannel();
    const current = await N.getPermissionsAsync();
    if (
      current.granted ||
      current.ios?.status === N.IosAuthorizationStatus.PROVISIONAL ||
      current.ios?.status === N.IosAuthorizationStatus.EPHEMERAL
    ) {
      return true;
    }
    const req = await N.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    return !!(
      req.granted ||
      req.ios?.status === N.IosAuthorizationStatus.PROVISIONAL ||
      req.ios?.status === N.IosAuthorizationStatus.EPHEMERAL
    );
  } catch (err) {
    console.warn('Failed to ensure notification permissions:', err);
    return false;
  }
}

/**
 * Cancel notifications by IDs
 */
export async function cancelHabitNotifications(ids: string[]) {
  const N = await getN();
  if (!N || !ids || ids.length === 0) return;
  const results = await Promise.allSettled(
    ids.map((id) => N.cancelScheduledNotificationAsync(id))
  );
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(`Could not cancel scheduled notification "${ids[index]}":`, result.reason);
    }
  });
}

export async function scheduleLoanNotifications(title: string, dueDate: string, loanId: string): Promise<string[]> {
  const N = await getN();
  if (!N || !remindersEnabled) return [];
  const permitted = await ensurePermission();
  if (!permitted) return [];
  const due = new Date(`${dueDate}T09:00:00`);
  if (!Number.isFinite(due.getTime())) return [];
  const ids: string[] = [];
  const channelId = getReminderChannelId();
  for (const [days, label] of [[1, 'due tomorrow'], [0, 'due today']] as const) {
    const date = new Date(due);
    date.setDate(date.getDate() - days);
    if (date.getTime() <= Date.now()) continue;
    try {
      ids.push(await N.scheduleNotificationAsync({
        content: { title: `Loan ${label}`, body: title, data: { loanId }, ...(Platform.OS === 'ios' ? { sound: reminderSoundsEnabled ? 'default' : false } : {}) },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date, channelId },
      }));
    } catch (error) {
      await cancelHabitNotifications(ids);
      throw error;
    }
  }
  return ids;
}

export async function schedulePurchaseNotification(title: string, reminderDate: string, purchaseReminderId: string): Promise<string[]> {
  const N = await getN();
  if (!N || !remindersEnabled) return [];
  if (!await ensurePermission()) return [];
  const date = new Date(`${reminderDate}T09:00:00`);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) return [];
  const channelId = getReminderChannelId();
  const id = await N.scheduleNotificationAsync({
    content: { title: 'Planned purchase reminder', body: title, data: { purchaseReminderId }, ...(Platform.OS === 'ios' ? { sound: reminderSoundsEnabled ? 'default' : false } : {}) },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date, channelId },
  });
  return [id];
}

/**
 * Schedule repeating daily/weekly reminders for a habit
 */
export async function scheduleHabitNotifications(habit: Reminder): Promise<string[]> {
  const N = await getN();
  const reminderTimes = habit.reminderTimes ?? [];
  const scheduledReminders = habit.scheduledReminders ?? [];
  if (!N || !remindersEnabled || (reminderTimes.length === 0 && scheduledReminders.length === 0)) {
    return [];
  }

  const hasPerm = await ensurePermission();
  if (!hasPerm) {
    console.warn('Notification permission denied, skipping scheduling.');
    return [];
  }

  const ids: string[] = [];
  const content: Notifications.NotificationContentInput = {
    title: `A moment for ${habit.name}`,
    body: motivation.reminder(habit.name),
    ...(Platform.OS === 'ios' ? { sound: reminderSoundsEnabled ? 'default' : false } : {}),
    data: { habitId: habit.id, habitName: habit.name },
  };
  const channelId = getReminderChannelId();

  try {
    for (const [reminderIndex, time] of reminderTimes.entries()) {
      const [hour, minute] = time.split(':').map(Number);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
        continue;
      }

      if (habit.days.length === 7) {
        const id = await N.scheduleNotificationAsync({
          content: { ...content, body: motivation.reminder(habit.name, reminderIndex) },
          trigger: {
            type: N.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
            channelId,
          },
        });
        ids.push(id);
      } else {
        for (const day of habit.days) {
          // Expo Notification weekday is 1-indexed: 1 = Sunday, 2 = Monday, ..., 7 = Saturday
          const weekday = day + 1;
          const id = await N.scheduleNotificationAsync({
            content: { ...content, body: motivation.reminder(habit.name, reminderIndex) },
            trigger: {
              type: N.SchedulableTriggerInputTypes.WEEKLY,
              weekday,
              hour,
              minute,
              channelId,
            },
          });
          ids.push(id);
        }
      }
    }

    for (const [reminderIndex, value] of scheduledReminders.entries()) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) continue;
      const id = await N.scheduleNotificationAsync({
        content: { ...content, body: motivation.reminder(habit.name, reminderTimes.length + reminderIndex) },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date,
          channelId,
        },
      });
      ids.push(id);
    }
  } catch (error) {
    try {
      await cancelHabitNotifications(ids);
    } catch (cleanupError) {
      console.warn('Could not clean up partially scheduled habit reminders:', cleanupError);
    }
    console.error('Error scheduling habit notifications:', error);
    throw error;
  }

  return ids;
}

/**
 * Send an immediate test notification to verify delivery
 */
export async function sendTestNotification(): Promise<boolean> {
  const N = await getN();
  if (!N) return false;

  const permitted = await ensurePermission();
  if (!permitted) return false;

  try {
    await N.scheduleNotificationAsync({
      content: {
        title: 'Habit Reminders are Working!',
        body: 'Notifications are configured properly. Keep building your daily momentum!',
        ...(Platform.OS === 'ios' ? { sound: reminderSoundsEnabled ? 'default' : false } : {}),
        badge: 1,
        data: { test: true },
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        repeats: false,
        channelId: getReminderChannelId(),
      },
    });
    return true;
  } catch (err) {
    console.error('Failed to trigger test notification:', err);
    return false;
  }
}
