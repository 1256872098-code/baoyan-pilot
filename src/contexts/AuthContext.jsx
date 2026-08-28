import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

const AuthContext = createContext(null);

const GUEST_USER = Object.freeze({
  id: "guest",
  nickname: "游客体验",
  avatar: "",
  avatar_url: "",
  loginType: "guest",
  isGuest: true,
});

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("账号服务暂未配置，请稍后再试。");
}

function normalizeNickname(value, email = "") {
  const nickname = String(value || "").trim();
  if (nickname) return nickname;
  return String(email || "").split("@")[0].trim() || "保研用户";
}

function normalizeProfile(authUser, row = null) {
  if (!authUser) return null;
  return {
    id: authUser.id,
    nickname: normalizeNickname(row?.nickname || authUser.user_metadata?.nickname, authUser.email),
    avatar_url: row?.avatar_url || "",
    bio: row?.bio || "",
    created_at: row?.created_at || authUser.created_at || "",
    updated_at: row?.updated_at || "",
  };
}

function normalizeAuthUser(authUser, profile) {
  if (!authUser) return null;
  const currentProfile = profile || normalizeProfile(authUser);
  return {
    ...authUser,
    nickname: currentProfile.nickname,
    avatar: currentProfile.avatar_url,
    avatar_url: currentProfile.avatar_url,
    bio: currentProfile.bio,
    loginType: "supabase",
    isGuest: false,
  };
}

async function loadProfile(authUser) {
  if (!authUser || !supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nickname,avatar_url,bio,created_at,updated_at")
    .eq("id", authUser.id)
    .maybeSingle();
  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[Auth] profile load failed", { code: error.code, message: error.message });
    }
    return normalizeProfile(authUser);
  }
  return normalizeProfile(authUser, data);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [guestMode, setGuestMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback(async (nextSession) => {
    setSession(nextSession || null);
    setGuestMode(false);
    if (!nextSession?.user) {
      setProfile(null);
      setLoading(false);
      return null;
    }
    const nextProfile = await loadProfile(nextSession.user);
    setProfile(nextProfile);
    setLoading(false);
    return nextSession;
  }, []);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return undefined;
    }
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error("[Auth] getSession failed", { code: error.code, message: error.message });
      }
      applySession(data?.session || null);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => {
        if (!active) return;
        if (nextSession) applySession(nextSession);
        else {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
      }, 0);
    });
    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [applySession]);

  const signInWithPassword = useCallback(async ({ email, password }) => {
    requireSupabase();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || ""),
    });
    if (error) {
      setLoading(false);
      throw new Error(
        error.message === "Invalid login credentials"
          ? "邮箱或密码不正确；若该邮箱尚未注册，请先注册。"
          : "登录失败，请稍后重试。",
      );
    }
    await applySession(data.session);
    return data.user;
  }, [applySession]);

  const signUp = useCallback(async ({ nickname, email, password }) => {
    requireSupabase();
    const normalizedNickname = normalizeNickname(nickname, email);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: String(email || "").trim(),
      password: String(password || ""),
      options: { data: { nickname: normalizedNickname } },
    });
    if (error) {
      setLoading(false);
      throw new Error(error.message?.includes("already registered") ? "该邮箱已经注册，请直接登录。" : "注册失败，请稍后重试。");
    }
    if (!data.session) {
      setLoading(false);
      throw new Error("注册已创建，但项目仍开启邮箱确认。请在 Supabase Auth 设置中关闭 Confirm email 后重试登录。");
    }
    const { error: profileError } = await supabase.from("profiles").upsert(
      { id: data.user.id, nickname: normalizedNickname },
      { onConflict: "id" },
    );
    if (profileError && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[Auth] profile bootstrap failed", { code: profileError.code, message: profileError.message });
    }
    await applySession(data.session);
    return data.user;
  }, [applySession]);

  const loginAsGuest = useCallback(async () => {
    if (session && supabase) await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setGuestMode(true);
    setLoading(false);
    return GUEST_USER;
  }, [session]);

  const signOut = useCallback(async () => {
    if (session && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error("退出登录失败，请稍后重试。");
    }
    setSession(null);
    setProfile(null);
    setGuestMode(false);
  }, [session]);

  const refreshSession = useCallback(async () => {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    await applySession(data.session);
    return data.session;
  }, [applySession]);

  const reloadProfile = useCallback(async () => {
    if (!session?.user) return null;
    const nextProfile = await loadProfile(session.user);
    setProfile(nextProfile);
    return nextProfile;
  }, [session?.user]);

  const updateUserProfile = useCallback(async (updates) => {
    requireSupabase();
    if (!session?.user) throw new Error("请先登录后再保存个人资料。");
    const payload = {
      id: session.user.id,
      nickname: normalizeNickname(updates.nickname, session.user.email),
      avatar_url: updates.avatar_url || null,
      bio: String(updates.bio || "").trim().slice(0, 200),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("id,nickname,avatar_url,bio,created_at,updated_at")
      .single();
    if (error) throw new Error("个人资料保存失败，请稍后重试。");
    const nextProfile = normalizeProfile(session.user, data);
    setProfile(nextProfile);
    return nextProfile;
  }, [session?.user]);

  const user = useMemo(
    () => (session?.user ? normalizeAuthUser(session.user, profile) : guestMode ? GUEST_USER : null),
    [guestMode, profile, session?.user],
  );
  const isAuthenticated = Boolean(session?.user);
  const guestProfile = useMemo(() => (guestMode ? { ...GUEST_USER } : null), [guestMode]);

  const value = useMemo(() => ({
    session,
    user,
    profile: guestProfile || profile,
    loading,
    isLoggedIn: isAuthenticated,
    isAuthenticated,
    isGuest: guestMode,
    signInWithPassword,
    signUp,
    loginAsGuest,
    signOut,
    refreshSession,
    reloadProfile,
    updateUserProfile,
  }), [guestMode, guestProfile, isAuthenticated, loading, loginAsGuest, profile, refreshSession, reloadProfile, session, signInWithPassword, signOut, signUp, updateUserProfile, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}
