import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWorkoutWeek } from "@/hooks/use-workout-week";
import type { WorkoutItem } from "@/interfaces/workouts";
import {
  completeSession,
  createSession,
  logSet,
} from "@/services/workoutLoggingService";
import { AuthContext } from "@/utils/authContext";

// ── Types ────────────────────────────────────────────────────────────────────

interface SetState {
  exerciseId: string;
  setNumber: number;
  reps: string;
  weight: string;
  confirmed: boolean;
  syncing: boolean;
  logId: string | null;
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

  // Confirmed set count
  const confirmedCount = useMemo(() => sets.filter((s) => s.confirmed).length, [sets]);
  const totalSets = sets.length;

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

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

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

  // ── Set input handlers ─────────────────────────────────────────────────────

  const updateSet = useCallback(
    (exerciseId: string, setNumber: number, field: "reps" | "weight", value: string) => {
      setSets((prev) =>
        prev.map((s) =>
          s.exerciseId === exerciseId && s.setNumber === setNumber
            ? { ...s, [field]: value }
            : s
        )
      );
    },
    []
  );

  const confirmSet = useCallback(
    async (exerciseId: string, setNumber: number) => {
      if (!token || !sessionId) return;

      const target = sets.find(
        (s) => s.exerciseId === exerciseId && s.setNumber === setNumber
      );
      if (!target || target.confirmed) return;

      const reps = parseInt(target.reps, 10);
      if (isNaN(reps) || reps <= 0) {
        Alert.alert("Invalid reps", "Enter a valid number of reps.");
        return;
      }

      const weightKg = target.weight ? parseFloat(target.weight) : undefined;
      if (target.weight && (isNaN(weightKg!) || weightKg! < 0)) {
        Alert.alert("Invalid weight", "Enter a valid weight.");
        return;
      }

      // Optimistic update
      setSets((prev) =>
        prev.map((s) =>
          s.exerciseId === exerciseId && s.setNumber === setNumber
            ? { ...s, confirmed: true, syncing: true }
            : s
        )
      );

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
    [token, sessionId, sets]
  );

  // ── Complete workout ───────────────────────────────────────────────────────

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
              router.back();
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
  }, [token, sessionId, confirmedCount, totalSets, router]);

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

  // Get sets for a specific exercise
  const getSetsForExercise = (exerciseId: string) =>
    sets.filter((s) => s.exerciseId === exerciseId);

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
        <View style={{ flex: 1, alignItems: "center" }}>
          <ThemedText type="defaultSemiBold">{workout.title}</ThemedText>
          <ThemedText style={{ fontSize: 13, color: colors.placeholder }}>
            {formatTime(elapsedSeconds)} • {confirmedCount}/{totalSets} sets
          </ThemedText>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar */}
      <View style={{ height: 3, backgroundColor: colors.inputBorder }}>
        <View
          style={{
            height: 3,
            width: totalSets > 0 ? `${(confirmedCount / totalSets) * 100}%` : "0%",
            backgroundColor: colors.primaryButton,
          }}
        />
      </View>

      {/* Exercise list */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {exercises.map((item, exerciseIndex) => (
          <ExerciseLogSection
            key={`${item.exercise.id}-${exerciseIndex}`}
            item={item}
            sets={getSetsForExercise(item.exercise.id)}
            colors={colors}
            onUpdateSet={updateSet}
            onConfirmSet={confirmSet}
          />
        ))}
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
    </SafeAreaView>
  );
}

// ── Exercise Section ─────────────────────────────────────────────────────────

interface ExerciseLogSectionProps {
  item: WorkoutItem;
  sets: SetState[];
  colors: typeof Colors.light;
  onUpdateSet: (exerciseId: string, setNumber: number, field: "reps" | "weight", value: string) => void;
  onConfirmSet: (exerciseId: string, setNumber: number) => void;
}

function ExerciseLogSection({ item, sets, colors, onUpdateSet, onConfirmSet }: ExerciseLogSectionProps) {
  const { exercise, prescription } = item;

  // Build initials for avatar
  const initials = exercise.name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <View style={{ marginTop: 24 }}>
      {/* Exercise header */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            backgroundColor: colors.inputBackground,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.inputBorder,
          }}
        >
          <ThemedText style={{ fontSize: 14, fontWeight: "600", fontFamily: Fonts.sans }}>
            {initials}
          </ThemedText>
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
            {exercise.name}
          </ThemedText>
          <ThemedText style={{ fontSize: 13, color: colors.placeholder }}>
            {prescription.sets} × {prescription.reps} • {prescription.restSeconds}s rest
          </ThemedText>
        </View>
      </View>

      {/* Column labels */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 4, marginBottom: 6 }}>
        <ThemedText
          style={{ width: 36, fontSize: 11, color: colors.placeholder, fontWeight: "500", fontFamily: Fonts.sans, textTransform: "uppercase" }}
        >
          Set
        </ThemedText>
        <ThemedText
          style={{ flex: 1, fontSize: 11, color: colors.placeholder, fontWeight: "500", fontFamily: Fonts.sans, textTransform: "uppercase" }}
        >
          Weight (kg)
        </ThemedText>
        <ThemedText
          style={{ flex: 1, fontSize: 11, color: colors.placeholder, fontWeight: "500", fontFamily: Fonts.sans, textTransform: "uppercase" }}
        >
          Reps
        </ThemedText>
        <View style={{ width: 44 }} />
      </View>

      {/* Set rows */}
      {sets.map((setRow) => (
        <SetRow
          key={`${setRow.exerciseId}-${setRow.setNumber}`}
          setRow={setRow}
          colors={colors}
          onUpdate={onUpdateSet}
          onConfirm={onConfirmSet}
        />
      ))}
    </View>
  );
}

// ── Set Row ──────────────────────────────────────────────────────────────────

interface SetRowProps {
  setRow: SetState;
  colors: typeof Colors.light;
  onUpdate: (exerciseId: string, setNumber: number, field: "reps" | "weight", value: string) => void;
  onConfirm: (exerciseId: string, setNumber: number) => void;
}

const SetRow = React.memo(function SetRow({ setRow, colors, onUpdate, onConfirm }: SetRowProps) {
  const { exerciseId, setNumber, reps, weight, confirmed, syncing } = setRow;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 6,
        paddingHorizontal: 4,
        borderRadius: 8,
        backgroundColor: confirmed ? `${colors.primaryButton}10` : "transparent",
        marginBottom: 4,
      }}
    >
      {/* Set number */}
      <ThemedText
        style={{
          width: 36,
          fontSize: 14,
          fontWeight: "600",
          fontFamily: Fonts.sans,
          color: confirmed ? colors.primaryButton : colors.text,
        }}
      >
        {setNumber}
      </ThemedText>

      {/* Weight input */}
      <View style={{ flex: 1, paddingRight: 8 }}>
        <TextInput
          value={weight}
          onChangeText={(v) => onUpdate(exerciseId, setNumber, "weight", v)}
          placeholder="—"
          placeholderTextColor={colors.placeholder}
          keyboardType="decimal-pad"
          editable={!confirmed}
          style={{
            backgroundColor: confirmed ? "transparent" : colors.inputBackground,
            borderWidth: confirmed ? 0 : 1,
            borderColor: colors.inputBorder,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 15,
            fontFamily: Fonts.sans,
            fontWeight: "500",
            color: colors.text,
            opacity: confirmed ? 0.6 : 1,
          }}
        />
      </View>

      {/* Reps input */}
      <View style={{ flex: 1, paddingRight: 8 }}>
        <TextInput
          value={reps}
          onChangeText={(v) => onUpdate(exerciseId, setNumber, "reps", v)}
          placeholder="—"
          placeholderTextColor={colors.placeholder}
          keyboardType="number-pad"
          editable={!confirmed}
          style={{
            backgroundColor: confirmed ? "transparent" : colors.inputBackground,
            borderWidth: confirmed ? 0 : 1,
            borderColor: colors.inputBorder,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 15,
            fontFamily: Fonts.sans,
            fontWeight: "500",
            color: colors.text,
            opacity: confirmed ? 0.6 : 1,
          }}
        />
      </View>

      {/* Confirm / check button */}
      <Pressable
        onPress={() => onConfirm(exerciseId, setNumber)}
        disabled={confirmed}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: confirmed ? colors.primaryButton : colors.inputBackground,
          borderWidth: confirmed ? 0 : 1,
          borderColor: colors.inputBorder,
        }}
      >
        {syncing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons
            name={confirmed ? "checkmark" : "checkmark-outline"}
            size={20}
            color={confirmed ? "#FFFFFF" : colors.placeholder}
          />
        )}
      </Pressable>
    </View>
  );
});
