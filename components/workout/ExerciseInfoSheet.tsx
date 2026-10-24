import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ContentSection } from "@/components/exercises/ContentSection";
import { ExerciseAskThread } from "@/components/exercises/ExerciseAskThread";
import { ExerciseMedia } from "@/components/exercises/ExerciseMedia";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useIsBeginner } from "@/hooks/use-is-beginner";
import type { ExerciseDetail } from "@/interfaces/exercises";
import { getExerciseById } from "@/services/exerciseService";
import { AuthContext } from "@/utils/authContext";
import { ScreenState } from "@/components/screen-state";

interface ExerciseInfoSheetProps {
  visible: boolean;
  inline?: boolean;
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
  inline = false,
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
  const [revision, setRevision] = useState(0);
  const { user } = useContext(AuthContext);
  const key = `${user?.id ?? "guest"}:${token}:${exerciseId}`;
  const keyRef = useRef(key);
  keyRef.current = key;
  const [owner, setOwner] = useState("");
  const isBeginner = useIsBeginner();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!visible || !exerciseId || !token) return;
      setIsLoading(true);
      setError(null);
      setDetail(null);
      setOwner(key);
      try {
        const data = await getExerciseById(exerciseId, token);
        if (!cancelled && keyRef.current === key) setDetail(data);
      } catch (err) {
        console.warn("Failed to load exercise detail for info sheet:", err);
        if (!cancelled && keyRef.current === key) setError("Couldn't load exercise details.");
      } finally {
        if (!cancelled && keyRef.current === key) setIsLoading(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [visible, exerciseId, token, key, revision]);

  // Reset stale content once the sheet closes so it doesn't flash next open.
  useEffect(() => {
    if (!visible) {
      setDetail(null);
      setError(null);
    }
  }, [visible]);

  const content = (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable
          accessible={false}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
          onPress={onClose}
        >
          <Pressable
            accessible={false}
            style={{ flex: 1, marginTop: insets.top + 8 }}
            onPress={(e) => e.stopPropagation()}
          >
            <SafeAreaView
              edges={["bottom"]}
              style={{
                backgroundColor: colors.background,
                flex: 1,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
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
                <Pressable
                  testID="player-info-sheet-close"
                  accessibilityRole="button"
                  accessibilityLabel="Close exercise information"
                  onPress={onClose}
                  style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
                >
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>

              <ScrollView
                style={{ paddingHorizontal: 20, flex: 1 }}
                contentContainerStyle={{ paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
              >
                {isLoading || owner !== key ? (
                  <View style={{ paddingVertical: 40, alignItems: "center" }}>
                    <ActivityIndicator size="large" color={colors.primaryButton} />
                  </View>
                ) : error ? (
                  <ScreenState colors={colors} kind="error" title="Exercise unavailable" message={error} actionLabel="Retry" onAction={() => setRevision((value) => value + 1)} testID="player-info-retry" />
                ) : detail ? (
                  <>
                    <ExerciseMedia
                      imageUrl={detail.imageUrl}
                      demoVideoUrl={detail.demoVideoUrl}
                      media={detail.media}
                      active={visible}
                      exerciseName={detail.name}
                      colors={colors}
                      height={180}
                    />
                    {detail.structuredContent?.cues.length ? <ContentSection title="Form cues" content={detail.structuredContent.cues.join("\n\n")} colors={colors} icon="checkmark-circle-outline" /> : null}

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
  );
  return inline ? (visible ? content : null) : <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>{content}</Modal>;
}
