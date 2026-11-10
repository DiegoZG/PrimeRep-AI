import { useFocusEffect } from "@react-navigation/native";
import { uuid } from "expo-modules-core";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { API_BASE_URL } from "@/config/api";
import type { EquipmentSearchPage, EquipmentSummary, ExerciseGuidance, ExerciseOptionsPage, ScanResult } from "@/interfaces/equipment-scanning";
import { accountRequestGuard } from "@/services/accountScope";
import { discardInterruptedScanPhoto, discardScanPhoto, pickScanPhoto, type ScanPhoto } from "@/services/equipmentScanPhoto";
import { checkEquipmentAttempt, EquipmentScanError, getEquipmentExercises, getScanGuidance, identifyEquipment, searchEquipment } from "@/services/equipmentScanService";
import { getFeatureFlags } from "@/services/featureFlagService";
import { AuthContext } from "@/utils/authContext";

type Stage = "capture" | "manual" | "confirm" | "exercises" | "guidance";
const remembered = new Map<string, string>();
const preAdmissionErrors = new Set(["scan_access_unknown", "scan_access_required", "scan_disabled", "scan_budget_exceeded", "scan_quota_exceeded", "scan_authentication_required", "scan_image_invalid", "scan_image_too_large", "scan_media_type_unsupported", "scan_invalid_request"]);
export function useEquipmentScanner() {
  const { user, token } = useContext(AuthContext);
  const [enabled, setEnabled] = useState(false);
  const [stage, setStage] = useState<Stage>("capture");
  const [photo, setPhoto] = useState<ScanPhoto | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [selection, setSelection] = useState<EquipmentSummary | null>(null);
  const [machine, setMachine] = useState<EquipmentSummary | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<EquipmentSearchPage | null>(null);
  const [options, setOptions] = useState<ExerciseOptionsPage | null>(null);
  const [guidance, setGuidance] = useState<ExerciseGuidance | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptKey, setAttemptKey] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);
  const active = useRef(false); const mounted = useRef(true); const generation = useRef(0);
  const accountGuard = useRef(accountRequestGuard()).current;
  const confirmationSource = useRef<"manual" | "confirm">("confirm");
  const scanRequest = useRef(false);
  const requestRef = useRef<AbortController | null>(null); const gate = useRef(false); const photoRef = useRef<ScanPhoto | null>(null);
  const guidanceRef = useRef<ExerciseGuidance | null>(null);
  const guidanceRefresh = useRef<AbortController | null>(null);
  const enabledRef = useRef(false); const environment = useRef<string | null>(null); const scope = useRef<string | null>(null);
  const owner = useRef(user?.id); owner.current = user?.id;
  const tokenRef = useRef(token); tokenRef.current = token;
  const current = useCallback(() => mounted.current && active.current && accountGuard() && owner.current === user?.id, [accountGuard, user?.id]);
  const forget = () => { if (scope.current) remembered.delete(scope.current); setAttemptKey(null); setRecovery(false); };
  const remember = (key: string) => { setAttemptKey(key); if (scope.current) { if (remembered.size >= 8) remembered.delete(remembered.keys().next().value!); remembered.set(scope.current, key); } };
  const cancelRequest = useCallback(() => { generation.current += 1; requestRef.current?.abort(); requestRef.current = null; gate.current = false; scanRequest.current = false; if (mounted.current) setBusy(false); }, []);
  const refreshAccess = useCallback(async () => {
    const accessToken = tokenRef.current;
    if (!accessToken || !current()) return;
    const expected = generation.current;
    try {
      const flags = await getFeatureFlags(accessToken);
      if (!current() || expected !== generation.current) return;
      if (typeof flags.environment !== "string" || !flags.environment) return;
      const nextScope = `${API_BASE_URL}:${flags.environment}:${user?.id}`;
      if (environment.current && environment.current !== flags.environment) { guidanceRefresh.current?.abort(); guidanceRef.current = null; cancelRequest(); const previous = photoRef.current; photoRef.current = null; setPhoto(null); if (previous) void discardScanPhoto(previous.uri); setResult(null); setSelection(null); setMachine(null); setOptions(null); setGuidance(null); setStage("capture"); }
      environment.current = flags.environment; scope.current = nextScope;
      const allow = Platform.OS !== "web" && flags.flags.equipment_scanning_enabled === true;
      enabledRef.current = allow; setEnabled(allow);
      if (!allow && scanRequest.current) cancelRequest();
      setAttemptKey(remembered.get(nextScope) ?? null); setRecovery(remembered.has(nextScope));
    } catch { if (current()) { enabledRef.current = false; setEnabled(false); } }
  }, [cancelRequest, current, user?.id]);
  useFocusEffect(useCallback(() => {
    active.current = true; void refreshAccess();
    if (Platform.OS === "android") void discardInterruptedScanPhoto().then((discarded) => { if (discarded && current()) setError("Your photo selection was interrupted. Choose the photo again before identifying it."); }).catch(() => {});
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") { guidanceRefresh.current?.abort(); return; }
      void refreshAccess();
      const previous = guidanceRef.current; const accessToken = tokenRef.current; const previousEnvironment = environment.current; const previousGeneration = generation.current;
      if (previous && accessToken) {
        guidanceRefresh.current?.abort(); const controller = new AbortController(); guidanceRefresh.current = controller;
        guidanceRef.current = null; setGuidance(null);
        void getScanGuidance(accessToken, previous.exercise_id, controller.signal).then((next) => { if (current() && previousEnvironment === environment.current && previousGeneration === generation.current && !controller.signal.aborted) { guidanceRef.current = next; setGuidance(next); } }).catch(() => { if (current() && previousEnvironment === environment.current && previousGeneration === generation.current && !controller.signal.aborted) setError("This guide couldn’t be verified. Go back and open it again when connected."); });
      }
    });
    return () => { active.current = false; subscription.remove(); guidanceRefresh.current?.abort(); guidanceRef.current = null; cancelRequest(); const previous = photoRef.current; photoRef.current = null; setPhoto(null); setPicking(false); setResult(null); setGuidance(null); setOptions(null); setMachine(null); setSelection(null); setStage("capture"); if (previous) void discardScanPhoto(previous.uri); };
  }, [cancelRequest, current, refreshAccess]));
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async <T,>(job: (signal: AbortSignal) => Promise<T>, apply: (value: T) => void, scan = false) => {
    if (!current() || !token || gate.current) return;
    gate.current = true; scanRequest.current = scan; const expected = ++generation.current; const controller = new AbortController(); requestRef.current = controller; setBusy(true); setError(null);
    try { const value = await job(controller.signal); if (current() && expected === generation.current) apply(value); }
    catch (failure) {
      if (!current() || expected !== generation.current || controller.signal.aborted) return;
      const fault = failure instanceof EquipmentScanError ? failure : null;
      if (fault?.attemptKey) { remember(fault.attemptKey); setRecovery(true); }
      else if (scan && fault?.status && preAdmissionErrors.has(fault.code)) forget();
      if (fault?.code === "scan_disabled") { enabledRef.current = false; setEnabled(false); }
      if (scan && (fault?.code === "scan_outcome_unknown" || fault?.code === "scan_provider_outcome_unknown" || fault?.code === "scan_in_progress" || fault?.code === "scan_provider_timeout")) setRecovery(true);
      setError(failure instanceof Error ? failure.message : "This request couldn’t finish. Search manually or try again.");
    } finally { if (current() && expected === generation.current) { gate.current = false; scanRequest.current = false; requestRef.current = null; setBusy(false); } }
  };
  const receiveResult = (next: ScanResult) => { forget(); setResult(next); setSelection(null); setStage(next.status === "candidates" ? "confirm" : "capture"); };
  const pick = async (source: "camera" | "library") => {
    if (!current() || !enabledRef.current || gate.current || picking) return;
    cancelRequest(); const expected = generation.current; setPicking(true); setError(null);
    try {
      const next = await pickScanPhoto(source, () => current() && expected === generation.current);
      if (!next) return;
      if (!current() || expected !== generation.current) { await discardScanPhoto(next.uri); return; }
      const previous = photoRef.current; photoRef.current = next; setPhoto(next); if (previous) void discardScanPhoto(previous.uri);
      forget(); setResult(null); setSelection(null); setStage("capture");
    } catch (failure) { if (current() && expected === generation.current) setError(failure instanceof Error ? failure.message : "This photo couldn’t open. Choose another photo."); }
    finally { if (current() && expected === generation.current) setPicking(false); }
  };
  const identify = () => {
    if (!enabledRef.current || !photoRef.current || attemptKey || gate.current || !token || !scope.current) return;
    const key = uuid.v4(); remember(key);
    void run((signal) => identifyEquipment(token, photoRef.current!.uri, key, signal), receiveResult, true);
  };
  const check = () => { if (!token || !attemptKey || !enabledRef.current) return; void run((signal) => checkEquipmentAttempt(token, attemptKey, signal), (status) => { if (status.attempt_key !== attemptKey) { setError("This result couldn’t be verified. Search manually."); return; } if (status.status === "completed" && status.result) receiveResult(status.result); else { setRecovery(true); setError(status.error?.detail ?? "Identification is still in progress. Check again in a moment."); } }); };
  const manual = () => { cancelRequest(); setPicking(false); setError(null); setSelection(null); setStage("manual"); };
  const find = (more = false) => { if (!token) return; const continuation = more ? search?.next_cursor ?? null : null; void run((signal) => searchEquipment(token, query, continuation, signal), (page) => { setSearch((previous) => more && previous ? { ...page, items: [...previous.items, ...page.items.filter((item) => !previous.items.some((p) => p.id === item.id))] } : page); setSelection(null); }); };
  const confirm = () => {
    if (!token || !selection) return; const chosen = selection; confirmationSource.current = stage === "manual" ? "manual" : "confirm";
    void run((signal) => getEquipmentExercises(token, chosen.id, null, signal), (page) => { if (page.equipment.id !== chosen.id) { setError("This equipment changed. Search again."); return; } setMachine(chosen); setOptions(page); setGuidance(null); setStage("exercises"); });
  };
  const moreExercises = () => { if (!token || !machine || !options?.next_cursor) return; void run((signal) => getEquipmentExercises(token, machine.id, options.next_cursor, signal), (page) => { if (page.equipment.id !== machine.id) return; setOptions((previous) => previous ? { ...page, items: [...previous.items, ...page.items.filter((item) => !previous.items.some((p) => p.exercise_id === item.exercise_id))] } : page); }); };
  const openGuidance = (exerciseId: string) => { if (!token) return; void run((signal) => getScanGuidance(token, exerciseId, signal), (next) => { guidanceRef.current = next; setGuidance(next); setStage("guidance"); }); };
  const back = () => { cancelRequest(); setError(null); setPicking(false); if (stage === "guidance") { guidanceRefresh.current?.abort(); guidanceRef.current = null; setGuidance(null); setStage("exercises"); } else if (stage === "exercises") { setMachine(null); setOptions(null); setStage(confirmationSource.current); } else { setSelection(null); setStage("capture"); } };
  return { enabled, stage, photo, result, selection, machine, query, search, options, guidance, busy, picking, error, attemptKey, recovery, setQuery: (value: string) => { cancelRequest(); setQuery(value); setSearch(null); setSelection(null); }, setSelection, pick, identify, check, manual, find, confirm, moreExercises, openGuidance, back, cancelRequest };
}
