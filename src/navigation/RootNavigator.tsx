import {
  createNavigationContainerRef,
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type * as Notifications from 'expo-notifications';
import ModulesButton from '../components/ModulesButton';
import { ScreenLoader } from '../components/ScreenLoader';
import TodayScreen from '../modules/habits/screens/TodayScreen';
import DashboardScreen from '../modules/habits/screens/DashboardScreen';
import HabitsScreen from '../modules/habits/screens/HabitsScreen';
import ChallengesScreen from '../modules/habits/screens/ChallengesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HabitFormScreen from '../modules/habits/screens/HabitFormScreen';
import HabitDetailScreen from '../modules/habits/screens/HabitDetailScreen';
import ModuleLauncherScreen from '../screens/ModuleLauncherScreen';
import LoanLedgerScreen from '../modules/loans/screens/LoanLedgerScreen';
import ExpenseBudgetScreen from '../modules/expenses/screens/ExpenseBudgetScreen';
import PasswordManagerScreen from '../modules/passwords/screens/PasswordManagerScreen';
import FileManagerScreen from '../modules/files/screens/FileManagerScreen';
import { HabitsStackParams, RootTabParams, AppStackParams } from './types';
import { useSettings } from '../context/SettingsContext';

const Tab = createBottomTabNavigator<RootTabParams>();
const HabitsStack = createNativeStackNavigator<HabitsStackParams>();
const AppStack = createNativeStackNavigator<AppStackParams>();
const navigationRef = createNavigationContainerRef<AppStackParams>();

function HabitDetailStack() {
  const { colors } = useSettings();
  return <HabitsStack.Navigator screenOptions={{
    headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: '800', fontSize: 17 }, headerTitleAlign: 'left',
    headerBackButtonDisplayMode: 'minimal',
    headerShadowVisible: false,
    headerRight: () => <ModulesButton />,
    contentStyle: { backgroundColor: colors.background },
  }}>
    <HabitsStack.Screen name="HabitsList" component={HabitsScreen} options={{ headerShown: false }} />
    <HabitsStack.Screen name="HabitForm" component={HabitFormScreen} options={({ route }) => ({
      title: route.params?.habitId ? 'Edit Habit' : route.params?.template ? 'Customize Template' : 'Create New Habit',
    })} />
    <HabitsStack.Screen name="HabitDetail" component={HabitDetailScreen} options={{ title: 'Habit Details' }} />
  </HabitsStack.Navigator>;
}

function HabitTrackerModule() {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const tabBarStyle = {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    height: 68 + insets.bottom,
    paddingTop: 8,
    paddingBottom: Math.max(insets.bottom, 6),
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 20,
  };
  return <View style={styles.fill}>
    <Tab.Navigator
      initialRouteName="Today"
      screenOptions={({ route }) => ({
        lazy: true,
        freezeOnBlur: Platform.OS !== 'web',
        tabBarIcon: ({ color, focused }) => {
          const icons: Record<keyof RootTabParams, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
            Today: ['calendar-outline', 'calendar'], Habits: ['checkmark-done-outline', 'checkmark-done'],
            Analytics: ['stats-chart-outline', 'stats-chart'],
            Settings: ['settings-outline', 'settings'],
          };
          return <Ionicons name={icons[route.name][focused ? 1 : 0]} size={focused ? 22 : 20} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabel: ({ Today: 'Today', Habits: 'Habits', Analytics: 'Insights', Settings: 'Settings' })[route.name],
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700', lineHeight: 15, marginTop: 3 },
        tabBarAllowFontScaling: true,
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: { flex: 1, minWidth: 0, paddingTop: 1, paddingBottom: 1 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Habits" component={HabitDetailStack} />
      <Tab.Screen name="Analytics" component={DashboardScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  </View>;
}

export default function RootNavigator() {
  const { isDark, colors } = useSettings();
  const base = isDark ? DarkTheme : DefaultTheme;
  const theme = useMemo(() => ({ ...base, colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.surface, border: colors.border, text: colors.text } }), [base, colors]);
  const pendingHabitId = useRef<string | null>(null);
  const handledResponses = useRef(new Set<string>());
  const lastRouteKey = useRef<string | undefined>(undefined);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [transitionLoading, setTransitionLoading] = useState(false);

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    let subscription: { remove: () => void } | null = null;
    void import('expo-notifications/build/NotificationsEmitter').then((Notifications) => {
      if (!mounted) return;
      const openHabit = (response: Notifications.NotificationResponse) => {
        const id = response.notification.request.identifier;
        if (handledResponses.current.has(id)) return;
        handledResponses.current.add(id);
        const habitId = response.notification.request.content.data?.habitId;
        if (typeof habitId !== 'string') return;
        if (!navigationRef.isReady()) { pendingHabitId.current = habitId; return; }
        navigationRef.navigate('HabitTracker', { screen: 'Habits', params: { screen: 'HabitDetail', params: { habitId } } });
      };
      subscription = Notifications.addNotificationResponseReceivedListener(openHabit);
      void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) openHabit(response); }).catch((error) => console.warn('Could not read notification response:', error));
    }).catch((error) => console.warn('Could not load notification handlers:', error));
    return () => { mounted = false; subscription?.remove(); };
  }, []);

  return <View style={styles.fill}>
  <NavigationContainer
    ref={navigationRef}
    theme={theme}
    onReady={() => {
      lastRouteKey.current = navigationRef.getCurrentRoute()?.key;
      const id = pendingHabitId.current;
      if (id) {
        pendingHabitId.current = null;
        navigationRef.navigate('HabitTracker', { screen: 'Habits', params: { screen: 'HabitDetail', params: { habitId: id } } });
      }
    }}
    onStateChange={() => {
      const routeKey = navigationRef.getCurrentRoute()?.key;
      if (!routeKey || routeKey === lastRouteKey.current) return;
      lastRouteKey.current = routeKey;
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      setTransitionLoading(true);
      transitionTimer.current = setTimeout(() => {
        transitionTimer.current = null;
        setTransitionLoading(false);
      }, 350);
    }}
  >
    <AppStack.Navigator initialRouteName="HabitTracker" screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text, headerTitleStyle: { fontWeight: '800' }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.background } }}>
      <AppStack.Screen name="ModuleLauncher" component={ModuleLauncherScreen} options={{ title: 'Modules', headerShown: false }} />
      <AppStack.Screen name="HabitTracker" component={HabitTrackerModule} options={{ headerShown: false }} />
      <AppStack.Screen name="Challenges" component={ChallengesScreen} options={{ title: 'Challenges & Badges' }} />
      <AppStack.Screen name="LoanLedger" component={LoanLedgerScreen} options={{ title: 'Loan Ledger', headerShown: false }} />
      <AppStack.Screen name="Expenses" component={ExpenseBudgetScreen} options={{ title: 'Expense & Budget', headerShown: false }} />
      <AppStack.Screen name="PasswordManager" component={PasswordManagerScreen} options={{ title: 'Password Manager', headerShown: false }} />
      <AppStack.Screen name="Files" component={FileManagerScreen} options={{ title: 'File Library', headerShown: false }} />
    </AppStack.Navigator>
  </NavigationContainer>
  {transitionLoading && <ScreenLoader label="Opening screen" />}
  </View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
