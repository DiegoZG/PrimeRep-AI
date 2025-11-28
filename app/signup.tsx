import React from "react";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const SignUpScreen = () => {
  return (
    <ThemedView
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <ThemedText type="title">signup</ThemedText>
    </ThemedView>
  );
};

export default SignUpScreen;
