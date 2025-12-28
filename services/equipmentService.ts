import { Equipment, EquipmentCategory } from "@/constants/equipment/types";
import { requestJson } from "./httpClient";

export interface EquipmentApiItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  category_order?: number;
  sort_order?: number;
  icon_key?: string | null;
  image_url?: string | null;
  is_active?: boolean;
}

export interface EquipmentApiResponse {
  items: EquipmentApiItem[];
}

/**
 * Fetches equipment catalog from backend
 */
export async function getEquipment(): Promise<EquipmentApiItem[]> {
  const data = await requestJson<EquipmentApiResponse>("/v1/equipment", {
    method: "GET",
  });
  return data.items || [];
}

/**
 * Type guard to validate API item shape
 */
export function isEquipmentApiItem(value: unknown): value is EquipmentApiItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.category === "string"
  );
}

/**
 * Maps backend API item to frontend Equipment UI type
 */
export function mapApiItemToEquipment(apiItem: EquipmentApiItem): Equipment {
  // Filter out inactive items
  if (apiItem.is_active === false) {
    throw new Error(`Equipment ${apiItem.id} is inactive`);
  }

  return {
    id: apiItem.id,
    name: apiItem.name,
    category: apiItem.category,
    iconKey: apiItem.icon_key || undefined,
    imageUrl: apiItem.image_url || undefined,
  };
}
