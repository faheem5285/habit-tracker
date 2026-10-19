import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Habit, Log } from '../types';
import {
  loadHabits,
  saveHabits,
  loadLogs,
  saveLogs,
  loadDailyNotes,
  saveDailyNotes,
  DailyNotes,
} from '../utils/storage';
import {
  scheduleHabitNotifications,
  cancelHabitNotifications,
  setRemindersFlag,
  ensurePermission,
  getNotificationPermissionStatus,
} from '../utils/notifications';
import { useSettings } from './SettingsContext';
import { getValue, updateLogValueIndex } from '../utils/streaks';
import { syncRecoveryData } from '../utils/recovery';

export type HabitInput = Omit<Habit, 'id' | 'createdAt' | 'notificationIds' | 'archived'>;

type Ctx = {
  habits: Habit[];
  logs: Log[];
  dailyNotes: DailyNotes;
  loaded: boolean;
  addHabit: (input: HabitInput) => Promise<void>;
  updateHabit: (id: string, input: HabitInput) => Promise<void>;
  setHabitArchived: (id: string, archived: boolean) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  setLog: (habitId: string, date: string, value: number) => void;
  toggleHabit: (habitId: string, date: string) => void;
  incrementHabit: (habitId: string, date: string, delta?: number) => void;
  setDailyNote: (date: string, note: string) => void;
  addHabits: (inputs: HabitInput[]) => void;
  resetAll: () => Promise<void>;
  setRemindersEnabled: (on: boolean) => Promise<boolean>;
};

const HabitContext = createContext<Ctx | null>(null);

export function HabitProvider({ children }: { children: ReactNode }) {
  const { settings, loaded: settingsLoaded } = useSettings();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [dailyNotes, setDailyNotes] = useState<DailyNotes>({});
  const [loaded, setLoaded] = useState(false);
  const logsRef = useRef(logs);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!settingsLoaded || restoredRef.current) return;
    restoredRef.current = true;
    void Promise.all([loadHabits(), loadLogs(), loadDailyNotes()]).then(([storedHabits, storedLogs, storedNotes]) => {
      logsRef.current = storedLogs;
      setHabits(storedHabits);
      setLogs(storedLogs);
      setDailyNotes(storedNotes);
      setLoaded(true);

      // Show the app as soon as local data is ready. Notification cleanup and
      // scheduling can take multiple native round trips, so finish that work
      // after the first screen has rendered.
      setRemindersFlag(settings.notificationsEnabled);
      void (async () => {
        const previousIds = storedHabits.flatMap((habit) => habit.notificationIds ?? []);
        await cancelHabitNotifications(previousIds);

        const permissionGranted = settings.notificationsEnabled
          ? await getNotificationPermissionStatus()
          : false;
        const refreshedHabits: Habit[] = [];
        for (const habit of storedHabits) {
          let notificationIds: string[] = [];
          if (permissionGranted && !habit.archived) {
            try {
              notificationIds = await scheduleHabitNotifications(habit);
            } catch (error) {
              console.warn(`Could not restore reminders for "${habit.name}":`, error);
            }
          }
          refreshedHabits.push({ ...habit, notificationIds });
        }
        const idsByHabit = new Map(refreshedHabits.map((habit) => [habit.id, habit.notificationIds]));
        setHabits((current) => current.map((habit) => ({
          ...habit,
          notificationIds: idsByHabit.get(habit.id) ?? [],
        })));
      })().catch((error) => console.warn('Could not refresh saved reminders:', error));
    }).catch((error) => {
      console.warn('Could not load saved habit data:', error);
      setLoaded(true);
    });
  }, [settingsLoaded, settings.notificationsEnabled]);

  // Persist after React has had a chance to paint the updated state. Debouncing
  // also avoids serializing the entire log history for every rapid check-in.
  useEffect(() => {
    if (!loaded) return;
    const timeout = setTimeout(() => {
      void Promise.all([saveHabits(habits), saveLogs(logs), saveDailyNotes(dailyNotes)])
        .then(() => syncRecoveryData())
        .catch((error) => console.warn('Habit backup sync failed:', error));
    }, 250);
    return () => clearTimeout(timeout);
  }, [loaded, habits, logs, dailyNotes]);

  const addHabit = async (input: HabitInput) => {
    const habit: Habit = {
      ...input,
      id: Date.now().toString(),
      notificationIds: [],
      archived: false,
      createdAt: new Date().toISOString(),
    };
    setHabits((previous) => [...previous, habit]);
    if (settings.notificationsEnabled) {
      void scheduleHabitNotifications(habit).then((notificationIds) => {
        setHabits((previous) => previous.map((item) => item.id === habit.id ? { ...item, notificationIds } : item));
      }).catch((error) => console.warn(`Could not schedule reminders for "${habit.name}":`, error));
    }
  };

  const updateHabit = async (id: string, input: HabitInput) => {
    const old = habits.find((h) => h.id === id);
    if (!old) throw new Error('This habit could not be found.');
    const shouldSchedule = !old.archived && settings.notificationsEnabled;
    setHabits((previous) => previous.map((h) => h.id === id ? { ...h, ...input, notificationIds: [] } : h));
    void cancelHabitNotifications(old.notificationIds).catch((error) => console.warn('Error cancelling previous notifications:', error));
    if (shouldSchedule) {
      void scheduleHabitNotifications({ ...input, id }).then((notificationIds) => {
        setHabits((previous) => previous.map((habit) => habit.id === id ? { ...habit, notificationIds } : habit));
      }).catch((error) => console.warn(`Could not schedule reminders for "${input.name}":`, error));
    }
  };

  const setHabitArchived = async (id: string, archived: boolean) => {
    const habit = habits.find((item) => item.id === id);
    if (!habit) throw new Error('This habit could not be found.');
    if (habit.archived === archived) return;

    setHabits((previous) => previous.map((item) => item.id === id ? { ...item, archived, notificationIds: [] } : item));
    if (archived) {
      void cancelHabitNotifications(habit.notificationIds).catch((error) => console.warn('Error cancelling archived habit reminders:', error));
    } else if (settings.notificationsEnabled) {
      void scheduleHabitNotifications(habit).then((notificationIds) => {
        setHabits((previous) => previous.map((item) => item.id === id ? { ...item, notificationIds } : item));
      }).catch((error) => console.warn(`Could not restore reminders for "${habit.name}":`, error));
    }
  };

  const setLog = (habitId: string, date: string, value: number) => {
    const previous = logsRef.current;
    const existingValue = getValue(previous, habitId, date);
    if (existingValue === value) return;

    let next: Log[];
    if (existingValue === 0 && value > 0) {
      // The common first check-in path only copies the array once.
      next = [...previous, { habitId, date, value }];
    } else if (value === 0) {
      next = previous.filter((log) => !(log.habitId === habitId && log.date === date));
    } else {
      const index = previous.findIndex((log) => log.habitId === habitId && log.date === date);
      next = [...previous];
      if (index !== -1) next[index] = { habitId, date, value };
    }
    logsRef.current = next;
    updateLogValueIndex(previous, next, habitId, date, value);
    setLogs(next);
  };

  const toggleHabit = (habitId: string, date: string) => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    const existing = logs.find((l) => l.habitId === habitId && l.date === date);
    const currentVal = existing?.value ?? 0;
    const isDone = currentVal >= habit.target;
    setLog(habitId, date, isDone ? 0 : habit.target);
  };

  const incrementHabit = (habitId: string, date: string, delta: number = 1) => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    const existing = logs.find((l) => l.habitId === habitId && l.date === date);
    const currentVal = existing?.value ?? 0;
    const nextVal = Math.max(0, currentVal + delta);
    setLog(habitId, date, nextVal);
  };

  const setDailyNote = (date: string, note: string) => {
    setDailyNotes((previous) => {
      const next = { ...previous };
      if (note.trim()) next[date] = note;
      else delete next[date];
      return next;
    });
  };

  const addHabits = (inputs: HabitInput[]) => {
    const stamp = Date.now();
    const created: Habit[] = inputs.map((input, i) => ({
      ...input,
      id: `${stamp}-${i}`,
      notificationIds: [],
      archived: false,
      createdAt: new Date().toISOString(),
    }));
    const next = [...habits, ...created];
    setHabits(next);
  };

  const resetAll = async () => {
    await Promise.all(habits.map((habit) => cancelHabitNotifications(habit.notificationIds)));
    setHabits([]);
    logsRef.current = [];
    setLogs([]);
    setDailyNotes({});
  };

  const setRemindersEnabled = async (on: boolean): Promise<boolean> => {
    if (on && !(await ensurePermission())) return false;
    if (!on) {
      await Promise.all(habits.map((habit) => cancelHabitNotifications(habit.notificationIds)));
      setRemindersFlag(false);
      const next = habits.map((habit) => ({ ...habit, notificationIds: [] }));
      setHabits(next);
      return true;
    }

    setRemindersFlag(true);
    const scheduled: string[] = [];
    try {
      const next: Habit[] = [];
      for (const habit of habits) {
        if (!habit.archived) {
          const notificationIds = await scheduleHabitNotifications(habit);
          scheduled.push(...notificationIds);
          next.push({ ...habit, notificationIds });
        } else {
          next.push(habit);
        }
      }
      await Promise.all(habits.map((habit) => cancelHabitNotifications(habit.notificationIds)));
      setHabits(next);
      return true;
    } catch (error) {
      setRemindersFlag(settings.notificationsEnabled);
      await cancelHabitNotifications(scheduled);
      throw error;
    }
  };

  const deleteHabit = async (id: string) => {
    const target = habits.find((h) => h.id === id);
    setHabits((previous) => previous.filter((h) => h.id !== id));
    const previousLogs = logsRef.current;
    const nextLogs = previousLogs.filter((l) => l.habitId !== id);
    logsRef.current = nextLogs;
    setLogs(nextLogs);
    if (target) void cancelHabitNotifications(target.notificationIds).catch((error) => console.warn('Error cancelling deleted habit reminders:', error));
  };

  return (
    <HabitContext.Provider
      value={{
        habits,
        logs,
        dailyNotes,
        loaded,
        addHabit,
        updateHabit,
        setHabitArchived,
        deleteHabit,
        setLog,
        toggleHabit,
        incrementHabit,
        setDailyNote,
        addHabits,
        resetAll,
        setRemindersEnabled,
      }}
    >
      {children}
    </HabitContext.Provider>
  );
}

export function useHabits() {
  const ctx = useContext(HabitContext);
  if (!ctx) throw new Error('useHabits must be used inside HabitProvider');
  return ctx;
}
