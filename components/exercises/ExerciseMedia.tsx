import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors, Fonts } from "@/constants/theme";

interface ExerciseMediaProps {
  /** Real licensed media for this exercise. */
  imageUrl?: string;
  demoVideoUrl?: string;
  exerciseName: string;
  colors: typeof Colors.light;
  height?: number;
}

/**
 * Media block for an exercise, shared by the detail screen and the in-workout
 * info sheet so both surfaces degrade the same way.
 *
 * Missing footage uses a neutral icon so it cannot be mistaken for a demo.
 */
export function ExerciseMedia({
  imageUrl,
  demoVideoUrl,
  exerciseName,
  colors,
  height = 220,
}: ExerciseMediaProps) {
  const hasImage = Boolean(imageUrl);
  const hasDemo = Boolean(demoVideoUrl);

  return (
    <View
      testID="exercise-media"
      style={[
        styles.container,
        { height, backgroundColor: colors.inputBackground },
      ]}
    >
      {hasImage ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.media}
          contentFit="cover"
          transition={200}
          accessibilityLabel={`${exerciseName} exercise image`}
        />
      ) : (
        <View style={styles.unavailable}>
          <Ionicons name={hasDemo ? "play-circle-outline" : "videocam-off-outline"} size={36} color={hasDemo ? colors.primaryButton : colors.placeholder} />
          <Text style={[styles.unavailableTitle, { color: colors.text }]}>{hasDemo ? "Video demo available" : "Demo unavailable"}</Text>
          <Text style={[styles.unavailableText, { color: colors.placeholder }]}>{hasDemo ? "Open the video below." : "Follow the written instructions below."}</Text>
        </View>
      )}
      <View
        testID="exercise-demo-status"
        accessibilityLabel={hasDemo ? `Video demonstration available for ${exerciseName}` : `Video demonstration unavailable for ${exerciseName}`}
        style={[styles.demoStatus, { backgroundColor: hasDemo ? colors.primaryButton : "rgba(0,0,0,0.62)" }]}
      >
        <Ionicons name={hasDemo ? "play" : "videocam-off-outline"} size={13} color="#FFFFFF" />
        <Text style={styles.demoStatusText}>{hasDemo ? "Video available" : "Demo unavailable"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
  },
  media: {
    width: "100%",
    height: "100%",
  },
  unavailable: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  unavailableTitle: { marginTop: 10, fontSize: 17, fontWeight: "700", fontFamily: Fonts.sans },
  unavailableText: { marginTop: 4, fontSize: 13, textAlign: "center", fontFamily: Fonts.sans },
  demoStatus: { position: "absolute", left: 12, bottom: 12, minHeight: 32, borderRadius: 16, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6 },
  demoStatusText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", fontFamily: Fonts.sans },
});
