import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ContentSection } from "@/components/exercises/ContentSection";
import { ExerciseAskThread } from "@/components/exercises/ExerciseAskThread";
import { ExerciseMedia } from "@/components/exercises/ExerciseMedia";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useIsBeginner } from "@/hooks/use-is-beginner";
import type { ExerciseDetail } from "@/interfaces/exercises";
import { getExerciseById } from "@/services/exerciseService";

interface ExerciseInfoSheetProps {
  visible: boolean;
  exerciseId: string | null;
  exerciseName: string;
  colors: typeof Colors.light;
  token: string | null;
  isLoggedIn: boolean;
  onClose: () => void;
}

/**
 * Mid-workout info sheet: shows the same content sections + Ask thread as the
 * exercise detail screen, without leaving the active workout player.
 */
export function ExerciseInfoSheet({
  visible,
  exerciseId,
  exerciseName,
  colors,
  token,
  isLoggedIn,
  onClose,
}: ExerciseInfoSheetProps) {
  const [detail, setDetail] = useState<ExerciseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBeginner = useIsBeginner();

  const handleWatchDemo = async () => {
    if (!detail?.demoVideoUrl) return;
    try {
      const canOpen = await Linking.canOpenURL(detail.demoVideoUrl);
      if (!canOpen) throw new Error("Unsupported demo URL");
      await Linking.openURL(detail.demoVideoUrl);
    } catch {
      Alert.alert("Demo Unavailable", "This exercise video could not be opened. Use the written instructions for now.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!visible || !exerciseId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await getExerciseById(exerciseId);
        if (!cancelled) setDetail(data);
      } catch (err) {
        console.warn("Failed to load exercise detail for info sheet:", err);
        if (!cancelled) setError("Couldn't load exercise details.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [visible, exerciseId]);

  // Reset stale content once the sheet closes so it doesn't flash next open.
  useEffect(() => {
    if (!visible) {
      setDetail(null);
      setError(null);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Keeps the Ask input visible instead of hidden behind the keyboard. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
          onPress={onClose}
        >
          {/* The height cap belongs here rather than on the sheet itself: a
              percentage resolves only against a parent with a definite height,
              which the full-screen overlay has and a content-sized view does not. */}
          <Pressable style={{ maxHeight: "85%" }} onPress={(e) => e.stopPropagation()}>
            <SafeAreaView
              edges={["bottom"]}
              style={{
                backgroundColor: colors.background,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                flexShrink: 1,
              }}
            >
              {/* Drag handle */}
              <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: colors.inputBorder,
                  }}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingTop: 8,
                  paddingBottom: 12,
                }}
              >
                <ThemedText
                  type="defaultSemiBold"
                  style={{ fontSize: 18, flex: 1 }}
                  numberOfLines={1}
                >
                  {exerciseName}
                </ThemedText>
                <Pressable testID="player-info-sheet-close" accessibilityRole="button" accessibilityLabel="Close exercise information" onPress={onClose} hitSlop={10}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>

              <ScrollView
                style={{ paddingHorizontal: 20, flexShrink: 1 }}
                contentContainerStyle={{ paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
              >
                {isLoading ? (
                  <View style={{ paddingVertical: 40, alignItems: "center" }}>
                    <ActivityIndicator size="large" color={colors.primaryButton} />
                  </View>
                ) : error ? (
                  <ThemedText
                    style={{ fontSize: 14, color: colors.placeholder, paddingVertical: 20 }}
                  >
                    {error}
                  </ThemedText>
                ) : detail ? (
                  <>
                    <ExerciseMedia
                      imageUrl={detail.imageUrl}
                      demoVideoUrl={detail.demoVideoUrl}
                      exerciseName={detail.name}
                      colors={colors}
                      height={180}
                    />
                    {detail.demoVideoUrl ? (
                      <Pressable
                        testID="player-watch-exercise-demo"
                        accessibilityRole="button"
                        accessibilityLabel={`Watch ${detail.name} demo video`}
                        onPress={() => void handleWatchDemo()}
                        style={{ minHeight: 48, marginBottom: 20, borderRadius: 14, backgroundColor: colors.primaryButton, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <Ionicons name="play-circle" size={22} color="#FFFFFF" />
                        <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>Watch Demo</ThemedText>
                      </Pressable>
                    ) : null}

                    {isBeginner && detail.beginnerNotes && (
                      <ContentSection
                        title="New to this?"
                        content={detail.beginnerNotes}
                        colors={colors}
                        highlight
                        icon="sparkles"
                      />
                    )}

                    {(detail.howTo || detail.whyItWorks || detail.commonMistakes) && (
                      <View style={{ marginBottom: 20 }}>
                        <ContentSection
                          title="How to perform"
                          content={detail.howTo}
                          colors={colors}
                          icon="list-outline"
                        />
                        <ContentSection
                          title="Why this exercise"
                          content={detail.whyItWorks}
                          colors={colors}
                          icon="bulb-outline"
                        />
                        <ContentSection
                          title="Common mistakes"
                          content={detail.commonMistakes}
                          colors={colors}
                          icon="warning-outline"
                        />
                      </View>
                    )}

                    <View style={{ marginBottom: 12 }}>
                      <ThemedText type="subtitle" style={{ fontSize: 16, marginBottom: 12 }}>
                        Ask about this exercise
                      </ThemedText>
                      <ExerciseAskThread
                        exerciseId={detail.id}
                        token={token}
                        isLoggedIn={isLoggedIn}
                        colors={colors}
                      />
                    </View>
                  </>
                ) : null}
              </ScrollView>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
