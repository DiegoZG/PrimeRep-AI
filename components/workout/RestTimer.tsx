import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";

interface RestTimerProps {
  /** Absolute epoch ms timestamp the rest period ends at. Survives backgrounding. */
  restEndsAt: number;
  /** Original rest duration in seconds, used as the progress bar denominator. */
  totalSeconds: number;
  colors: typeof Colors.light;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
  onExpire: () => void;
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
  colors,
  onAdjust,
  onSkip,
  onExpire,
}: RestTimerProps) {
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

  return (
    <View
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        backgroundColor: colors.inputBackground,
        padding: 20,
        alignItems: "center",
      }}
    >
      <ThemedText
        style={{
          fontSize: 12,
          fontWeight: "600",
          fontFamily: Fonts.sans,
          color: colors.placeholder,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        Resting
      </ThemedText>

      <ThemedText
        style={{
          fontSize: 56,
          // ThemedText defaults to lineHeight 24 — must override or large
          // digits get vertically clipped (only the bottom half shows).
          lineHeight: 68,
          fontWeight: "700",
          fontFamily: Fonts.sans,
          color: colors.text,
          fontVariant: ["tabular-nums"],
          includeFontPadding: false,
          textAlign: "center",
          width: "100%",
        }}
      >
        {formatCountdown(remainingSeconds)}
      </ThemedText>

      {/* Progress bar */}
      <View
        style={{
          width: "100%",
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.inputBorder,
          overflow: "hidden",
          marginTop: 16,
          marginBottom: 20,
        }}
      >
        <View
          style={{
            width: `${progress * 100}%`,
            height: 6,
            backgroundColor: colors.primaryButton,
          }}
        />
      </View>

      {/* Adjust + skip controls */}
      <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
        <Pressable
          onPress={() => onAdjust(-15)}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            paddingVertical: 12,
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
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: colors.primaryButton,
          }}
        >
          <ThemedText style={{ fontSize: 14, fontWeight: "600", fontFamily: Fonts.sans, color: "#FFFFFF" }}>
            Skip Rest
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => onAdjust(15)}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            paddingVertical: 12,
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
  );
}
