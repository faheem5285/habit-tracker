import { NavigatorScreenParams } from '@react-navigation/native';

export type HabitsStackParams = {
  HabitsList: undefined;
  HabitForm: { habitId?: string } | undefined;
  HabitDetail: { habitId: string };
};

export type RootTabParams = {
  Today: undefined;
  Habits: NavigatorScreenParams<HabitsStackParams>;
  Analytics: undefined;
  Challenges: undefined;
  Settings: undefined;
};