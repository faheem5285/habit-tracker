import { Text, useWindowDimensions, View } from 'react-native';
import type { ReactNode } from 'react';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useSettings } from '../../../context/SettingsContext';

function ChartFrame({ children, height = 150 }: { children: ReactNode; height?: number }) {
  const { width } = useWindowDimensions();
  return <View style={{ width: Math.max(230, width - 100), height }}>{children}</View>;
}

export function LineTrendChart({ values, labels }: { values: number[]; labels: string[] }) {
  const w = Math.max(230, useWindowDimensions().width - 100);
  const { colors } = useSettings();
  const height = 166;
  const top = 12;
  const bottom = 34;
  const left = 38;
  const right = 8;
  const plotHeight = height - top - bottom;
  const x = (i: number) => left + (i * (w - left - right)) / Math.max(1, values.length - 1);
  const y = (value: number) => top + (1 - Math.max(0, Math.min(1, value))) * plotHeight;
  return <ChartFrame height={height}><Svg width={w} height={height}>
    {[0, 0.5, 1].map((v) => {
      const yPosition = y(v);
      return <G key={v}>
        <Line x1={left} x2={w - right} y1={yPosition} y2={yPosition} stroke={colors.borderStrong} strokeOpacity={0.65} />
        <SvgText x={0} y={yPosition + 4} fontSize="12" fill={colors.mutedText}>{`${Math.round(v * 100)}%`}</SvgText>
      </G>;
    })}
    {values.map((value, i) => {
      if (i === 0 || value < 0 || values[i - 1] < 0) return null;
      return <Line key={`line-${i}`} x1={x(i - 1)} y1={y(values[i - 1])} x2={x(i)} y2={y(value)} stroke={colors.primary} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />;
    })}
    {values.map((v, i) => {
      const xPosition = x(i);
      return <G key={i}>
        {v < 0
          ? <Circle cx={xPosition} cy={top + plotHeight} r={4} fill={colors.surfaceMuted} stroke={colors.mutedText} strokeWidth={1.5} />
          : <Circle cx={xPosition} cy={y(v)} r={4} fill={colors.primary} />}
        <SvgText x={xPosition} y={height - 4} fontSize="12" fill={colors.mutedText} textAnchor={i === 0 ? 'start' : i === values.length - 1 ? 'end' : 'middle'}>{labels[i]}</SvgText>
      </G>;
    })}
  </Svg></ChartFrame>;
}

export function AreaTrendChart({ values, labels }: { values: number[]; labels: string[] }) {
  const w = Math.max(230, useWindowDimensions().width - 100);
  const { colors } = useSettings();
  const height = 164;
  const top = 12;
  const bottom = 34;
  const left = 38;
  const right = 8;
  const plotHeight = height - top - bottom;
  const x = (i: number) => left + (i * (w - left - right)) / Math.max(1, values.length - 1);
  const y = (value: number) => top + (1 - Math.max(0, Math.min(1, value))) * plotHeight;
  const axisIndices = [0, Math.floor((values.length - 1) / 2), values.length - 1];
  const areaPath = values.length && values.every((value) => value >= 0)
    ? `M ${values.map((value, i) => `${x(i)},${y(value)}`).join(' L ')} L ${x(values.length - 1)},${top + plotHeight} L ${x(0)},${top + plotHeight} Z`
    : '';
  return <ChartFrame height={height}><Svg width={w} height={height}>
    {[0, 0.5, 1].map((v) => {
      const yPosition = y(v);
      return <G key={v}>
        <Line x1={left} x2={w - right} y1={yPosition} y2={yPosition} stroke={colors.borderStrong} strokeOpacity={0.65} />
        <SvgText x={0} y={yPosition + 4} fontSize="12" fill={colors.mutedText}>{`${Math.round(v * 100)}%`}</SvgText>
      </G>;
    })}
    {areaPath ? <Path d={areaPath} fill={colors.primary} fillOpacity={0.12} /> : null}
    {values.map((value, i) => {
      if (i === 0 || value < 0 || values[i - 1] < 0) return null;
      return <Line key={`line-${i}`} x1={x(i - 1)} y1={y(values[i - 1])} x2={x(i)} y2={y(value)} stroke={colors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />;
    })}
    {values.map((value, i) => value < 0 ? null : <Circle key={`point-${i}`} cx={x(i)} cy={y(value)} r={2.5} fill={colors.primary} />)}
    {axisIndices.map((index, position) => (
      <SvgText key={position} x={x(index)} y={height - 4} fontSize="12" fill={colors.mutedText} textAnchor={position === 0 ? 'start' : position === axisIndices.length - 1 ? 'end' : 'middle'}>
        {labels[position]}
      </SvgText>
    ))}
  </Svg></ChartFrame>;
}

export function DonutChart({ values }: { values: { label: string; value: number; color: string }[] }) {
  const { colors } = useSettings();
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
      <SvgText x={size / 2} y={size / 2 + 2} fontSize="14" fontWeight="700" fill={colors.text} textAnchor="middle">{total}</SvgText>
      <SvgText x={size / 2} y={size / 2 + 18} fontSize="12" fill={colors.mutedText} textAnchor="middle">check-ins</SvgText>
    </Svg>
    <View style={{ flex: 1, gap: 8 }}>
      {values.length ? values.slice(0, 5).map((item) => <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12 }}>{item.label}</Text></View>
        <Text style={{ color: colors.mutedText, fontSize: 12 }}>{item.value}</Text>
      </View>) : <Text style={{ color: colors.mutedText, fontSize: 12 }}>Complete a habit to see your mix.</Text>}
    </View>
  </View>;
}

export function WeekdayChart({ values, labels }: { values: number[]; labels: string[] }) {
  const { colors } = useSettings();
  const w = Math.max(230, useWindowDimensions().width - 100);
  const labelW = 32;
  const barW = w - labelW - 44;
  const rowH = 24;
  return <ChartFrame height={values.length * rowH + 8}><Svg width={w} height={values.length * rowH + 8}>
    {values.map((v, i) => <G key={i}>
      <SvgText x={0} y={i * rowH + 16} fontSize="12" fill={colors.mutedText}>{labels[i]}</SvgText>
      <Rect x={labelW} y={i * rowH + 4} width={barW} height={12} rx={6} fill={colors.surfaceMuted} />
      <Rect x={labelW} y={i * rowH + 4} width={barW * Math.max(0, Math.min(1, v))} height={12} rx={6} fill={colors.primary} />
      <SvgText x={w - 4} y={i * rowH + 16} fontSize="12" fill={colors.textSecondary} textAnchor="end">{v < 0 ? '—' : `${Math.round(v * 100)}%`}</SvgText>
    </G>)}
  </Svg></ChartFrame>;
}
