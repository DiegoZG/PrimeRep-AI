import { useCallback, useEffect, useRef, useState } from "react";
import type { ExploreSearchResponse } from "@/interfaces/programs";
import { searchExplore } from "@/services/programService";

const EMPTY: ExploreSearchResponse = { programs: [], exercises: [] };

export function useExploreSearchPages(token: string | null, account: string, query: string, scope: "all" | "programs" | "exercises") {
  const key = `${account}:${query}:${scope}`;
  const keyRef = useRef(key);
  keyRef.current = key;
  const generation = useRef(0);
  const busy = useRef(false);
  const resultRef = useRef(EMPTY);
  const [state, setState] = useState({ owner: "", result: EMPTY, loading: false, loadingMore: false, error: null as string | null });
  const load = useCallback(async (kind?: "programs" | "exercises") => {
    if (!token || query.length < 2 || (kind && busy.current)) return;
    const request = ++generation.current;
    busy.current = true;
    const previous = kind ? resultRef.current : EMPTY;
    const page = kind === "programs" ? previous.program_pagination : previous.exercise_pagination;
    const offset = page ? page.offset + page.limit : kind ? previous[kind].length : 0;
    setState({ owner: key, result: previous, loading: !kind, loadingMore: !!kind, error: null });
    try {
      const result = await searchExplore(token, query, kind ?? scope, kind === "programs" ? { programOffset: offset } : { exerciseOffset: offset });
      if (request !== generation.current || keyRef.current !== key) return;
      const next = kind ? {
        ...previous,
        [kind]: [...new Map([...previous[kind], ...result[kind]].map((item) => [item.id, item])).values()],
        [`${kind === "programs" ? "program" : "exercise"}_pagination`]: kind === "programs" ? result.program_pagination : result.exercise_pagination,
      } : result;
      resultRef.current = next;
      setState({ owner: key, result: next, loading: false, loadingMore: false, error: null });
    } catch {
      if (request === generation.current && keyRef.current === key) setState((previousState) => ({ ...previousState, loading: false, loadingMore: false, error: "Search couldn’t load. Try again." }));
    } finally {
      if (request === generation.current) busy.current = false;
    }
  }, [key, query, scope, token]);
  useEffect(() => {
    resultRef.current = EMPTY;
    busy.current = false;
    void load();
    return () => { generation.current += 1; };
  }, [load]);
  return { ...state, result: state.owner === key ? state.result : EMPTY, loading: query.length >= 2 && (state.owner !== key || state.loading), load };
}
