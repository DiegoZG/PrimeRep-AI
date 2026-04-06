import { StyleSheet } from "react-native";

import { Fonts } from "@/constants/theme";

export const MENU_WIDTH = 200;

export const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  menuContainer: {
    position: "absolute",
    width: MENU_WIDTH,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  menuContent: {
    borderRadius: 12,
    overflow: "hidden",
  },
  menuHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
    opacity: 0.6,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(150, 150, 150, 0.3)",
    marginHorizontal: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  menuItemText: {
    fontSize: 15,
    fontFamily: Fonts.sans,
  },
});
