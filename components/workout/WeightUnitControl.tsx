import { Pressable, View } from "react-native";
import { WorkoutText as ThemedText } from "@/components/workout/WorkoutText";
import type { Colors } from "@/constants/theme";
import type { WeightUnit } from "@/utils/weightUnits";

export function WeightUnitControl({ unit, colors, disabled, onChange }: {
  unit: WeightUnit; colors: typeof Colors.light; disabled: boolean; onChange: () => void;
}) {
  return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
    <ThemedText style={{ fontSize: 12, color: colors.placeholder }}>Weight unit</ThemedText>
    <View style={{ flexDirection: "row", borderRadius: 9, borderWidth: 1, borderColor: colors.inputBorder, overflow: "hidden" }}>
      {(["LB", "KG"] as const).map((value) => <Pressable key={value} testID={`player-unit-${value.toLowerCase()}`}
        accessibilityRole="button" accessibilityLabel={`Weight unit ${value}`} accessibilityState={{ selected: value === unit, disabled }}
        disabled={disabled} onPress={() => { if (value !== unit) onChange(); }}
        style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: value === unit ? colors.inputBorder : colors.background }}>
        <ThemedText style={{ fontSize: 12, fontWeight: "600", color: value === unit ? colors.text : colors.placeholder }}>{value}</ThemedText>
      </Pressable>)}
    </View>
  </View>;
}
