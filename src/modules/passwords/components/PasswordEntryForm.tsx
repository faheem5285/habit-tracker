import { useMemo, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput as NativeTextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import Button from '../../../components/Button';
import { Text } from '../../../components/Themed';
import TextField from '../../../components/TextField';
import { useSettings } from '../../../context/SettingsContext';
import { generatePassword, measurePasswordStrength } from '../crypto';
import { VAULT_CATEGORIES, type GeneratorOptions, type PasswordEntry } from '../types';

type Props = {
  visible: boolean;
  initialEntry: PasswordEntry | null;
  existingEntries: PasswordEntry[];
  onClose: () => void;
  onSave: (entry: PasswordEntry) => Promise<void>;
};

const DEFAULT_GENERATOR: GeneratorOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
};

function normalizeWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export default function PasswordEntryForm({
  visible,
  initialEntry,
  existingEntries,
  onClose,
  onSave,
}: Props) {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(initialEntry?.title ?? '');
  const [website, setWebsite] = useState(initialEntry?.website ?? '');
  const [username, setUsername] = useState(initialEntry?.username ?? '');
  const [password, setPassword] = useState(initialEntry?.password ?? '');
  const [notes, setNotes] = useState(initialEntry?.notes ?? '');
  const [category, setCategory] = useState(initialEntry?.category ?? 'Personal');
  const [tags, setTags] = useState(initialEntry?.tags.join(', ') ?? '');
  const [revealPassword, setRevealPassword] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorOptions, setGeneratorOptions] = useState(DEFAULT_GENERATOR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => measurePasswordStrength(password), [password]);
  const duplicatePassword = Boolean(password) && existingEntries.some(
    (entry) => entry.password === password && entry.id !== initialEntry?.id,
  );

  const toggleGeneratorOption = (key: keyof Omit<GeneratorOptions, 'length'>) => {
    setGeneratorOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const makeGeneratedPassword = async () => {
    try {
      const generated = await generatePassword(generatorOptions);
      setPassword(generated);
      setRevealPassword(true);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not generate a password.');
    }
  };

  const submit = async () => {
    const cleanTitle = title.trim();
    const cleanPassword = password;
    const cleanWebsite = normalizeWebsite(website);
    const cleanTags = [...new Set(tags.split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
    if (!cleanTitle) {
      setError('Add a name for this login.');
      return;
    }
    if (!cleanPassword) {
      setError('Add a password or generate one first.');
      return;
    }
    if (cleanPassword.length > 4_096 || notes.length > 10_000 || cleanTags.some((tag) => tag.length > 40)) {
      setError('One or more fields are too long. Shorten them and try again.');
      return;
    }
    if (cleanWebsite === null) {
      setError('Enter a valid website address, such as example.com.');
      return;
    }

    const now = Date.now();
    const entry: PasswordEntry = {
      id: initialEntry?.id ?? Crypto.randomUUID(),
      title: cleanTitle,
      website: cleanWebsite,
      username: username.trim(),
      password: cleanPassword,
      notes: notes.trim(),
      category,
      tags: cleanTags,
      favorite: initialEntry?.favorite ?? false,
      createdAt: initialEntry?.createdAt ?? now,
      updatedAt: now,
    };

    setSaving(true);
    setError(null);
    Keyboard.dismiss();
    try {
      await onSave(entry);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this entry.');
    } finally {
      setSaving(false);
    }
  };

  const strengthColor = [
    colors.danger,
    colors.danger,
    colors.accent,
    colors.primary,
    colors.success,
  ][strength.score];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <KeyboardAwareScrollViewCompat
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 26 },
          ]}
          bottomOffset={76}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>{initialEntry ? 'EDIT LOGIN' : 'NEW LOGIN'}</Text>
              <Text style={styles.title}>{initialEntry ? 'Update entry' : 'Save a login'}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close password entry form"
              onPress={onClose}
              style={({ pressed }) => [styles.iconButton, { borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <TextField
            label="Name"
            placeholder="For example, Personal email"
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            autoCapitalize="sentences"
            returnKeyType="next"
          />
          <TextField
            label="Website"
            placeholder="example.com"
            value={website}
            onChangeText={setWebsite}
            maxLength={2_048}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="next"
          />
          <TextField
            label="Username or email"
            placeholder="name@example.com"
            value={username}
            onChangeText={setUsername}
            maxLength={250}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            returnKeyType="next"
          />

          <View style={styles.passwordGroup}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Password</Text>
            <View style={[styles.passwordRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <NativeTextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter or generate a password"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!revealPassword}
                textContentType="newPassword"
                accessibilityLabel="Password"
                style={[styles.passwordInput, { color: colors.text }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={revealPassword ? 'Hide password' : 'Show password'}
                onPress={() => setRevealPassword((value) => !value)}
                style={styles.inlineIcon}
              >
                <Ionicons name={revealPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.primary} />
              </Pressable>
            </View>
            {password ? (
              <View style={styles.strengthWrap} accessibilityLabel={`Password strength: ${strength.label}`}>
                <View style={[styles.strengthTrack, { backgroundColor: colors.surfaceMuted }]}>
                  <View style={[styles.strengthFill, { width: `${Math.max(14, strength.score * 25)}%`, backgroundColor: strengthColor }]} />
                </View>
                <Text style={[styles.strengthLabel, { color: strengthColor }]}>{strength.label}</Text>
              </View>
            ) : null}
            {duplicatePassword ? (
              <View style={[styles.warning, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="warning-outline" size={18} color={colors.accent} />
                <Text style={[styles.warningText, { color: colors.text }]}>
                  This password is already used in another entry. Reusing passwords increases risk.
                </Text>
              </View>
            ) : null}
          </View>

          <Button
            label={generatorOpen ? 'Close password generator' : 'Generate a strong password'}
            variant="tonal"
            onPress={() => setGeneratorOpen((value) => !value)}
          />

          {generatorOpen ? (
            <View style={[styles.generator, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.generatorHeading}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.generatorTitle}>Password generator</Text>
                  <Text style={[styles.generatorHint, { color: colors.textSecondary }]}>Created with your device’s secure random source.</Text>
                </View>
                <View style={styles.lengthControl}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Decrease password length"
                    onPress={() => setGeneratorOptions((current) => ({ ...current, length: Math.max(8, current.length - 1) }))}
                    style={[styles.lengthButton, { borderColor: colors.border }]}
                  >
                    <Ionicons name="remove" size={18} color={colors.text} />
                  </Pressable>
                  <Text style={styles.lengthValue}>{generatorOptions.length}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Increase password length"
                    onPress={() => setGeneratorOptions((current) => ({ ...current, length: Math.min(64, current.length + 1) }))}
                    style={[styles.lengthButton, { borderColor: colors.border }]}
                  >
                    <Ionicons name="add" size={18} color={colors.text} />
                  </Pressable>
                </View>
              </View>
              {([
                ['lowercase', 'Lowercase letters'],
                ['uppercase', 'Uppercase letters'],
                ['numbers', 'Numbers'],
                ['symbols', 'Symbols'],
              ] as const).map(([key, label]) => (
                <View key={key} style={styles.optionRow}>
                  <Text style={styles.optionLabel}>{label}</Text>
                  <Switch
                    value={generatorOptions[key]}
                    onValueChange={() => toggleGeneratorOption(key)}
                    trackColor={{ false: colors.borderStrong, true: colors.primary }}
                    accessibilityLabel={label}
                  />
                </View>
              ))}
              <Button label="Generate and use" onPress={() => void makeGeneratedPassword()} size="compact" />
            </View>
          ) : null}

          <Text style={[styles.sectionLabel, { color: colors.text }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {VAULT_CATEGORIES.map((item) => {
              const selected = category === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setCategory(item)}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.categoryText, { color: selected ? colors.onPrimary : colors.textSecondary }]}>{item}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <TextField
            label="Tags"
            placeholder="Separate tags with commas"
            value={tags}
            onChangeText={setTags}
            maxLength={500}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <TextField
            label="Notes"
            placeholder="Optional details"
            value={notes}
            onChangeText={setNotes}
            maxLength={10_000}
            multiline
            returnKeyType="default"
          />

          {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          <Button
            label={saving ? 'Saving…' : duplicatePassword ? 'Save anyway' : initialEntry ? 'Save changes' : 'Save login'}
            onPress={() => void submit()}
            loading={saving}
            disabled={saving}
          />
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={styles.cancelButton}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 22, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerCopy: { gap: 4 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: '#6C7C70' },
  title: { fontSize: 27, fontWeight: '900' },
  iconButton: { minWidth: 46, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
  passwordGroup: { gap: 7 },
  passwordRow: { minHeight: 52, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  passwordInput: { flex: 1, minHeight: 48, paddingVertical: 10, fontSize: 16 },
  inlineIcon: { minWidth: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  strengthTrack: { flex: 1, height: 5, borderRadius: 5, overflow: 'hidden' },
  strengthFill: { height: 5, borderRadius: 5 },
  strengthLabel: { minWidth: 76, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  warning: { flexDirection: 'row', gap: 9, padding: 12, borderRadius: 14, alignItems: 'flex-start' },
  warningText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  generator: { padding: 16, borderWidth: 1, borderRadius: 18, gap: 10 },
  generatorHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 },
  generatorTitle: { fontSize: 15, fontWeight: '800' },
  generatorHint: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  lengthControl: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  lengthButton: { width: 34, height: 34, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  lengthValue: { minWidth: 24, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 42 },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginBottom: -7 },
  chipRow: { gap: 8, paddingVertical: 3 },
  categoryChip: { minHeight: 38, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1, borderRadius: 20 },
  categoryText: { fontSize: 13, fontWeight: '700' },
  error: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontWeight: '700' },
});
