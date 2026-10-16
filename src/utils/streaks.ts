import { Habit, Log } from '../types';
import { addDays, fromDateKey, toDateKey } from './dates';

type LogValueIndex = { base: Map<string, number>; changes: Map<string, number | null> };
const logValueIndexes = new WeakMap<Log[], LogValueIndex>();
const MAX_LOG_INDEX_CHANGES = 128;

function getLogValueIndex(logs: Log[]): LogValueIndex {
  let index = logValueIndexes.get(logs);
  if (!index) {
    const base = new Map<string, number>();
    for (const log of logs) base.set(`${log.habitId}\u0000${log.date}`, log.value);
    index = { base, changes: new Map() };
    logValueIndexes.set(logs, index);
  }
  return index;
}

/** Carry the cached lookup forward when a single log entry changes. */
export function updateLogValueIndex(previous: Log[], next: Log[], habitId: string, date: string, value: number) {
  const previousIndex = getLogValueIndex(previous);
  const changes = new Map(previousIndex.changes);
  changes.set(`${habitId}\u0000${date}`, value > 0 ? value : null);

  if (changes.size >= MAX_LOG_INDEX_CHANGES) {
    const base = new Map(previousIndex.base);
    for (const [key, nextValue] of changes) {
      if (nextValue === null) base.delete(key);
      else base.set(key, nextValue);
    }
    logValueIndexes.set(next, { base, changes: new Map() });
    return;
  }

  logValueIndexes.set(next, { base: previousIndex.base, changes });
}

export const isScheduled = (h: Habit, d: Date) => h.days.includes(d.getDay());

export function getValue(logs: Log[], habitId: string, date: string): number {
  const key = `${habitId}\u0000${date}`;
  const index = getLogValueIndex(logs);
  if (index.changes.has(key)) return index.changes.get(key) ?? 0;
  return index.base.get(key) ?? 0;
}

export const isDone = (h: Habit, logs: Log[], date: string) =>
  getValue(logs, h.id, date) >= h.target;

// Consecutive scheduled days completed, counting back from today.
// Unscheduled days are skipped; today not yet done doesn't break the streak.
export function currentStreak(h: Habit, logs: Log[], today: Date = new Date()): number {
  let streak = 0;
  for (let i = 0; i < 366; i++) {
    const d = addDays(today, -i);
    if (!isScheduled(h, d)) continue;
    if (isDone(h, logs, toDateKey(d))) streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}
export const createdKey = (h: Habit) => toDateKey(new Date(h.createdAt));

export function bestStreak(h: Habit, logs: Log[], today: Date = new Date()): number {
  const dates = logs.filter((l) => l.habitId === h.id).map((l) => l.date).sort();
  const start = dates.length && dates[0] < createdKey(h) ? dates[0] : createdKey(h);
  const todayStr = toDateKey(today);
  let best = 0;
  let run = 0;
  for (let d = fromDateKey(start); toDateKey(d) <= todayStr; d = addDays(d, 1)) {
    if (!isScheduled(h, d)) continue;
    if (isDone(h, logs, toDateKey(d))) {
      run++;
      best = Math.max(best, run);
    } else if (toDateKey(d) !== todayStr) run = 0;
  }
  return best;
}

/** Current run of scheduled days on which every active habit reached its target. */
export function perfectDayStreak(habits: Habit[], logs: Log[], today: Date = new Date()): number {
  let streak = 0;
  for (let offset = 0; offset < 3660; offset++) {
    const day = addDays(today, -offset);
    const key = toDateKey(day);
    const scheduled = habits.filter((habit) => !habit.archived && createdKey(habit) <= key && isScheduled(habit, day));
    if (!scheduled.length) continue;
    const perfect = scheduled.every((habit) => isDone(habit, logs, key));
    if (perfect) streak++;
    else if (offset !== 0) break; // Today's score is still in progress.
  }
  return streak;
}

/** Longest historical run of scheduled days completed at 100%. */
export function bestPerfectDayStreak(habits: Habit[], logs: Log[], today: Date = new Date()): number {
  const activeHabits = habits.filter((habit) => !habit.archived);
  if (!activeHabits.length) return 0;
  const start = activeHabits.reduce((earliest, habit) => {
    const created = createdKey(habit);
    return created < earliest ? created : earliest;
  }, createdKey(activeHabits[0]));
  const end = toDateKey(today);
  let best = 0;
  let run = 0;
  for (let day = fromDateKey(start); toDateKey(day) <= end; day = addDays(day, 1)) {
    const key = toDateKey(day);
    const scheduled = activeHabits.filter((habit) => createdKey(habit) <= key && isScheduled(habit, day));
    if (!scheduled.length) continue;
    if (scheduled.every((habit) => isDone(habit, logs, key))) {
      run++;
      best = Math.max(best, run);
    } else if (key !== end) run = 0;
  }
  return best;
}

export type DayStat = { done: number; total: number };

export function dayStat(habits: Habit[], logs: Log[], d: Date): DayStat {
  const key = toDateKey(d);
  const list = habits.filter((h) => !h.archived && isScheduled(h, d) && createdKey(h) <= key);
  return { done: list.filter((h) => isDone(h, logs, key)).length, total: list.length };
}

export const pct = (s: DayStat) => (s.total ? s.done / s.total : 0);

export function completionRate(h: Habit, logs: Log[], days = 30, today: Date = new Date()): number {
  let done = 0;
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    const key = toDateKey(d);
    if (!isScheduled(h, d) || createdKey(h) > key) continue;
    total++;
    if (isDone(h, logs, key)) done++;
  }
  return total ? done / total : 0;
}
