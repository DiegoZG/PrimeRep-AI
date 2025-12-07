import { EQUIPMENT } from "@/constants/equipment/equipment";

/**
 * Get default equipment selections based on gym type
 */
export function getDefaultEquipmentSelections(
  gymType: "large-gym" | "small-gym" | "garage-gym"
): Set<string> {
  const allEquipmentIds = new Set(EQUIPMENT.map((eq) => eq.id));

  if (gymType === "large-gym") {
    // Large gym: Everything except specific excluded items
    const excludedIds = [
      "hack_squat_machine_selectorized",
      "multi_hip_machine",
      "bent_arm_fly_machine",
      "sissy_squat_machine",
      "sled",
      "skipping_rope",
      "plate_loaded_chest_supported_t_bar",
      "plate_loaded_ab_crunch",
      "plate_loaded_chest_supported_row",
      "plate_loaded_hip_thrust_belt",
      "plate_loaded_standing_lateral_raise",
      "plate_loaded_pullover",
      "plate_loaded_standing_leg_curl",
      "vertical_leg_press",
      "belt_squat_machine",
      "plate_loaded_dip_machine",
      "mini_bands",
      "air_bike",
      "stationary_bike",
      "elliptical",
      "rowing_machine_cardio",
      "stair_stepper",
      "treadmill",
      "vertical_climber",
      "ski_erg",
    ];
    const excludedSet = new Set(excludedIds);
    return new Set(
      Array.from(allEquipmentIds).filter((id) => !excludedSet.has(id))
    );
  }

  if (gymType === "small-gym") {
    // Small gym: Only specific equipment (13 items)
    const smallGymIds = [
      "ab_wheel",
      "stability_ball",
      "fly_machine",
      "row_machine",
      "olympic_barbell",
      "plates",
      "crossover_cable",
      "hi_lo_pull_cable",
      "dumbbells",
      "flat_bench",
      "incline_bench",
      "pull_up_bar",
      "squat_rack",
    ];
    return new Set(smallGymIds);
  }

  // Garage gym: Only specific equipment (9 items total)
  const garageGymIds = [
    "ab_wheel",
    "stability_ball",
    "olympic_barbell",
    "plates",
    "dumbbells",
    "flat_bench",
    "incline_bench",
    "pull_up_bar",
    "squat_rack",
  ];
  // Return only these specific IDs - no other equipment
  return new Set(garageGymIds);
}

/**
 * Group equipment by display categories for the UI
 * Only includes equipment visible in the screenshots
 */
export function groupEquipmentByDisplayCategory() {
  // Equipment IDs visible in screenshots, organized by display category
  const equipmentByCategory: Record<string, string[]> = {
    "Cable machines": ["crossover_cable", "hi_lo_pull_cable"],
    "Small weights": ["dumbbells"],
    "Benches and racks": [
      "flat_bench",
      "incline_bench",
      "pull_up_bar",
      "squat_rack",
    ],
    "Plated machines": [
      "plate_loaded_hack_squat",
      "plate_loaded_iso_lateral_row",
      "plate_loaded_shoulder_machine",
    ],
    "Weight machines": [
      "row_machine",
      "assisted_weight_machine",
      "bicep_curl_machine",
      "fly_machine",
    ],
    "Balls and accessories": ["ab_wheel", "stability_ball"],
    "Bars and plates": ["olympic_barbell", "plates"],
  };

  const groups: { title: string; equipment: typeof EQUIPMENT }[] = [];

  Object.entries(equipmentByCategory).forEach(([title, equipmentIds]) => {
    const equipment = EQUIPMENT.filter((eq) => equipmentIds.includes(eq.id));
    if (equipment.length > 0) {
      groups.push({ title, equipment });
    }
  });

  return groups;
}
