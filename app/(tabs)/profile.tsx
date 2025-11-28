import { AuthContext } from "@/utils/authContext";
import React, { useContext } from "react";
import { Text, TouchableOpacity } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const ProfileScreen = () => {
  const { logOut } = useContext(AuthContext);
  return (
    <ThemedView
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <ThemedText type="title">profile</ThemedText>
      <TouchableOpacity
        onPress={logOut}
        style={{
          backgroundColor: "#007AFF",
          paddingHorizontal: 32,
          paddingVertical: 12,
          borderRadius: 8,
          minWidth: 200,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
          Sign out
        </Text>
      </TouchableOpacity>
    </ThemedView>
  );
};

export default ProfileScreen;
