import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface ExerciseRowProps {
  id: string;
  name: string;
  primaryMuscle: string;
  imageUrl?: string;
  isFavorite: boolean;
  canFavorite: boolean;
  isFavoriteDisabled?: boolean;
  onToggleFavorite: (id: string) => void;
  onPress?: () => void;
}

export function ExerciseRow({
  id,
  name,
  primaryMuscle,
  imageUrl,
  isFavorite,
  canFavorite,
  isFavoriteDisabled = false,
  onToggleFavorite,
  onPress,
}: ExerciseRowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  // Get initials for fallback
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleFavoritePress = () => {
    if (canFavorite && !isFavoriteDisabled) {
      onToggleFavorite(id);
    }
  };

  return (
    <Pressable
      testID="exercise-row"
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.inputBackground,
          opacity: pressed ? 0.95 : 1,
        },
      ]}
    >
      {/* Thumbnail */}
      <View style={[styles.thumbnail, { backgroundColor: colors.inputBorder }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumbnailImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Text style={[styles.initialsText, { color: colors.placeholder }]}>
            {initials}
          </Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text
          style={[styles.name, { color: colors.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {name}
        </Text>
        <Text style={[styles.muscle, { color: colors.placeholder }]}>
          {primaryMuscle}
        </Text>
      </View>

      {/* Favorite control */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isFavorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
        accessibilityState={{ disabled: !canFavorite || isFavoriteDisabled, busy: isFavoriteDisabled }}
        onPress={handleFavoritePress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.favoriteButton}
        disabled={!canFavorite || isFavoriteDisabled}
      >
        {isFavorite && canFavorite ? (
          <Ionicons name="heart" size={22} color="#FF4B4B" />
        ) : (
          <View
            style={[
              styles.plusButton,
              {
                borderColor: colors.inputBorder,
                opacity: canFavorite ? 1 : 0.35,
              },
            ]}
          >
            <Ionicons
              name="add"
              size={18}
              color={canFavorite ? colors.placeholder : colors.inputBorder}
            />
          </View>
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  initialsText: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  muscle: {
    fontSize: 13,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    textTransform: "capitalize",
  },
  favoriteButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  plusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
