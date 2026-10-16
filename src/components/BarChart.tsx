import { useWindowDimensions } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';

type Props = { values: number[]; labels: string[]; color?: string; height?: number };

export default function BarChart({ values, labels, color = '#1244C5', height = 120 }: Props) {
  const { width: screenW } = useWindowDimensions();
  const width = screenW - 64;
  const n = values.length;
  const gap = n > 10 ? 2 : 8;
  const bw = (width - gap * (n - 1)) / n;

  return (
    <Svg width={width} height={height + 22}>
      {values.map((v, i) => {
        const x = i * (bw + gap);
        const h = v > 0 ? Math.max(3, v * height) : 0;
        const showLabel = n <= 10 || i % 5 === 0 || i === n - 1;
        return (
          <G key={i}>
            <Rect x={x} y={0} width={bw} height={height} rx={3} fill="rgba(128,128,128,0.15)" />
            <Rect x={x} y={height - h} width={bw} height={h} rx={3} fill={color} />
            {showLabel && (
              <SvgText x={x + bw / 2} y={height + 15} fontSize="10" fill="#9ca3af" textAnchor="middle">
                {labels[i]}
              </SvgText>
            )}
          </G>
        );
      })}
    </Svg>
  );
}
