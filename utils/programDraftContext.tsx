import type {
  DraftProgramDay,
  DraftProgramExercise,
  ProgramDetail,
  ProgramDraft,
  ProgramGoal,
  ProgramLevel,
  ProgramMutationPayload,
} from "@/interfaces/programs";
import type { Exercise } from "@/interfaces/exercises";
import React, { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { AuthContext } from "./authContext";

function localId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyDraft(): ProgramDraft {
  return {
    name: "",
    description: "",
    goal: "general-fitness",
    level: "beginner",
    durationMinutes: 35,
    aliases: [],
    days: [],
  };
}

function programToDraft(program: ProgramDetail): ProgramDraft {
  return {
    templateId: program.id,
    scope: program.scope,
    isActive: program.isActive,
    isScheduled: program.isScheduled,
    version: program.version,
    name: program.name,
    description: program.description,
    goal: program.goal,
    level: program.level,
    durationMinutes: program.durationMinutes,
    aliases: program.aliases ?? [],
    days: program.days.map((day) => ({
      localId: localId("day"),
      id: day.id,
      position: day.position,
      title: day.title,
      dayType: day.dayType,
      exercises: day.exercises.map((item) => ({
        localId: localId("exercise"),
        id: item.id,
        position: item.position,
        blockType: item.blockType,
        exerciseId: item.exerciseId,
        exercise: item.exercise,
        sets: item.sets,
        repsMin: item.repsMin,
        repsMax: item.repsMax,
        restSeconds: item.restSeconds,
        cue: item.cue,
      })),
    })),
  };
}

interface ProgramDraftContextValue {
  draft: ProgramDraft;
  resetDraft: () => void;
  loadProgram: (program: ProgramDetail, asCopy?: boolean) => void;
  updateMetadata: (values: Partial<Pick<ProgramDraft, "name" | "description" | "goal" | "level" | "durationMinutes" | "aliases">>) => void;
  addDay: () => string | null;
  updateDay: (dayId: string, values: Partial<Pick<DraftProgramDay, "title">>) => void;
  removeDay: (dayId: string) => void;
  moveDay: (dayId: string, direction: -1 | 1) => void;
  addExercise: (dayId: string, exercise: Exercise) => void;
  updateExercise: (dayId: string, itemId: string, values: Partial<Pick<DraftProgramExercise, "blockType" | "sets" | "repsMin" | "repsMax" | "restSeconds" | "cue">>) => void;
  removeExercise: (dayId: string, itemId: string) => void;
  moveExercise: (dayId: string, itemId: string, direction: -1 | 1) => void;
  toPayload: () => ProgramMutationPayload;
}

export const ProgramDraftContext = createContext<ProgramDraftContextValue | null>(null);

function repositionDays(days: DraftProgramDay[]) {
  return days.map((day, index) => ({
    ...day,
    position: index,
    exercises: day.exercises.map((item, itemIndex) => ({ ...item, position: itemIndex })),
  }));
}

export function ProgramDraftProvider({ children }: PropsWithChildren) {
  const { user } = useContext(AuthContext);
  const currentUserId = user?.id ?? null;
  const emptyVisibleDraft = useMemo(emptyDraft, [currentUserId]);
  const [ownedDraft, setOwnedDraft] = useState<{
    ownerUserId: string | null;
    draft: ProgramDraft;
  }>(() => ({ ownerUserId: currentUserId, draft: emptyDraft() }));
  const draft = ownedDraft.ownerUserId === currentUserId
    ? ownedDraft.draft
    : emptyVisibleDraft;

  const updateDraft = useCallback(
    (update: (current: ProgramDraft) => ProgramDraft) => {
      setOwnedDraft((current) => ({
        ownerUserId: currentUserId,
        draft: update(
          current.ownerUserId === currentUserId ? current.draft : emptyDraft(),
        ),
      }));
    },
    [currentUserId],
  );

  useEffect(() => {
    setOwnedDraft({ ownerUserId: currentUserId, draft: emptyDraft() });
  }, [currentUserId]);

  const resetDraft = useCallback(() => {
    setOwnedDraft({ ownerUserId: currentUserId, draft: emptyDraft() });
  }, [currentUserId]);
  const loadProgram = useCallback((program: ProgramDetail, asCopy = false) => {
    const next = programToDraft(program);
    if (asCopy) {
      delete next.templateId;
      delete next.version;
      next.scope = "private";
      next.isActive = false;
      next.isScheduled = false;
      next.name = `${next.name} copy`;
      next.days = next.days.map((day) => ({
        ...day,
        id: undefined,
        exercises: day.exercises.map((item) => ({ ...item, id: undefined })),
      }));
    }
    setOwnedDraft({ ownerUserId: currentUserId, draft: next });
  }, [currentUserId]);

  const updateMetadata = useCallback((values: Partial<Pick<ProgramDraft, "name" | "description" | "goal" | "level" | "durationMinutes" | "aliases">>) => {
    updateDraft((current) => ({ ...current, ...values }));
  }, [updateDraft]);

  const addDay = useCallback(() => {
    let created: string | null = null;
    updateDraft((current) => {
      if (current.days.length >= 7) return current;
      created = localId("day");
      return {
        ...current,
        days: [...current.days, { localId: created, position: current.days.length, title: `Day ${current.days.length + 1}`, dayType: `day_${current.days.length + 1}`, exercises: [] }],
      };
    });
    return created;
  }, [updateDraft]);

  const updateDay = useCallback((dayId: string, values: Partial<Pick<DraftProgramDay, "title">>) => {
    updateDraft((current) => ({
      ...current,
      days: current.days.map((day) => day.localId === dayId ? { ...day, ...values } : day),
    }));
  }, [updateDraft]);

  const removeDay = useCallback((dayId: string) => {
    updateDraft((current) => ({ ...current, days: repositionDays(current.days.filter((day) => day.localId !== dayId)) }));
  }, [updateDraft]);

  const moveDay = useCallback((dayId: string, direction: -1 | 1) => {
    updateDraft((current) => {
      const index = current.days.findIndex((day) => day.localId === dayId);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.days.length) return current;
      const days = [...current.days];
      [days[index], days[destination]] = [days[destination], days[index]];
      return { ...current, days: repositionDays(days) };
    });
  }, [updateDraft]);

  const addExercise = useCallback((dayId: string, exercise: Exercise) => {
    updateDraft((current) => ({
      ...current,
      days: current.days.map((day) => {
        if (day.localId !== dayId || day.exercises.some((item) => item.exerciseId === exercise.id)) return day;
        return {
          ...day,
          exercises: [...day.exercises, {
            localId: localId("exercise"),
            position: day.exercises.length,
            blockType: "main",
            exerciseId: exercise.id,
            exercise,
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
          }],
        };
      }),
    }));
  }, [updateDraft]);

  const updateExercise = useCallback((dayId: string, itemId: string, values: Partial<Pick<DraftProgramExercise, "blockType" | "sets" | "repsMin" | "repsMax" | "restSeconds" | "cue">>) => {
    updateDraft((current) => ({ ...current, days: current.days.map((day) => day.localId !== dayId ? day : {
      ...day,
      exercises: day.exercises.map((item) => item.localId === itemId ? { ...item, ...values } : item),
    }) }));
  }, [updateDraft]);

  const removeExercise = useCallback((dayId: string, itemId: string) => {
    updateDraft((current) => ({ ...current, days: current.days.map((day) => day.localId !== dayId ? day : {
      ...day,
      exercises: day.exercises.filter((item) => item.localId !== itemId).map((item, position) => ({ ...item, position })),
    }) }));
  }, [updateDraft]);

  const moveExercise = useCallback((dayId: string, itemId: string, direction: -1 | 1) => {
    updateDraft((current) => ({ ...current, days: current.days.map((day) => {
      if (day.localId !== dayId) return day;
      const index = day.exercises.findIndex((item) => item.localId === itemId);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= day.exercises.length) return day;
      const exercises = [...day.exercises];
      [exercises[index], exercises[destination]] = [exercises[destination], exercises[index]];
      return { ...day, exercises: exercises.map((item, position) => ({ ...item, position })) };
    }) }));
  }, [updateDraft]);

  const toPayload = useCallback((): ProgramMutationPayload => ({
    name: draft.name.trim(),
    description: draft.description.trim(),
    goal: draft.goal as ProgramGoal,
    level: draft.level as ProgramLevel,
    durationMinutes: draft.durationMinutes,
    aliases: draft.aliases.map((alias) => alias.trim()).filter(Boolean),
    version: draft.version,
    days: draft.days.map((day) => ({
      title: day.title.trim(),
      dayType: day.dayType,
      exercises: day.exercises.map((item) => ({
        blockType: item.blockType,
        exerciseId: item.exerciseId,
        sets: item.sets,
        repsMin: item.repsMin,
        repsMax: item.repsMax,
        restSeconds: item.restSeconds,
        cue: item.cue?.trim() || null,
      })),
    })),
  }), [draft]);

  const value = useMemo(() => ({ draft, resetDraft, loadProgram, updateMetadata, addDay, updateDay, removeDay, moveDay, addExercise, updateExercise, removeExercise, moveExercise, toPayload }), [draft, resetDraft, loadProgram, updateMetadata, addDay, updateDay, removeDay, moveDay, addExercise, updateExercise, removeExercise, moveExercise, toPayload]);

  return <ProgramDraftContext.Provider value={value}>{children}</ProgramDraftContext.Provider>;
}

export function useProgramDraft() {
  const context = useContext(ProgramDraftContext);
  if (!context) throw new Error("useProgramDraft must be used within ProgramDraftProvider");
  return context;
}
