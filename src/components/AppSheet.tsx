import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { Text } from './Themed';
import Button from './Button';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
  saveDisabled?: boolean;
  closeDisabled?: boolean;
  saveLabel?: string;
};

export default function AppSheet({
  visible,
  title,
  onClose,
  onSave,
  children,
  saveDisabled = false,
  closeDisabled = false,
  saveLabel = 'Save',
}: Props) {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={closeDisabled ? () => {} : onClose}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close form"
          disabled={closeDisabled}
          onPress={closeDisabled ? undefined : onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.text, opacity: 0.45 }]}
        />
        <View style={styles.bottomAlign}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                paddingTop: Math.max(insets.top, 16),
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <ScrollView
              style={styles.fields}
              contentContainerStyle={styles.fieldsContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
            <View style={styles.footer}>
              <Button label="Cancel" variant="secondary" onPress={onClose} disabled={closeDisabled} style={styles.footerButton} />
              <Button label={saveLabel} onPress={onSave} disabled={saveDisabled} style={styles.footerButton} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  bottomAlign: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  fields: { flexShrink: 1 },
  fieldsContent: { paddingBottom: 8 },
  footer: { flexDirection: 'row', gap: 12, paddingTop: 8 },
  footerButton: { flex: 1 },
});
