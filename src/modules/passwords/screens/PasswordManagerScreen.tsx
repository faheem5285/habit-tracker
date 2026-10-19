import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../../../context/SettingsContext';
import { Text } from '../../../components/Themed';
import TextField from '../../../components/TextField';
import Button from '../../../components/Button';
import Card from '../../../components/Card';
import Chip from '../../../components/Chip';
import ModulesButton from '../../../components/ModulesButton';
import { ScreenLoader } from '../../../components/ScreenLoader';
import { usePasswordVault } from '../PasswordVaultContext';
import {
  decryptVaultEnvelope,
  measurePasswordStrength,
  validateVaultEnvelope,
} from '../crypto';
import { copySecretTemporarily } from '../clipboard';
import PasswordEntryForm from '../components/PasswordEntryForm';
import type { PasswordEntry, VaultEnvelope } from '../types';
import { SCREEN_PADDING } from '../../../ui';

const FILTERS = ['All', 'Favorites', ...['Personal', 'Finance', 'Work', 'Social', 'Shopping', 'Other']];
const MAX_IMPORT_BYTES = 2_000_000;

export default function PasswordManagerScreen() {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const vault = usePasswordVault();
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [editingEntry, setEditingEntry] = useState<PasswordEntry | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSelectedPassword, setShowSelectedPassword] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importEnvelope, setImportEnvelope] = useState<VaultEnvelope | null>(null);
  const [importPassphrase, setImportPassphrase] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmNewPassphrase, setConfirmNewPassphrase] = useState('');
  const [showNewPassphrase, setShowNewPassphrase] = useState(false);
  const [operationBusy, setOperationBusy] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  useEffect(() => {
    if (!vault.unlocked) {
      setSelectedId(null);
      setShowSelectedPassword(false);
      setFormOpen(false);
      setSettingsOpen(false);
      setImportOpen(false);
      setImportPassphrase('');
      setNewPassphrase('');
      setConfirmNewPassphrase('');
    } else if (importEnvelope) {
      setImportOpen(true);
    }
  }, [vault.unlocked, importEnvelope]);

  const selectedEntry = useMemo(
    () => vault.entries.find((entry) => entry.id === selectedId) ?? null,
    [vault.entries, selectedId],
  );

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return [...vault.entries]
      .filter((entry) => activeFilter === 'All' || (
        activeFilter === 'Favorites' ? entry.favorite : entry.category === activeFilter
      ))
      .filter((entry) => {
        if (!needle) return true;
        return [
          entry.title,
          entry.website,
          entry.username,
          entry.category,
          ...entry.tags,
        ].some((field) => field.toLocaleLowerCase().includes(needle));
      })
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);
  }, [vault.entries, activeFilter, query]);

  const closeAuthForm = () => {
    setPassphrase('');
    setConfirmPassphrase('');
    setAuthError(null);
  };

  const submitAuth = async () => {
    setOperationBusy(true);
    setAuthError(null);
    try {
      if (vault.vaultExists) {
        await vault.unlockVault(passphrase);
      } else {
        if (passphrase !== confirmPassphrase) {
          setAuthError('The passphrases do not match.');
          return;
        }
        await vault.createVault(passphrase);
      }
      closeAuthForm();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not open the password vault.');
    } finally {
      setOperationBusy(false);
    }
  };

  const saveEntry = async (entry: PasswordEntry) => {
    await vault.saveEntry(entry);
    setFormOpen(false);
    setEditingEntry(null);
  };

  const toggleFavorite = async (entry: PasswordEntry) => {
    try {
      await vault.setFavorite(entry.id, !entry.favorite);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Could not update this favorite.');
    }
  };

  const removeEntry = (entry: PasswordEntry) => {
    Alert.alert(
      'Delete saved login?',
      `“${entry.title}” will be removed from this vault. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void vault.deleteEntry(entry.id).then(() => {
              setSelectedId(null);
              setShowSelectedPassword(false);
            }).catch((error: unknown) => {
              setOperationError(error instanceof Error ? error.message : 'Could not delete this login.');
            });
          },
        },
      ],
    );
  };

  const copyPassword = async (value: string) => {
    try {
      await copySecretTemporarily(value);
      Alert.alert('Copied', 'Clipboard access will be cleared in 30 seconds if the copied value is still there.');
    } catch {
      setOperationError('Could not copy this password. Check clipboard access on your device.');
    }
  };

  const exportEncryptedBackup = async () => {
    setOperationBusy(true);
    setOperationError(null);
    let fileUri: string | null = null;
    try {
      const directory = FileSystem.cacheDirectory;
      if (!directory) throw new Error('Temporary file storage is not available on this device.');
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Secure file sharing is not available on this device.');
      }
      fileUri = `${directory}momentum-encrypted-vault-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, vault.exportEncryptedBackup(), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Share encrypted Momentum vault',
      });
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Could not export the encrypted backup.');
    } finally {
      if (fileUri) await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
      setOperationBusy(false);
    }
  };

  const chooseEncryptedBackup = async () => {
    setOperationBusy(true);
    setOperationError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if ((file.size ?? 0) > MAX_IMPORT_BYTES) {
        throw new Error('That file is too large. Choose a Momentum encrypted vault backup under 2 MB.');
      }
      const raw = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (raw.length > MAX_IMPORT_BYTES) {
        throw new Error('That file is too large. Choose a Momentum encrypted vault backup under 2 MB.');
      }
      const parsed: unknown = JSON.parse(raw);
      setImportEnvelope(validateVaultEnvelope(parsed));
      setImportPassphrase('');
      setImportOpen(true);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Could not read that encrypted backup.');
    } finally {
      setOperationBusy(false);
    }
  };

  const mergeEncryptedBackup = async () => {
    if (!importEnvelope) return;
    setOperationBusy(true);
    setOperationError(null);
    let key: Uint8Array | null = null;
    try {
      const imported = await decryptVaultEnvelope(importEnvelope, importPassphrase);
      key = imported.key;
      const count = await vault.mergeImportedEntries(imported.entries);
      setImportOpen(false);
      setImportEnvelope(null);
      setImportPassphrase('');
      Alert.alert('Import complete', `${count} encrypted entries were merged into this vault.`);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Could not import this encrypted backup.');
    } finally {
      key?.fill(0);
      setOperationBusy(false);
    }
  };

  const changeMasterPassphrase = async () => {
    setOperationError(null);
    if (newPassphrase !== confirmNewPassphrase) {
      setOperationError('The new passphrases do not match.');
      return;
    }
    if (newPassphrase.length < 12) {
      setOperationError('Use at least 12 characters for the new master passphrase.');
      return;
    }
    setOperationBusy(true);
    try {
      await vault.changeMasterPassphrase(newPassphrase);
      setNewPassphrase('');
      setConfirmNewPassphrase('');
      Alert.alert('Passphrase updated', 'Your vault was re-encrypted with the new passphrase.');
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Could not change the master passphrase.');
    } finally {
      setOperationBusy(false);
    }
  };

  const openWebsite = async (website: string) => {
    const url = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    try {
      await Linking.openURL(url);
    } catch {
      setOperationError('Could not open this website on your device.');
    }
  };

  if (!vault.ready) {
    return <ScreenLoader label="Loading your encrypted vault" />;
  }

  const webInsets = Platform.OS === 'web';
  const topInset = webInsets ? 67 : Math.max(insets.top, 12);
  const bottomInset = webInsets ? 34 : insets.bottom;

  if (vault.loadError) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.authContent, { paddingTop: topInset, paddingBottom: bottomInset + 24 }]}>
          <ModuleHeader title="Password Manager" subtitle="Vault storage needs attention." />
          <Card style={styles.authCard}>
            <View style={[styles.authIcon, { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name="warning-outline" size={27} color={colors.danger} />
            </View>
            <Text style={styles.authTitle}>Couldn’t read the vault</Text>
            <Text style={[styles.bodyCopy, { color: colors.textSecondary }]}>{vault.loadError}</Text>
            <Text style={[styles.bodyCopy, { color: colors.textSecondary }]}>
              Your stored data has not been reset. Try again or restore an encrypted vault backup.
            </Text>
            <Button label="Try again" onPress={() => void vault.refresh()} />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (!vault.unlocked) {
    const setup = !vault.vaultExists;
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <ScrollView
          contentContainerStyle={[
            styles.authContent,
            { paddingTop: topInset, paddingBottom: bottomInset + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <ModuleHeader title="Password Manager" subtitle={setup ? 'Create your private vault.' : 'Unlock your saved logins.'} />
          <Card style={styles.authCard}>
            <View style={[styles.authIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={setup ? 'key-outline' : 'lock-closed-outline'} size={27} color={colors.primary} />
            </View>
            <Text style={styles.authTitle}>{setup ? 'Start with a strong passphrase' : 'Welcome back'}</Text>
            <Text style={[styles.bodyCopy, { color: colors.textSecondary }]}>
              {operationBusy
                ? 'Deriving your encryption key securely. Older vaults may take longer on the first unlock; keep the app open.'
                : setup
                ? 'Your passphrase derives the encryption key. It is never stored. Use 12 or more characters that you will remember.'
                : 'Enter the master passphrase you chose when you created this vault.'}
            </Text>
            <TextField
              label="Master passphrase"
              placeholder="At least 12 characters"
              value={passphrase}
              onChangeText={setPassphrase}
              secureTextEntry={!showPassphrase}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={setup ? 'newPassword' : 'password'}
              returnKeyType={setup ? 'next' : 'go'}
              onSubmitEditing={() => {
                if (!setup) void submitAuth();
              }}
            />
            {setup ? (
              <TextField
                label="Confirm passphrase"
                placeholder="Enter it again"
                value={confirmPassphrase}
                onChangeText={setConfirmPassphrase}
                secureTextEntry={!showPassphrase}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={() => void submitAuth()}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassphrase ? 'Hide master passphrase' : 'Show master passphrase'}
              onPress={() => setShowPassphrase((value) => !value)}
              style={styles.showPassword}
            >
              <Ionicons name={showPassphrase ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
              <Text style={[styles.showPasswordText, { color: colors.primary }]}>{showPassphrase ? 'Hide passphrase' : 'Show passphrase'}</Text>
            </Pressable>
            {authError ? <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.danger }]}>{authError}</Text> : null}
            <Button
              label={operationBusy ? setup ? 'Creating vault…' : 'Unlocking securely…' : setup ? 'Create encrypted vault' : 'Unlock vault'}
              onPress={() => void submitAuth()}
              loading={operationBusy}
              disabled={operationBusy}
            />
          </Card>
          <Card style={styles.securityCard}>
            <Ionicons name="shield-checkmark-outline" size={19} color={colors.primary} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={styles.securityTitle}>Encrypted on this device</Text>
              <Text style={[styles.securityNote, { color: colors.textSecondary }]}>
                The encrypted vault is included in full recovery backups. You still need its master passphrase to unlock it after restoring; keep that passphrase safe.
              </Text>
            </View>
          </Card>
          {webInsets ? (
            <Text style={[styles.webWarning, { color: colors.accent }]}>
              Browser storage depends on the privacy of this browser profile. Use the installed mobile app for sensitive vault use.
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top']}
      onTouchStart={vault.touch}
    >
      <ScrollView
        contentContainerStyle={[
          styles.page,
          {
            paddingTop: webInsets ? 67 : 12,
            paddingBottom: bottomInset + 28,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <View style={styles.pageTitleGroup}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>PRIVATE BY DESIGN</Text>
            <Text style={styles.pageTitle}>Password vault</Text>
            <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
              {vault.entries.length} {vault.entries.length === 1 ? 'login' : 'logins'} · encrypted on this device
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Vault settings"
              onPress={() => setSettingsOpen(true)}
              style={({ pressed }) => [styles.headerIcon, { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="settings-outline" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lock password vault"
              onPress={vault.lockVault}
              style={({ pressed }) => [styles.headerIcon, { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
            >
              <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
            </Pressable>
            <ModulesButton />
          </View>
        </View>

        <LinearGradient
          colors={[colors.navy, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroText}>
            <Text style={styles.heroEyebrow}>YOUR LOGINS, IN ONE PLACE</Text>
            <Text style={styles.heroTitle}>One strong passphrase. No forgotten logins.</Text>
            <Text style={styles.heroBody}>Passwords are encrypted locally. Lock the vault whenever you step away.</Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark" size={29} color="#D8F1DF" />
          </View>
        </LinearGradient>

        <View style={styles.actionRow}>
          <Button
            label="Add login"
            onPress={() => {
              setEditingEntry(null);
              setFormOpen(true);
            }}
            style={styles.actionButton}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Export encrypted vault backup"
            disabled={operationBusy}
            onPress={() => void exportEncryptedBackup()}
            style={({ pressed }) => [
              styles.secondaryAction,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed || operationBusy ? 0.65 : 1 },
            ]}
          >
            <Ionicons name="download-outline" size={18} color={colors.primary} />
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>Export</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import encrypted vault backup"
            disabled={operationBusy}
            onPress={() => void chooseEncryptedBackup()}
            style={({ pressed }) => [
              styles.secondaryAction,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed || operationBusy ? 0.65 : 1 },
            ]}
          >
            <Ionicons name="push-outline" size={18} color={colors.primary} />
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>Import</Text>
          </Pressable>
        </View>

        {operationError ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss message"
            onPress={() => setOperationError(null)}
            style={[styles.errorBanner, { backgroundColor: colors.dangerSoft }]}
          >
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={[styles.errorBannerText, { color: colors.danger }]}>{operationError}</Text>
            <Ionicons name="close" size={17} color={colors.danger} />
          </Pressable>
        ) : null}

        <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={19} color={colors.muted} />
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder="Search names, sites, usernames or tags"
            accessibilityLabel="Search password entries"
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={styles.searchInputWrap}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery('')}
              style={styles.clearSearch}
            >
              <Ionicons name="close-circle" size={19} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((filter) => (
            <Chip
              key={filter}
              label={filter}
              selected={activeFilter === filter}
              onPress={() => setActiveFilter(filter)}
            />
          ))}
        </ScrollView>

        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>{activeFilter === 'Favorites' ? 'Favorites' : 'Saved logins'}</Text>
          <Text style={[styles.resultCount, { color: colors.muted }]}>{filteredEntries.length} shown</Text>
        </View>

        {filteredEntries.length === 0 ? (
          <Card style={styles.emptyCard}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={query ? 'search-outline' : 'key-outline'} size={27} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{query ? 'No matching logins' : 'Your vault is ready'}</Text>
            <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>
              {query
                ? 'Try another name, website, username or tag.'
                : 'Save your first login. You can search, sort by category, mark favorites and create unique passwords as you go.'}
            </Text>
            {query ? (
              <Button label="Clear search" onPress={() => setQuery('')} variant="tonal" />
            ) : (
              <Button
                label="Add your first login"
                onPress={() => {
                  setEditingEntry(null);
                  setFormOpen(true);
                }}
              />
            )}
          </Card>
        ) : (
          <View style={styles.entryList}>
            {filteredEntries.map((entry) => (
              <Card key={entry.id} style={styles.entryCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${entry.title}`}
                  onPress={() => {
                    setSelectedId(entry.id);
                    setShowSelectedPassword(false);
                  }}
                  style={styles.entryMain}
                >
                  <View style={[styles.entryIcon, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons name={iconForCategory(entry.category)} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.entryCopy}>
                    <Text numberOfLines={1} style={styles.entryTitle}>{entry.title}</Text>
                    <Text numberOfLines={1} style={[styles.entrySubtitle, { color: colors.textSecondary }]}>
                      {entry.website || entry.username || entry.category}
                    </Text>
                    <View style={styles.entryMeta}>
                      <Text style={[styles.categoryLabel, { color: colors.primary, backgroundColor: colors.primarySoft }]}>{entry.category}</Text>
                      {entry.tags.slice(0, 2).map((tag) => (
                        <Text key={tag} numberOfLines={1} style={[styles.tagLabel, { color: colors.muted }]}>{tag}</Text>
                      ))}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={entry.favorite ? `Remove ${entry.title} from favorites` : `Add ${entry.title} to favorites`}
                  onPress={() => void toggleFavorite(entry)}
                  style={styles.favoriteButton}
                >
                  <Ionicons name={entry.favorite ? 'star' : 'star-outline'} size={19} color={entry.favorite ? colors.accent : colors.muted} />
                </Pressable>
              </Card>
            ))}
          </View>
        )}

        <Card style={styles.securityFooter}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={[styles.footerCopy, { color: colors.textSecondary }]}>
            Full recovery backups include the encrypted vault. Keep your recovery code and vault master passphrase safe.
          </Text>
        </Card>
      </ScrollView>

      <PasswordEntryForm
        key={editingEntry?.id ?? 'new-entry'}
        visible={formOpen}
        initialEntry={editingEntry}
        existingEntries={vault.entries}
        onClose={() => {
          setFormOpen(false);
          setEditingEntry(null);
        }}
        onSave={saveEntry}
      />

      <Modal
        visible={Boolean(selectedEntry)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedId(null)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(5, 18, 12, 0.58)' }]}>
          {selectedEntry ? (
            <ScrollView
              style={[styles.detailCard, { backgroundColor: colors.background, borderColor: colors.border }]}
              contentContainerStyle={styles.detailContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.detailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eyebrow, { color: colors.primary }]}>{selectedEntry.category.toUpperCase()}</Text>
                  <Text style={styles.detailTitle}>{selectedEntry.title}</Text>
                  {selectedEntry.website ? <Text style={[styles.detailWebsite, { color: colors.textSecondary }]}>{selectedEntry.website}</Text> : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close login details"
                  onPress={() => setSelectedId(null)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>

              {selectedEntry.website ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void openWebsite(selectedEntry.website)}
                  style={[styles.websiteAction, { backgroundColor: colors.primarySoft }]}
                >
                  <Ionicons name="open-outline" size={16} color={colors.primary} />
                  <Text style={[styles.websiteActionText, { color: colors.primary }]}>Open website</Text>
                </Pressable>
              ) : null}
              <DetailValue label="Username" value={selectedEntry.username || 'Not set'} />
              <View style={[styles.detailField, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.detailFieldHeading}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Password</Text>
                  <View style={styles.detailActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={showSelectedPassword ? 'Hide saved password' : 'Reveal saved password'}
                      onPress={() => setShowSelectedPassword((value) => !value)}
                      style={styles.detailIconButton}
                    >
                      <Ionicons name={showSelectedPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Copy saved password"
                      onPress={() => void copyPassword(selectedEntry.password)}
                      style={styles.detailIconButton}
                    >
                      <Ionicons name="copy-outline" size={17} color={colors.primary} />
                    </Pressable>
                  </View>
                </View>
                <Text selectable style={[styles.passwordValue, { color: colors.text }]}>
                  {showSelectedPassword ? selectedEntry.password : '••••••••••••'}
                </Text>
                <Text style={[styles.strengthLabel, { color: colors.muted }]}>
                  Strength: {measurePasswordStrength(selectedEntry.password).label}
                </Text>
              </View>
              {selectedEntry.notes ? <DetailValue label="Notes" value={selectedEntry.notes} multiline /> : null}
              {selectedEntry.tags.length ? <DetailValue label="Tags" value={selectedEntry.tags.join(' · ')} /> : null}
              <View style={styles.detailFooter}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete login"
                  onPress={() => removeEntry(selectedEntry)}
                  style={[styles.dangerAction, { backgroundColor: colors.dangerSoft }]}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
                <Button
                  label="Edit login"
                  onPress={() => {
                    setEditingEntry(selectedEntry);
                    setFormOpen(true);
                    setSelectedId(null);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={settingsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(5, 18, 12, 0.58)' }]}>
          <ScrollView
            style={[styles.settingsSheet, { backgroundColor: colors.background, borderColor: colors.border }]}
            contentContainerStyle={styles.settingsContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.detailHeader}>
              <View>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>VAULT CONTROLS</Text>
                <Text style={styles.detailTitle}>Security settings</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close vault settings"
                onPress={() => setSettingsOpen(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <Text style={styles.settingLabel}>Lock after inactivity</Text>
            <Text style={[styles.bodyCopy, { color: colors.textSecondary }]}>The vault also locks whenever Momentum leaves the foreground.</Text>
            <View style={styles.timeoutChoices}>
              {[1, 5, 15].map((minutes) => (
                <Chip
                  key={minutes}
                  label={`${minutes} min`}
                  selected={vault.timeoutMinutes === minutes}
                  onPress={() => void vault.setTimeoutMinutes(minutes).catch((error: unknown) => {
                    setOperationError(error instanceof Error ? error.message : 'Could not save the lock timeout.');
                  })}
                />
              ))}
            </View>
            <View style={styles.settingsDivider} />
            <Text style={styles.settingLabel}>Change master passphrase</Text>
            <Text style={[styles.bodyCopy, { color: colors.textSecondary }]}>Your entries will be re-encrypted before the new passphrase is used.</Text>
            <TextField
              label="New passphrase"
              value={newPassphrase}
              onChangeText={setNewPassphrase}
              placeholder="At least 12 characters"
              secureTextEntry={!showNewPassphrase}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              maxLength={256}
            />
            <TextField
              label="Confirm new passphrase"
              value={confirmNewPassphrase}
              onChangeText={setConfirmNewPassphrase}
              placeholder="Enter it again"
              secureTextEntry={!showNewPassphrase}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              maxLength={256}
            />
            <Pressable onPress={() => setShowNewPassphrase((value) => !value)} style={styles.showPassword}>
              <Ionicons name={showNewPassphrase ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.primary} />
              <Text style={[styles.showPasswordText, { color: colors.primary }]}>{showNewPassphrase ? 'Hide passphrase' : 'Show passphrase'}</Text>
            </Pressable>
            {operationError ? <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.danger }]}>{operationError}</Text> : null}
            <Button
              label={operationBusy ? 'Updating…' : 'Re-encrypt vault'}
              onPress={() => void changeMasterPassphrase()}
              loading={operationBusy}
              disabled={operationBusy}
            />
            <Text style={[styles.securityNote, { color: colors.textSecondary }]}>
              No passphrase reset is available. Export an encrypted backup before changing devices.
            </Text>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={importOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setImportOpen(false);
          setImportEnvelope(null);
          setImportPassphrase('');
        }}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(5, 18, 12, 0.58)' }]}>
          <View style={[styles.importCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.eyebrow, { color: colors.primary }]}>ENCRYPTED BACKUP</Text>
                <Text style={styles.detailTitle}>Merge a vault backup</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel backup import"
                onPress={() => {
                  setImportOpen(false);
                  setImportEnvelope(null);
                  setImportPassphrase('');
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <Text style={[styles.bodyCopy, { color: colors.textSecondary }]}>
              Enter the passphrase used when this encrypted backup was created. Matching entry IDs will be updated; other entries will be added.
            </Text>
            <TextField
              label="Backup passphrase"
              value={importPassphrase}
              onChangeText={setImportPassphrase}
              placeholder="Enter backup passphrase"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              maxLength={256}
            />
            {operationError ? <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.danger }]}>{operationError}</Text> : null}
            <Button
              label={operationBusy ? 'Checking backup…' : 'Decrypt and merge'}
              onPress={() => void mergeEncryptedBackup()}
              loading={operationBusy}
              disabled={operationBusy || !importPassphrase}
            />
            <Pressable
              onPress={() => {
                setImportOpen(false);
                setImportEnvelope(null);
                setImportPassphrase('');
              }}
              style={styles.cancelImport}
            >
              <Text style={[styles.showPasswordText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ModuleHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors } = useSettings();
  return (
    <View style={styles.pageHeader}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>MOMENTUM</Text>
        <Text style={styles.pageTitle}>{title}</Text>
        <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <ModulesButton />
    </View>
  );
}

function DetailValue({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const { colors } = useSettings();
  return (
    <View style={[styles.detailField, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text selectable style={[styles.detailValue, { color: colors.text }, multiline && styles.multilineValue]}>{value}</Text>
    </View>
  );
}

function iconForCategory(category: string): keyof typeof Ionicons.glyphMap {
  switch (category) {
    case 'Finance': return 'card-outline';
    case 'Work': return 'briefcase-outline';
    case 'Social': return 'chatbubbles-outline';
    case 'Shopping': return 'bag-outline';
    case 'Other': return 'grid-outline';
    default: return 'person-outline';
  }
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  page: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: SCREEN_PADDING, gap: 16 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  pageTitleGroup: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  pageTitle: { fontSize: 27, fontWeight: '900', marginTop: 5 },
  pageSubtitle: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 15 },
  hero: { minHeight: 148, borderRadius: 23, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, overflow: 'hidden' },
  heroText: { flex: 1, gap: 7 },
  heroEyebrow: { color: '#D0E9D8', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 25, fontWeight: '900', maxWidth: 390 },
  heroBody: { color: '#DFEEE3', fontSize: 12, lineHeight: 17, maxWidth: 380 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1 },
  secondaryAction: { minHeight: 50, minWidth: 72, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  secondaryActionText: { fontSize: 12, fontWeight: '700' },
  errorBanner: { minHeight: 46, paddingHorizontal: 12, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorBannerText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  searchWrap: { minHeight: 54, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  searchInputWrap: { flex: 1 },
  searchInput: { minHeight: 49, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent', paddingHorizontal: 0 },
  clearSearch: { minWidth: 32, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  filters: { gap: 8, paddingRight: 8 },
  listHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  resultCount: { fontSize: 12, fontWeight: '600' },
  entryList: { gap: 10 },
  entryCard: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 12, borderRadius: 19 },
  entryMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  entryIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  entryCopy: { flex: 1, gap: 3 },
  entryTitle: { fontSize: 15, fontWeight: '800' },
  entrySubtitle: { fontSize: 12, maxWidth: 260 },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  categoryLabel: { overflow: 'hidden', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, fontSize: 10, fontWeight: '800' },
  tagLabel: { maxWidth: 74, fontSize: 10, fontWeight: '600' },
  favoriteButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { alignItems: 'center', gap: 12, paddingVertical: 25, borderRadius: 22 },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyCopy: { maxWidth: 390, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 4 },
  securityFooter: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: 15 },
  footerCopy: { flex: 1, fontSize: 11, lineHeight: 16 },
  authContent: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 22, gap: 16 },
  authCard: { gap: 14, borderRadius: 22 },
  authIcon: { width: 56, height: 56, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  authTitle: { fontSize: 21, fontWeight: '900' },
  bodyCopy: { fontSize: 13, lineHeight: 19 },
  showPassword: { alignSelf: 'flex-start', minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7 },
  showPasswordText: { fontSize: 13, fontWeight: '700' },
  errorText: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  securityCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderRadius: 18 },
  securityTitle: { fontSize: 13, fontWeight: '800' },
  securityNote: { fontSize: 11, lineHeight: 16 },
  webWarning: { fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  modalBackdrop: { flex: 1, paddingHorizontal: 18, paddingVertical: 24, alignItems: 'center', justifyContent: 'center' },
  detailCard: { width: '100%', maxWidth: 560, maxHeight: '92%', borderRadius: 23, borderWidth: 1 },
  detailContent: { gap: 12, padding: 19 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  detailTitle: { fontSize: 22, fontWeight: '900', marginTop: 4 },
  detailWebsite: { fontSize: 12, marginTop: 4 },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  websiteAction: { alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  websiteActionText: { fontSize: 12, fontWeight: '800' },
  detailField: { padding: 13, borderRadius: 15, borderWidth: 1, gap: 6 },
  detailFieldHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  detailActions: { flexDirection: 'row', gap: 5 },
  detailIconButton: { minWidth: 34, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  detailValue: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  multilineValue: { maxHeight: 130 },
  passwordValue: { fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },
  strengthLabel: { fontSize: 11, fontWeight: '600' },
  detailFooter: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4 },
  dangerAction: { width: 50, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  settingsSheet: { width: '100%', maxWidth: 560, maxHeight: '92%', borderRadius: 24, borderWidth: 1 },
  settingsContent: { padding: 20, gap: 13 },
  settingLabel: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  timeoutChoices: { flexDirection: 'row', gap: 8 },
  settingsDivider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
  importCard: { width: '100%', maxWidth: 520, gap: 14, padding: 20, borderWidth: 1, borderRadius: 23 },
  cancelImport: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
});
