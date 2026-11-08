import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useContext, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { useSegments } from "expo-router";
import { API_BASE_URL } from "@/config/api";
import { accountGeneration, accountRequestGuard } from "@/services/accountScope";
import { WorkoutDiagnostics } from "@/services/workoutDiagnostics";
import type { DiagnosticReceipt } from "@/services/workoutDiagnosticSchema";
import { AuthContext } from "./authContext";
import { loadActiveWorkout } from "./activeWorkoutStore";
import { setWorkoutDiagnosticListener, workoutDiagnostics } from "./workoutDiagnosticsBridge";

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 3) | 8).toString(16);
  });
}
const processRunId = uuid();

async function diagnosticRequest<T>(path: string, token: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(`${API_BASE_URL}${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
        if (!response.ok) throw Object.assign(new Error("Diagnostic request failed"), { status: response.status });
        return await response.json() as T;
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Diagnostic timeout")); }, 5_000); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
export function WorkoutDiagnosticsSync() {
  const { token, user, isLoggedIn } = useContext(AuthContext);
  const segments = useSegments();
  const generation = accountGeneration();
  const hasCredential = Boolean(token);
  const credentialRef = useRef({ owner: user?.id, token });
  credentialRef.current = { owner: user?.id, token };
  const wakeRef = useRef<(() => void) | null>(null);
  const player = segments.join("/") === "workout/active";
  const playerRef = useRef(player);
  playerRef.current = player;
  useEffect(() => {
    if (user?.id) workoutDiagnostics(user.id).emit({ kind: "player", active: player });
  }, [player, user?.id]);
  useEffect(() => {
    if (!isLoggedIn || !user?.id || !token || !["ios", "android", "web"].includes(Platform.OS)) return;
    const owner = user.id;
    const accountCurrent = accountRequestGuard();
    let alive = true, fetching = false, authBlocked = false;
    let foreground = AppState.currentState === "active";
    let lastFlags = -Infinity;
    let lastToken = token;
    let runtime: WorkoutDiagnostics | undefined;
    let environment: string | undefined;
    let runtimeEpoch = 0;
    let removeListener: (() => void) | undefined;
    const current = () => alive && accountCurrent();
    const refresh = async () => {
      if (!current() || !foreground || fetching || authBlocked || Date.now() - lastFlags < 60_000) return;
      const requestToken = credentialRef.current.owner === owner ? credentialRef.current.token : null;
      if (!requestToken) return;
      fetching = true; lastFlags = Date.now();
      try {
        const snapshot = await diagnosticRequest<{ environment: string; flags: { workout_reliability_monitoring_enabled?: boolean } }>("/v1/feature-flags", requestToken);
        if (!current()) return;
        const enabled = snapshot.flags?.workout_reliability_monitoring_enabled === true;
        if (typeof snapshot.environment !== "string" || !snapshot.environment || snapshot.environment.length > 100) { runtime?.setEnabled(false); return; }
        if (environment !== snapshot.environment) {
          runtime?.setEnabled(false); removeListener?.();
          runtimeEpoch += 1; runtime = undefined;
          environment = snapshot.environment;
        }
        if (!enabled) { runtime?.setEnabled(false); return; }
        if (!runtime) {
          const capturedEpoch = ++runtimeEpoch;
          const owns = () => current() && runtimeEpoch === capturedEpoch;
          runtime = new WorkoutDiagnostics({ storage: AsyncStorage, uuid, now: Date.now, current: owns, runId: processRunId, platform: Platform.OS as "ios" | "android" | "web", appVersion: Constants.expoConfig?.version ?? "unknown",
            storageKey: `primerep.workout-diagnostics.v1.${encodeURIComponent(API_BASE_URL)}.${encodeURIComponent(environment)}.${encodeURIComponent(owner)}`,
            send: async (body) => {
              const sendingToken = credentialRef.current.owner === owner ? credentialRef.current.token : null;
              if (!owns() || !sendingToken) throw new Error("Diagnostic owner changed");
              try { return await diagnosticRequest<DiagnosticReceipt>("/v1/diagnostics/workout-sync", sendingToken, body); }
              catch (error) { if (sendingToken !== credentialRef.current.token) throw new Error("Diagnostic credential changed"); throw error; }
            },
          });
          const captured = runtime;
          removeListener = setWorkoutDiagnosticListener({ owner, current: () => owns() && captured.isEnabled(), emit: (signal) => captured.capture(signal) });
          runtime.setForeground(foreground);
          runtime.setEnabled(enabled);
          void runtime.initialize().then(() => {
            if (!owns() || !captured.isEnabled()) return;
            workoutDiagnostics(owner).emit({ kind: "player", active: playerRef.current });
            void loadActiveWorkout(owner).catch(() => {});
          });
        } else runtime?.setEnabled(enabled);
      } catch (error) {
        if (!current()) return;
        if (requestToken !== credentialRef.current.token) { lastFlags = -Infinity; return; }
        const status = (error as { status?: number } | null)?.status;
        if (status === 401 || status === 403) authBlocked = true;
        runtime?.setEnabled(false);
      } finally { fetching = false; }
    };
    const tick = () => {
      const nextToken = credentialRef.current.token;
      if (nextToken && nextToken !== lastToken) { lastToken = nextToken; authBlocked = false; lastFlags = -Infinity; runtime?.credentialsChanged(); }
      void refresh(); runtime?.tick();
    };
    wakeRef.current = tick;
    tick();
    const timer = setInterval(tick, 2_000);
    const subscription = AppState.addEventListener("change", (state) => {
      foreground = state === "active"; runtime?.setForeground(foreground);
      if (foreground) { lastFlags = -Infinity; tick(); }
    });
    return () => { alive = false; if (wakeRef.current === tick) wakeRef.current = null; removeListener?.(); runtime?.setEnabled(false); clearInterval(timer); subscription.remove(); };
  // Token refresh reuses this owned actor and its in-flight observations.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, hasCredential, user?.id, generation]);
  useEffect(() => { wakeRef.current?.(); }, [token]);
  return null;
}
