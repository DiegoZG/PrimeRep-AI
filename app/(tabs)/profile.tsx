import { AuthContext } from "@/utils/authContext";
import { useEquipment } from "@/utils/equipmentContext";
import React, { useContext, useEffect } from "react";
import { Text, TouchableOpacity } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

const ProfileScreen = () => {
  const { logOut, user } = useContext(AuthContext);
  const { items, ensureEquipmentLoaded } = useEquipment();

  useEffect(() => {
    ensureEquipmentLoaded();
  }, [ensureEquipmentLoaded]);

  useEffect(() => {
    if (__DEV__) {
      console.log("Equipment count:", items.length);
    }
  }, [items.length]);

  return (
    <ThemedView
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <ThemedText type="title">profile</ThemedText>
      {user?.preferred_name && (
        <ThemedText type="default" style={{ marginTop: 16, marginBottom: 32 }}>
          {user.preferred_name}
        </ThemedText>
      )}
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
