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
    color: "rgba(255,255,255,0.82)",
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
    color: "rgba(255,255,255,0.84)",
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
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  compactPanel: {
    minHeight: 76,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
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
  coachStripe: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionHeaderPadded: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
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
    height: 220,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  workoutCardHighlighted: {
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  workoutCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  dayBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    letterSpacing: 0.5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    overflow: "hidden",
  },
  todayIndicator: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  todayText: {
    color: "#6a4ff5",
    fontSize: 10,
    fontWeight: "800",
    fontFamily: Fonts.sans,
    letterSpacing: 0.5,
  },
  overflowButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  workoutContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  workoutTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    marginBottom: 2,
  },
  workoutSubtitle: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    fontWeight: "400",
    fontFamily: Fonts.sans,
    textTransform: "capitalize",
    marginBottom: 10,
  },
  workoutMetrics: {
    flexDirection: "row",
    gap: 14,
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    fontWeight: "500",
    fontFamily: Fonts.sans,
  },
  highlightIndicator: {
    position: "absolute",
    bottom: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  // State containers
  stateContainerPadded: {
    paddingHorizontal: 20,
  },
  // Loading/Error/Empty states
  loadingContainer: {
    height: 170,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.7,
  },
  errorContainer: {
    height: 200,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
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
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  emptyContainer: {
    height: 170,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
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
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
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
