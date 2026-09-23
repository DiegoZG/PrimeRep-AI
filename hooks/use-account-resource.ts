import { useCallback, useContext, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AuthContext } from "@/utils/authContext";
import { accountGeneration, accountRequestGuard } from "@/services/accountScope";

export function useAccountResource<T>(load: (token: string) => Promise<T>) {
  const { token, user } = useContext(AuthContext);
  const key = `${user?.id ?? ""}:${accountGeneration()}`;
  const keyRef = useRef(key);
  keyRef.current = key;
  const sequence = useRef(0);
  const [state, setState] = useState({ key: "", data: null as T | null, loading: true, error: false });
  const refresh = useCallback(async () => {
    if (!token || !user) return;
    const attempt = ++sequence.current;
    const current = accountRequestGuard();
    const valid = () => current() && keyRef.current === key && sequence.current === attempt;
    setState((previous) => ({ key, data: previous.key === key ? previous.data : null, loading: true, error: false }));
    try {
      const data = await load(token);
      if (valid()) setState({ key, data, loading: false, error: false });
    } catch {
      if (valid()) setState((previous) => ({ ...previous, loading: false, error: true }));
    }
  }, [key, load, token, user]);
  useFocusEffect(useCallback(() => { void refresh(); return () => { sequence.current += 1; }; }, [refresh]));
  return { data: state.key === key ? state.data : null, loading: state.key !== key || state.loading, error: state.key === key && state.error, refresh };
}
