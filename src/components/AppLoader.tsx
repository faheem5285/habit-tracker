import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, useColorScheme } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { palette } from '../theme';

type Props = {
  size?: number;
  label?: string;
  scheme?: 'light' | 'dark';
};

export function HabitLoader({ size = 140, label, scheme }: Props) {
  const system = useColorScheme();
  const c = palette[scheme ?? (system === 'dark' ? 'dark' : 'light')];

  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    spinLoop.start();
    return () => {
      spinLoop.stop();
    };
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const R = 46;
  const circumference = 2 * Math.PI * R;
  const layer = [StyleSheet.absoluteFill];

  const Gradients = (
    <Defs>
      <LinearGradient id="hl-grad" x1="0" y1="1" x2="1" y2="0">
        <Stop offset="0" stopColor={c.cyan} />
        <Stop offset="1" stopColor={c.mint} />
      </LinearGradient>
    </Defs>
  );

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'}>
      <View style={{ width: size, height: size }}>
          {/* calendar */}
          <Svg width={size} height={size} style={layer} viewBox="0 14 200 200">
            <Rect x="14" y="34" width="172" height="152" rx="34" fill={c.primarySoft} stroke={c.primary} strokeWidth="2" />
            <Rect x="64" y="26" width="14" height="36" rx="7" fill={c.primary} />
            <Rect x="122" y="26" width="14" height="36" rx="7" fill={c.primary} />
            <Circle cx="100" cy="114" r="50" fill={c.navy} />
          </Svg>

          {/* moving ring line */}
          <Animated.View style={[layer, { transform: [{ rotate }] }]}>
            <Svg width={size} height={size} style={layer} viewBox="0 14 200 200">
              {Gradients}
              <Circle
                cx="100"
                cy="114"
                r={R}
                stroke="url(#hl-grad)"
                strokeWidth="11"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${circumference * 0.66} ${circumference}`}
                transform="rotate(-50 100 114)"
              />
            </Svg>
          </Animated.View>

          {/* figure with flag (fixed position, same as logo) */}
          <Svg width={size} height={size} style={layer} viewBox="0 14 200 200">
            {Gradients}
            {/* head */}
            <Circle cx="103.5" cy="99" r="5.8" fill="url(#hl-grad)" />
            {/* left arm */}
            <Path d="M88 102.5 C93 105 97 108 102 108" stroke="url(#hl-grad)" strokeWidth="5" strokeLinecap="round" fill="none" />
            {/* right arm raised to flag */}
            <Path d="M102 108 C110 106 116 99 119 92.5" stroke="url(#hl-grad)" strokeWidth="6" strokeLinecap="round" fill="none" />
            {/* torso and swoosh tail */}
            <Path
              d="M100 110 C100 118 96 120 90 120 C82 120 74 117 69 124 C66 131 71 139 80 143"
              stroke="url(#hl-grad)"
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
            />
            {/* flag pole and flag */}
            <Path d="M116.5 78 L116.5 91" stroke={c.accent} strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <Path d="M117 78 Q124 75 131 79 Q124 83 117 84.5 Z" fill={c.accent} />
          </Svg>
      </View>

      {label ? <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text> : null}
    </View>
  );
}

export function LoaderScreen({
  label,
  scheme,
  backgroundOpacity = 0.8,
  transparent = false,
}: {
  label?: string;
  scheme?: 'light' | 'dark';
  backgroundOpacity?: number;
  transparent?: boolean;
}) {
  const system = useColorScheme();
  const c = palette[scheme ?? (system === 'dark' ? 'dark' : 'light')];

  return (
    <View style={styles.screen}>
      {!transparent && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.background, opacity: backgroundOpacity }]} />}
      <HabitLoader size={140} label={label} scheme={scheme} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  label: { marginTop: 14, fontSize: 14, fontWeight: '500' },
});
