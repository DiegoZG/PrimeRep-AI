import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { useEvent } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, Fonts } from "@/constants/theme";
import type { ExerciseVideo } from "@/interfaces/exercises/types";

interface ExerciseMediaProps {
  imageUrl?: string;
  demoVideoUrl?: string;
  media?: ExerciseVideo | null;
  exerciseName: string;
  colors: typeof Colors.light;
  height?: number;
  active?: boolean;
}

export function isPlayableExerciseVideo(url?: string, mimeType?: string) {
  return Boolean(url && (mimeType?.startsWith("video/") || /\.(mp4|m4v|mov|webm|m3u8)(?:[?#]|$)/i.test(url)));
}

function InlineVideo({ url, active, onRetry }: { url: string; active: boolean; onRetry: () => void }) {
  const player = useVideoPlayer(url);
  const { status } = useEvent(player, "statusChange", { status: player.status });
  const [timedOut, setTimedOut] = useState(false);
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!active) player.pause();
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") player.pause(); });
    return () => { subscription.remove(); };
  }, [active, player]);
  useEffect(() => {
    if (status === "readyToPlay" && active && AppState.currentState === "active" && !timedOut && !autoStarted.current) {
      autoStarted.current = true;
      player.play();
    }
  }, [active, player, status, timedOut]);
  useEffect(() => {
    if (status !== "loading" && status !== "idle") return;
    const timer = setTimeout(() => { player.pause(); setTimedOut(true); }, 20000);
    return () => clearTimeout(timer);
  }, [player, status]);
  const failed = status === "error" || timedOut;
  return <View style={styles.fill}>
    <VideoView testID="exercise-video-player" accessibilityLabel="Exercise demonstration video" player={player} style={styles.fill} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }} allowsPictureInPicture={false} />
    {!failed && status !== "readyToPlay" ? <View style={styles.overlay}><ActivityIndicator testID="exercise-video-loading" color="#FFFFFF" /><Text style={styles.lightText}>Loading demo…</Text></View> : null}
    {failed ? <View style={styles.overlay}><Text testID="exercise-video-error" accessibilityRole="alert" style={styles.lightText}>The demo couldn’t play. Your instructions are still available below.</Text><Pressable testID="exercise-video-retry" accessibilityRole="button" accessibilityLabel="Retry exercise video" onPress={onRetry} style={styles.action}><Text style={styles.lightText}>Retry video</Text></Pressable></View> : null}
  </View>;
}

function MediaContent({ imageUrl, demoVideoUrl, media, exerciseName, colors, height = 220, active = true }: ExerciseMediaProps) {
  const focused = useIsFocused();
  const [started, setStarted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [openError, setOpenError] = useState(false);
  const [opening, setOpening] = useState(false);
  const url = media?.url ?? demoVideoUrl;
  const playable = Boolean(media?.url) || isPlayableExerciseVideo(url);
  const poster = media?.poster_url ?? imageUrl;
  async function play() {
    if (playable) { setStarted(true); return; }
    if (!url) return;
    setOpening(true);
    setOpenError(false);
    try {
      if (!/^https?:\/\//i.test(url) || !await Linking.canOpenURL(url)) throw new Error("Unavailable demo");
      await Linking.openURL(url);
    } catch { setOpenError(true); }
    finally { setOpening(false); }
  }
  return <View testID="exercise-media" style={[styles.container, { height, backgroundColor: colors.inputBackground }]}>
    {started && playable && url ? <InlineVideo key={attempt} url={url} active={active && focused} onRetry={() => setAttempt((value) => value + 1)} /> : <>
      {poster && !imageFailed ? <Image source={{ uri: poster }} style={styles.fill} contentFit="contain" onError={() => setImageFailed(true)} accessibilityLabel={`${exerciseName} exercise image`} /> : <View style={styles.unavailable}><Ionicons name={url ? "play-circle-outline" : "videocam-off-outline"} size={36} color={colors.placeholder} /><Text style={[styles.title, { color: colors.text }]}>{url ? "Exercise demonstration" : "Demo unavailable"}</Text>{!url ? <Text style={[styles.caption, { color: colors.placeholder }]}>Follow the written instructions below.</Text> : null}</View>}
      {url ? <View style={styles.controls}><Pressable testID="exercise-watch-demo" accessibilityRole="button" accessibilityLabel={`Watch ${exerciseName} demo video`} accessibilityState={{ disabled: opening, busy: opening }} disabled={opening} onPress={() => void play()} style={[styles.action, { backgroundColor: colors.primaryButton }]}>{opening ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="play" size={20} color="#FFFFFF" />}<Text style={styles.lightText}>{playable ? "Play demo" : "Open demo"}</Text></Pressable>{openError ? <Text testID="exercise-video-error" accessibilityRole="alert" style={[styles.caption, { color: colors.text, backgroundColor: colors.background }]}>The video couldn’t open. Tap Open demo to retry.</Text> : null}</View> : null}
    </>}
    {!started ? <Text testID="exercise-demo-status" accessibilityLabel={url ? `Video demonstration available for ${exerciseName}` : `Video demonstration unavailable for ${exerciseName}`} style={styles.demoStatus}>{url ? "Video available" : "Demo unavailable"}</Text> : null}
  </View>;
}

export function ExerciseMedia(props: ExerciseMediaProps) {
  return <MediaContent key={`${props.media?.url ?? props.demoVideoUrl}:${props.imageUrl}`} {...props} />;
}

const styles = StyleSheet.create({
  container: { borderRadius: 20, overflow: "hidden", marginBottom: 20 },
  fill: { width: "100%", height: "100%" },
  unavailable: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 40 },
  title: { marginTop: 10, fontSize: 17, fontWeight: "700", fontFamily: Fonts.sans },
  caption: { marginTop: 4, padding: 4, fontSize: 13, textAlign: "center", fontFamily: Fonts.sans },
  controls: { position: "absolute", bottom: 12, left: 12, right: 12, alignItems: "center" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 20, gap: 12 },
  action: { minHeight: 48, paddingHorizontal: 18, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  lightText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", textAlign: "center" },
  demoStatus: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.65)", color: "#FFFFFF", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, fontSize: 11 },
});
