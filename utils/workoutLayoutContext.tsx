import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from "react";

import { AuthContext } from "@/utils/authContext";
import { loadWorkoutLayout, saveWorkoutLayout, type WorkoutLayout } from "@/utils/workoutLayoutPreference";

type LayoutState = { ownerId: string | null; epoch: number; layout: WorkoutLayout; isReady: boolean; isSaving: boolean };
type WorkoutLayoutContextValue = Omit<LayoutState, "ownerId" | "epoch"> & { setLayout: (layout: WorkoutLayout) => Promise<void> };

const DEFAULT_LAYOUT: WorkoutLayout = "focus";
const WorkoutLayoutContext = createContext<WorkoutLayoutContextValue | null>(null);

export function WorkoutLayoutProvider({ children }: PropsWithChildren) {
  const { user } = useContext(AuthContext);
  const userId = user?.id ?? null;
  const identityRef = useRef({ ownerId: userId, epoch: 0 });
  if (identityRef.current.ownerId !== userId) identityRef.current = { ownerId: userId, epoch: identityRef.current.epoch + 1 };
  const epoch = identityRef.current.epoch;
  const saveRef = useRef<{ ownerId: string; epoch: number } | null>(null);
  const [state, setState] = useState<LayoutState>({ ownerId: null, epoch: -1, layout: DEFAULT_LAYOUT, isReady: false, isSaving: false });
  const visibleState = state.ownerId === userId && state.epoch === epoch ? state : { ownerId: userId, epoch, layout: DEFAULT_LAYOUT, isReady: false, isSaving: false };
  const stateRef = useRef(visibleState);
  stateRef.current = visibleState;

  useEffect(() => {
    saveRef.current = null;
    setState({ ownerId: userId, epoch, layout: DEFAULT_LAYOUT, isReady: !userId, isSaving: false });
    if (!userId) return;
    let cancelled = false;
    void loadWorkoutLayout(userId).then((layout) => {
      if (!cancelled && identityRef.current.ownerId === userId && identityRef.current.epoch === epoch) {
        setState({ ownerId: userId, epoch, layout, isReady: true, isSaving: false });
      }
    }).catch(() => {
      if (!cancelled && identityRef.current.ownerId === userId && identityRef.current.epoch === epoch) {
        setState({ ownerId: userId, epoch, layout: DEFAULT_LAYOUT, isReady: true, isSaving: false });
      }
    });
    return () => { cancelled = true; };
  }, [userId, epoch]);

  const setLayout = useCallback(async (layout: WorkoutLayout) => {
    const ownerId = userId;
    const current = stateRef.current;
    if (!ownerId || identityRef.current.ownerId !== ownerId || identityRef.current.epoch !== epoch || current.ownerId !== ownerId || current.epoch !== epoch || !current.isReady || current.isSaving || current.layout === layout) return;
    const previous = current.layout;
    saveRef.current = { ownerId, epoch };
    stateRef.current = { ownerId, epoch, layout, isReady: true, isSaving: true };
    setState(state => state.ownerId === ownerId && state.epoch === epoch ? { ...state, layout, isSaving: true } : state);
    try {
      await saveWorkoutLayout(ownerId, layout);
    } catch (error) {
      if (identityRef.current.ownerId === ownerId && identityRef.current.epoch === epoch && saveRef.current?.epoch === epoch) {
        stateRef.current = { ownerId, epoch, layout: previous, isReady: true, isSaving: false };
        setState(state => state.ownerId === ownerId && state.epoch === epoch ? { ...state, layout: previous, isSaving: false } : state);
        throw error;
      }
    } finally {
      if (identityRef.current.ownerId === ownerId && identityRef.current.epoch === epoch && saveRef.current?.epoch === epoch) {
        saveRef.current = null;
        stateRef.current = { ownerId, epoch, layout: stateRef.current.layout, isReady: true, isSaving: false };
        setState(state => state.ownerId === ownerId && state.epoch === epoch ? { ...state, isSaving: false } : state);
      }
    }
  }, [userId, epoch]);

  return <WorkoutLayoutContext.Provider value={{ layout: visibleState.layout, isReady: visibleState.isReady, isSaving: visibleState.isSaving, setLayout }}>{children}</WorkoutLayoutContext.Provider>;
}

export function useWorkoutLayout(): WorkoutLayoutContextValue {
  const context = useContext(WorkoutLayoutContext);
  if (!context) throw new Error("useWorkoutLayout must be used within WorkoutLayoutProvider");
  return context;
}
