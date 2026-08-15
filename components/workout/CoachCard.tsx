import { ContentSection } from "@/components/exercises/ContentSection";
import { Colors } from "@/constants/theme";

interface CoachCardProps {
  intent?: string | null;
  colors: typeof Colors.light;
}

export function CoachCard({ intent, colors }: CoachCardProps) {
  return (
    <ContentSection
      title="Today's focus"
      content={intent}
      colors={colors}
      highlight
      icon="sparkles"
    />
  );
}
