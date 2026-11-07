import React, { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const AnimatedPath = Animated.createAnimatedComponent(Path);
type Illustration = "workouts" | "progress" | "coaching" | "scan";

function AnimatedBenefit({ kind, title, delay, stacked = false }: { kind: Illustration; title: string; delay: number; stacked?: boolean }) {
  const dark = useColorScheme() === "dark";
  const colors = Colors[dark ? "dark" : "light"];
  const accent = dark ? "#B9ACFF" : colors.primaryButton;
  const paper = colors.background;
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  const teaser = kind === "scan";
  const play = useCallback((wait: number) => {
    cancelAnimation(progress);
    if (reducedMotion) { progress.value = 1; return; }
    progress.value = 0;
    progress.value = withDelay(wait, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [progress, reducedMotion]);
  useEffect(() => { play(delay); return () => cancelAnimation(progress); }, [delay, play, progress]);

  const leftCard = useAnimatedStyle(() => ({ transform: [{ translateX: -14 * (1 - progress.value) }, { translateY: -6 * (1 - progress.value) }, { rotate: `${-18 + 10 * progress.value}deg` }] }));
  const rightCard = useAnimatedStyle(() => ({ transform: [{ translateX: 14 * (1 - progress.value) }, { translateY: 6 * (1 - progress.value) }, { rotate: `${18 - 10 * progress.value}deg` }] }));
  const frontCard = useAnimatedStyle(() => ({ transform: [{ translateY: 10 * (1 - progress.value) }] }));
  const chart = useAnimatedProps(() => ({ strokeDashoffset: 57 * (1 - progress.value) }));
  const endpoint = useAnimatedStyle(() => ({ opacity: Math.max(0, (progress.value - 0.95) / 0.05), transform: [{ scale: 0.6 + 0.4 * progress.value }] }));
  const message = useAnimatedStyle(() => ({ opacity: Math.min(1, progress.value * 2), transform: [{ translateY: 8 * (1 - Math.min(1, progress.value * 2)) }] }));
  const reply = useAnimatedStyle(() => ({ opacity: Math.max(0, (progress.value - 0.45) / 0.55), transform: [{ translateY: 8 * (1 - progress.value) }] }));
  const scan = useAnimatedStyle(() => ({ opacity: progress.value < 0.7 ? 1 : Math.max(0, (0.85 - progress.value) / 0.15), transform: [{ translateY: 38 * Math.min(1, progress.value / 0.7) }] }));
  const video = useAnimatedStyle(() => ({ opacity: Math.max(0, (progress.value - 0.7) / 0.3), transform: [{ scale: 0.7 + 0.3 * progress.value }] }));

  const card = (muted: boolean) => <Svg width={27} height={39} viewBox="0 0 27 39" accessible={false}>
    <Rect x={1} y={1} width={25} height={37} rx={5} fill={paper} stroke={muted ? colors.icon : colors.text} strokeWidth={1.7} />
    <Rect x={6} y={7} width={15} height={5} rx={2} fill={accent} opacity={muted ? 0.35 : 1} />
    <Path d="M7 19h13M7 25h10M7 31h13" stroke={colors.icon} strokeWidth={1.6} strokeLinecap="round" opacity={0.65} />
  </Svg>;

  return <Pressable testID={`subscription-benefit-${kind}`} accessible accessibilityRole={reducedMotion ? "text" : "button"}
    accessibilityLabel={teaser ? `Coming soon: ${title}` : title}
    accessibilityHint={reducedMotion ? undefined : "Double-tap to replay the illustration."}
    onPress={reducedMotion ? undefined : () => play(0)}
    style={({ pressed }) => [styles.benefit, (stacked || teaser) && styles.horizontal, teaser && !stacked && styles.teaserRow, { opacity: pressed ? 0.7 : 1 }]}>
    <View style={teaser && !stacked ? styles.teaserArtColumn : undefined}>
    <View style={styles.art} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {kind === "workouts" ? <>
        <Animated.View style={[styles.card, { left: 6, top: 12 }, leftCard]}>{card(true)}</Animated.View>
        <Animated.View style={[styles.card, { left: 30, top: 12 }, rightCard]}>{card(true)}</Animated.View>
        <Animated.View style={[styles.card, { left: 18, top: 17 }, frontCard]}>{card(false)}</Animated.View>
      </> : null}
      {kind === "progress" ? <>
        <Svg width={64} height={64} viewBox="0 0 64 64" accessible={false}>
          <Path d="M9 12v42h48" stroke={colors.icon} opacity={0.35} strokeWidth={1.5} strokeLinecap="round" fill="none" />
          <AnimatedPath animatedProps={chart} d="M13 45l12-11 12 5 16-22" stroke={accent} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="57 57" />
        </Svg>
        <Animated.View style={[styles.endpoint, { backgroundColor: accent, borderColor: paper }, endpoint]} />
      </> : null}
      {kind === "coaching" ? <>
        <Animated.View style={[styles.message, message]}>
          <Svg width={47} height={39} viewBox="0 0 47 39" accessible={false}>
            <Path d="M11 3h25a7 7 0 0 1 7 7v14a7 7 0 0 1-7 7H19l-9 6v-7a7 7 0 0 1-7-7V10a7 7 0 0 1 8-7Z" fill={paper} stroke={colors.text} strokeWidth={1.8} strokeLinejoin="round" />
            {[15, 23, 31].map(x => <Circle key={x} cx={x} cy={17} r={1.8} fill={accent} />)}
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.reply, reply]}>
          <Svg width={34} height={29} viewBox="0 0 34 29" accessible={false}>
            <Path d="M8 2h18a6 6 0 0 1 6 6v9a6 6 0 0 1-6 6v4l-7-4H8a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6Z" fill={paper} stroke={accent} strokeWidth={1.8} strokeLinejoin="round" />
            <Path d="M10 10h14M10 16h9" stroke={accent} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </> : null}
      {teaser ? <>
        <Svg width={64} height={64} viewBox="0 0 64 64" accessible={false}>
          <Path d="M5 18V8h10M49 8h10v10M5 46v10h10M49 56h10V46" stroke={accent} strokeWidth={1.8} strokeLinecap="round" fill="none" />
          <Path d="M19 49h27M23 49V16h19v13M23 36h19v13M38 29l10 5M38 14v6" stroke={colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Rect x={17} y={22} width={7} height={18} rx={1.5} stroke={colors.text} strokeWidth={1.5} fill={paper} />
          <Path d="M19 28h3M19 34h3" stroke={colors.icon} strokeWidth={1.2} />
        </Svg>
        <Animated.View style={[styles.scanLine, { backgroundColor: accent }, scan]} />
        <Animated.View style={[styles.video, { backgroundColor: accent, borderColor: paper }, video]}>
          <Svg width={14} height={14} viewBox="0 0 14 14" accessible={false}><Path d="m5 3 6 4-6 4Z" fill={dark ? "#151718" : "#FFFFFF"} /></Svg>
        </Animated.View>
      </> : null}
    </View>
    </View>
    <View style={[(stacked || teaser) && styles.copy, teaser && !stacked && styles.teaserCopy]}>
      {teaser ? <Text accessible={false} style={[styles.comingSoon, { color: colors.icon }]}>Coming soon</Text> : null}
      <Text accessible={false} style={[styles.label, (stacked || teaser) && styles.horizontalLabel, teaser && styles.teaserLabel, { color: colors.text }]}>{title}</Text>
    </View>
  </Pressable>;
}

export function SubscriptionBenefitIllustrations() {
  const { fontScale } = useWindowDimensions();
  const colors = Colors[useColorScheme() ?? "light"];
  const stacked = fontScale >= 1.3;
  return <View style={styles.section}>
    <View style={[styles.features, stacked && styles.stacked]}>
      <AnimatedBenefit kind="workouts" title="Built around your goals" delay={0} stacked={stacked} />
      <AnimatedBenefit kind="progress" title="See your progress" delay={700} stacked={stacked} />
      <AnimatedBenefit kind="coaching" title="AI coaching" delay={1400} stacked={stacked} />
    </View>
    <View style={[styles.teaser, { borderTopColor: colors.inputBorder }]}>
      <AnimatedBenefit kind="scan" title="Scan gym equipment" delay={2100} stacked={stacked} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  features: { flexDirection: "row", gap: 12 },
  stacked: { flexDirection: "column", gap: 16 },
  benefit: { flex: 1, minWidth: 0, minHeight: 44, alignItems: "center", gap: 8 },
  horizontal: { flex: 0, flexDirection: "row", gap: 14 },
  teaserRow: { gap: 4 },
  teaserArtColumn: { width: "33.333333%", paddingRight: 8, alignItems: "center" },
  teaserCopy: { flex: 1 },
  art: { width: 64, height: 64, flexShrink: 0 },
  card: { position: "absolute" },
  endpoint: { position: "absolute", left: 49, top: 13, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  message: { position: "absolute", left: 2, top: 7 },
  reply: { position: "absolute", right: 1, bottom: 4 },
  scanLine: { position: "absolute", left: 7, top: 12, width: 50, height: 1.5 },
  video: { position: "absolute", right: 3, bottom: 2, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  label: { fontSize: 14, fontWeight: "600", textAlign: "center", letterSpacing: -0.2 },
  horizontalLabel: { fontSize: 16, textAlign: "left" },
  teaserLabel: { fontSize: 15 },
  comingSoon: { fontSize: 12, fontWeight: "500" },
  teaser: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
});
