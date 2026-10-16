import { Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

const chartColor = '#315E53';

function ChartFrame({ children, height = 150 }: { children: React.ReactNode; height?: number }) {
  const { width } = useWindowDimensions();
  return <View style={{ width: Math.max(230, width - 100), height }}>{children}</View>;
}

export function LineTrendChart({ values, labels }: { values: number[]; labels: string[] }) {
  const w = Math.max(230, useWindowDimensions().width - 100);
  const h = 130;
  const pad = 15;
  const points = values.map((v, i) => v < 0 ? '' : `${pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1)},${h - pad - Math.max(0, Math.min(1, v)) * (h - pad * 2)}`).filter(Boolean);
  return <ChartFrame height={154}><Svg width={w} height={154}>
    {[0, 0.5, 1].map((v) => <Line key={v} x1={pad} x2={w - pad} y1={h - pad - v * (h - pad * 2)} y2={h - pad - v * (h - pad * 2)} stroke="#89958F" strokeOpacity={0.22} />)}
    <Path d={points.map((p, i) => `${i ? 'L' : 'M'} ${p}`).join(' ')} fill="none" stroke={chartColor} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
    {values.map((v, i) => {
      if (v < 0) return null;
      const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
      const y = h - pad - Math.max(0, Math.min(1, v)) * (h - pad * 2);
      return <G key={i}><Circle cx={x} cy={y} r={4} fill={chartColor} /><SvgText x={x} y={h + 13} fontSize="9" fill="#748079" textAnchor="middle">{labels[i]}</SvgText></G>;
    })}
  </Svg></ChartFrame>;
}

export function AreaTrendChart({ values }: { values: number[] }) {
  const w = Math.max(230, useWindowDimensions().width - 100);
  const h = 120;
  const pad = 10;
  const points = values.map((v, i) => v < 0 ? '' : `${pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1)},${h - pad - Math.max(0, Math.min(1, v)) * (h - pad * 2)}`).filter(Boolean);
  const d = points.length ? `M ${points[0]} ${points.slice(1).map((p) => `L ${p}`).join(' ')} L ${w - pad},${h - pad} L ${pad},${h - pad} Z` : '';
  return <ChartFrame height={124}><Svg width={w} height={124}>
    {[0, 0.5, 1].map((v) => <Line key={v} x1={pad} x2={w - pad} y1={h - pad - v * (h - pad * 2)} y2={h - pad - v * (h - pad * 2)} stroke="#89958F" strokeOpacity={0.2} />)}
    <Path d={d} fill={chartColor} fillOpacity={0.16} stroke={chartColor} strokeWidth={2.5} strokeLinejoin="round" />
  </Svg></ChartFrame>;
}

export function DonutChart({ values }: { values: { label: string; value: number; color: string }[] }) {
  const size = 150;
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const total = values.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#89958F" strokeOpacity={0.2} strokeWidth={18} />
      {total > 0 && values.map((item) => {
        const dash = (item.value / total) * circumference;
        const circle = <Circle key={item.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={item.color} strokeWidth={18} strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} rotation={-90} origin={`${size / 2}, ${size / 2}`} />;
        offset += dash;
        return circle;
      })}
      <SvgText x={size / 2} y={size / 2 + 4} fontSize="12" fontWeight="700" fill="#53615A" textAnchor="middle">{total}</SvgText>
      <SvgText x={size / 2} y={size / 2 + 18} fontSize="8" fill="#748079" textAnchor="middle">check-ins</SvgText>
    </Svg>
    <View style={{ flex: 1, gap: 8 }}>
      {values.length ? values.slice(0, 5).map((item) => <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: '#53615A', fontSize: 11 }}>{item.label}</Text></View>
        <Text style={{ color: '#748079', fontSize: 10 }}>{item.value}</Text>
      </View>) : <Text style={{ color: '#748079', fontSize: 11 }}>Complete a habit to see your mix.</Text>}
    </View>
  </View>;
}

export function WeekdayChart({ values, labels }: { values: number[]; labels: string[] }) {
  const w = Math.max(230, useWindowDimensions().width - 100);
  const labelW = 32;
  const barW = w - labelW - 44;
  const rowH = 24;
  return <ChartFrame height={values.length * rowH + 8}><Svg width={w} height={values.length * rowH + 8}>
    {values.map((v, i) => <G key={i}>
      <SvgText x={0} y={i * rowH + 15} fontSize="10" fill="#748079">{labels[i]}</SvgText>
      <Rect x={labelW} y={i * rowH + 4} width={barW} height={12} rx={6} fill="#89958F" fillOpacity={0.17} />
      <Rect x={labelW} y={i * rowH + 4} width={barW * Math.max(0, Math.min(1, v))} height={12} rx={6} fill={chartColor} />
      <SvgText x={w - 4} y={i * rowH + 14} fontSize="9" fill="#53615A" textAnchor="end">{v < 0 ? '—' : `${Math.round(v * 100)}%`}</SvgText>
    </G>)}
  </Svg></ChartFrame>;
}
