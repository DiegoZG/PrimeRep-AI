import { ThemedText, type ThemedTextProps } from "@/components/themed-text";

export function WorkoutText({ style, ...props }: ThemedTextProps) {
  // Let native text metrics grow with accessibility fonts instead of clipping to a fixed line height.
  return <ThemedText {...props} style={[style, { lineHeight: undefined }]} />;
}
