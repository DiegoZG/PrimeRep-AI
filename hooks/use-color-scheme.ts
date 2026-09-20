import { useAppearance } from "@/utils/appearanceContext";

export function useColorScheme() {
  return useAppearance().colorScheme;
}
