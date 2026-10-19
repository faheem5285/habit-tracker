import { useState, useCallback } from 'react';
import { ActivityIndicator, View, Switch, TouchableOpacity, ScrollView, StyleSheet, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/Themed';
import Button from '../components/Button';
import TextField from '../components/TextField';
import { useSettings } from '../context/SettingsContext';
import { useHabits } from '../context/HabitContext';
import { AppPalette } from '../theme';
import { sendTestNotification, getNotificationPermissionStatus, ensurePermission } from '../utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RECOVERY_BACKUP_READY_KEY, RECOVERY_CODE_KEY } from '../utils/storage';
import { createRecoveryCode, syncRecoveryData } from '../utils/recovery';
import ScreenHeader from '../components/ScreenHeader';
import { SCREEN_PADDING, SPACING } from '../ui';
import { loadLedger } from '../modules/loans/storage';
import { loadExpenses } from '../modules/expenses/storage';
import Card from '../components/Card';

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
            {option.icon && <Ionicons name={option.icon} size={18} color={colors.primary} />}
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
  const [recoveryBackupReady, setRecoveryBackupReady] = useState(false);
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [customRecoveryCode, setCustomRecoveryCode] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all([
      AsyncStorage.getItem(RECOVERY_CODE_KEY),
      AsyncStorage.getItem(RECOVERY_BACKUP_READY_KEY),
    ]).then(([code, backupReady]) => {
      if (!active) return;
      setRecoveryCode(code);
      setRecoveryBackupReady(Boolean(code && backupReady === 'true'));
    }).catch((error) => console.warn('Could not read recovery status:', error));
    return () => { active = false; };
  }, []));

  const setupRecovery = async () => {
    setRecoveryBusy(true);
    const alreadyReady = recoveryBackupReady;
    const alreadyHadCode = Boolean(recoveryCode);
    try {
      const code = recoveryCode || await createRecoveryCode();
      setRecoveryCode(code);
      await syncRecoveryData(code, { habits, logs, dailyNotes, settings });
      setRecoveryBackupReady(true);
      Alert.alert(
        alreadyReady ? 'Backup is up to date' : alreadyHadCode ? 'Recovery backup completed' : 'Recovery code created',
        'Your backup is ready. Anyone with your recovery code can read it, so store the code privately.'
      );
    } catch (error) {
      Alert.alert('Could not set up recovery', error instanceof Error ? error.message : 'Please try again.');
    } finally { setRecoveryBusy(false); }
  };

  const saveCustomRecovery = async (value: string) => {
    setRecoveryBusy(true);
    try {
      const code = await createRecoveryCode(value);
      setRecoveryCode(code);
      setRecoveryBackupReady(false);
      setCustomRecoveryCode('');
      await syncRecoveryData(code, { habits, logs, dailyNotes, settings });
      setRecoveryBackupReady(true);
      Alert.alert(
        'Custom recovery backup created',
        'Your backup is ready. Keep this code private; anyone who has it can read your backup.'
      );
    } catch (error) {
      Alert.alert('Could not set up recovery', error instanceof Error ? error.message : 'Please try again.');
    } finally { setRecoveryBusy(false); }
  };

  const confirmCustomRecovery = () => {
    const code = customRecoveryCode.trim();
    if (!code) {
      Alert.alert('Enter a recovery code', 'Choose a custom code between 20 and 80 characters.');
      return;
    }
    if (recoveryCode && recoveryCode !== code) {
      Alert.alert(
        'Replace this device’s recovery code?',
        'This changes the code used for future backups on this device. Your existing backup will still be available with its old code.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Use custom code', style: 'destructive', onPress: () => void saveCustomRecovery(code) },
        ]
      );
      return;
    }
    void saveCustomRecovery(code);
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

  const exportData = async () => {
    try {
      const [loans, expenses] = await Promise.all([loadLedger(), loadExpenses()]);
      await Share.share({
        title: 'Momentum Backup',
        message: JSON.stringify({ habits, logs, dailyNotes, settings, loans, expenses }, null, 2),
      });
    } catch (error) {
      Alert.alert('Could not export backup', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const copyRecoveryCode = async () => {
    if (!recoveryCode) return;
    try {
      await Share.share({ title: 'Momentum recovery code', message: recoveryCode });
    } catch (error) {
      Alert.alert('Could not share recovery code', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const confirmReset = () => {
    Alert.alert(
      'Reset Habit Data?',
      'This permanently deletes your habits, check-ins, and reflection notes. Your loans, expenses, budgets, and settings will stay unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Habit Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetAll();
              Alert.alert('Reset Complete', 'Your habit data has been reset.');
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
        <ScreenHeader
          title="Settings"
          subtitle="Make Momentum yours."
          style={styles.pageHeading}
        />

        {/* Notification Status Banner */}
        <View
          style={[
            styles.notifStatusBanner,
            {
              backgroundColor: notificationsReady ? colors.primarySoft : colors.accentSoft,
              borderColor: notificationsReady ? colors.primary : colors.accent + '44',
            },
          ]}
        >
          <Ionicons
            name={notificationsReady ? 'checkmark-circle' : 'alert-circle'}
            size={22}
            color={notificationsReady ? colors.primary : colors.accent}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.notifStatusTitle,
                { color: notificationsReady ? colors.text : colors.accent },
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
        <Card style={styles.card}>
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
        </Card>

        {/* Appearance Section */}
        <Text style={styles.sectionTitle}>Appearance & Theme</Text>
        <Card style={styles.card}>
          <Text style={styles.settingTitle}>Color Mode</Text>
          <Text style={[styles.settingSubtitle, { color: colors.muted, marginBottom: 12 }]}>
            Choose between dark OLED, light, or auto system theme.
          </Text>
          <Chips
            colors={colors}
            options={[
              { label: 'Dark', value: 'dark', icon: 'moon-outline' },
              { label: 'Light', value: 'light', icon: 'sunny-outline' },
              { label: 'System', value: 'system', icon: 'phone-portrait-outline' },
            ]}
            value={settings.theme}
            onChange={(value) => update({ theme: value })}
          />
        </Card>

        {/* Calendar Section */}
        <Text style={styles.sectionTitle}>Calendar Start Day</Text>
        <Card style={styles.card}>
          <Text style={styles.settingTitle}>First Day of the Week</Text>
          <Text style={[styles.settingSubtitle, { color: colors.muted, marginBottom: 12 }]}>
            Choose which day your week starts on.
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
        </Card>

        {/* Data & Privacy */}
        <Text style={styles.sectionTitle}>Data & Privacy</Text>
        <Card onPress={setupRecovery} disabled={recoveryBusy} style={styles.actionRow}>
          <View style={[styles.leadingIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>
              {recoveryBackupReady ? 'Recovery Backup Enabled' : recoveryCode ? 'Finish Recovery Setup' : 'Set Up Recovery Code'}
            </Text>
            <Text style={[styles.settingSubtitle, { color: colors.muted }]}>
              {recoveryBackupReady
                ? 'A recovery backup is set up. Keep your recovery code safe.'
                : recoveryCode
                  ? 'Your code is saved, but the first backup needs to finish. Tap to retry.'
                  : 'Create a code to restore your data after reinstall.'}
            </Text>
          </View>
          {recoveryBusy
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="chevron-forward" size={18} color={colors.primary} />}
        </Card>
        {recoveryCode && (
          <Card style={styles.recoveryCodeCard}>
            <Text style={styles.settingTitle}>Your recovery code</Text>
            <Text selectable style={[styles.recoveryCode, { color: colors.text }]}>
              {showRecoveryCode ? recoveryCode : '•'.repeat(recoveryCode.length)}
            </Text>
            {!recoveryBackupReady && (
              <Text style={[styles.settingSubtitle, { color: colors.accent, marginTop: 8 }]}>
                This code does not have a completed backup yet.
              </Text>
            )}
            {recoveryBackupReady && (
              <Text style={[styles.settingSubtitle, { color: colors.textSecondary, marginTop: 8 }]}>
                Anyone with this code can read your backup. Share it only with people you trust.
              </Text>
            )}
            <View style={styles.recoveryCodeActions}>
              <TouchableOpacity accessibilityRole="button" style={[styles.recoveryCodeButton, { borderColor: colors.border }]} onPress={() => setShowRecoveryCode((visible) => !visible)}>
                <Text style={[styles.recoveryCodeButtonText, { color: colors.primary }]}>{showRecoveryCode ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={[styles.recoveryCodeButton, { borderColor: colors.border }]} onPress={() => void copyRecoveryCode()}>
                <Text style={[styles.recoveryCodeButtonText, { color: colors.primary }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
        <Card style={styles.card}>
          <Text style={styles.settingTitle}>Choose your own recovery code</Text>
          <Text style={[styles.settingSubtitle, { color: colors.muted, marginBottom: 12 }]}>
            Use 20–80 letters, numbers, hyphens, or underscores. Keep it private and save it somewhere safe.
          </Text>
          <TextField
            label="Custom recovery code"
            value={customRecoveryCode}
            onChangeText={setCustomRecoveryCode}
            placeholder="Enter a code you will remember"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            maxLength={80}
            editable={!recoveryBusy}
            accessibilityLabel="Custom recovery code"
          />
          <Button
            label="Create backup with this code"
            onPress={confirmCustomRecovery}
            loading={recoveryBusy}
            disabled={!customRecoveryCode.trim()}
            style={styles.customRecoveryButton}
          />
        </Card>
        <Card onPress={exportData} style={styles.actionRow}>
          <View style={[styles.leadingIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="download-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Export Backup</Text>
            <Text style={[styles.settingSubtitle, { color: colors.muted }]}>
              Save a JSON copy of your habits, finances, notes, and settings.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Card>
        <Text style={[styles.sectionTitle, styles.dangerSectionTitle]}>Danger zone</Text>
        <Card onPress={confirmReset} style={styles.actionRow}>
          <View style={[styles.leadingIcon, { backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </View>
          <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: colors.danger }]}>Reset Habit Data</Text>
            <Text style={[styles.settingSubtitle, { color: colors.muted }]}>
              Delete all habits, check-ins, and journal history.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Card>

        {/* App Info Footer */}
        <View style={styles.aboutContainer}>
          <Text style={[styles.aboutText, { color: colors.muted }]}>
            Momentum · v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
          <Text style={[styles.aboutSub, { color: colors.muted }]}>
            {recoveryBackupReady
              ? 'Your data is backed up with your recovery code.'
              : recoveryCode
                ? 'Your first backup is not complete yet.'
                : 'Your data stays on this device unless you turn on backup.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { paddingHorizontal: SCREEN_PADDING, paddingTop: 0, paddingBottom: 64 },
  pageHeading: { marginHorizontal: -SCREEN_PADDING, marginBottom: 16 },
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
  notifStatusDesc: { fontSize: 12, marginTop: 1, lineHeight: 16 },
  fixBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fixBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: SPACING.xxl, marginBottom: SPACING.md },
  card: { marginBottom: SPACING.md },
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
  settingSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },
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
  chip: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 4, borderRadius: 10 },
  chipText: { fontSize: 12, fontWeight: '600' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  recoveryCodeCard: { marginTop: 10, marginBottom: 10 },
  recoveryCode: { fontSize: 14, fontWeight: '700', letterSpacing: 1, marginTop: 8 },
  recoveryCodeActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  customRecoveryButton: { marginTop: 12 },
  recoveryCodeButton: { minHeight: 44, minWidth: 72, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  recoveryCodeButtonText: { fontSize: 13, fontWeight: '700' },
  aboutContainer: { alignItems: 'center', marginTop: 24, marginBottom: 10 },
  aboutText: { fontSize: 12, fontWeight: '700' },
  aboutSub: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  dangerSectionTitle: { marginTop: 32 },
});
