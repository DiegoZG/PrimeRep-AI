import { Dimensions, StyleSheet } from "react-native";

import { Fonts } from "@/constants/theme";

// Card dimensions - exported for use in the component
const { width: SCREEN_WIDTH } = Dimensions.get("window");
export const HORIZONTAL_PADDING = 20;
export const CARD_GAP = 10;
export const CARD_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_GAP;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
  },
  primaryAction: {
    marginHorizontal: 20,
    marginBottom: 22,
    padding: 18,
    minHeight: 92,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  primaryEyebrow: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  primaryTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    marginTop: 3,
  },
  primaryBody: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  quietAction: {
    marginHorizontal: 20,
    marginBottom: 22,
    borderRadius: 18,
    minHeight: 92,
    padding: 17,
    gap: 6,
  },
  quietActionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  compactAction: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    borderRadius: 10,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  compactPanel: {
    minHeight: 76,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
  },
  coachPanel: {
    minHeight: 106,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    overflow: "hidden",
  },
  panelLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  coachTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  coachBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  emptyLine: {
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: 8,
  },
  trendPanel: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 9,
  },
  trendBars: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-end",
  },
  trendColumn: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  trendBarsExpanded: {
    flexWrap: "wrap",
    rowGap: 18,
  },
  trendColumnExpanded: {
    flexBasis: "45%",
  },
  trendCount: {
    fontSize: 15,
    fontWeight: "700",
  },
  trendTrack: {
    width: "100%",
    height: 64,
    borderRadius: 7,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  trendFill: {
    width: "100%",
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  trendWeekLabel: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
  trendFootnote: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  section: {
    marginBottom: 28,
  },
  sectionPadded: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionHeaderPadded: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    flexShrink: 1,
    maxWidth: "100%",
  },
  workoutCount: {
    fontSize: 14,
    fontFamily: Fonts.sans,
  },
  // Carousel styles
  carouselContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  cardSeparator: {
    width: CARD_GAP,
  },
  // Workout card styles
  workoutCard: {
    width: CARD_WIDTH,
    minHeight: 180,
    borderRadius: 20,
    borderWidth: 2,
    padding: 16,
    overflow: "hidden",
    position: "relative",
  },
  workoutCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  dayBadge: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  dayBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    paddingVertical: 8,
  },
  todayIndicator: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  todayText: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  overflowButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  workoutContent: {
    marginTop: 16,
    gap: 4,
  },
  workoutTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    marginBottom: 2,
  },
  workoutSubtitle: {
    fontSize: 13,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    textTransform: "capitalize",
    marginBottom: 10,
  },
  workoutMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: Fonts.sans,
  },
  // State containers
  stateContainerPadded: {
    paddingHorizontal: 20,
  },
  // Loading/Error/Empty states
  loadingContainer: {
    minHeight: 170,
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.7,
  },
  errorContainer: {
    minHeight: 200,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    minHeight: 44,
    minWidth: 44,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  emptyContainer: {
    minHeight: 170,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
  },
  // Stats styles
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statsStack: {
    flexDirection: "column",
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    alignItems: "center",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: "center",
  },
  // Regenerating overlay
  regeneratingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  regeneratingContent: {
    padding: 32,
    borderRadius: 16,
    alignItems: "center",
  },
  regeneratingText: {
    marginTop: 16,
    fontSize: 16,
  },
});
