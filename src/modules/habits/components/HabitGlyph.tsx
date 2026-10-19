import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useSettings } from '../../../context/SettingsContext';

type GlyphName = ComponentProps<typeof Ionicons>['name'];

const categoryGlyphs: Record<string, GlyphName> = {
  health: 'heart-outline',
  fitness: 'barbell-outline',
  productivity: 'flash-outline',
  mind: 'leaf-outline',
  learning: 'book-outline',
  other: 'sparkles-outline',
};

const nameGlyphs: [RegExp, GlyphName][] = [
  [/water|hydrate|drink/i, 'water-outline'],
  [/sleep|rest/i, 'bed-outline'],
  [/meal|eat|food|nutrition/i, 'restaurant-outline'],
  [/step|walk|run|jog/i, 'walk-outline'],
  [/workout|gym|strength|exercise/i, 'barbell-outline'],
  [/stretch|mobility/i, 'body-outline'],
  [/meditat|mindful|calm|pray|prayer|gratitude/i, 'leaf-outline'],
  [/reflect|journal|write/i, 'create-outline'],
  [/read|book/i, 'book-outline'],
  [/focus|deep work|discipline|priority/i, 'flash-outline'],
  [/learn|skill|study/i, 'school-outline'],
  [/save|money|financ/i, 'cash-outline'],
  [/plan|tomorrow|schedule/i, 'calendar-outline'],
];

export function resolveHabitGlyph(icon?: string, category?: string, name?: string): GlyphName {
  if (icon && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, icon)) return icon as GlyphName;
  const namedGlyph = nameGlyphs.find(([pattern]) => pattern.test(name ?? ''))?.[1];
  return namedGlyph ?? categoryGlyphs[category ?? ''] ?? 'sparkles-outline';
}

export function HabitGlyph({ icon, category, name, size = 24, color }: { icon?: string; category?: string; name?: string; size?: number; color?: string }) {
  const { colors } = useSettings();
  const glyph = resolveHabitGlyph(icon, category, name);

  return <Ionicons name={glyph} size={size} color={color ?? colors.primary} />;
}
