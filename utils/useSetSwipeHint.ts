import { useCallback, useEffect, useRef, useState } from "react";
import { loadSetSwipeHintSeen, markSetSwipeHintSeen } from "@/utils/workoutLayoutPreference";

export function useSetSwipeHint(userId: string | null, eligible: boolean) {
  const identity = useRef({ userId, epoch: 0 });
  if (identity.current.userId !== userId) identity.current = { userId, epoch: identity.current.epoch + 1 };
  const epoch = identity.current.epoch;
  const [state, setState] = useState({ userId, epoch, ready: false, seen: false, requested: false, visible: false });

  useEffect(() => {
    setState({ userId, epoch, ready: false, seen: false, requested: false, visible: false });
    if (!userId) return;
    let cancelled = false;
    void loadSetSwipeHintSeen(userId).catch(() => true).then((seen) => {
      if (!cancelled) setState((current) => current.userId === userId && current.epoch === epoch
        ? { ...current, ready: true, seen: current.seen || seen } : current);
    });
    return () => { cancelled = true; };
  }, [userId, epoch]);

  const request = useCallback(() => {
    setState((current) => current.userId === userId && current.epoch === epoch && !current.seen
      ? { ...current, requested: true } : current);
  }, [userId, epoch]);

  const dismiss = useCallback(() => {
    if (!userId || identity.current.userId !== userId || identity.current.epoch !== epoch) return;
    setState((current) => current.userId === userId && current.epoch === epoch
      ? { ...current, seen: true, requested: false, visible: false } : current);
    void markSetSwipeHintSeen(userId).catch(() => undefined);
  }, [userId, epoch]);

  useEffect(() => {
    if (!userId || state.userId !== userId || state.epoch !== epoch || !state.ready || state.seen || !state.requested || !eligible) return;
    setState((current) => ({ ...current, seen: true, visible: true }));
    void markSetSwipeHintSeen(userId).catch(() => undefined);
  }, [userId, epoch, eligible, state]);

  return { request, dismiss, visible: eligible && state.userId === userId && state.epoch === epoch && state.visible };
}
