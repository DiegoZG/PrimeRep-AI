import AsyncStorage from "@react-native-async-storage/async-storage";
import { Equipment } from "@/constants/equipment/types";

const EQUIPMENT_CACHE_KEY = "primerep_equipment_cache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedEquipmentData {
  items: Equipment[];
  fetchedAt: number;
  isUsingFallback?: boolean;
}

/**
 * Reads equipment cache from AsyncStorage
 */
export async function readEquipmentCache(): Promise<CachedEquipmentData | null> {
  try {
    const cached = await AsyncStorage.getItem(EQUIPMENT_CACHE_KEY);
    if (!cached) return null;

    const data: CachedEquipmentData = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is expired
    if (now - data.fetchedAt > CACHE_TTL_MS) {
      await clearEquipmentCache();
      return null;
    }

    return data;
  } catch (error) {
    // If cache is corrupted, clear it
    await clearEquipmentCache();
    return null;
  }
}

/**
 * Writes equipment cache to AsyncStorage
 */
export async function writeEquipmentCache(
  data: CachedEquipmentData
): Promise<void> {
  try {
    await AsyncStorage.setItem(EQUIPMENT_CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    // Silently fail - cache write errors shouldn't break the app
    console.warn("Failed to write equipment cache:", error);
  }
}

/**
 * Clears equipment cache from AsyncStorage
 */
export async function clearEquipmentCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(EQUIPMENT_CACHE_KEY);
  } catch (error) {
    // Silently fail
    console.warn("Failed to clear equipment cache:", error);
  }
}

