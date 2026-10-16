import { useState, useCallback } from 'react';
import { ActivityIndicator, View, Switch, TouchableOpacity, ScrollView, StyleSheet, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/Themed';
import { useSettings } from '../context/SettingsContext';
import { useHabits } from '../context/HabitContext';
import { AppPalette } from '../theme';
import { sendTestNotification, getNotificationPermissionStatus, ensurePermission } from '../utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RECOVERY_CODE_KEY } from '../utils/storage';
import { createRecoveryCode, syncRecoveryData } from '../utils/recovery';

type Option<T> = { label: string; value: T; icon?: keyof typeof Ionicons.glyphMap };

function Chips<T extends string | number>({
  options,
  value,
  onChange,
  colors,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  colors: AppPalette;
}) {
  return (
    <View style={[styles.chips, { backgroundColor: colors.surfaceMuted }]}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <TouchableOpacity
            key={String(option.value)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              selected && {
                backgroundColor: colors.surface,
                shadowColor: colors.cardShadow,
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
              },
            ]}
            onPress={() => onChange(option.value)}
          >
            {option.icon && <Ionicons name={option.icon} size={15} color={colors.primary} />}
            <Text
              style={[
                styles.chipText,
                { color: selected ? colors.text : colors.muted },
                selected && { fontWeight: '700' },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const { settings, update, colors } = useSettings();
  const { habits, logs, dailyNotes, resetAll, setRemindersEnabled } = useHabits();

  const [hasPermission, setHasPermission] = useState(false);
  const [updatingNotifications, setUpdatingNotifications] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void AsyncStorage.getItem(RECOVERY_CODE_KEY).then((code) => { if (active) setRecoveryCode(code); });
    return () => { active = false; };
  }, []));

  const setupRecovery = async () => {
    setRecoveryBusy(true);
    try {
      const code = recoveryCode || await createRecoveryCode();
      setRecoveryCode(code);
      await syncRecoveryData(code);
      Alert.alert(recoveryCode ? 'Backup is up to date' : 'Recovery code created', `Save this code somewhere safe. It is required after reinstall:\n\n${code}\n\nYour backup is plain JSON in Cloudinary. Anyone with this code can read it.`, [{ text: 'Share / save code', onPress: () => { void Share.share({ title: 'Habit Tracker recovery code', message: `My Habit Tracker recovery code: ${code}` }); } }, { text: 'OK' }]);
    } catch (error) {
      Alert.alert('Could not set up recovery', error instanceof Error ? error.message : 'Please try again.');
    } finally { setRecoveryBusy(false); }
  };

  const checkStatus = useCallback(async () => {
    const status = await getNotificationPermissionStatus();
    setHasPermission(status);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    void getNotificationPermissionStatus().then((status) => {
      if (active) setHasPermission(status);
    });
    return () => {
      active = false;
    };
  }, []));

  const exportData = () => {
    Share.share({
      title: 'Habit Tracker Backup',
      message: JSON.stringify({ habits, logs, dailyNotes }, null, 2),
    });
  };

  const confirmReset = () => {
    Alert.alert(
      'Reset All Data?',
      'This will permanently delete all your habits, logs, streaks, and journal notes. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetAll();
              Alert.alert('Reset Complete', 'All data has been reset.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not reset data.');
            }
          },
        },
      ]
    );
  };

  const toggleNotifications = async (enabled: boolean) => {
    setUpdatingNotifications(true);
    try {
      const permitted = await setRemindersEnabled(enabled);
      if (!permitted && enabled) {
        Alert.alert(
          'Permission Needed',
          'Notification permissions are disabled on your device. Please enable notifications in your phone Settings to receive habit reminders.'
        );
        return;
      }
      update({ notificationsEnabled: enabled });
      await checkStatus();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not update reminders.');
    } finally {
      setUpdatingNotifications(false);
    }
  };

  const toggleReminderSound = async (enabled: boolean) => {
    update({ soundEnabled: enabled });
    if (!settings.notificationsEnabled || !hasPermission) return;

    setUpdatingNotifications(true);
    try {
      const refreshed = await setRemindersEnabled(true);
      if (!refreshed) {
        Alert.alert(
          'Reminders could not be updated',
          'Check notification permissions in your device settings, then try again.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Could not update reminders',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setUpdatingNotifications(false);
    }
  };

  const handleTestNotification = async () => {
    setSendingTest(true);
    try {
      const success = await sendTestNotification();
      if (!success) {
        Alert.alert(
          'Notifications Blocked',
          'Could not send notification. Please check that notifications are enabled in your device Settings.'
        );
      } else {
        Alert.alert(
          'Test Notification Sent!',
          'Your device was sent a test notification. Check your phone notification tray!'
        );
      }
      await checkStatus();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to trigger test notification.');
    } finally {
      setSendingTest(false);
    }
  };

  const handleRequestPermission = async () => {
    setUpdatingNotifications(true);
    try {
      const granted = await ensurePermission();
      setHasPermission(granted);
      if (!granted) {
        Alert.alert('Permission Denied', 'Notifications could not be enabled.');
        return;
      }
      const enabled = await setRemindersEnabled(true);
      if (!enabled) {
        Alert.alert('Could not enable reminders', 'Please try again in device settings.');
        return;
      }
      update({ notificationsEnabled: true });
      Alert.alert('Success!', 'Habit reminders are enabled.');
    } catch (error) {
      Alert.alert(
        'Could not enable reminders',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setUpdatingNotifications(false);
    }
  };

  const scheduledReminderCount = habits.reduce(
    (total, habit) => total + habit.notificationIds.length,
    0
  );
  const notificationsReady = settings.notificationsEnabled && hasPermission;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.pageHeading}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>PREFERENCES</Text>
          <Text style={styles.title}>Settings</Text>
          <Text style={[styles.intro, { color: colors.muted }]}>
            Personalize your habit tracking experience, reminders, and themes.
          </Text>
        </View>

        {/* Notification Status Banner */}
        <View
          style={[
            styles.notifStatusBanner,
            {
              backgroundColor: notificationsReady ? colors.successSoft : colors.accentSoft,
              borderColor: notificationsReady ? colors.success + '44' : colors.accent + '44',
            },
          ]}
        >
          <Ionicons
            name={notificationsReady ? 'checkmark-circle' : 'alert-circle'}
            size={22}
            color={notificationsReady ? colors.success : colors.accent}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.notifStatusTitle,
                { color: notificationsReady ? colors.success : colors.accent },
              ]}
            >
              {notificationsReady
                ? scheduledReminderCount
                  ? 'Habit reminders are ready'
                  : 'Notifications are enabled'
                : settings.notificationsEnabled
                  ? 'Permission required'
                  : 'Reminders are paused'}
            </Text>
            <Text style={[styles.notifStatusDesc, { color: colors.textSecondary }]}>
              {notificationsReady
                ? scheduledReminderCount
                  ? `${scheduledReminderCount} scheduled reminder${scheduledReminderCount === 1 ? '' : 's'} on this device.`
                  : 'Add a reminder time to a habit to schedule a nudge.'
                : settings.notificationsEnabled
                  ? 'Allow notifications on your device to receive habit reminders.'
                  : 'Turn on habit reminders whenever you are ready.'}
            </Text>
          </View>
          {!hasPermission && (
            <TouchableOpacity
              style={[styles.fixBtn, { backgroundColor: colors.accent }]}
              disabled={updatingNotifications}
              onPress={handleRequestPermission}
            >
              <Text style={styles.fixBtnText}>Enable</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notifications Section */}
        <Text style={styles.sectionTitle}>Reminders & Notifications</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={[styles.leadingIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="notifications" size={20} color={colors.primary} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Habit Reminders</Text>
              <Text style={[styles.settingSubtitle, { color: colors.muted }]}>
                Get timely nudges at your chosen reminder times.
              </Text>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              disabled={updatingNotifications}
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.surfaceMuted, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.settingRow}>
            <View style={[styles.leadingIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="volume-high" size={20} color={colors.primary} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>Reminder Sounds</Text>
              <Text style={[styles.settingSubtitle, { color: colors.muted }]}>
                Play audible alert with notification.
              </Text>
            </View>
            <Switch
              value={settings.soundEnabled}
              disabled={updatingNotifications}
              onValueChange={toggleReminderSound}
              trackColor={{ false: colors.surfaceMuted, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={sendingTest || updatingNotifications}
            style={[
              styles.testNotifBtn,
              { backgroundColor: colors.primarySoft, borderColor: colors.primary },
            ]}
            onPress={handleTestNotification}
          >
            <Ionicons name="paper-plane" size={16} color={colors.primary} />
            <Text style={[styles.testNotifText, { color: colors.primary }]}>
              {sendingTest ? 'Sending Test...' : 'Send Test Notification Now'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Appearance Section */}
        <Text style={styles.sectionTitle}>Appearance & Theme</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.settingTitle}>Color Mode</Text>
          <Text style={[styles.settingSubtitle, { color: colors.muted, marginBottom: 12 }]}>
            Choose between dark OLED, light, or auto system theme.
          </Text>
          <Chips
            colors={colors}
            options={[
              { label: 'Dark Mode', value: 'dark', icon: 'moon-outline' },
              { label: 'Light Mode', value: 'light', icon: 'sunny-outline' },
              { label: 'System', value: 'system', icon: 'phone-portrait-outline' },
            ]}
            value={settings.theme}
            onChange={(value) => update({ theme: value })}
          />
        </View>

        {/* Calendar Section */}
        <Text style={styles.sectionTitle}>Calendar Start Day</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.settingTitle}>First Day of the Week</Text>
          <Text style={[styles.settingSubtitle, { color: colors.muted, marginBottom: 12 }]}>
            Affects weekly completion matrix and horizontal scroller.
          </Text>
          <Chips
            colors={colors}
            options={[
              { label: 'Monday', value: 1 },
              { label: 'Sunday', value: 0 },
            ]}
            value={settings.weekStartsOn}
            onChange={(value) => update({ weekStartsOn: value as 0 | 1 })}
          />
        </View>

        {/* Data & Privacy */}
        <Text style={styles.sectionTitle}>Data & Privacy</Text>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={recoveryBusy}
          style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={setupRecovery}
        >
          <View style={[styles.leadingIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>{recoveryCode ? 'Recovery Code Enabled' : 'Set Up Recovery Code'}</Text>
            <Text style={[styles.settingSubtitle, { color: colors.muted }]}>
              {recoveryCode ? 'Your app data syncs to a plain JSON Cloudinary backup.' : 'Create a code to restore your data after reinstall.'}
            </Text>
          </View>
          {recoveryBusy
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="chevron-forward" size={18} color={colors.primary} />}
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={exportData}
        >
          <View style={[styles.leadingIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="download-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Export Backup</Text>
            <Text style={[styles.settingSubtitle, { color: colors.muted }]}>
              Save a JSON copy of all your habits and logs.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>


        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.actionRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={confirmReset}
        >
          <View style={[styles.leadingIcon, { backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="trash-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: colors.danger }]}>Reset All Data</Text>
            <Text style={[styles.settingSubtitle, { color: colors.muted }]}>
              Delete all habits, check-ins, and journal history.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>

        {/* App Info Footer */}
        <View style={styles.aboutContainer}>
          <Text style={[styles.aboutText, { color: colors.muted }]}>
            Habit Tracker · v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
          <Text style={[styles.aboutSub, { color: colors.muted }]}>
            Built with 100% offline privacy · Your data stays on your device
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 50 },
  pageHeading: { marginBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 },
  intro: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  notifStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  notifStatusTitle: { fontSize: 13, fontWeight: '800' },
  notifStatusDesc: { fontSize: 11, marginTop: 1, lineHeight: 15 },
  fixBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fixBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 16, marginBottom: 10 },
  card: { borderWidth: 1.5, borderRadius: 20, padding: 16, marginBottom: 10 },
  settingRow: { flexDirection: 'row', alignItems: 'center' },
  leadingIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingCopy: { flex: 1, paddingRight: 8 },
  settingTitle: { fontSize: 15, fontWeight: '700' },
  settingSubtitle: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  divider: { height: 1, marginVertical: 14 },
  testNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 14,
  },
  testNotifText: { fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', borderRadius: 13, padding: 4, gap: 4 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  chipText: { fontSize: 12, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 10,
  },
  aboutContainer: { alignItems: 'center', marginTop: 24, marginBottom: 10 },
  aboutText: { fontSize: 12, fontWeight: '700' },
  aboutSub: { fontSize: 11, marginTop: 4, textAlign: 'center' },
});
