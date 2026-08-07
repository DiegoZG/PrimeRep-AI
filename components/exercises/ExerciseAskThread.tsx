import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import { HttpError } from "@/services/httpClient";
import {
  askExerciseQuestion,
  listExerciseQuestions,
  type QaItem,
} from "@/services/exerciseQaService";

interface ExerciseAskThreadProps {
  exerciseId: string;
  token: string | null;
  isLoggedIn: boolean;
  colors: typeof Colors.light;
}

function friendlyErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.status === 429) {
      return "You've hit today's limit of 20 questions. Try again tomorrow.";
    }
    if (err.status === 503) {
      return "The coach is unavailable right now. Please try again shortly.";
    }
  }
  return "Something went wrong asking that. Please try again.";
}

/**
 * On-demand AI Q&A thread for a single exercise. Reusable from the exercise
 * detail screen and the in-workout info sheet.
 */
export function ExerciseAskThread({
  exerciseId,
  token,
  isLoggedIn,
  colors,
}: ExerciseAskThreadProps) {
  const router = useRouter();

  const [questions, setQuestions] = useState<QaItem[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadThread() {
      if (!isLoggedIn || !token || !exerciseId) return;
      setIsLoadingThread(true);
      try {
        const items = await listExerciseQuestions(token, exerciseId);
        if (!cancelled) {
          // API returns newest first; display oldest-to-newest like a chat.
          setQuestions([...items].reverse());
        }
      } catch (err) {
        console.warn("Failed to load exercise Q&A thread:", err);
      } finally {
        if (!cancelled) setIsLoadingThread(false);
      }
    }
    loadThread();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, token, exerciseId]);

  const handleSend = useCallback(async () => {
    const question = questionText.trim();
    if (!question || !token || isAsking) return;

    setIsAsking(true);
    setError(null);
    try {
      const result = await askExerciseQuestion(token, exerciseId, question);
      setQuestions((prev) => [...prev, result]);
      setQuestionText("");
    } catch (err) {
      console.warn("Failed to ask exercise question:", err);
      setError(friendlyErrorMessage(err));
    } finally {
      setIsAsking(false);
    }
  }, [questionText, token, isAsking, exerciseId]);

  if (!isLoggedIn) {
    return (
      <View
        style={{
          backgroundColor: colors.inputBackground,
          borderRadius: 16,
          padding: 20,
          alignItems: "center",
          gap: 10,
        }}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.placeholder} />
        <ThemedText style={{ fontSize: 14, textAlign: "center", color: colors.placeholder }}>
          Log in to ask the coach questions about this exercise.
        </ThemedText>
        <Pressable
          onPress={() => router.push("/login")}
          style={{
            marginTop: 4,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: colors.primaryButton,
          }}
        >
          <ThemedText style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
            Log In
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <View testID="exercise-qa-thread" style={{ gap: 10, marginBottom: 12 }}>
        {isLoadingThread ? (
          <View style={{ paddingVertical: 16, alignItems: "center" }}>
            <ActivityIndicator size="small" color={colors.primaryButton} />
          </View>
        ) : questions.length === 0 ? (
          <ThemedText style={{ fontSize: 13, color: colors.placeholder, paddingVertical: 4 }}>
            Ask anything about form, tempo, or how to adapt this exercise.
          </ThemedText>
        ) : (
          questions.map((item) => (
            <View key={item.id} style={{ gap: 6 }}>
              {/* Question bubble — right aligned, primary tint */}
              <View style={{ alignItems: "flex-end" }}>
                <View
                  style={{
                    maxWidth: "85%",
                    backgroundColor: colors.primaryButton,
                    borderRadius: 16,
                    borderBottomRightRadius: 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                >
                  <ThemedText style={{ color: "#FFFFFF", fontSize: 14, lineHeight: 20 }}>
                    {item.question}
                  </ThemedText>
                </View>
              </View>
              {/* Answer bubble — left aligned, subtle */}
              <View style={{ alignItems: "flex-start" }}>
                <View
                  style={{
                    maxWidth: "85%",
                    backgroundColor: colors.inputBackground,
                    borderRadius: 16,
                    borderBottomLeftRadius: 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                  }}
                >
                  <ThemedText style={{ fontSize: 14, lineHeight: 20 }}>{item.answer}</ThemedText>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {error && (
        <ThemedText
          style={{ fontSize: 13, color: "#FF3B30", marginBottom: 8, lineHeight: 18 }}
        >
          {error}
        </ThemedText>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: colors.inputBackground,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          paddingHorizontal: 12,
          paddingVertical: 6,
        }}
      >
        <TextInput
          testID="exercise-ask-input"
          value={questionText}
          onChangeText={setQuestionText}
          placeholder="Ask about this exercise..."
          placeholderTextColor={colors.placeholder}
          style={{
            flex: 1,
            fontSize: 14,
            paddingVertical: 8,
            color: colors.text,
            fontFamily: Fonts.sans,
          }}
          multiline
          editable={!isAsking}
          onSubmitEditing={handleSend}
        />
        <Pressable
          testID="exercise-ask-send"
          onPress={handleSend}
          disabled={isAsking || !questionText.trim()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor:
              isAsking || !questionText.trim() ? colors.inputBorder : colors.primaryButton,
          }}
        >
          {isAsking ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </View>
  );
}
