import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ContentSection } from "@/components/exercises/ContentSection";
import { ExerciseAskThread } from "@/components/exercises/ExerciseAskThread";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useIsBeginner } from "@/hooks/use-is-beginner";
import type { ExerciseDetail } from "@/interfaces/exercises";
import {
  favoriteExercise,
  getExerciseById,
  getFavoriteExercises,
  unfavoriteExercise,
} from "@/services/exerciseService";
import { AuthContext } from "@/utils/authContext";

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { token, isLoggedIn } = useContext(AuthContext);

  // Exercise state
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Favorite state
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState(false);

  // Experience level (used to decide whether beginner notes are shown prominently)
  const isBeginner = useIsBeginner();

  // Fetch exercise
  const fetchExercise = useCallback(async () => {
    if (!id) {
      setError("Exercise ID not provided");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await getExerciseById(id);
      setExercise(data);
    } catch (err: any) {
      console.warn("Failed to load exercise:", err);
      setError(err?.message || "Failed to load exercise");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Check if exercise is favorited
  const checkFavorite = useCallback(async () => {
    if (!isLoggedIn || !token || !id) return;

    try {
      const favoriteIds = await getFavoriteExercises(token);
      setIsFavorite(favoriteIds.includes(id));
    } catch (err) {
      console.warn("Failed to check favorite status:", err);
    }
  }, [isLoggedIn, token, id]);

  useEffect(() => {
    fetchExercise();
  }, [fetchExercise]);

  useEffect(() => {
    checkFavorite();
  }, [checkFavorite]);

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
    } finally {
      setIsFavoriteLoading(false);
    }
  };

  // Open demo video link
  const handleWatchDemo = async () => {
    if (!exercise?.demoVideoUrl) return;

    const canOpen = await Linking.canOpenURL(exercise.demoVideoUrl);
    if (canOpen) {
      await Linking.openURL(exercise.demoVideoUrl);
    }
  };

  // Get initials for fallback
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
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
            onPress={() => router.back()}
            style={[
              styles.backActionButton,
              { backgroundColor: colors.primaryButton },
            ]}
          >
            <Text style={styles.backActionButtonText}>Go Back</Text>
          </Pressable>
        </View>
      ) : exercise ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Exercise Image */}
          <View
            style={[
              styles.imageContainer,
              { backgroundColor: colors.inputBackground },
            ]}
          >
            {exercise.imageUrl ? (
              <Image
                source={{ uri: exercise.imageUrl }}
                style={styles.image}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text
                  style={[styles.imageInitials, { color: colors.placeholder }]}
                >
                  {getInitials(exercise.name)}
                </Text>
              </View>
            )}
          </View>

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
          {exercise.equipmentIds && exercise.equipmentIds.length > 0 && (
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
                <Text style={[styles.equipmentText, { color: colors.text }]}>
                  {exercise.equipmentIds.length} piece
                  {exercise.equipmentIds.length !== 1 ? "s" : ""} of equipment
                  required
                </Text>
              </View>
            </View>
          )}

          {/* Demo Video Button */}
          {exercise.demoVideoUrl && (
            <View style={styles.section}>
              <Pressable
                onPress={handleWatchDemo}
                style={[
                  styles.demoButton,
                  { backgroundColor: colors.primaryButton },
                ]}
              >
                <Ionicons name="play-circle" size={24} color="#FFFFFF" />
                <Text style={styles.demoButtonText}>Watch Demo Video</Text>
              </Pressable>
            </View>
          )}

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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  imageContainer: {
    height: 220,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  imageInitials: {
    fontSize: 48,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  titleSection: {
    marginBottom: 24,
  },
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

