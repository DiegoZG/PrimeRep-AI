import { AuthContext } from "@/utils/authContext";
import React, { useContext, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";

const ProfileScreen = () => {
  const { logOut, user } = useContext(AuthContext);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  // Format join date
  const joinYear = useMemo(() => {
    if (user?.created_at) {
      return new Date(user.created_at).getFullYear();
    }
    return new Date().getFullYear();
  }, [user?.created_at]);

  // Get user initials for avatar
  const initials = useMemo(() => {
    if (user?.preferred_name) {
      const names = user.preferred_name.split(" ");
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      }
      return user.preferred_name[0].toUpperCase();
    }
    return "U";
  }, [user?.preferred_name]);

  // Placeholder stats (will be replaced with real data later)
  const stats = {
    streak: 0,
    weight: "220 lbs",
    workouts: 1,
    friends: 0,
    totalVolume: "15,000 lbs",
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>
            Profile
          </ThemedText>
          <Pressable
            onPress={() => {
              // TODO: Navigate to settings screen
            }}
            style={styles.settingsButton}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Profile Card */}
        <ThemedView
          style={[
            styles.profileCard,
            { backgroundColor: colors.inputBackground },
          ]}
        >
          <View style={styles.profileContent}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: colors.primaryButton },
                ]}
              >
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Pressable
                style={[
                  styles.editAvatarButton,
                  { backgroundColor: colors.background },
                ]}
              >
                <Ionicons
                  name="pencil"
                  size={12}
                  color={colors.primaryButton}
                />
              </Pressable>
            </View>

            {/* Name and Info */}
            <View style={styles.profileInfo}>
              <ThemedText type="title" style={styles.profileName}>
                {user?.preferred_name || "User"}
              </ThemedText>
              <View style={styles.badgeContainer}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: colors.electricBlue },
                  ]}
                >
                  <Text style={styles.badgeText}>PRO MEMBER</Text>
                </View>
              </View>
              <ThemedText type="default" style={styles.profileSubtext}>
                Joined {joinYear} • {stats.workouts} Workout
                {stats.workouts !== 1 ? "s" : ""}
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          {/* Streak Card */}
          <ThemedView
            style={[
              styles.statCard,
              styles.streakCard,
              { backgroundColor: colors.inputBackground },
            ]}
          >
            <View style={styles.streakCircle}>
              <Text style={[styles.streakNumber, { color: colors.text }]}>
                {stats.streak}
              </Text>
              <View
                style={[
                  styles.streakDot,
                  { backgroundColor: colors.electricBlue },
                ]}
              />
            </View>
            <ThemedText type="default" style={styles.statLabel}>
              STREAK
            </ThemedText>
          </ThemedView>

          {/* Weight Card */}
          <ThemedView
            style={[
              styles.statCard,
              { backgroundColor: colors.inputBackground },
            ]}
          >
            <ThemedText type="default" style={styles.statLabel}>
              WEIGHT
            </ThemedText>
            <View style={styles.weightRow}>
              <Text style={[styles.weightValue, { color: colors.text }]}>
                {stats.weight}
              </Text>
              <Ionicons
                name="bar-chart-outline"
                size={16}
                color={colors.placeholder}
              />
            </View>
          </ThemedView>
        </View>

        {/* Friends and Support Row */}
        <View style={styles.bottomStatsRow}>
          {/* Friends Card */}
          <ThemedView
            style={[
              styles.friendsCard,
              { backgroundColor: colors.inputBackground },
            ]}
          >
            <ThemedText type="default" style={styles.statLabel}>
              FRIENDS
            </ThemedText>
            <View style={styles.friendsRow}>
              <Pressable
                style={[
                  styles.friendsAddButton,
                  { backgroundColor: colors.primaryButton },
                ]}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable
                style={[
                  styles.friendsArrowButton,
                  { backgroundColor: colors.inputBorder },
                ]}
              >
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.text}
                />
              </Pressable>
            </View>
          </ThemedView>

          {/* Support Card */}
          <Pressable
            style={[
              styles.supportCard,
              { backgroundColor: colors.primaryButton },
            ]}
          >
            <Ionicons name="headset-outline" size={24} color="#FFFFFF" />
            <View style={styles.supportTextContainer}>
              <Text style={styles.supportTitle}>Need help?</Text>
              <Text style={styles.supportSubtitle}>Talk to support</Text>
            </View>
            <Ionicons name="open-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Activity Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="title" style={styles.sectionTitle}>
              Activity
            </ThemedText>
            <Pressable
              style={[
                styles.yearSelector,
                { backgroundColor: colors.inputBackground },
              ]}
            >
              <Text style={[styles.yearText, { color: colors.text }]}>
                2025
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={colors.placeholder}
              />
            </Pressable>
          </View>

          {/* Activity Grid */}
          <View
            style={[
              styles.activityGrid,
              {
                backgroundColor:
                  colorScheme === "dark"
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(0, 0, 0, 0.02)",
              },
            ]}
          >
            {/* Grid rows with labels - 7 rows × 7 cells */}
            {[
              { label: "Mon", activeIndex: 4 },
              { label: "Tue", activeIndex: -1 },
              { label: "Wed", activeIndex: -1 },
              { label: "Thu", activeIndex: -1 },
              { label: "Fri", activeIndex: -1 },
              { label: "Sat", activeIndex: -1 },
              { label: "Sun", activeIndex: -1 },
            ].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {row.label && (
                  <Text
                    style={[styles.gridLabel, { color: colors.placeholder }]}
                  >
                    {row.label}
                  </Text>
                )}
                {!row.label && <View style={styles.gridLabel} />}
                <View style={styles.gridRowCells}>
                  {Array.from({ length: 7 }).map((_, cellIndex) => {
                    const isActive = cellIndex === row.activeIndex;
                    return (
                      <View
                        key={cellIndex}
                        style={[
                          styles.gridCell,
                          {
                            backgroundColor: isActive
                              ? colors.electricBlue
                              : colors.inputBorder,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          {/* Total Volume */}
          <View style={styles.volumeContainer}>
            <ThemedText type="default" style={styles.volumeLabel}>
              TOTAL VOLUME
            </ThemedText>
            <View style={styles.volumeRow}>
              <Text style={[styles.volumeValue, { color: colors.text }]}>
                {stats.totalVolume}
              </Text>
              <View style={styles.volumeDots}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.volumeDot,
                      {
                        backgroundColor:
                          index === 0
                            ? colors.electricBlue
                            : colors.inputBorder,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Badges Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="title" style={styles.sectionTitle}>
              Badges
            </ThemedText>
            <Pressable>
              <ThemedText
                type="link"
                style={[styles.viewAllText, { color: colors.primaryButton }]}
              >
                View All
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesContainer}
          >
            {/* GYM LOCAL Badge */}
            <ThemedView
              style={[
                styles.badgeCard,
                { backgroundColor: colors.inputBackground },
              ]}
            >
              <View
                style={[styles.badgeIconCircle, { backgroundColor: "#FFD700" }]}
              >
                <Ionicons name="location" size={32} color="#FF8C00" />
              </View>
              <ThemedText type="default" style={styles.badgeTitle}>
                GYM LOCAL
              </ThemedText>
              <ThemedText type="default" style={styles.badgeSubtitle}>
                First check-in
              </ThemedText>
            </ThemedView>

            {/* 5K CLUB Badge */}
            <ThemedView
              style={[
                styles.badgeCard,
                { backgroundColor: colors.inputBackground },
              ]}
            >
              <View
                style={[styles.badgeIconCircle, { backgroundColor: "#87CEEB" }]}
              >
                <Ionicons name="barbell" size={32} color="#4169E1" />
              </View>
              <ThemedText type="default" style={styles.badgeTitle}>
                5K CLUB
              </ThemedText>
              <ThemedText type="default" style={styles.badgeSubtitle}>
                Volume Milestone
              </ThemedText>
            </ThemedView>
          </ScrollView>
        </View>

        {/* Sign Out Button (hidden in design but keeping for functionality) */}
        <Pressable
          onPress={logOut}
          style={[
            styles.signOutButton,
            { backgroundColor: colors.inputBackground },
          ]}
        >
          <ThemedText type="default" style={styles.signOutText}>
            Sign Out
          </ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  settingsButton: {
    padding: 4,
  },
  profileCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: Fonts.sans,
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileInfo: {
    flex: 1,
    gap: 8,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  badgeContainer: {
    alignSelf: "flex-start",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: Fonts.sans,
  },
  profileSubtext: {
    fontSize: 14,
    opacity: 0.7,
    fontFamily: Fonts.sans,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  streakCard: {
    gap: 8,
  },
  streakCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  streakNumber: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  streakDot: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.7,
    fontFamily: Fonts.sans,
    textTransform: "uppercase",
  },
  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  weightValue: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  bottomStatsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  friendsCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  friendsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  friendsAddButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  friendsArrowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  supportCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  supportTextContainer: {
    flex: 1,
    gap: 2,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: Fonts.sans,
  },
  supportSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    color: "#FFFFFF",
    opacity: 0.9,
    fontFamily: Fonts.sans,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: Fonts.sans,
  },
  yearSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  yearText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  activityGrid: {
    gap: 10,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.02)",
  },
  gridRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    height: 16,
  },
  gridLabel: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    width: 36,
    opacity: 0.6,
  },
  gridLabelEmpty: {
    opacity: 0.3,
  },
  gridRowCells: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    alignItems: "center",
  },
  gridCell: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  volumeContainer: {
    gap: 6,
    marginTop: 4,
  },
  volumeLabel: {
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.6,
    fontFamily: Fonts.sans,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  volumeValue: {
    fontSize: 24,
    fontWeight: "800",
    fontFamily: Fonts.sans,
    letterSpacing: -0.5,
  },
  volumeDots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  volumeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgesContainer: {
    gap: 12,
  },
  badgeCard: {
    width: 140,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTitle: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Fonts.sans,
    textAlign: "center",
  },
  badgeSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    opacity: 0.7,
    fontFamily: Fonts.sans,
    textAlign: "center",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  signOutButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
});

export default ProfileScreen;
