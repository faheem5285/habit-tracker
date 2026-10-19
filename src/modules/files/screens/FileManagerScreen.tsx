import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../../components/Themed';
import Button from '../../../components/Button';
import Chip from '../../../components/Chip';
import ScreenHeader from '../../../components/ScreenHeader';
import { ScreenLoader } from '../../../components/ScreenLoader';
import { syncRecoveryData } from '../../../utils/recovery';
import { useSettings } from '../../../context/SettingsContext';
import {
  copyManagedFile,
  deleteManagedFile,
  FILE_CATEGORIES,
  getManagedFileBlob,
  getManagedFileUri,
  importManagedFile,
  loadManagedFiles,
  MAX_FILE_BYTES,
  MAX_IMAGE_PREVIEW_BYTES,
  MAX_PREVIEW_BYTES,
  moveManagedFile,
  readManagedText,
  renameManagedFile,
  sanitizeFileName,
  type FileCategory,
  type FileCategoryFilter,
  type ManagedFile,
} from '../storage';

type SortOrder = 'Recent' | 'Name' | 'Size' | 'Type';
type DialogKind = 'details' | 'rename' | 'move' | 'sort' | 'delete' | 'preview';

const FILE_FILTERS: FileCategoryFilter[] = ['All', ...FILE_CATEGORIES];
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'csv', 'json', 'log', 'xml', 'yaml', 'yml', 'html', 'css',
  'js', 'ts', 'jsx', 'tsx', 'sql', 'ini', 'conf',
]);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic']);

function extensionOf(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function categoryForFile(name: string, mimeType?: string | null): FileCategory {
  const mime = mimeType?.toLowerCase() ?? '';
  const extension = extensionOf(name);
  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) return 'Images';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime.startsWith('video/')) return 'Video';
  if (
    mime.startsWith('text/') ||
    mime === 'application/pdf' ||
    mime.includes('document') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt', 'ods'].includes(extension)
  ) return 'Documents';
  return 'Other';
}

function iconForCategory(category: FileCategory): keyof typeof Ionicons.glyphMap {
  if (category === 'Images') return 'image-outline';
  if (category === 'Audio') return 'musical-notes-outline';
  if (category === 'Video') return 'videocam-outline';
  if (category === 'Documents') return 'document-text-outline';
  return 'document-outline';
}

function formatSize(size: number) {
  if (size < 1_000) return `${size} B`;
  if (size < 1_000_000) return `${(size / 1_000).toFixed(size < 10_000 ? 1 : 0)} KB`;
  return `${(size / 1_000_000).toFixed(size < 10_000_000 ? 1 : 0)} MB`;
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isInlineImage(file: ManagedFile) {
  return file.category === 'Images' ||
    file.mimeType.startsWith('image/') ||
    IMAGE_EXTENSIONS.has(extensionOf(file.name));
}

function isInlineText(file: ManagedFile) {
  return file.mimeType.startsWith('text/') || TEXT_EXTENSIONS.has(extensionOf(file.name));
}

function fileError(error: unknown) {
  return error instanceof Error ? error.message : 'The file action could not be completed.';
}

export default function FileManagerScreen() {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const [files, setFiles] = useState<ManagedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FileCategoryFilter>('All');
  const [sortOrder, setSortOrder] = useState<SortOrder>('Recent');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [selectedFile, setSelectedFile] = useState<ManagedFile | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const refreshFiles = useCallback(async () => {
    try {
      const items = await loadManagedFiles();
      setFiles(items);
      setError(null);
    } catch (cause) {
      setError(fileError(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void loadManagedFiles()
      .then((items) => {
        if (active) {
          setFiles(items);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(fileError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []));

  const visibleFiles = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const result = files
      .filter((file) => category === 'All' || file.category === category)
      .filter((file) => !needle || `${file.name} ${file.mimeType} ${file.category}`.toLocaleLowerCase().includes(needle));
    return result.sort((a, b) => {
      if (sortOrder === 'Name') return a.name.localeCompare(b.name);
      if (sortOrder === 'Size') return b.size - a.size;
      if (sortOrder === 'Type') return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      return b.updatedAt - a.updatedAt;
    });
  }, [files, category, query, sortOrder]);

  const perform = async (label: string, action: () => Promise<void>, backup = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setProgressLabel(label);
    setError(null);
    try {
      await action();
      if (backup) {
        void syncRecoveryData().catch((cause) => console.warn('File backup sync failed:', cause));
      }
    } catch (cause) {
      setError(fileError(cause));
      if (dialog) setDialog(null);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setProgressLabel('');
    }
  };

  const pickFiles = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      let imported = 0;
      const failures: string[] = [];
      for (let index = 0; index < result.assets.length; index += 1) {
        const asset = result.assets[index];
        if (!asset) continue;
        setProgressLabel(`Saving ${index + 1} of ${result.assets.length}`);
        try {
          const pickedSize = asset.size ?? asset.file?.size ?? 0;
          if (pickedSize > MAX_FILE_BYTES) {
            throw new Error('This file is over the 100 MB per-file limit.');
          }
          const saved = await importManagedFile({
            uri: asset.uri,
            name: asset.name,
            mimeType: asset.mimeType,
            size: asset.size,
            webFile: asset.file,
          }, categoryForFile(asset.name, asset.mimeType));
          setFiles((current) => [saved, ...current]);
          imported += 1;
        } catch (cause) {
          failures.push(`${sanitizeFileName(asset.name)}: ${fileError(cause)}`);
        }
      }
      if (failures.length) {
        setError(
          imported
            ? `${imported} file${imported === 1 ? '' : 's'} saved. ${failures[0]}`
            : failures[0] ?? 'No files were saved.',
        );
      }
      if (imported > 0) {
        void syncRecoveryData().catch((cause) => console.warn('File backup sync failed:', cause));
      }
    } catch (cause) {
      setError(fileError(cause));
    } finally {
      busyRef.current = false;
      setBusy(false);
      setProgressLabel('');
    }
  };

  const downloadFile = async (file: ManagedFile) => {
    await perform(Platform.OS === 'web' ? 'Preparing download' : 'Preparing file', async () => {
      if (Platform.OS === 'web') {
        const blob = await getManagedFileBlob(file);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1_000);
        return;
      }
      const uri = await getManagedFileUri(file);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: file.mimeType,
          dialogTitle: `Save or share ${file.name}`,
          UTI: file.mimeType === 'application/pdf' ? 'com.adobe.pdf' : undefined,
        });
      } else {
        await Share.share({ message: uri, title: file.name });
      }
    });
  };

  const openPreview = async (file: ManagedFile) => {
    setDialog('preview');
    setPreviewUri(null);
    setPreviewText(null);
    setPreviewMessage(null);
    setPreviewBusy(true);
    try {
      if (isInlineImage(file) && file.size > MAX_IMAGE_PREVIEW_BYTES) {
        setPreviewMessage(`This image is too large for an in-app preview. Download it to view it in another app.`);
      } else if (isInlineImage(file)) {
        setPreviewUri(await getManagedFileUri(file));
      } else if (file.size > MAX_PREVIEW_BYTES) {
        setPreviewMessage(`Preview is limited to ${formatSize(MAX_PREVIEW_BYTES)}. Download the file to open it in another app.`);
      } else if (isInlineText(file)) {
        setPreviewText(await readManagedText(file));
      } else {
        setPreviewMessage('This format cannot be previewed safely inside Momentum. Download it to open with a compatible app.');
      }
    } catch (cause) {
      setPreviewMessage(fileError(cause));
    } finally {
      setPreviewBusy(false);
    }
  };

  const closePreview = () => {
    if (Platform.OS === 'web' && previewUri?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUri);
    }
    setPreviewUri(null);
    setPreviewText(null);
    setPreviewMessage(null);
    setDialog(null);
  };

  const saveRename = async () => {
    if (!selectedFile) return;
    await perform('Renaming file', async () => {
      const updated = await renameManagedFile(selectedFile.id, renameValue);
      setFiles((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedFile(updated);
      setDialog('details');
    }, true);
  };

  const moveFile = async (nextCategory: FileCategory) => {
    if (!selectedFile) return;
    await perform('Moving file', async () => {
      const updated = await moveManagedFile(selectedFile.id, nextCategory);
      setFiles((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelectedFile(updated);
      setDialog('details');
    }, true);
  };

  const duplicateFile = async () => {
    if (!selectedFile) return;
    await perform('Copying file', async () => {
      const duplicate = await copyManagedFile(selectedFile.id);
      setFiles((current) => [duplicate, ...current]);
      setSelectedFile(duplicate);
      setDialog('details');
    }, true);
  };

  const removeFile = async () => {
    if (!selectedFile) return;
    await perform('Deleting file', async () => {
      await deleteManagedFile(selectedFile.id);
      setFiles((current) => current.filter((item) => item.id !== selectedFile.id));
      setSelectedFile(null);
      setDialog(null);
    }, true);
  };

  const openDetails = (file: ManagedFile) => {
    setSelectedFile(file);
    setDialog('details');
  };

  const contentInset = Platform.OS === 'web' ? 67 : Math.max(insets.top, 8);
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.fill}>
        <FlatList
          key={viewMode}
          data={visibleFiles}
          keyExtractor={(file) => file.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
          contentContainerStyle={[
            styles.content,
            { paddingTop: contentInset, paddingBottom: bottomInset + 28 },
            visibleFiles.length === 0 && styles.emptyContent,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <FileCard
              file={item}
              grid={viewMode === 'grid'}
              onPress={() => openDetails(item)}
            />
          )}
          ListHeaderComponent={
            <View>
              <ScreenHeader
                title="File library"
                subtitle="A private place for the files you want to keep close."
                style={styles.header}
              />
              <View style={[styles.privacyNote, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="lock-closed-outline" size={17} color={colors.primary} />
                <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                  {Platform.OS === 'web'
                    ? 'Files stay in this browser profile and are encrypted before they are included in recovery backups. Up to 100 MB per file.'
                    : 'Files stay in this app’s private storage and are encrypted before they are included in recovery backups. Up to 100 MB per file.'}
                </Text>
              </View>

              <Button
                label={busy ? (progressLabel || 'Please wait…') : 'Add files'}
                onPress={() => void pickFiles()}
                loading={busy}
                disabled={busy}
                accessibilityLabel="Add files to the private library"
                style={styles.addButton}
              />

              {error ? (
                <View style={[styles.errorBanner, { backgroundColor: colors.dangerSoft }]}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                  <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.danger }]}>
                    {error}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss file library message"
                    onPress={() => setError(null)}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              ) : null}

              <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={19} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search files"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Search files"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  style={[styles.searchInput, { color: colors.text }]}
                />
                {query ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear file search"
                    onPress={() => setQuery('')}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={19} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filters}
              >
                {FILE_FILTERS.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={category === item}
                    onPress={() => setCategory(item)}
                  />
                ))}
              </ScrollView>

              <View style={styles.listHeading}>
                <View style={styles.listHeadingCopy}>
                  <Text style={styles.sectionTitle}>{category === 'All' ? 'Your files' : category}</Text>
                  <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
                    {visibleFiles.length} {visibleFiles.length === 1 ? 'file' : 'files'}
                  </Text>
                </View>
                <View style={styles.viewActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Sort files, currently ${sortOrder}`}
                    onPress={() => setDialog('sort')}
                    style={[styles.toolButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  >
                    <Ionicons name="swap-vertical-outline" size={18} color={colors.text} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={viewMode === 'list' ? 'Show files in a grid' : 'Show files in a list'}
                    onPress={() => setViewMode((current) => current === 'list' ? 'grid' : 'list')}
                    style={[styles.toolButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  >
                    <Ionicons
                      name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
                      size={18}
                      color={colors.text}
                    />
                  </Pressable>
                </View>
              </View>
              <View style={styles.sortLabelRow}>
                <Text style={[styles.sortLabel, { color: colors.muted }]}>Sort by {sortOrder.toLowerCase()}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refresh files"
                  onPress={() => {
                    setLoading(true);
                    void refreshFiles();
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="refresh-outline" size={17} color={colors.muted} />
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? null : (
              <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name={query ? 'search-outline' : 'folder-open-outline'} size={25} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>{query ? 'No files found' : 'Your library is ready'}</Text>
                <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>
                  {query
                    ? 'Try another name or clear the search.'
                    : category === 'All'
                      ? 'Add files to keep them in one private, searchable place.'
                      : `Files in ${category.toLowerCase()} will appear here.`}
                </Text>
                {query || category !== 'All' ? (
                  <Button
                    label="Clear filters"
                    onPress={() => {
                      setQuery('');
                      setCategory('All');
                    }}
                    variant="tonal"
                  />
                ) : null}
              </View>
            )
          }
        />
        {loading ? <ScreenLoader label="Loading your file library" /> : null}
        {busy ? (
          <View
            pointerEvents="auto"
            accessibilityRole="progressbar"
            accessibilityLabel={progressLabel || 'Processing files'}
            style={[styles.busyOverlay, { backgroundColor: colors.background }]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.busyText, { color: colors.textSecondary }]}>
              {progressLabel || 'Processing…'}
            </Text>
          </View>
        ) : null}
      </View>

      <Modal
        visible={dialog === 'details'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDialog(null)}
      >
        {selectedFile ? (
          <SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeadingCopy}>
                <Text style={styles.modalEyebrow}>FILE DETAILS</Text>
                <Text numberOfLines={1} style={styles.modalTitle}>{selectedFile.name}</Text>
              </View>
              <IconButton label="Close file details" icon="close" onPress={() => setDialog(null)} />
            </View>
            <ScrollView contentContainerStyle={[styles.detailContent, { paddingBottom: bottomInset + 24 }]}>
              <View style={[styles.detailHero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.detailIcon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name={iconForCategory(selectedFile.category)} size={28} color={colors.primary} />
                </View>
                <Text style={styles.detailName}>{selectedFile.name}</Text>
                <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>
                  {selectedFile.category} · {formatSize(selectedFile.size)}
                </Text>
              </View>

              <View style={[styles.detailInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <InfoRow label="File type" value={selectedFile.mimeType} />
                <InfoRow label="Added" value={formatDate(selectedFile.createdAt)} />
                <InfoRow label="Category" value={selectedFile.category} />
                <InfoRow label="Storage" value="Private to this app" />
              </View>

              <Text style={[styles.actionTitle, { color: colors.textSecondary }]}>ACTIONS</Text>
              <View style={styles.actions}>
                <ActionButton
                  icon="eye-outline"
                  label="Preview"
                  onPress={() => void openPreview(selectedFile)}
                />
                <ActionButton
                  icon={Platform.OS === 'web' ? 'download-outline' : 'share-outline'}
                  label={Platform.OS === 'web' ? 'Download' : 'Share'}
                  onPress={() => void downloadFile(selectedFile)}
                />
                <ActionButton
                  icon="create-outline"
                  label="Rename"
                  onPress={() => {
                    setRenameValue(selectedFile.name);
                    setDialog('rename');
                  }}
                />
                <ActionButton
                  icon="folder-open-outline"
                  label="Move"
                  onPress={() => setDialog('move')}
                />
                <ActionButton
                  icon="copy-outline"
                  label="Make a copy"
                  onPress={() => void duplicateFile()}
                />
                <ActionButton
                  icon="trash-outline"
                  label="Delete"
                  danger
                  onPress={() => setDialog('delete')}
                />
              </View>
              <Text style={[styles.privateStorageNote, { color: colors.textSecondary }]}>
                {Platform.OS === 'web'
                  ? 'A local copy stays in this browser profile. Momentum does not upload files or execute unsupported formats.'
                  : 'A local copy stays in this app’s private storage. Momentum does not upload files or execute unsupported formats.'}
              </Text>
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>

      <Modal
        visible={dialog === 'rename'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDialog('details')}
      >
        <SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          <ModalHeading title="Rename file" onClose={() => setDialog('details')} />
          <View style={styles.formContent}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>FILE NAME</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              maxLength={180}
              autoCapitalize="sentences"
              autoCorrect={false}
              accessibilityLabel="New file name"
              returnKeyType="done"
              style={[styles.textField, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            />
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Keep the file extension if you want other apps to recognize its format.
            </Text>
            <Button
              label={busy ? 'Saving…' : 'Save name'}
              onPress={() => void saveRename()}
              disabled={busy || !renameValue.trim()}
              loading={busy}
            />
            <Button label="Cancel" onPress={() => setDialog('details')} variant="tonal" disabled={busy} />
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={dialog === 'move' || dialog === 'sort'}
        animationType="slide"
        presentationStyle="pageSheet"
          onRequestClose={() => setDialog(dialog === 'move' ? 'details' : null)}
      >
        <SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          <ModalHeading
            title={dialog === 'move' ? 'Move to category' : 'Sort files'}
            onClose={() => setDialog(dialog === 'move' ? 'details' : null)}
          />
          {dialog === 'move' && selectedFile ? (
            <View style={styles.optionList}>
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                Choose where “{selectedFile.name}” belongs in your library.
              </Text>
              {FILE_CATEGORIES.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedFile.category === item }}
                  onPress={() => void moveFile(item)}
                  disabled={busy}
                  style={[
                    styles.optionRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    selectedFile.category === item && { borderColor: colors.primary },
                  ]}
                >
                  <View style={[styles.optionIcon, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons name={iconForCategory(item)} size={19} color={colors.primary} />
                  </View>
                  <Text style={styles.optionName}>{item}</Text>
                  {selectedFile.category === item ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  )}
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.optionList}>
              {(['Recent', 'Name', 'Size', 'Type'] as SortOrder[]).map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sortOrder === item }}
                  onPress={() => {
                    setSortOrder(item);
                    setDialog(null);
                  }}
                  style={[
                    styles.optionRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    sortOrder === item && { borderColor: colors.primary },
                  ]}
                >
                  <Text style={styles.optionName}>{item === 'Recent' ? 'Recently added' : item}</Text>
                  {sortOrder === item ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={dialog === 'delete'}
        animationType="fade"
        transparent
        onRequestClose={() => setDialog('details')}
      >
        <View style={[styles.confirmBackdrop, { backgroundColor: colors.background + 'CC' }]}>
          <View style={[styles.confirmCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.confirmIcon, { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name="trash-outline" size={23} color={colors.danger} />
            </View>
            <Text style={styles.confirmTitle}>Delete this file?</Text>
            <Text style={[styles.confirmCopy, { color: colors.textSecondary }]}>
              “{selectedFile?.name}” will be removed from the library and private storage. This cannot be undone.
            </Text>
            <Button
              label={busy ? 'Deleting…' : 'Delete file'}
              onPress={() => void removeFile()}
              disabled={busy}
              loading={busy}
              variant="destructive"
            />
            <Button label="Keep file" onPress={() => setDialog('details')} variant="tonal" disabled={busy} />
          </View>
        </View>
      </Modal>

      <Modal
        visible={dialog === 'preview'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePreview}
      >
        <SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeadingCopy}>
              <Text style={styles.modalEyebrow}>SAFE PREVIEW</Text>
              <Text numberOfLines={1} style={styles.modalTitle}>{selectedFile?.name ?? 'File preview'}</Text>
            </View>
            <IconButton label="Close preview" icon="close" onPress={closePreview} />
          </View>
          <View style={styles.previewBody}>
            {previewBusy ? (
              <View style={styles.previewState}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>Opening preview…</Text>
              </View>
            ) : previewUri ? (
              <Image source={{ uri: previewUri }} resizeMode="contain" style={styles.previewImage} />
            ) : previewText !== null ? (
              <ScrollView
                style={[styles.textPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}
                contentContainerStyle={styles.textPreviewContent}
              >
                <Text selectable style={[styles.previewText, { color: colors.text }]}>{previewText}</Text>
              </ScrollView>
            ) : (
              <View style={styles.previewState}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="document-outline" size={25} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>Preview unavailable</Text>
                <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>
                  {previewMessage ?? 'This file format is not supported for an in-app preview.'}
                </Text>
                {selectedFile ? (
                  <Button
                    label={Platform.OS === 'web' ? 'Download file' : 'Open or share file'}
                    onPress={() => void downloadFile(selectedFile)}
                    variant="tonal"
                  />
                ) : null}
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function FileCard({
  file,
  grid,
  onPress,
}: {
  file: ManagedFile;
  grid: boolean;
  onPress: () => void;
}) {
  const { colors } = useSettings();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Details for ${file.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fileCard,
        grid && styles.fileCardGrid,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.78 : 1 },
      ]}
    >
      <View style={[styles.fileIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={iconForCategory(file.category)} size={22} color={colors.primary} />
      </View>
      <View style={styles.fileCopy}>
        <Text numberOfLines={grid ? 2 : 1} style={styles.fileName}>{file.name}</Text>
        <Text numberOfLines={1} style={[styles.fileMeta, { color: colors.textSecondary }]}>
          {file.category} · {formatSize(file.size)}
        </Text>
        {!grid ? (
          <Text style={[styles.fileDate, { color: colors.muted }]}>{formatDate(file.updatedAt)}</Text>
        ) : null}
      </View>
      {!grid ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

function IconButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const { colors } = useSettings();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors } = useSettings();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: danger ? colors.dangerSoft : colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      <Text style={[styles.actionButtonText, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useSettings();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ModalHeading({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.modalHeader}>
      <View style={styles.modalHeadingCopy}>
        <Text style={styles.modalEyebrow}>FILE LIBRARY</Text>
        <Text numberOfLines={1} style={styles.modalTitle}>{title}</Text>
      </View>
      <IconButton label="Close" icon="close" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20 },
  emptyContent: { minHeight: '100%' },
  header: { paddingHorizontal: 0, paddingTop: 0, marginBottom: 10 },
  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderRadius: 16, marginBottom: 14 },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  addButton: { marginBottom: 16 },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 14, marginBottom: 13 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  search: { minHeight: 50, borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, minHeight: 46, paddingVertical: 8, fontSize: 15 },
  filters: { gap: 8, paddingVertical: 13 },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  listHeadingCopy: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  resultCount: { fontSize: 12, fontWeight: '600' },
  viewActions: { flexDirection: 'row', gap: 8 },
  toolButton: { width: 40, height: 40, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sortLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sortLabel: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  gridRow: { justifyContent: 'space-between' },
  fileCard: { minHeight: 82, borderWidth: 1, borderRadius: 17, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  fileCardGrid: { width: '48.5%', minHeight: 145, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  fileIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  fileCopy: { flex: 1, minWidth: 0, gap: 4 },
  fileName: { fontSize: 14, fontWeight: '700' },
  fileMeta: { fontSize: 12, fontWeight: '500' },
  fileDate: { fontSize: 11, marginTop: 1 },
  emptyState: { alignItems: 'center', borderWidth: 1, borderRadius: 20, padding: 22, gap: 10, marginTop: 5 },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyCopy: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 300 },
  busyOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.96 },
  busyText: { fontSize: 13, fontWeight: '600' },
  modalRoot: { flex: 1 },
  modalHeader: { minHeight: 68, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalHeadingCopy: { flex: 1, minWidth: 0, gap: 3 },
  modalEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  iconButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  detailContent: { paddingHorizontal: 20, paddingTop: 12, gap: 15 },
  detailHero: { borderWidth: 1, borderRadius: 22, alignItems: 'center', padding: 20, gap: 9 },
  detailIcon: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  detailName: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  detailMeta: { fontSize: 13, fontWeight: '600' },
  detailInfo: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14 },
  infoRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLabel: { fontSize: 12, fontWeight: '600' },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '700' },
  actionTitle: { fontSize: 11, letterSpacing: 1.4, fontWeight: '800', marginTop: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  actionButton: { width: '31.5%', minHeight: 79, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 4 },
  actionButtonText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  privateStorageNote: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 2 },
  formContent: { padding: 20, gap: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  textField: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, fontSize: 16 },
  helperText: { fontSize: 13, lineHeight: 19 },
  optionList: { paddingHorizontal: 20, paddingTop: 5, gap: 10 },
  optionRow: { minHeight: 58, borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionName: { flex: 1, fontSize: 15, fontWeight: '700' },
  confirmBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmCard: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 22, padding: 20, gap: 12 },
  confirmIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  confirmTitle: { fontSize: 19, fontWeight: '800' },
  confirmCopy: { fontSize: 13, lineHeight: 19, marginBottom: 3 },
  previewBody: { flex: 1, padding: 18, justifyContent: 'center' },
  previewState: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  previewImage: { width: '100%', height: '100%' },
  textPreview: { flex: 1, borderWidth: 1, borderRadius: 16 },
  textPreviewContent: { padding: 16 },
  previewText: { fontSize: 13, lineHeight: 19 },
});
