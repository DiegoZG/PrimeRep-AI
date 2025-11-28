import { AuthContext } from "@/utils/authContext";
import React, { useContext } from "react";
import { Text, TouchableOpacity, View } from "react-native";

const ProfileScreen = () => {
  const { logOut } = useContext(AuthContext);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>profile</Text>
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
    </View>
  );
};

export default ProfileScreen;
