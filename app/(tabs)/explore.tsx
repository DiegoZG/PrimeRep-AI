import React from "react";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const ExploreScreen = () => {
  return (
    <ThemedView
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <ThemedText type="title">explore</ThemedText>
    </ThemedView>
  );
};

export default ExploreScreen;
