import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SCREEN_PADDING } from '../ui';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export default function HorizontalChips({ children, style, contentContainerStyle }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={[styles.scroll, style]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -SCREEN_PADDING },
  content: { paddingHorizontal: SCREEN_PADDING, gap: 8 },
});
