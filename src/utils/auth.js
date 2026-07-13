export const LOCAL_GUEST_USER_ID = "guest_local";

export function getScopedStorageKey(baseKey, user = null) {
  const userId = user?.id || LOCAL_GUEST_USER_ID;
  return `${baseKey}_${userId}`;
}
