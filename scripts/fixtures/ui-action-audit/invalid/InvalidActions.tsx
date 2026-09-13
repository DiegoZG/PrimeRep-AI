import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text } from "react-native";

const referencedNoop = () => {};
const validHandler = () => console.info("handled");

export function InvalidActions() {
  return <>
    <Pressable><Text>Missing handler</Text></Pressable>
    <Pressable onPress={() => {}}><Text>Inline no-op</Text></Pressable>
    <Pressable onPress={referencedNoop}><Text>Referenced no-op</Text></Pressable>
    <Pressable onPress={validHandler}><Ionicons name="close" /></Pressable>
    <Pressable onPress={validHandler} disabled><Text>Disabled</Text></Pressable>
  </>;
}
