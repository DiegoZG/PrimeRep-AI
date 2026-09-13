import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text } from "react-native";

const validHandler = () => console.info("handled");

export function ValidActions() {
  return <>
    <Pressable onPress={validHandler}><Text>Action</Text></Pressable>
    <Pressable accessibilityLabel="Close" onPress={validHandler}><Ionicons name="close" /></Pressable>
    <Pressable accessibilityState={{ disabled: true }} disabled onPress={validHandler}><Text>Disabled</Text></Pressable>
  </>;
}
