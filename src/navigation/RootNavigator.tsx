import {
  createNavigationContainerRef,
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useEffect, useMemo, useRef } from 'react';
import type * as Notifications from 'expo-notifications';
import TodayScreen from '../screens/TodayScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HabitsScreen from '../screens/HabitsScreen';
import ChallengesScreen from '../screens/ChallengesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HabitFormScreen from '../screens/HabitFormScreen';
import HabitDetailScreen from '../screens/HabitDetailScreen';
import { HabitsStackParams, RootTabParams } from './types';
import { useSettings } from '../context/SettingsContext';

const Tab = createBottomTabNavigator<RootTabParams>();
const Stack = createNativeStackNavigator<HabitsStackParams>();
const navigationRef = createNavigationContainerRef<RootTabParams>();

function HabitsStack() {
  const { colors } = useSettings();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 17 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="HabitsList"
        component={HabitsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="HabitForm"
        component={HabitFormScreen}
        options={({ route }) => ({
          title: route.params?.habitId ? 'Edit Habit' : 'Create New Habit',
        })}
      />
      <Stack.Screen
        name="HabitDetail"
        component={HabitDetailScreen}
        options={{ title: 'Habit Details' }}
      />
    </Stack.Navigator>
  );
}

const icons: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Today: ['today-outline', 'today'],
  Analytics: ['stats-chart-outline', 'stats-chart'],
  Habits: ['grid-outline', 'grid'],
  Challenges: ['trophy-outline', 'trophy'],
  Settings: ['settings-outline', 'settings'],
};

const tabLabels: Record<keyof RootTabParams, string> = {
  Today: 'Today',
  Habits: 'Habits',
  Analytics: 'Insights',
  Challenges: 'Awards',
  Settings: 'Settings',
};

export default function RootNavigator() {
  const { isDark, colors } = useSettings();
  const pendingHabitId = useRef<string | null>(null);
  const handledResponses = useRef(new Set<string>());
  const base = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = useMemo(() => ({
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      border: colors.border,
      text: colors.text,
    },
  }), [base, colors]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    let subscription: { remove: () => void } | null = null;
    void import('expo-notifications').then((Notifications) => {
      if (!mounted) return;
      const openHabitFromNotification = (response: Notifications.NotificationResponse) => {
        const responseId = response.notification.request.identifier;
        if (handledResponses.current.has(responseId)) return;
        handledResponses.current.add(responseId);
        const habitId = response.notification.request.content.data?.habitId;
        if (typeof habitId !== 'string') return;
        if (!navigationRef.isReady()) {
          pendingHabitId.current = habitId;
          return;
        }
        navigationRef.navigate('Habits', {
          screen: 'HabitDetail',
          params: { habitId },
        });
      };

      subscription = Notifications.addNotificationResponseReceivedListener(openHabitFromNotification);
      void Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) openHabitFromNotification(response);
        })
        .catch((error) => console.warn('Could not read the notification that opened the app:', error));
    }).catch((error) => console.warn('Could not load notification handlers:', error));
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={() => {
        const habitId = pendingHabitId.current;
        if (!habitId) return;
        pendingHabitId.current = null;
        navigationRef.navigate('Habits', {
          screen: 'HabitDetail',
          params: { habitId },
        });
      }}
    >
      <Tab.Navigator
        screenOptions={({ route }) => ({
          // Keep inactive tabs mounted without letting their heavy screens
          // rerender during updates elsewhere in the app.
          lazy: true,
          freezeOnBlur: Platform.OS !== 'web',
          tabBarIcon: ({ color, size, focused }) => {
            const iconPair = icons[route.name] || ['ellipse-outline', 'ellipse'];
            return (
              <Ionicons
                name={iconPair[focused ? 1 : 0]}
                size={focused ? 23 : 21}
                color={color}
              />
            );
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabel: tabLabels[route.name],
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            elevation: 0,
            height: 68,
            paddingTop: 8,
            paddingBottom: 10,
          },
          tabBarHideOnKeyboard: true,
          tabBarItemStyle: { paddingVertical: 2 },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Today" component={TodayScreen} />
        <Tab.Screen name="Habits" component={HabitsStack} />
        <Tab.Screen name="Analytics" component={DashboardScreen} />
        <Tab.Screen name="Challenges" component={ChallengesScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
