import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '../components/Themed';
import { restoreWithRecoveryCode } from '../utils/recovery';

export default function RecoveryStartScreen({ onStartFresh, onRestored }: { onStartFresh: () => void; onRestored: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const restore = async () => {
    if (!code.trim()) { Alert.alert('Enter your recovery code'); return; }
    setBusy(true);
    try { await restoreWithRecoveryCode(code); onRestored(); }
    catch (error) { Alert.alert('Could not restore data', error instanceof Error ? error.message : 'Check the code and try again.'); }
    finally { setBusy(false); }
  };
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Recover your data</Text>
        <Text style={styles.description}>Enter the recovery code you saved to validate it and download your habits, check-ins, notes, and settings from Cloudinary.</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
          placeholder="Recovery code"
          style={styles.input}
          editable={!busy}
          maxLength={80}
          accessibilityLabel="Recovery code"
        />
        <TouchableOpacity style={[styles.button, busy && styles.disabled]} onPress={restore} disabled={busy}>
          {busy && <ActivityIndicator size="small" color="#fff" />}
          <Text style={styles.buttonText}>{busy ? 'Restoring your data' : 'Restore my data'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={onStartFresh} disabled={busy}>
          <Text style={styles.secondaryText}>Start with a new account</Text>
        </TouchableOpacity>
        <Text style={styles.footnote}>Keep your code private. Anyone with it can access your backup. If you lose it, the backup cannot be recovered.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' }, content: { gap: 14 }, title: { fontSize: 28, fontWeight: '800', color: '#111827' }, description: { fontSize: 15, lineHeight: 22, color: '#4b5563', marginBottom: 8 }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#fff' }, button: { alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: '#4f46e5' }, disabled: { opacity: 0.6 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 }, secondary: { alignItems: 'center', padding: 14 }, secondaryText: { color: '#4f46e5', fontWeight: '700' }, footnote: { color: '#64748b', fontSize: 12, lineHeight: 18, marginTop: 8 } });
