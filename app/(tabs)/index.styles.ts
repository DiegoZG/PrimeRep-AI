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
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
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
