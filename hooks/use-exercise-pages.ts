import { useCallback, useContext, useEffect, useRef, useState } from "react";

import type { Exercise } from "@/interfaces/exercises";
import { getExercisePage } from "@/services/exerciseService";
import { AuthContext } from "@/utils/authContext";

const PAGE_SIZE = 50;

export function useExercisePages(query = "", types: string[] = []) {
  const { token, user } = useContext(AuthContext);
  const typesKey = types.join(",");
  const key = `${user?.id ?? "guest"}:${token ?? ""}:${query}:${typesKey}`;
  const keyRef = useRef(key);
  keyRef.current = key;
  const generation = useRef(0);
  const busy = useRef(false);
  const cursors = useRef<Record<string, number>>({});
  const [state, setState] = useState({ owner: "", items: [] as Exercise[], loading: true, refreshing: false, loadingMore: false, error: null as string | null, hasMore: false });
  const ownerRef = useRef("");
  const retryAppend = useRef(false);

  const load = useCallback(async (append = false) => {
    if (!token || (append && busy.current)) return;
    const request = ++generation.current;
    busy.current = true;
    retryAppend.current = append;
    const sameOwner = ownerRef.current === key;
    ownerRef.current = key;
    if (!append) cursors.current = Object.fromEntries((typesKey ? typesKey.split(",") : [""]).map((type) => [type, 0]));
    setState((previous) => ({ ...previous, owner: key, items: sameOwner ? previous.items : [], loading: !append && (!sameOwner || previous.items.length === 0), refreshing: !append && sameOwner && previous.items.length > 0, loadingMore: append, error: null }));
    try {
      const pages = await Promise.all(Object.entries(cursors.current).filter(([, offset]) => offset >= 0).map(async ([type, offset]) => ({ type, page: await getExercisePage({ q: query.length >= 2 ? query : undefined, type: type || undefined, offset, limit: PAGE_SIZE }, token) })));
      if (request !== generation.current || keyRef.current !== key) return;
      for (const { type, page } of pages) cursors.current[type] = page.has_more ? page.offset + page.limit : -1;
      setState((previous) => {
        const merged = new Map((append ? previous.items : []).map((item) => [item.id, item]));
        pages.forEach(({ page }) => page.items.forEach((item) => merged.set(item.id, item)));
        return { owner: key, items: [...merged.values()], loading: false, refreshing: false, loadingMore: false, error: null, hasMore: Object.values(cursors.current).some((offset) => offset >= 0) };
      });
    } catch {
      if (request === generation.current && keyRef.current === key) setState((previous) => ({ ...previous, loading: false, refreshing: false, loadingMore: false, error: "Exercises couldn’t load. Check your connection and try again." }));
    } finally {
      if (request === generation.current) busy.current = false;
    }
  }, [key, query, token, typesKey]);

  useEffect(() => {
    busy.current = false;
    void load();
    return () => { generation.current += 1; };
  }, [load]);

  return { ...state, items: state.owner === key ? state.items : [], loading: state.owner !== key || state.loading, loadMore: () => load(true), refresh: () => load(false), retry: () => load(retryAppend.current) };
}
