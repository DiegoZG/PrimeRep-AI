import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExerciseListSheet } from "@/components/workout/ExerciseListSheet";
import { RestTimer } from "@/components/workout/RestTimer";
import { SetInputRow } from "@/components/workout/SetInputRow";
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWorkoutWeek } from "@/hooks/use-workout-week";
import type { RestContext, SetState, WorkoutItem } from "@/interfaces/workouts";
import {
  completeSession,
  createSession,
  fetchLastSetsForExercises,
  logSet,
  type LastSet,
} from "@/services/workoutLoggingService";
import { AuthContext } from "@/utils/authContext";
import {
  convertWeightString,
  formatWeightInput,
  formatWeightLabel,
  fromKg,
  loadWeightUnit,
  saveWeightUnit,
  toKg,
  type WeightUnit,
} from "@/utils/weightUnits";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function findHistoryForSet(history: LastSet[] | undefined, setNumber: number): LastSet | undefined {
  if (!history || history.length === 0) return undefined;
  return history.find((h) => h.setNumber === setNumber) || history[0];
}

function formatLastTimeHint(
  match: LastSet | undefined,
  weightUnit: WeightUnit
): string | undefined {
  if (!match) return undefined;
  if (match.weightKg != null) {
    return `${formatWeightLabel(match.weightKg, weightUnit)} × ${match.reps}`;
  }
  return `${match.reps} reps`;
}

interface WorkoutSummaryPayload {
  workoutName: string;
  durationSeconds: number;
  setsCompleted: number;
  totalSets: number;
  totalVolumeKg: number;
  weightUnit: WeightUnit;
  prExerciseNames: string[];
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const { workoutDayId } = useLocalSearchParams<{ workoutDayId: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { token } = useContext(AuthContext);
  const { getWorkoutById } = useWorkoutWeek();

  const workout = workoutDayId ? getWorkoutById(workoutDayId) : null;

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // All exercises flattened from blocks
  const exercises = useMemo(() => {
    if (!workout) return [];
    return workout.blocks.flatMap((block) => block.items);
  }, [workout]);

  // Initialize set tracking state from prescription
  const [sets, setSets] = useState<SetState[]>([]);

  useEffect(() => {
    if (exercises.length > 0 && sets.length === 0) {
      const initial: SetState[] = [];
      for (const item of exercises) {
        for (let s = 1; s <= item.prescription.sets; s++) {
          initial.push({
            exerciseId: item.exercise.id,
            setNumber: s,
            reps: "",
            weight: "",
            confirmed: false,
            syncing: false,
            logId: null,
          });
        }
      }
      setSets(initial);
    }
  }, [exercises, sets.length]);

  // ── Weight unit (display preference; API always stores kg) ─────────────────

  const [weightUnit, setWeightUnit] = useState<WeightUnit>("LB");
  const [unitReady, setUnitReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadWeightUnit().then((unit) => {
      if (!cancelled) {
        setWeightUnit(unit);
        setUnitReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleWeightUnit = useCallback(() => {
    const next: WeightUnit = weightUnit === "KG" ? "LB" : "KG";
    setSets((prev) =>
      prev.map((s) => ({
        ...s,
        weight: convertWeightString(s.weight, weightUnit, next),
      }))
    );
    setWeightUnit(next);
    void saveWeightUnit(next);
  }, [weightUnit]);

  // ── Last-sets prefetch (for pre-fill + PR detection) ──────────────────────

  const [lastSetsByExercise, setLastSetsByExercise] = useState<Record<string, LastSet[]>>({});
  const [lastSetsLoaded, setLastSetsLoaded] = useState(false);
  const hasPrefilledRef = useRef(false);

  useEffect(() => {
    async function loadLastSets() {
      if (!token || exercises.length === 0 || lastSetsLoaded) return;
      const exerciseIds = exercises.map((item) => item.exercise.id);
      const map = await fetchLastSetsForExercises(token, exerciseIds);
      setLastSetsByExercise(map);
      setLastSetsLoaded(true);
    }
    loadLastSets();
  }, [token, exercises, lastSetsLoaded]);

  // Pre-fill blank, unconfirmed set inputs from history exactly once, so we
  // never clobber values the user has already started typing. Wait for the
  // weight-unit preference so prefilled values match the display unit.
  useEffect(() => {
    if (!unitReady || !lastSetsLoaded || sets.length === 0 || hasPrefilledRef.current) return;
    hasPrefilledRef.current = true;
    setSets((prev) =>
      prev.map((s) => {
        if (s.confirmed || s.weight || s.reps) return s;
        const match = findHistoryForSet(lastSetsByExercise[s.exerciseId], s.setNumber);
        if (!match) return s;
        return {
          ...s,
          weight:
            match.weightKg != null
              ? formatWeightInput(fromKg(match.weightKg, weightUnit))
              : s.weight,
          reps: match.reps != null ? String(match.reps) : s.reps,
        };
      })
    );
  }, [unitReady, lastSetsLoaded, sets.length, lastSetsByExercise, weightUnit]);

  // Confirmed set count (overall, across all exercises)
  const confirmedCount = useMemo(() => sets.filter((s) => s.confirmed).length, [sets]);
  const totalSets = sets.length;

  const getExerciseProgress = useCallback(
    (exerciseId: string) => {
      const exerciseSets = sets.filter((s) => s.exerciseId === exerciseId);
      return {
        confirmed: exerciseSets.filter((s) => s.confirmed).length,
        total: exerciseSets.length,
      };
    },
    [sets]
  );

  // ── Timer ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (sessionId) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId]);

  // ── Rest-end sound (loaded once, replayed on each rest completion) ────────

  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadSound() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/sounds/rest-done.m4a")
        );
        if (isMounted) {
          soundRef.current = sound;
        } else {
          sound.unloadAsync();
        }
      } catch (err) {
        console.warn("Failed to load rest-done sound:", err);
      }
    }
    loadSound();
    return () => {
      isMounted = false;
      soundRef.current?.unloadAsync();
    };
  }, []);

  const playRestEndFeedback = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    soundRef.current?.replayAsync().catch((err) => {
      console.warn("Failed to play rest-done sound:", err);
    });
  }, []);

  // ── Create session on mount ────────────────────────────────────────────────

  useEffect(() => {
    async function startSession() {
      if (!token || !workout || sessionId || isCreating) return;
      setIsCreating(true);
      try {
        const session = await createSession(
          token,
          workout.workoutDayId,
          workout.date,
          workout.dayType
        );
        setSessionId(session.id);
      } catch (err) {
        console.warn("Failed to create session:", err);
        Alert.alert("Error", "Could not start workout session. Please try again.", [
          { text: "Go Back", onPress: () => router.back() },
        ]);
      } finally {
        setIsCreating(false);
      }
    }
    startSession();
  }, [token, workout, sessionId, isCreating, router]);

  // ── One-exercise-at-a-time navigation ──────────────────────────────────────

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const currentItem: WorkoutItem | undefined = exercises[currentExerciseIndex];

  const currentSets = useMemo(() => {
    if (!currentItem) return [];
    return sets
      .filter((s) => s.exerciseId === currentItem.exercise.id)
      .sort((a, b) => a.setNumber - b.setNumber);
  }, [sets, currentItem]);

  // ── Rest timer state ───────────────────────────────────────────────────────

  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restTotalSeconds, setRestTotalSeconds] = useState(0);
  const [restContext, setRestContext] = useState<RestContext | null>(null);
  const [pendingTransition, setPendingTransition] = useState<{
    nextIndex: number;
    nextName: string;
  } | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRestingCurrentExercise =
    restEndsAt !== null && restContext?.exerciseIndex === currentExerciseIndex;

  const finishRest = useCallback(() => {
    setRestEndsAt(null);
    setRestContext((ctx) => {
      if (ctx?.isLastSetOfExercise) {
        const nextIndex = ctx.exerciseIndex + 1;
        if (nextIndex < exercises.length) {
          setPendingTransition({ nextIndex, nextName: exercises[nextIndex].exercise.name });
        }
      }
      return null;
    });
  }, [exercises]);

  const handleRestExpire = useCallback(() => {
    playRestEndFeedback();
    finishRest();
  }, [playRestEndFeedback, finishRest]);

  const handleRestSkip = useCallback(() => {
    finishRest();
  }, [finishRest]);

  const adjustRest = useCallback((deltaSeconds: number) => {
    setRestEndsAt((prev) => (prev === null ? prev : prev + deltaSeconds * 1000));
  }, []);

  const handleContinueTransition = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    setPendingTransition((current) => {
      if (!current) return null;
      setCurrentExerciseIndex(current.nextIndex);
      return null;
    });
  }, []);

  // Auto-advance the "Next up" transition after a short delay; the user can
  // also tap Continue to skip the wait.
  useEffect(() => {
    if (!pendingTransition) return;
    transitionTimeoutRef.current = setTimeout(() => {
      handleContinueTransition();
    }, 2200);
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, [pendingTransition, handleContinueTransition]);

  // ── Set input handlers ─────────────────────────────────────────────────────

  const updateSet = useCallback(
    (setNumber: number, field: "reps" | "weight", value: string) => {
      if (!currentItem) return;
      const exerciseId = currentItem.exercise.id;
      setSets((prev) =>
        prev.map((s) =>
          s.exerciseId === exerciseId && s.setNumber === setNumber
            ? { ...s, [field]: value }
            : s
        )
      );
    },
    [currentItem]
  );

  const confirmSet = useCallback(
    async (setNumber: number) => {
      if (!token || !sessionId || !currentItem) return;
      const exerciseId = currentItem.exercise.id;

      const target = sets.find(
        (s) => s.exerciseId === exerciseId && s.setNumber === setNumber
      );
      if (!target || target.confirmed) return;

      const reps = parseInt(target.reps, 10);
      if (isNaN(reps) || reps <= 0) {
        Alert.alert("Invalid reps", "Enter a valid number of reps.");
        return;
      }

      const weightDisplay = target.weight ? parseFloat(target.weight) : undefined;
      if (target.weight && (isNaN(weightDisplay!) || weightDisplay! < 0)) {
        Alert.alert("Invalid weight", "Enter a valid weight.");
        return;
      }
      // Backend always stores kilograms.
      const weightKg =
        weightDisplay != null ? Math.round(toKg(weightDisplay, weightUnit) * 100) / 100 : undefined;

      // Determine whether this confirmation completes the exercise, so we
      // know what to do once the rest period that follows ends.
      const exerciseSetsAfter = sets
        .filter((s) => s.exerciseId === exerciseId)
        .map((s) => (s.setNumber === setNumber ? { ...s, confirmed: true } : s));
      const isLastSetOfExercise = exerciseSetsAfter.every((s) => s.confirmed);

      // Optimistic update
      setSets((prev) =>
        prev.map((s) =>
          s.exerciseId === exerciseId && s.setNumber === setNumber
            ? { ...s, confirmed: true, syncing: true }
            : s
        )
      );

      // Rest timer starts immediately — it's a UX affordance independent of
      // whether the network call has resolved yet.
      const restSeconds = currentItem.prescription.restSeconds;
      setRestTotalSeconds(restSeconds);
      setRestEndsAt(Date.now() + restSeconds * 1000);
      setRestContext({ exerciseIndex: currentExerciseIndex, isLastSetOfExercise });

      try {
        const result = await logSet(token, sessionId, exerciseId, setNumber, reps, weightKg);
        setSets((prev) =>
          prev.map((s) =>
            s.exerciseId === exerciseId && s.setNumber === setNumber
              ? { ...s, syncing: false, logId: result.id }
              : s
          )
        );
      } catch (err) {
        console.warn("Failed to log set:", err);
        // Revert optimistic update
        setSets((prev) =>
          prev.map((s) =>
            s.exerciseId === exerciseId && s.setNumber === setNumber
              ? { ...s, confirmed: false, syncing: false }
              : s
          )
        );
      }
    },
    [token, sessionId, sets, currentItem, currentExerciseIndex, weightUnit]
  );

  // ── Complete workout ───────────────────────────────────────────────────────

  const buildSummaryPayload = useCallback((): WorkoutSummaryPayload => {
    let totalVolumeKg = 0;
    const prExerciseNames = new Set<string>();

    for (const item of exercises) {
      const history = lastSetsByExercise[item.exercise.id] || [];
      const priorMaxWeight = history.reduce<number | null>((max, h) => {
        if (h.weightKg == null) return max;
        return max === null ? h.weightKg : Math.max(max, h.weightKg);
      }, null);

      const exerciseSets = sets.filter((s) => s.exerciseId === item.exercise.id && s.confirmed);
      for (const s of exerciseSets) {
        const weightDisplay = s.weight ? parseFloat(s.weight) : null;
        const reps = parseInt(s.reps, 10);
        if (weightDisplay != null && !isNaN(weightDisplay) && !isNaN(reps)) {
          const weightKg = toKg(weightDisplay, weightUnit);
          totalVolumeKg += weightKg * reps;
          if (priorMaxWeight !== null && weightKg > priorMaxWeight) {
            prExerciseNames.add(item.exercise.name);
          }
        }
      }
    }

    return {
      workoutName: workout?.title || "Workout",
      durationSeconds: elapsedSeconds,
      setsCompleted: confirmedCount,
      totalSets,
      totalVolumeKg,
      weightUnit,
      prExerciseNames: Array.from(prExerciseNames),
    };
  }, [
    exercises,
    lastSetsByExercise,
    sets,
    workout,
    elapsedSeconds,
    confirmedCount,
    totalSets,
    weightUnit,
  ]);

  const handleComplete = useCallback(async () => {
    if (!token || !sessionId) return;

    if (confirmedCount === 0) {
      Alert.alert("No sets logged", "Log at least one set before finishing.");
      return;
    }

    Alert.alert(
      "Finish Workout?",
      `You completed ${confirmedCount} of ${totalSets} sets.`,
      [
        { text: "Keep Going", style: "cancel" },
        {
          text: "Finish",
          onPress: async () => {
            setIsCompleting(true);
            try {
              await completeSession(token, sessionId);
              if (timerRef.current) clearInterval(timerRef.current);
              const payload = buildSummaryPayload();
              router.replace({
                pathname: "/workout/summary",
                params: { payload: JSON.stringify(payload) },
              });
            } catch (err) {
              console.warn("Failed to complete session:", err);
              Alert.alert("Error", "Could not finish session. Please try again.");
            } finally {
              setIsCompleting(false);
            }
          },
        },
      ]
    );
  }, [token, sessionId, confirmedCount, totalSets, router, buildSummaryPayload]);

  // ── Back with confirmation ─────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    if (confirmedCount > 0) {
      Alert.alert(
        "Quit Workout?",
        "Your logged sets will be saved but the session won't be marked as complete.",
        [
          { text: "Keep Going", style: "cancel" },
          { text: "Quit", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  }, [confirmedCount, router]);

  // ── Loading / error states ─────────────────────────────────────────────────

  if (!workout) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ThemedText>Workout not found.</ThemedText>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <ThemedText style={{ color: colors.primaryButton }}>Go Back</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isCreating || !sessionId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.primaryButton} />
          <ThemedText style={{ marginTop: 12, opacity: 0.7 }}>Starting session...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const initials = currentItem
    ? currentItem.exercise.name
        .split(/[\s-]+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.inputBorder,
        }}
      >
        <Pressable
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          style={{ flex: 1, alignItems: "center" }}
          onPress={() => setSheetVisible(true)}
        >
          <ThemedText type="defaultSemiBold">{workout.title}</ThemedText>
          <ThemedText style={{ fontSize: 13, color: colors.placeholder }}>
            {formatTime(elapsedSeconds)} • Exercise {currentExerciseIndex + 1} of{" "}
            {exercises.length} • {confirmedCount}/{totalSets} sets
          </ThemedText>
        </Pressable>
        <Pressable
          testID="player-exercise-list-button"
          onPress={() => setSheetVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="list" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Overall progress bar */}
      <View style={{ height: 3, backgroundColor: colors.inputBorder }}>
        <View
          style={{
            height: 3,
            width: totalSets > 0 ? `${(confirmedCount / totalSets) * 100}%` : "0%",
            backgroundColor: colors.primaryButton,
          }}
        />
      </View>

      {/* Main content */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
      >
        {pendingTransition ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <ThemedText style={{ fontSize: 14, color: colors.placeholder, marginBottom: 8 }}>
              Next up
            </ThemedText>
            <ThemedText type="title" style={{ fontSize: 26, textAlign: "center", marginBottom: 24 }}>
              {pendingTransition.nextName}
            </ThemedText>
            <Pressable
              testID="player-next-exercise"
              onPress={handleContinueTransition}
              style={{
                backgroundColor: colors.primaryButton,
                paddingHorizontal: 32,
                paddingVertical: 14,
                borderRadius: 14,
              }}
            >
              <ThemedText style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                Continue
              </ThemedText>
            </Pressable>
          </View>
        ) : currentItem ? (
          <>
            {/* Exercise header */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: colors.inputBackground,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                }}
              >
                <ThemedText style={{ fontSize: 15, fontWeight: "600", fontFamily: Fonts.sans }}>
                  {initials}
                </ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="title" style={{ fontSize: 22 }}>
                  {currentItem.exercise.name}
                </ThemedText>
                <ThemedText style={{ fontSize: 14, color: colors.placeholder, marginTop: 2 }}>
                  {currentItem.prescription.sets} × {currentItem.prescription.reps} •{" "}
                  {currentItem.prescription.restSeconds}s rest
                </ThemedText>
              </View>
            </View>

            {isRestingCurrentExercise && restEndsAt !== null ? (
              <RestTimer
                restEndsAt={restEndsAt}
                totalSeconds={restTotalSeconds}
                colors={colors}
                onAdjust={adjustRest}
                onSkip={handleRestSkip}
                onExpire={handleRestExpire}
              />
            ) : (
              <>
                {/* Column labels + unit toggle */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 4,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ width: 42 }} />
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ThemedText
                      style={{
                        fontSize: 11,
                        color: colors.placeholder,
                        fontWeight: "500",
                        fontFamily: Fonts.sans,
                        textTransform: "uppercase",
                      }}
                    >
                      Weight
                    </ThemedText>
                    <View
                      style={{
                        flexDirection: "row",
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.inputBorder,
                        overflow: "hidden",
                      }}
                    >
                      {(["LB", "KG"] as const).map((unit) => {
                        const isActive = weightUnit === unit;
                        return (
                          <Pressable
                            key={unit}
                            testID={`player-unit-${unit.toLowerCase()}`}
                            onPress={() => {
                              if (unit !== weightUnit) toggleWeightUnit();
                            }}
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              backgroundColor: isActive
                                ? colors.primaryButton
                                : colors.background,
                            }}
                          >
                            <ThemedText
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                fontFamily: Fonts.sans,
                                color: isActive ? "#FFFFFF" : colors.placeholder,
                              }}
                            >
                              {unit}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={{ width: 20 }} />
                  <ThemedText
                    style={{
                      flex: 1,
                      fontSize: 11,
                      color: colors.placeholder,
                      fontWeight: "500",
                      fontFamily: Fonts.sans,
                      textTransform: "uppercase",
                    }}
                  >
                    Reps
                  </ThemedText>
                  <View style={{ width: 40 }} />
                </View>

                {currentSets.map((setRow) => (
                  <SetInputRow
                    key={`${setRow.exerciseId}-${setRow.setNumber}`}
                    setRow={setRow}
                    colors={colors}
                    weightUnit={weightUnit}
                    lastTimeHint={formatLastTimeHint(
                      findHistoryForSet(lastSetsByExercise[setRow.exerciseId], setRow.setNumber),
                      weightUnit
                    )}
                    onUpdate={updateSet}
                    onConfirm={confirmSet}
                  />
                ))}
              </>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* Finish button */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 20,
          paddingBottom: 34,
          paddingTop: 12,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.inputBorder,
        }}
      >
        <Pressable
          testID="player-finish"
          onPress={handleComplete}
          disabled={isCompleting || confirmedCount === 0}
          style={{
            backgroundColor: confirmedCount > 0 ? colors.primaryButton : colors.inputBackground,
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: "center",
            opacity: isCompleting ? 0.6 : 1,
          }}
        >
          {isCompleting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText
              type="defaultSemiBold"
              style={{
                color: confirmedCount > 0 ? "#FFFFFF" : colors.placeholder,
                fontSize: 16,
              }}
            >
              Finish Workout ({confirmedCount}/{totalSets})
            </ThemedText>
          )}
        </Pressable>
      </View>

      <ExerciseListSheet
        visible={sheetVisible}
        exercises={exercises}
        currentIndex={currentExerciseIndex}
        colors={colors}
        getProgress={getExerciseProgress}
        onSelect={(index) => {
          setCurrentExerciseIndex(index);
          setSheetVisible(false);
        }}
        onClose={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  );
}
