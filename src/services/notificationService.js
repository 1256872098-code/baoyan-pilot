import { supabase, isSupabaseConfigured } from "../lib/supabaseClient.js";

const databaseNotConfiguredMessage =
  "消息通知数据库暂未配置，请配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。";
const tableNotReadyMessage = "消息通知功能暂未初始化，请先在 Supabase 执行 supabase/user-notifications.sql。";

function ensureDatabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(databaseNotConfiguredMessage);
  }
}

function ensureUserId(userId) {
  if (!userId) {
    throw new Error("请先登录后再查看消息通知。");
  }
}

function getFriendlyError(error, fallback) {
  if (error?.code === "42P01" || /user_notifications/i.test(error?.message || "")) {
    return tableNotReadyMessage;
  }
  return fallback;
}

export async function fetchNotifications({ userId, limit = 30, offset = 0, unreadOnly = false } = {}) {
  ensureDatabase();
  ensureUserId(userId);

  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 50));
  const safeOffset = Math.max(Number(offset) || 0, 0);

  let query = supabase
    .from("user_notifications")
    .select("*")
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(getFriendlyError(error, "消息加载失败，请稍后重试。"));
  }

  return data || [];
}

export async function fetchUnreadNotificationCount(userId) {
  ensureDatabase();
  ensureUserId(userId);

  const { count, error } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new Error(getFriendlyError(error, "未读消息数量加载失败，请稍后重试。"));
  }

  return Math.max(0, count || 0);
}

export async function markNotificationAsRead({ notificationId, userId }) {
  ensureDatabase();
  ensureUserId(userId);
  if (!notificationId) return null;

  const { data, error } = await supabase
    .from("user_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(getFriendlyError(error, "消息标记已读失败，请稍后重试。"));
  }

  return data || null;
}

export async function markAllNotificationsAsRead(userId) {
  ensureDatabase();
  ensureUserId(userId);

  const { error } = await supabase
    .from("user_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new Error(getFriendlyError(error, "全部已读失败，请稍后重试。"));
  }

  return true;
}

export function subscribeToUserNotifications({ userId, onInsert, onUpdate }) {
  ensureDatabase();
  ensureUserId(userId);

  return supabase
    .channel(`user-notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "user_notifications",
        filter: `recipient_user_id=eq.${userId}`,
      },
      (payload) => onInsert?.(payload.new),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "user_notifications",
        filter: `recipient_user_id=eq.${userId}`,
      },
      (payload) => onUpdate?.(payload.new),
    )
    .subscribe();
}

export async function unsubscribeFromUserNotifications(channel) {
  if (!channel || !supabase) return;
  await supabase.removeChannel(channel);
}
