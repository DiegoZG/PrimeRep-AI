import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ContentSection } from "@/components/exercises/ContentSection";
import { ExerciseMedia } from "@/components/exercises/ExerciseMedia";
import { ExerciseAskThread } from "@/components/exercises/ExerciseAskThread";
import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
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
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 2;
  const danger = colorScheme === "dark" ? "#FF8B82" : "#B42318";
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
      edges={["top", "bottom"]}
    >
      {/* Header */}
      <View testID="exercise-detail-header" style={styles.header} onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }}>
        <Pressable
          testID="exercise-detail-back"
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
        <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
        <View style={styles.headerTitleContainer}>
          {!largeText && (
          <ThemedText type="title" style={styles.headerTitle}>
            Exercise
          </ThemedText>
          )}
        </View>
        </TouchableWithoutFeedback>
        {isLoggedIn && (
          <Pressable
            testID="exercise-detail-favorite"
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? `Remove ${exercise?.name ?? "exercise"} from favorites` : `Add ${exercise?.name ?? "exercise"} to favorites`}
            accessibilityState={{ disabled: isFavoriteLoading, busy: isFavoriteLoading }}
            onPress={handleToggleFavorite}
            style={styles.favoriteButton}
            disabled={isFavoriteLoading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isFavoriteLoading ? (
              <ActivityIndicator size="small" color={colors.icon} />
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
          <ActivityIndicator size="large" color={colors.icon} />
        </View>
      ) : error ? (
        <ScrollView contentContainerStyle={styles.errorContainer}>
          <View
            style={[
              styles.errorIcon,
              { backgroundColor: colors.inputBackground },
            ]}
          >
            <Ionicons name="alert-circle" size={32} color={danger} />
          </View>
          <ThemedText style={styles.errorTitle}>Exercise not found</ThemedText>
          <ThemedText style={[styles.errorSubtitle, { color: colors.icon }]}>{error}</ThemedText>
          <Pressable
            testID="exercise-detail-retry"
            accessibilityRole="button"
            accessibilityLabel="Retry loading exercise"
            onPress={() => void fetchExercise()}
            style={({ pressed }) => [
              styles.backActionButton,
              { backgroundColor: pressed ? colors.inputBackground : colors.background, borderColor: colors.inputBorder },
            ]}
          >
            <Text style={[styles.backActionButtonText, { color: colors.text }]}>Retry</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Back from exercise error" onPress={() => router.back()} style={styles.secondaryErrorAction}>
            <Text style={[styles.secondaryErrorActionText, { color: colors.text }]}>Go Back</Text>
          </Pressable>
        </ScrollView>
      ) : exercise ? (
        <ScrollView
          testID="exercise-detail-scroll"
          contentContainerStyle={styles.scrollContent}
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          onTouchEnd={(event) => { if (event.target === event.currentTarget) Keyboard.dismiss(); }}
        >
          <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
          <View testID="exercise-detail-content">
          {/* Exercise media — real footage, else labelled placeholder */}
          <ExerciseMedia
            imageUrl={exercise.imageUrl}
            demoVideoUrl={exercise.demoVideoUrl}
            media={exercise.media}
            exerciseName={exercise.name}
            colors={{ ...colors, placeholder: colors.icon }}
            height={largeText ? Math.round(220 * fontScale) : 220}
          />

          {/* Exercise Name & Type */}
          <View style={styles.titleSection}>
            <ThemedText testID="exercise-detail-name" type="title" style={styles.exerciseName}>
              {exercise.name}
            </ThemedText>
            {exercise.exerciseType && (
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
                ]}
              >
                <Text
                  style={[styles.typeBadgeText, { color: colors.icon }]}
                >
                  {exercise.exerciseType.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {exercise.isEditable ? (
            <><View style={styles.customActions}>
              <Pressable testID="custom-exercise-edit" accessibilityRole="button" accessibilityLabel={`Edit ${exercise.name}`} accessibilityState={{ disabled: customActionBusy }} disabled={customActionBusy} onPress={() => router.push({ pathname: "/programs/custom-exercise", params: { exerciseId: exercise.id } })} style={({ pressed }) => [styles.customAction, { borderColor: colors.inputBorder, backgroundColor: pressed ? colors.inputBackground : colors.background }]}><Ionicons name="create-outline" size={20} color={customActionBusy ? colors.icon : colors.text} /><Text style={[styles.customActionText, { color: customActionBusy ? colors.icon : colors.text }]}>Edit</Text></Pressable>
              <Pressable testID="custom-exercise-archive" accessibilityRole="button" accessibilityLabel={`Archive ${exercise.name}`} accessibilityState={{ disabled: customActionBusy, busy: customActionBusy }} disabled={customActionBusy} onPress={handleArchiveCustom} style={({ pressed }) => [styles.customAction, { borderColor: colors.inputBorder, backgroundColor: pressed ? colors.inputBackground : colors.background }]}>{customActionBusy ? <ActivityIndicator size="small" color={danger} /> : <Ionicons name="trash-outline" size={20} color={danger} />}<Text style={[styles.customActionText, { color: danger }]}>{customActionBusy ? "Archiving…" : "Archive"}</Text></Pressable>
            </View>{customActionError ? <ThemedText testID="custom-exercise-archive-error" accessibilityRole="alert" style={[styles.customActionError, { color: danger }]}>{customActionError}</ThemedText> : null}</>
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
                { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
              ]}
            >
              <View
                style={[
                  styles.muscleIcon,
                  { backgroundColor: colors.background, borderColor: colors.inputBorder },
                ]}
              >
                <Ionicons
                  name="fitness"
                  size={20}
                  color={colors.icon}
                />
              </View>
              <View style={styles.muscleInfo}>
                <Text style={[styles.muscleLabel, { color: colors.icon }]}>
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
                  { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
                ]}
              >
                <View
                  style={[
                    styles.muscleIcon,
                    { backgroundColor: colors.background, borderColor: colors.inputBorder },
                  ]}
                >
                  <Ionicons
                    name="body"
                    size={20}
                    color={colors.icon}
                  />
                </View>
                <View style={styles.muscleInfo}>
                  <Text
                    style={[styles.muscleLabel, { color: colors.icon }]}
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
                  { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
                ]}
              >
                <View
                  style={[
                    styles.equipmentIcon,
                    { backgroundColor: colors.background, borderColor: colors.inputBorder },
                  ]}
                >
                  <Ionicons name="barbell" size={20} color={colors.icon} />
                </View>
                <Text testID="exercise-equipment-names" style={[styles.equipmentText, { color: colors.text }]}>
                  {equipmentLabel}
                </Text>
              </View>
              {equipmentError && unresolvedEquipmentIds.length > 0 && !isEquipmentPending ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Retry loading equipment names" onPress={() => void ensureEquipmentLoaded({ force: true })} style={styles.equipmentRetry}>
                  <Text style={[styles.equipmentRetryText, { color: colors.text }]}>Retry equipment details</Text>
                </Pressable>
              ) : null}
          </View>

          {exercise.structuredContent?.cues.length ? <ContentSection testID="exercise-detail-cues" title="Form cues" content={exercise.structuredContent.cues.join("\n\n")} colors={colors} icon="checkmark-circle-outline" detailPresentation /> : null}
          {/* Beginner Notes — prominent for beginners */}
          {isBeginner && exercise.beginnerNotes && (
            <ContentSection
              title="New to this?"
              testID="exercise-detail-beginner"
              content={exercise.beginnerNotes}
              colors={colors}
              highlight
              detailPresentation
              icon="sparkles"
            />
          )}

          {/* Collapsible content sections */}
          {(exercise.howTo || exercise.whyItWorks || exercise.commonMistakes) && (
            <View style={styles.section}>
              <ContentSection
                title="How to perform"
                testID="exercise-detail-how-to"
                content={exercise.howTo}
                colors={colors}
                icon="list-outline"
                detailPresentation
              />
              <ContentSection
                title="Why this exercise"
                testID="exercise-detail-why"
                content={exercise.whyItWorks}
                colors={colors}
                icon="bulb-outline"
                detailPresentation
              />
              <ContentSection
                title="Common mistakes"
                testID="exercise-detail-mistakes"
                content={exercise.commonMistakes}
                colors={colors}
                icon="warning-outline"
                detailPresentation
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
              detailPresentation
            />
          </View>
          </View>
          </TouchableWithoutFeedback>
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
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 24,
  },
  favoriteButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 44,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
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
    textAlign: "center",
    marginBottom: 24,
  },
  backActionButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
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
    paddingBottom: 32,
  },
  titleSection: {
    marginBottom: 24,
  },
  customActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 },
  customAction: { flexGrow: 1, flexBasis: 140, minHeight: 46, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  customActionText: { flexShrink: 1, fontSize: 14, fontWeight: "700", fontFamily: Fonts.sans },
  customActionError: { marginTop: -12, marginBottom: 20 },
  exerciseName: {
    fontSize: 28,
    marginBottom: 8,
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: "100%",
  },
  typeBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
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
    borderWidth: 1,
    marginBottom: 8,
    gap: 14,
  },
  muscleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  muscleInfo: {
    flex: 1,
    minWidth: 0,
  },
  muscleLabel: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: Fonts.sans,
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
    borderWidth: 1,
    gap: 14,
  },
  equipmentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
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
