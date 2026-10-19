import { useWindowDimensions } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { useSettings } from '../../../context/SettingsContext';

type Props = { values: number[]; labels: string[]; color?: string; height?: number };

export default function BarChart({ values, labels, color, height = 120 }: Props) {
  const { width: screenW } = useWindowDimensions();
  const { colors } = useSettings();
  const width = Math.max(1, screenW - 40 - 34);
  const barColor = color ?? colors.primary;
  const n = values.length;
  const gap = n > 10 ? 2 : 8;
  const bw = (width - gap * (n - 1)) / n;

  return (
    <Svg width={width} height={height + 24}>
      {values.map((v, i) => {
        const x = i * (bw + gap);
        const h = v > 0 ? Math.max(3, v * height) : 0;
        const showLabel = n <= 10 || i % 5 === 0 || i === n - 1;
        return (
          <G key={labels[i] ?? String(i)}>
            <Rect x={x} y={0} width={bw} height={height} rx={3} fill={colors.surfaceMuted} />
            <Rect x={x} y={height - h} width={bw} height={h} rx={3} fill={barColor} />
            {showLabel && (
              <SvgText x={x + bw / 2} y={height + 17} fontSize="12" fill={colors.mutedText} textAnchor="middle">
                {labels[i]}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}
