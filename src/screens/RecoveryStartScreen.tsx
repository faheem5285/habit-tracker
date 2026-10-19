import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Themed';
import { restoreWithRecoveryCode } from '../utils/recovery';
import { useSettings } from '../context/SettingsContext';
import TextField from '../components/TextField';
import Button from '../components/Button';
import { appCopy } from '../copy';

export default function RecoveryStartScreen({ onStartFresh, onRestored }: { onStartFresh: () => void; onRestored: () => void }) {
  const { colors } = useSettings();
  const copy = appCopy.recoveryStart;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const restore = async () => {
    if (!code.trim()) { Alert.alert(copy.missingCode); return; }
    setBusy(true);
    try { await restoreWithRecoveryCode(code); onRestored(); }
    catch (error) { Alert.alert(copy.restoreFailedTitle, error instanceof Error ? error.message : copy.restoreFailedMessage); }
    finally { setBusy(false); }
  };
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>{copy.description}</Text>
        <TextField
          label={copy.codeLabel}
          autoCapitalize="none"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
          placeholder={copy.codePlaceholder}
          style={styles.input}
          editable={!busy}
          maxLength={80}
          accessibilityLabel="Recovery code"
        />
        <Button label={busy ? copy.restoring : copy.restore} onPress={restore} loading={busy} />
        <Button label={copy.startFresh} variant="secondary" onPress={onStartFresh} disabled={busy} />
        <Text style={[styles.footnote, { color: colors.muted }]}>{copy.privacyNote}</Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, screen: { flex: 1, justifyContent: 'center', padding: 24 }, content: { flexGrow: 1, justifyContent: 'center', gap: 14 }, title: { fontSize: 28, fontWeight: '800' }, description: { fontSize: 15, lineHeight: 22, marginBottom: 8 }, input: { marginBottom: 0 }, footnote: { fontSize: 12, lineHeight: 18, marginTop: 8 } });
