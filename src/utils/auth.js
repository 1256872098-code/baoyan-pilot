const USER_STORAGE_KEY = "baoyanpilot_user";
export const AUTH_CHANGED_EVENT = "baoyanpilot_auth_changed";
export const LOCAL_GUEST_USER_ID = "guest_local";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function createRandomId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function emitAuthChanged(user) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_CHANGED_EVENT, {
      detail: { user },
    }),
  );
}

function normalizeUser(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (!value.id || !value.nickname || !value.loginType || !value.createdAt) {
    return null;
  }

  return {
    id: String(value.id),
    nickname: String(value.nickname),
    loginType: value.loginType,
    phone: value.phone ? String(value.phone) : undefined,
    createdAt: String(value.createdAt),
  };
}

function maskPhone(phone) {
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export function getCurrentUser() {
  if (!canUseStorage()) {
    return null;
  }

  try {
    return normalizeUser(JSON.parse(window.localStorage.getItem(USER_STORAGE_KEY)));
  } catch {
    return null;
  }
}

export function loginWithPhone(phone) {
  const normalizedPhone = String(phone || "").replace(/\D/g, "");
  const now = new Date().toISOString();
  const user = {
    id: `phone_${normalizedPhone}`,
    nickname: `手机用户 ${maskPhone(normalizedPhone)}`,
    loginType: "phone",
    phone: normalizedPhone,
    createdAt: now,
  };

  // TODO: replace mock phone login with real SMS OTP provider
  if (canUseStorage()) {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
  emitAuthChanged(user);
  return user;
}

export function loginAsGuest() {
  const now = new Date().toISOString();
  const user = {
    id: createRandomId("guest"),
    nickname: "游客体验",
    loginType: "guest",
    createdAt: now,
  };

  if (canUseStorage()) {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
  emitAuthChanged(user);
  return user;
}

export function logout() {
  if (canUseStorage()) {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }
  emitAuthChanged(null);
}

export function getUserStorageKey(baseKey, user = getCurrentUser()) {
  const userId = user?.id || LOCAL_GUEST_USER_ID;
  return `${baseKey}_${userId}`;
}

// TODO: move user and chat data from localStorage to database
