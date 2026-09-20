import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Colors } from "@/constants/theme";

export function CatalogPageFooter({ loading, error, hasMore, onLoad, colors, testID = "exercise-load-more" }: { loading: boolean; error: string | null; hasMore: boolean; onLoad: () => void; colors: typeof Colors.light; testID?: string }) {
  if (!loading && !error && !hasMore) return null;
  return <View style={{ paddingVertical: 16, alignItems: "center", gap: 8 }}>
    {error ? <Text accessibilityRole="alert" style={{ color: colors.text, textAlign: "center" }}>{error}</Text> : null}
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={error ? "Retry loading more results" : "Load more results"} accessibilityState={{ disabled: loading, busy: loading }} disabled={loading} onPress={onLoad} style={{ minHeight: 48, minWidth: 140, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.inputBorder }}>
      {loading ? <ActivityIndicator color={colors.primaryButton} /> : <Text style={{ color: colors.primaryButton, fontWeight: "700" }}>{error ? "Retry" : "Load more"}</Text>}
    </Pressable>
  </View>;
}
