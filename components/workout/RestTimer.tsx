import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, useWindowDimensions, View } from "react-native";

import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
import { Colors, Fonts } from "@/constants/theme";

interface RestTimerProps {
  /** Absolute epoch ms timestamp the rest period ends at. Survives backgrounding. */
  restEndsAt: number;
  /** Original rest duration in seconds, used as the progress bar denominator. */
  totalSeconds: number;
  exerciseName?: string;
  colors: typeof Colors.light;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
  onExpire: () => void;
  disabled?: boolean;
  compact?: boolean;
}

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Full-width rest countdown. Recomputes remaining time from `restEndsAt`
 * rather than relying purely on interval ticks, so the countdown stays
 * accurate even after the app is backgrounded and resumed.
 */
export function RestTimer({
  restEndsAt,
  totalSeconds,
  exerciseName,
  colors,
  onAdjust,
  onSkip,
  onExpire,
  disabled,
  compact = false,
}: RestTimerProps) {
  const { width, fontScale } = useWindowDimensions();
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, restEndsAt - Date.now())
  );
  const hasExpiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const recompute = useCallback(() => {
    const remaining = Math.max(0, restEndsAt - Date.now());
    setRemainingMs(remaining);
    if (remaining <= 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpireRef.current();
    }
  }, [restEndsAt]);

  // Reset expiry guard and re-sync whenever the target end time changes
  // (e.g. after a +15s/-15s adjustment or a new rest period starting).
  useEffect(() => {
    hasExpiredRef.current = false;
    recompute();
    const interval = setInterval(recompute, 200);
    return () => clearInterval(interval);
  }, [restEndsAt, recompute]);

  // Recompute immediately when the app returns to the foreground — the
  // setInterval above may have been suspended while backgrounded.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        recompute();
      }
    });
    return () => subscription.remove();
  }, [recompute]);

  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const progress =
    totalSeconds > 0 ? Math.min(1, Math.max(0, remainingMs / (totalSeconds * 1000))) : 0;

  if (compact) {
    const stacked = fontScale > 1.5 || width < 340;
    const controlBackground = colors.background === "#fff" ? "#F2F3F5" : "#2B2D2F";
    const adjustButton = (seconds: number, label: string) => (
      <Pressable
        testID={seconds < 0 ? "player-rest-minus" : "player-rest-plus"}
        onPress={() => onAdjust(seconds)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={seconds < 0 ? "Reduce rest by 15 seconds" : "Extend rest by 15 seconds"}
        accessibilityState={{ disabled: Boolean(disabled) }}
        style={{ minWidth: stacked ? 0 : 56, flex: stacked ? 1 : undefined, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: controlBackground }}
      >
        <ThemedText style={{ fontSize: 15, fontWeight: "600", fontFamily: Fonts.sans }}>{label}</ThemedText>
      </Pressable>
    );
    const countdown = <ThemedText
      accessibilityLabel={`Rest time remaining ${formatCountdown(remainingSeconds)}`}
      style={{ flex: 1, minWidth: 72, textAlign: stacked ? "left" : "center", fontSize: 26, fontWeight: "700", fontFamily: Fonts.sans, fontVariant: ["tabular-nums"], color: colors.text, includeFontPadding: false }}
    >{formatCountdown(remainingSeconds)}</ThemedText>;
    const skipButton = <Pressable
      testID="player-rest-skip"
      onPress={onSkip}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Skip rest"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={{ minWidth: stacked ? 88 : 64, minHeight: 44, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primaryButton }}
    >
      <ThemedText style={{ fontSize: 15, fontWeight: "600", fontFamily: Fonts.sans, color: "#FFFFFF" }}>Skip</ThemedText>
    </Pressable>;

    return <View testID="player-sticky-rest" style={{ backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.inputBorder }}>
      <View style={{ height: 3, backgroundColor: colors.inputBorder }}>
        <View style={{ width: `${progress * 100}%`, height: 3, backgroundColor: colors.primaryButton }} />
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 }}>
        <ThemedText numberOfLines={stacked ? 2 : 1} accessibilityLabel={exerciseName ? `Resting after ${exerciseName}` : "Resting"}
          style={{ color: colors.placeholder, fontSize: 12, marginBottom: 4 }}>
          {exerciseName ? `Rest · ${exerciseName}` : "Rest"}
        </ThemedText>
        {stacked ? <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{countdown}{skipButton}</View>
          <View style={{ flexDirection: "row", gap: 8 }}>{adjustButton(-15, "−15")}{adjustButton(15, "+15")}</View>
        </View> : <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {adjustButton(-15, "−15")}{countdown}{adjustButton(15, "+15")}{skipButton}
        </View>}
      </View>
    </View>;
  }

  return (
    <View
      testID={compact ? "player-sticky-rest" : undefined}
      style={{
        borderRadius: compact ? 0 : 12,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        backgroundColor: colors.inputBackground,
        paddingHorizontal: compact ? 20 : 12,
        paddingVertical: compact ? 8 : 12,
        marginBottom: compact ? 0 : 16,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 12, rowGap: compact ? 4 : 0 }}>
      <View style={{ flex: 1, minWidth: compact ? 120 : 80 }}>
      <ThemedText
        style={{
          fontSize: compact ? 11 : 12,
          fontWeight: "600",
          fontFamily: Fonts.sans,
          color: colors.placeholder,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: compact ? 0 : 4,
        }}
      >
        {exerciseName ? `Resting · ${exerciseName}` : "Resting"}
      </ThemedText>

      <ThemedText
        style={{
          fontSize: compact ? 22 : 28,
          fontWeight: "700",
          fontFamily: Fonts.sans,
          color: colors.text,
          fontVariant: ["tabular-nums"],
          includeFontPadding: false,
          textAlign: "left",
          width: "100%",
        }}
      >
        {formatCountdown(remainingSeconds)}
      </ThemedText>
      </View>

      {/* Adjust + skip controls */}
      <View style={{ flexDirection: "row", flexWrap: compact ? "wrap" : "nowrap", gap: 6, maxWidth: "100%" }}>
        <Pressable
          onPress={() => onAdjust(-15)}
          disabled={disabled}
          accessibilityState={{ disabled: Boolean(disabled) }}
          accessibilityRole="button"
          accessibilityLabel="Reduce rest by 15 seconds"
          style={{
            minHeight: 44,
            minWidth: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: compact ? 6 : 8,
            borderRadius: 12,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.inputBorder,
          }}
        >
          <Ionicons name="remove" size={16} color={colors.text} />
          <ThemedText style={{ fontSize: 14, fontWeight: "600", fontFamily: Fonts.sans }}>
            15s
          </ThemedText>
        </Pressable>

        <Pressable
          testID="player-rest-skip"
          onPress={onSkip}
          disabled={disabled}
          accessibilityState={{ disabled: Boolean(disabled) }}
          accessibilityRole="button"
          accessibilityLabel="Skip rest"
          style={{
            minHeight: 44,
            minWidth: 44,
            alignItems: "center",
            justifyContent: "center",
            padding: compact ? 6 : 8,
            borderRadius: 12,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.inputBorder,
          }}
        >
          <ThemedText style={{ fontSize: 14, fontWeight: "600", fontFamily: Fonts.sans }}>
            Skip
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => onAdjust(15)}
          disabled={disabled}
          accessibilityState={{ disabled: Boolean(disabled) }}
          accessibilityRole="button"
          accessibilityLabel="Extend rest by 15 seconds"
          style={{
            minHeight: 44,
            minWidth: 44,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: compact ? 6 : 8,
            borderRadius: 12,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.inputBorder,
          }}
        >
          <Ionicons name="add" size={16} color={colors.text} />
          <ThemedText style={{ fontSize: 14, fontWeight: "600", fontFamily: Fonts.sans }}>
            15s
          </ThemedText>
        </Pressable>
      </View>
      </View>
      <View style={{ height: compact ? 2 : 3, borderRadius: 2, backgroundColor: colors.inputBorder, overflow: "hidden", marginTop: compact ? 5 : 10 }}>
        <View style={{ width: `${progress * 100}%`, height: 3, backgroundColor: colors.primaryButton }} />
      </View>
    </View>
  );
}
