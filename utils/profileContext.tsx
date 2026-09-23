import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { AuthContext } from "./authContext";
import { accountGeneration, accountRequestGuard } from "@/services/accountScope";
import { getAvatar, getProfile, type Profile } from "@/services/profileService";

type State = { owner: string; profile: Profile | null; avatar: string | null; loading: boolean; error: string | null; avatarError: boolean };
const empty: State = { owner: "", profile: null, avatar: null, loading: true, error: null, avatarError: false };
const ProfileContext = createContext<State & { refresh: () => Promise<void>; install: (profile: Profile) => Promise<void>; retryAvatar: () => Promise<void> }>({ ...empty, refresh: async () => {}, install: async () => {}, retryAvatar: async () => {} });

export function ProfileProvider({ children }: PropsWithChildren) {
  const { user, token, acceptProfileIdentity } = useContext(AuthContext);
  const owner = `${user?.id ?? ""}:${accountGeneration()}`;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const request = useRef(0);
  const avatarRequest = useRef(0);
  const [state, setState] = useState<State>(empty);

  const loadAvatar = useCallback(async (profile: Profile) => {
    if (!token) return;
    const attempt = ++avatarRequest.current;
    const current = accountRequestGuard();
    const valid = () => current() && ownerRef.current === owner && attempt === avatarRequest.current;
    if (!profile.avatar_version) {
      setState((previous) => ({ ...previous, avatar: null, avatarError: false }));
      return;
    }
    try {
      const avatar = await getAvatar(token);
      if (valid()) setState((previous) => ({ ...previous, avatar, avatarError: false }));
    } catch {
      if (valid()) setState((previous) => ({ ...previous, avatar: null, avatarError: true }));
    }
  }, [owner, token]);

  const refresh = useCallback(async () => {
    if (!token || !user) return;
    const attempt = ++request.current;
    const current = accountRequestGuard();
    const valid = () => current() && ownerRef.current === owner && attempt === request.current;
    setState((previous) => previous.owner === owner ? { ...previous, loading: !previous.profile, error: null } : { ...empty, owner });
    try {
      const profile = await getProfile(token);
      if (!valid() || profile.id !== user.id) return;
      setState((previous) => ({ ...previous, owner, profile, loading: false, error: null }));
      await loadAvatar(profile);
    } catch {
      if (valid()) setState((previous) => ({ ...previous, loading: false, error: "Your profile couldn’t load. Check your connection and try again." }));
    }
  }, [loadAvatar, owner, token, user]);

  const install = useCallback(async (profile: Profile) => {
    if (ownerRef.current !== owner || profile.id !== user?.id) return;
    request.current += 1;
    setState((previous) => ({ ...previous, owner, profile, loading: false, error: null }));
    acceptProfileIdentity(profile);
    await loadAvatar(profile);
  }, [acceptProfileIdentity, loadAvatar, owner, user?.id]);

  useEffect(() => {
    request.current += 1;
    avatarRequest.current += 1;
    setState(empty);
    return () => { request.current += 1; avatarRequest.current += 1; };
  }, [owner]);

  const visible = state.owner === owner ? state : empty;
  const value = useMemo(() => ({ ...visible, refresh, install, retryAvatar: async () => { if (visible.profile) await loadAvatar(visible.profile); } }), [visible, refresh, install, loadAvatar]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export const useProfile = () => useContext(ProfileContext);
