import {
  createNavigationContainerRef,
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import type * as Notifications from 'expo-notifications';
import TodayScreen from '../screens/TodayScreen';
import DashboardScreen from '../screens/DashboardScreen';
import HabitsScreen from '../screens/HabitsScreen';
import ChallengesScreen from '../screens/ChallengesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HabitFormScreen from '../screens/HabitFormScreen';
import HabitDetailScreen from '../screens/HabitDetailScreen';
import ModuleLauncherScreen from '../screens/ModuleLauncherScreen';
import LoanLedgerScreen from '../modules/loans/screens/LoanLedgerScreen';
import ExpenseBudgetScreen from '../modules/expenses/screens/ExpenseBudgetScreen';
import { HabitsStackParams, RootTabParams, AppStackParams } from './types';
import { useSettings } from '../context/SettingsContext';
import { Text } from '../components/Themed';
import { LoaderScreen } from '../components/AppLoader';

const Tab = createBottomTabNavigator<RootTabParams>();
const HabitsStack = createNativeStackNavigator<HabitsStackParams>();
const AppStack = createNativeStackNavigator<AppStackParams>();
const navigationRef = createNavigationContainerRef<AppStackParams>();

function HabitDetailStack() {
  const { colors } = useSettings();
  return <HabitsStack.Navigator screenOptions={{
    headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: '800', fontSize: 17 }, headerShadowVisible: false,
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
  const { colors, isDark } = useSettings();
  const [switching, setSwitching] = useState(false);
  const switchingAt = useRef(0);
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (switchTimer.current) clearTimeout(switchTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);
  return <View style={styles.fill}>
    <Tab.Navigator
      initialRouteName="Today"
      screenListeners={({ route, navigation }) => ({
        tabPress: (event) => {
          const state = navigation.getState();
          const active = state.routes[state.index ?? 0]?.name;
          if (active === route.name) return;
          event.preventDefault();
          if (switchTimer.current) clearTimeout(switchTimer.current);
          if (hideTimer.current) clearTimeout(hideTimer.current);
          switchingAt.current = Date.now();
          setSwitching(true);
          switchTimer.current = setTimeout(() => {
            navigation.navigate(route.name);
            switchTimer.current = null;
          }, 16);
        },
        focus: () => {
          if (!switchingAt.current) return;
          const delay = Math.max(0, 240 - (Date.now() - switchingAt.current));
          hideTimer.current = setTimeout(() => {
            switchingAt.current = 0;
            setSwitching(false);
            hideTimer.current = null;
          }, delay);
        },
      })}
      screenOptions={({ route }) => ({
        lazy: true,
        freezeOnBlur: Platform.OS !== 'web',
        tabBarIcon: ({ color, focused }) => {
          const icons: Record<keyof RootTabParams, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
            Today: ['today-outline', 'today'], Habits: ['grid-outline', 'grid'],
            Analytics: ['stats-chart-outline', 'stats-chart'], Challenges: ['trophy-outline', 'trophy'],
            Settings: ['settings-outline', 'settings'],
          };
          return <Ionicons name={icons[route.name][focused ? 1 : 0]} size={focused ? 23 : 21} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabel: ({ Today: 'Today', Habits: 'Habits', Analytics: 'Insights', Challenges: 'Awards', Settings: 'Settings' })[route.name],
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 3 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, elevation: 0, height: 70, paddingTop: 9, paddingBottom: 10 },
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: { paddingVertical: 2 },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Habits" component={HabitDetailStack} />
      <Tab.Screen name="Analytics" component={DashboardScreen} />
      <Tab.Screen name="Challenges" component={ChallengesScreen} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
    {switching && <View pointerEvents="auto" style={styles.switchOverlay}><LoaderScreen scheme={isDark ? 'dark' : 'light'} label="Opening screen" backgroundOpacity={0.8} /></View>}
  </View>;
}

export default function RootNavigator() {
  const { isDark, colors } = useSettings();
  const base = isDark ? DarkTheme : DefaultTheme;
  const theme = useMemo(() => ({ ...base, colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.surface, border: colors.border, text: colors.text } }), [base, colors]);
  const pendingHabitId = useRef<string | null>(null);
  const handledResponses = useRef(new Set<string>());

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

  const homeButton = (navigation: { navigate: (route: 'ModuleLauncher') => void }) => <Pressable onPress={() => navigation.navigate('ModuleLauncher')} style={styles.homeButton}><Ionicons name="apps-outline" size={16} color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800' }}>Modules</Text></Pressable>;
  return <NavigationContainer ref={navigationRef} theme={theme} onReady={() => {
    const id = pendingHabitId.current;
    if (id) {
      pendingHabitId.current = null;
      navigationRef.navigate('HabitTracker', { screen: 'Habits', params: { screen: 'HabitDetail', params: { habitId: id } } });
    }
  }}>
    <AppStack.Navigator initialRouteName="HabitTracker" screenOptions={{ headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text, headerTitleStyle: { fontWeight: '800' }, headerShadowVisible: false, contentStyle: { backgroundColor: colors.background } }}>
      <AppStack.Screen name="ModuleLauncher" component={ModuleLauncherScreen} options={{ title: 'Modules', headerShown: false }} />
      <AppStack.Screen name="HabitTracker" component={HabitTrackerModule} options={({ navigation }) => ({ title: 'Habit Tracker', headerRight: () => homeButton(navigation) })} />
      <AppStack.Screen name="LoanLedger" component={LoanLedgerScreen} options={{ title: 'Loan Ledger', headerShown: false }} />
      <AppStack.Screen name="Expenses" component={ExpenseBudgetScreen} options={{ title: 'Expense & Budget', headerShown: false }} />
    </AppStack.Navigator>
  </NavigationContainer>;
}

const styles = StyleSheet.create({ fill: { flex: 1 }, homeButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8 }, switchOverlay: { ...StyleSheet.absoluteFill, zIndex: 100, elevation: 100 } });
