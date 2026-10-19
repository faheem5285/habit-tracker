import {
  createNavigationContainerRef,
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { PlatformPressable } from '@react-navigation/elements';
import { Animated, Platform, StyleSheet, View } from 'react-native';
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

const TAB_RADIUS = 14;
const FLARE_SIZE = 14;
const BAR_TOP_OVERLAP = 9; // bar paddingTop (8) + item paddingTop (1), so the tab touches the bar's top edge

/**
 * Chrome-style active tab for a bottom bar: the selected tab is filled with the
 * screen background and flares outward at the top so it looks like part of the screen.
 */
function ChromeTabButton({ children, accessibilityState, style, activeColor, barColor, ...props }: Omit<BottomTabBarButtonProps, 'ref'> & {
  activeColor: string;
  barColor: string;
}) {
  const selected = Boolean(props['aria-selected'] ?? accessibilityState?.selected);
  const progress = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: selected ? 1 : 0, duration: 160, useNativeDriver: false }).start();
  }, [progress, selected]);

  const backgroundColor = progress.interpolate({ inputRange: [0, 1], outputRange: ['transparent', activeColor] });

  return <PlatformPressable
    {...props}
    accessibilityState={accessibilityState}
    pressColor="transparent"
    pressOpacity={1}
    style={[style, styles.tabButton]}
  >
    <Animated.View pointerEvents="none" style={[styles.activeTab, { backgroundColor }]}>
      <Animated.View style={[styles.flare, styles.flareLeft, { backgroundColor: activeColor, opacity: progress }]}>
        <View style={[styles.flareCut, styles.flareCutLeft, { backgroundColor: barColor }]} />
      </Animated.View>
      <Animated.View style={[styles.flare, styles.flareRight, { backgroundColor: activeColor, opacity: progress }]}>
        <View style={[styles.flareCut, styles.flareCutRight, { backgroundColor: barColor }]} />
      </Animated.View>
    </Animated.View>
    {children}
  </PlatformPressable>;
}

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
    borderTopWidth: 0,
    elevation: 0,
    width: '100%' as const,
    height: 76 + insets.bottom,
    paddingTop: 8,
    paddingBottom: Math.max(insets.bottom, 15),
    marginHorizontal: 0,
    marginBottom: 0,
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
          return <Ionicons name={icons[route.name][focused ? 1 : 0]} size={focused ? 22 : 20} color={color} style={{ transform: [{ translateY: -8 }] }} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabel: ({ Today: 'Today', Habits: 'Habits', Analytics: 'Insights', Settings: 'Settings' })[route.name],
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700', lineHeight: 15, marginTop: 3, transform: [{ translateY: -8 }] },
        tabBarAllowFontScaling: true,
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarButton: ({ ref, ...props }) => <ChromeTabButton {...props} activeColor={colors.background} barColor={colors.surface} />,
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

const styles = StyleSheet.create({
  fill: { flex: 1 },
  tabButton: { overflow: 'visible' },
  activeTab: {
    position: 'absolute',
    top: -BAR_TOP_OVERLAP,
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomLeftRadius: TAB_RADIUS,
    borderBottomRightRadius: TAB_RADIUS,
  },
  flare: { position: 'absolute', top: 0, width: FLARE_SIZE, height: FLARE_SIZE },
  flareLeft: { left: -FLARE_SIZE },
  flareRight: { right: -FLARE_SIZE },
  flareCut: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  flareCutLeft: { borderTopRightRadius: FLARE_SIZE },
  flareCutRight: { borderTopLeftRadius: FLARE_SIZE },
});
