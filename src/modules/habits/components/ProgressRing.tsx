import { View, StyleSheet } from 'react-native';
import { Text } from '../../../components/Themed';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  backgroundColor?: string;
  textColor?: string;
};

export default function ProgressRing({
  progress,
  size = 90,
  stroke = 9,
  color = '#1B6B52',
  backgroundColor = '#D9DFD8',
  textColor,
}: Props) {
  const safeSize = Math.max(1, size);
  const safeStroke = Math.max(0, Math.min(stroke, safeSize));
  const r = Math.max(0, (safeSize - safeStroke) / 2);
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const center = safeSize / 2;
  const pointAt = (angle: number) => ({
    x: center + r * Math.cos((angle * Math.PI) / 180),
    y: center + r * Math.sin((angle * Math.PI) / 180),
  });
  const start = pointAt(-90);
  const end = pointAt(-90 + 360 * safeProgress);
  const largeArc = safeProgress > 0.5 ? 1 : 0;
  const arc = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  return (
    <View style={{ width: safeSize, height: safeSize }}>
      <Svg width={safeSize} height={safeSize} viewBox={`0 0 ${safeSize} ${safeSize}`}>
        <Circle cx={center} cy={center} r={r} stroke={backgroundColor} strokeWidth={safeStroke} fill="none" />
        {safeProgress >= 1 ? (
          <Circle cx={center} cy={center} r={r} stroke={color} strokeWidth={safeStroke} fill="none" />
        ) : safeProgress > 0 ? (
          <Path d={arc} stroke={color} strokeWidth={safeStroke} strokeLinecap="round" fill="none" />
        ) : null}
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.text, textColor ? { color: textColor } : null]}>{Math.round(safeProgress * 100)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 18, fontWeight: '700' },
});
