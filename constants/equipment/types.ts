// constants/equipment/types.ts

export type EquipmentCategory =
  | "machine"
  | "plateLoaded"
  | "benchRack"
  | "cable"
  | "freeWeight"
  | "functional"
  | "bandAccessory"
  | "cardio";

export interface Equipment {
  id: string; // stable slug, e.g. "ab_crunch_machine"
  name: string; // display name, e.g. "Ab Crunch Machine"
  category: EquipmentCategory;
  iconKey?: string; // optional: if icon key differs from id
}
