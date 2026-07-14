import { supabase, isSupabaseConfigured } from "../lib/supabaseClient.js";

const databaseNotConfiguredMessage =
  "论坛数据库暂未配置，请配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。";

function ensureDatabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(databaseNotConfiguredMessage);
  }
}

export function normalizeForumSearchQuery(query) {
  return String(query || "").trim().slice(0, 50);
}

export async function searchForumPosts({ query = "", category = "全部", limit = 50, offset = 0 } = {}) {
  ensureDatabase();

  const { data, error } = await supabase.rpc("search_forum_posts", {
    p_query: normalizeForumSearchQuery(query),
    p_category: category || "全部",
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  return data || [];
}
