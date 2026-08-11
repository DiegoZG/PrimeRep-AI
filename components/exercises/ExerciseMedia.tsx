import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors, Fonts } from "@/constants/theme";
import {
  PLACEHOLDER_EXERCISE_GIF,
  PLACEHOLDER_MEDIA_CAPTION,
} from "@/constants/placeholderMedia";

interface ExerciseMediaProps {
  /** Real footage for this exercise. When absent, a labelled placeholder shows. */
  imageUrl?: string;
  exerciseName: string;
  colors: typeof Colors.light;
  height?: number;
}

/**
 * Media block for an exercise, shared by the detail screen and the in-workout
 * info sheet so both surfaces degrade the same way.
 *
 * The placeholder is a generic animation, not this exercise, so it always
 * carries a caption. Without one it would read as an incorrect demonstration.
 */
export function ExerciseMedia({
  imageUrl,
  exerciseName,
  colors,
  height = 220,
}: ExerciseMediaProps) {
  const hasRealMedia = Boolean(imageUrl);

  return (
    <View
      testID="exercise-media"
      style={[
        styles.container,
        { height, backgroundColor: colors.inputBackground },
      ]}
    >
      {hasRealMedia ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.media}
          contentFit="cover"
          transition={200}
          accessibilityLabel={`${exerciseName} demonstration`}
        />
      ) : (
        <>
          <Image
            testID="exercise-media-placeholder"
            source={PLACEHOLDER_EXERCISE_GIF}
            style={styles.media}
            contentFit="contain"
            accessibilityLabel={`Generic exercise animation. ${PLACEHOLDER_MEDIA_CAPTION} for ${exerciseName}.`}
          />
          <View style={styles.captionRow}>
            <Text style={styles.captionText}>{PLACEHOLDER_MEDIA_CAPTION}</Text>
          </View>
        </>
      )}
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
  captionRow: {
    position: "absolute",
    left: 12,
    bottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  captionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
});
