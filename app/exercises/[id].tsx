import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ContentSection } from "@/components/exercises/ContentSection";
import { ExerciseMedia } from "@/components/exercises/ExerciseMedia";
import { ExerciseAskThread } from "@/components/exercises/ExerciseAskThread";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useIsBeginner } from "@/hooks/use-is-beginner";
import type { ExerciseDetail } from "@/interfaces/exercises";
import {
  favoriteExercise,
  archiveCustomExercise,
  getExerciseById,
  unfavoriteExercise,
} from "@/services/exerciseService";
import { AuthContext } from "@/utils/authContext";
import { useEquipment } from "@/utils/equipmentContext";

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { token, isLoggedIn, user } = useContext(AuthContext);
  const accountKey = `${user?.id ?? "guest"}:${token ?? "anonymous"}`;
  const accountRef = useRef(accountKey);
  accountRef.current = accountKey;
  const {
    items: equipment,
    isLoading: isEquipmentLoading,
    error: equipmentError,
    lastFetchedAt: equipmentFetchedAt,
    ensureEquipmentLoaded,
  } = useEquipment();

  // Exercise state
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Favorite state
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);
  const [customActionBusy, setCustomActionBusy] = useState(false);
  const [customActionError, setCustomActionError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const focusedRef = useRef(false);
  const customMutationRef = useRef(0);

  // Experience level (used to decide whether beginner notes are shown prominently)
  const isBeginner = useIsBeginner();

  // Fetch exercise
  const fetchExercise = useCallback(async () => {
    if (!id) {
      setError("Exercise ID not provided");
      setIsLoading(false);
      return;
    }

    const requestAccount = accountKey;
    try {
      setIsLoading(true);
      setError(null);
      const data = await getExerciseById(id, token);
      if (!mountedRef.current || !focusedRef.current || accountRef.current !== requestAccount) return;
      setExercise(data);
      setIsFavorite(data.isFavorited);
    } catch (err: any) {
      if (!mountedRef.current || !focusedRef.current || accountRef.current !== requestAccount) return;
      console.warn("Failed to load exercise:", err);
      setError(err?.message || "Failed to load exercise");
    } finally {
      if (mountedRef.current && focusedRef.current && accountRef.current === requestAccount) setIsLoading(false);
    }
  }, [accountKey, id, token]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      customMutationRef.current += 1;
    };
  }, []);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    void fetchExercise();
    return () => {
      focusedRef.current = false;
      customMutationRef.current += 1;
    };
  }, [fetchExercise]));

  useEffect(() => {
    void ensureEquipmentLoaded();
  }, [ensureEquipmentLoaded]);

  // Handle favorite toggle
  const handleToggleFavorite = async () => {
    if (!isLoggedIn || !token || !id) return;

    setIsFavoriteLoading(true);
    const previousState = isFavorite;
    setIsFavorite(!isFavorite);

    try {
      if (previousState) {
        await unfavoriteExercise(id, token);
      } else {
        await favoriteExercise(id, token);
      }
    } catch (err) {
      console.warn("Failed to toggle favorite:", err);
      setIsFavorite(previousState);
      Alert.alert(
        "Favorite wasn't updated",
        "Check your connection and try again.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Try Again", onPress: () => void handleToggleFavorite() },
        ],
      );
    } finally {
      setIsFavoriteLoading(false);
    }
  };

  // Open demo video link
  const handleArchiveCustom = () => {
    if (!token || !exercise?.isEditable || customActionBusy) return;
    Alert.alert("Archive exercise?", "It stays in completed workouts but can’t be added to new programs.", [
      { text: "Cancel", style: "cancel" },
      { text: "Archive", style: "destructive", onPress: async () => {
        const requestAccount = accountRef.current;
        const mutationId = ++customMutationRef.current;
        const isCurrent = () => mountedRef.current && focusedRef.current && accountRef.current === requestAccount && customMutationRef.current === mutationId;
        setCustomActionBusy(true);
        setCustomActionError(null);
        try {
          await archiveCustomExercise(token, exercise.id);
          if (isCurrent()) router.back();
        } catch {
          if (isCurrent()) setCustomActionError("The exercise wasn’t archived. Check your connection and try again.");
        } finally {
          if (isCurrent()) setCustomActionBusy(false);
        }
      } },
    ]);
  };

  const equipmentIds = exercise?.equipmentIds ?? [];
  const resolvedEquipmentNames = equipmentIds.flatMap((equipmentId) => {
    const match = equipment.find((item) => item.id === equipmentId);
    return match ? [match.name] : [];
  });
  const unresolvedEquipmentIds = equipmentIds.filter(
    (equipmentId) => !equipment.some((item) => item.id === equipmentId),
  );
  const isEquipmentPending = equipmentFetchedAt === null || isEquipmentLoading;
  const equipmentLabel = equipmentIds.length === 0
    ? "Bodyweight — no equipment required"
    : unresolvedEquipmentIds.length > 0 && isEquipmentPending
      ? "Loading equipment details…"
      : unresolvedEquipmentIds.length > 0 && equipmentError
        ? [...resolvedEquipmentNames, "Some equipment details couldn't load"].join(", ")
        : [...resolvedEquipmentNames, ...unresolvedEquipmentIds.map((equipmentId) => `Unknown equipment (${equipmentId})`)].join(", ");

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back from exercise"
          accessibilityState={{ disabled: customActionBusy }}
          disabled={customActionBusy}
          onPress={() => router.back()}
          style={[styles.backButton, { opacity: customActionBusy ? 0.35 : 1 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <ThemedText type="title" style={styles.headerTitle}>
            Exercise
          </ThemedText>
        </View>
        {isLoggedIn && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? `Remove ${exercise?.name ?? "exercise"} from favorites` : `Add ${exercise?.name ?? "exercise"} to favorites`}
            accessibilityState={{ disabled: isFavoriteLoading, busy: isFavoriteLoading }}
            onPress={handleToggleFavorite}
            style={styles.favoriteButton}
            disabled={isFavoriteLoading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isFavoriteLoading ? (
              <ActivityIndicator size="small" color={colors.primaryButton} />
            ) : (
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={24}
                color={isFavorite ? "#FF4B4B" : colors.text}
              />
            )}
          </Pressable>
        )}
        {!isLoggedIn && <View style={styles.headerSpacer} />}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryButton} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <View
            style={[
              styles.errorIcon,
              { backgroundColor: "rgba(255, 59, 48, 0.1)" },
            ]}
          >
            <Ionicons name="alert-circle" size={48} color="#FF3B30" />
          </View>
          <ThemedText style={styles.errorTitle}>Exercise not found</ThemedText>
          <ThemedText style={styles.errorSubtitle}>{error}</ThemedText>
          <Pressable
            testID="exercise-detail-retry"
            accessibilityRole="button"
            accessibilityLabel="Retry loading exercise"
            onPress={() => void fetchExercise()}
            style={[
              styles.backActionButton,
              { backgroundColor: colors.primaryButton },
            ]}
          >
            <Text style={styles.backActionButtonText}>Retry</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Back from exercise error" onPress={() => router.back()} style={styles.secondaryErrorAction}>
            <Text style={[styles.secondaryErrorActionText, { color: colors.primaryButton }]}>Go Back</Text>
          </Pressable>
        </View>
      ) : exercise ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Exercise media — real footage, else labelled placeholder */}
          <ExerciseMedia
            imageUrl={exercise.imageUrl}
            demoVideoUrl={exercise.demoVideoUrl}
            media={exercise.media}
            exerciseName={exercise.name}
            colors={colors}
          />

          {/* Exercise Name & Type */}
          <View style={styles.titleSection}>
            <ThemedText type="title" style={styles.exerciseName}>
              {exercise.name}
            </ThemedText>
            {exercise.exerciseType && (
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: colors.inputBackground },
                ]}
              >
                <Text
                  style={[styles.typeBadgeText, { color: colors.primaryButton }]}
                >
                  {exercise.exerciseType.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {exercise.isEditable ? (
            <><View style={styles.customActions}>
              <Pressable testID="custom-exercise-edit" accessibilityRole="button" accessibilityLabel={`Edit ${exercise.name}`} accessibilityState={{ disabled: customActionBusy }} disabled={customActionBusy} onPress={() => router.push({ pathname: "/programs/custom-exercise", params: { exerciseId: exercise.id } })} style={[styles.customAction, { borderColor: colors.inputBorder, opacity: customActionBusy ? 0.5 : 1 }]}><Ionicons name="create-outline" size={20} color={colors.primaryButton} /><Text style={[styles.customActionText, { color: colors.primaryButton }]}>Edit</Text></Pressable>
              <Pressable testID="custom-exercise-archive" accessibilityRole="button" accessibilityLabel={`Archive ${exercise.name}`} accessibilityState={{ disabled: customActionBusy, busy: customActionBusy }} disabled={customActionBusy} onPress={handleArchiveCustom} style={[styles.customAction, { borderColor: colors.inputBorder, opacity: customActionBusy ? 0.5 : 1 }]}>{customActionBusy ? <ActivityIndicator size="small" color="#D92D20" /> : <Ionicons name="trash-outline" size={20} color="#D92D20" />}<Text style={[styles.customActionText, { color: "#D92D20" }]}>{customActionBusy ? "Archiving…" : "Archive"}</Text></Pressable>
            </View>{customActionError ? <ThemedText testID="custom-exercise-archive-error" accessibilityRole="alert" style={styles.customActionError}>{customActionError}</ThemedText> : null}</>
          ) : null}

          {/* Muscles Section */}
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Target Muscles
            </ThemedText>

            {/* Primary Muscle */}
            <View
              style={[
                styles.muscleCard,
                { backgroundColor: colors.inputBackground },
              ]}
            >
              <View
                style={[
                  styles.muscleIcon,
                  { backgroundColor: "rgba(106, 79, 245, 0.1)" },
                ]}
              >
                <Ionicons
                  name="fitness"
                  size={20}
                  color={colors.primaryButton}
                />
              </View>
              <View style={styles.muscleInfo}>
                <Text style={[styles.muscleLabel, { color: colors.placeholder }]}>
                  Primary
                </Text>
                <Text style={[styles.muscleName, { color: colors.text }]}>
                  {exercise.primaryMuscle || "Not specified"}
                </Text>
              </View>
            </View>

            {/* Secondary Muscles */}
            {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
              <View
                style={[
                  styles.muscleCard,
                  { backgroundColor: colors.inputBackground },
                ]}
              >
                <View
                  style={[
                    styles.muscleIcon,
                    { backgroundColor: "rgba(0, 212, 255, 0.1)" },
                  ]}
                >
                  <Ionicons
                    name="body"
                    size={20}
                    color={colors.electricBlue}
                  />
                </View>
                <View style={styles.muscleInfo}>
                  <Text
                    style={[styles.muscleLabel, { color: colors.placeholder }]}
                  >
                    Secondary
                  </Text>
                  <Text style={[styles.muscleName, { color: colors.text }]}>
                    {exercise.secondaryMuscles.join(", ")}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Equipment Section */}
          <View style={styles.section}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Equipment
              </ThemedText>
              <View
                style={[
                  styles.equipmentCard,
                  { backgroundColor: colors.inputBackground },
                ]}
              >
                <View
                  style={[
                    styles.equipmentIcon,
                    { backgroundColor: "rgba(52, 199, 89, 0.1)" },
                  ]}
                >
                  <Ionicons name="barbell" size={20} color="#34C759" />
                </View>
                <Text testID="exercise-equipment-names" style={[styles.equipmentText, { color: colors.text }]}>
                  {equipmentLabel}
                </Text>
              </View>
              {equipmentError && unresolvedEquipmentIds.length > 0 && !isEquipmentPending ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Retry loading equipment names" onPress={() => void ensureEquipmentLoaded({ force: true })} style={styles.equipmentRetry}>
                  <Text style={[styles.equipmentRetryText, { color: colors.primaryButton }]}>Retry equipment details</Text>
                </Pressable>
              ) : null}
          </View>

          {exercise.structuredContent?.cues.length ? <ContentSection title="Form cues" content={exercise.structuredContent.cues.join("\n\n")} colors={colors} icon="checkmark-circle-outline" /> : null}
          {/* Beginner Notes — prominent for beginners */}
          {isBeginner && exercise.beginnerNotes && (
            <ContentSection
              title="New to this?"
              content={exercise.beginnerNotes}
              colors={colors}
              highlight
              icon="sparkles"
            />
          )}

          {/* Collapsible content sections */}
          {(exercise.howTo || exercise.whyItWorks || exercise.commonMistakes) && (
            <View style={styles.section}>
              <ContentSection
                title="How to perform"
                content={exercise.howTo}
                colors={colors}
                icon="list-outline"
              />
              <ContentSection
                title="Why this exercise"
                content={exercise.whyItWorks}
                colors={colors}
                icon="bulb-outline"
              />
              <ContentSection
                title="Common mistakes"
                content={exercise.commonMistakes}
                colors={colors}
                icon="warning-outline"
              />
            </View>
          )}

          {/* Ask about this exercise */}
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Ask about this exercise
            </ThemedText>
            <ExerciseAskThread
              exerciseId={exercise.id}
              token={token}
              isLoggedIn={isLoggedIn}
              colors={colors}
            />
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
  },
  favoriteButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
    marginBottom: 24,
  },
  backActionButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  backActionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  secondaryErrorAction: {
    minHeight: 44,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryErrorActionText: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  titleSection: {
    marginBottom: 24,
  },
  customActions: { flexDirection: "row", gap: 10, marginBottom: 22 },
  customAction: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  customActionText: { fontSize: 14, fontWeight: "700", fontFamily: Fonts.sans },
  customActionError: { color: "#D92D20", marginTop: -12, marginBottom: 20, lineHeight: 20 },
  exerciseName: {
    fontSize: 28,
    marginBottom: 8,
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  muscleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    gap: 14,
  },
  muscleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  muscleInfo: {
    flex: 1,
  },
  muscleLabel: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: Fonts.sans,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  muscleName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    textTransform: "capitalize",
  },
  equipmentCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    gap: 14,
  },
  equipmentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  equipmentText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    fontFamily: Fonts.sans,
  },
  equipmentRetry: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  equipmentRetryText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  demoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
    gap: 10,
  },
  demoButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
});
