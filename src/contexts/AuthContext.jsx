import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

const MOCK_USER_KEY = "baoyanpilot_mock_user";
const MOCK_ACCOUNTS_KEY = "baoyanpilot_mock_accounts";
const phonePattern = /^1\d{10}$/;

function readJson(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function removeItem(key) {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(key);
  }
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function maskPhone(phone) {
  const value = normalizePhone(phone);
  if (value.length !== 11) {
    return "";
  }

  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

function getAccountNickname(phone) {
  return `手机用户 ${maskPhone(phone)}`;
}

function getProfileFromUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    nickname: user.nickname || (user.phone ? getAccountNickname(user.phone) : "游客体验"),
    avatar_url: user.avatar || user.avatarUrl || "",
    school_id: user.school_id || "",
    school_name: user.school_name || "",
    school_level_tags: Array.isArray(user.school_level_tags) ? user.school_level_tags : [],
    major: user.major || "",
    grade: user.grade || "",
    bio: user.bio || "",
    verification_status: "unverified",
  };
}

function readStoredProfile(userId) {
  return readJson(`baoyanpilot_profile_${userId}`, null);
}

function mergeStoredProfile(user) {
  const storedProfile = readStoredProfile(user.id);
  if (!storedProfile) return user;

  return {
    ...user,
    nickname: storedProfile.nickname || user.nickname,
    avatar: storedProfile.avatar_url || user.avatar || "",
    school_id: storedProfile.school_id || "",
    school_name: storedProfile.school_name || "",
    school_level_tags: Array.isArray(storedProfile.school_level_tags) ? storedProfile.school_level_tags : [],
    major: storedProfile.major || "",
    grade: storedProfile.grade || "",
    bio: storedProfile.bio || "",
  };
}

function validateMainlandPhone(phone) {
  const normalizedPhone = normalizePhone(phone);
  if (!phonePattern.test(normalizedPhone)) {
    throw new Error("请输入 11 位中国大陆手机号。");
  }

  return normalizedPhone;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = readJson(MOCK_USER_KEY, null);
    setUser(storedUser ? mergeStoredProfile(storedUser) : null);
    setLoading(false);
  }, []);

  const refreshSession = useCallback(async () => {
    const storedUser = readJson(MOCK_USER_KEY, null);
    const currentUser = storedUser ? mergeStoredProfile(storedUser) : null;
    setUser(currentUser);
    setLoading(false);
    return currentUser ? { user: currentUser } : null;
  }, []);

  const updateMockUser = useCallback((updates) => {
    setUser((currentUser) => {
      if (!currentUser) {
        return currentUser;
      }

      const nextUser = {
        ...currentUser,
        ...updates,
        isMock: true,
      };

      writeJson(MOCK_USER_KEY, nextUser);

      if (nextUser.loginType === "phone_mock" && nextUser.phone) {
        const accounts = readJson(MOCK_ACCOUNTS_KEY, {});
        accounts[nextUser.phone] = {
          ...(accounts[nextUser.phone] || {}),
          id: nextUser.id,
          nickname: nextUser.nickname,
          avatar: nextUser.avatar || "",
          school_id: nextUser.school_id || "",
          school_name: nextUser.school_name || "",
          school_level_tags: Array.isArray(nextUser.school_level_tags) ? nextUser.school_level_tags : [],
          createdAt: nextUser.createdAt,
        };
        writeJson(MOCK_ACCOUNTS_KEY, accounts);
      }

      return nextUser;
    });
  }, []);

  const loginWithPhone = useCallback(async (phone) => {
    const normalizedPhone = validateMainlandPhone(phone);
    const accounts = readJson(MOCK_ACCOUNTS_KEY, {});
    const existingAccount = accounts[normalizedPhone];
    const now = new Date().toISOString();
    const account = existingAccount || {
      id: createId(),
      nickname: getAccountNickname(normalizedPhone),
      avatar: "",
      createdAt: now,
    };

    accounts[normalizedPhone] = account;
    writeJson(MOCK_ACCOUNTS_KEY, accounts);

    const nextUser = mergeStoredProfile({
      id: account.id,
      phone: normalizedPhone,
      nickname: account.nickname,
      avatar: account.avatar || "",
      school_id: account.school_id || "",
      school_name: account.school_name || "",
      school_level_tags: Array.isArray(account.school_level_tags) ? account.school_level_tags : [],
      loginType: "phone_mock",
      isMock: true,
      createdAt: account.createdAt || now,
    });

    writeJson(MOCK_USER_KEY, nextUser);
    setUser(nextUser);
    setLoading(false);
    return nextUser;
  }, []);

  const loginAsGuest = useCallback(async () => {
    const now = new Date().toISOString();
    const nextUser = {
      id: `guest_${createId()}`,
      phone: null,
      nickname: "游客体验",
      avatar: "",
      loginType: "guest",
      isMock: true,
      createdAt: now,
    };

    writeJson(MOCK_USER_KEY, nextUser);
    setUser(nextUser);
    setLoading(false);
    return nextUser;
  }, []);

  const signOut = useCallback(async () => {
    removeItem(MOCK_USER_KEY);
    setUser(null);
  }, []);

  const reloadProfile = useCallback(async () => getProfileFromUser(readJson(MOCK_USER_KEY, null)), []);

  const signInWithQQ = useCallback(async () => {
    throw new Error("QQ 登录暂未开放，请使用手机号体验登录。");
  }, []);

  const signInWithWeChat = useCallback(async () => {
    throw new Error("微信登录暂未开放，请使用手机号体验登录。");
  }, []);

  const session = user ? { user } : null;
  const profile = getProfileFromUser(user);

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      isLoggedIn: Boolean(user),
      loginWithPhone,
      loginAsGuest,
      signOut,
      refreshSession,
      reloadProfile,
      updateMockUser,
      signInWithQQ,
      signInWithWeChat,
    }),
    [
      session,
      user,
      profile,
      loading,
      loginWithPhone,
      loginAsGuest,
      signOut,
      refreshSession,
      reloadProfile,
      updateMockUser,
      signInWithQQ,
      signInWithWeChat,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
