import { NavigatorScreenParams } from '@react-navigation/native';
import type { HabitInput } from '../context/HabitContext';

export type HabitsStackParams = {
  HabitsList: undefined;
  HabitForm: { habitId?: string; template?: HabitInput } | undefined;
  HabitDetail: { habitId: string };
};

export type RootTabParams = {
  Today: undefined;
  Habits: NavigatorScreenParams<HabitsStackParams> | undefined;
  Analytics: undefined;
  Settings: undefined;
};

export type AppStackParams = {
  ModuleLauncher: undefined;
  HabitTracker: NavigatorScreenParams<RootTabParams> | undefined;
  Challenges: undefined;
  LoanLedger: undefined;
  Expenses: undefined;
  PasswordManager: undefined;
  Files: undefined;
};
