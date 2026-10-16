import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './Themed';
import { DAY_LABELS, toDateKey } from '../utils/dates';

type Props = {
  year: number;
  month: number; // 0-11
  weekStartsOn: 0 | 1;
  color?: string;
  level: (key: string) => number; // -1 = not applicable, 0..1 = completion
  onPress?: (key: string) => void;
};

export default function Heatmap({ year, month, weekStartsOn, color = '#1244C5', level, onPress }: Props) {
  const offset = (new Date(year, month, 1).getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const labels = weekStartsOn === 1 ? [...DAY_LABELS.slice(1), DAY_LABELS[0]] : DAY_LABELS;

  return (
    <View>
      <View style={styles.grid}>
        {labels.map((l) => (
          <Text key={l} style={styles.head}>{l[0]}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`e${i}`} style={styles.cell} />;
          const key = toDateKey(new Date(year, month, day));
          const lv = level(key);
          const filled = lv > 0;
          return (
            <TouchableOpacity
              key={key}
              style={styles.cell}
              disabled={!onPress || lv < 0}
              onPress={() => onPress?.(key)}
            >
              <View
                style={[
                  styles.inner,
                  {
                    backgroundColor: filled ? color : lv === 0 ? 'rgba(128,128,128,0.2)' : 'transparent',
                    opacity: lv > 0 && lv < 1 ? 0.55 : 1,
                  },
                ]}
              >
                <Text style={[styles.num, filled && { color: '#fff' }, lv < 0 && { color: '#9ca3af' }]}>
                  {day}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  head: { width: '14.285%', textAlign: 'center', color: '#9ca3af', fontSize: 12, marginBottom: 4 },
  cell: { width: '14.285%', aspectRatio: 1, padding: 2 },
  inner: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 12 },
});
