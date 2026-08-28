import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

function ensureSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase 账号服务暂未配置。");
}

export async function fetchProfile(userId) {
  if (!userId) return null;
  ensureSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nickname,avatar_url,bio,created_at,updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function createProfile(userId, profile = {}) {
  if (!userId) throw new Error("请先登录后再创建个人资料。");
  ensureSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      nickname: profile.nickname || "保研用户",
      avatar_url: profile.avatar_url || null,
      bio: profile.bio || "",
    }, { onConflict: "id" })
    .select("id,nickname,avatar_url,bio,created_at,updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, profile = {}) {
  return createProfile(userId, profile);
}

export async function uploadAvatar(userId, file) {
  if (!userId) throw new Error("请先登录后再上传头像。");
  ensureSupabase();
  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw new Error("头像上传失败，请稍后重试。");
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl || "";
}

export async function fetchMyPosts(userId) {
  if (!userId || !isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("forum_posts")
    .select("id,title,category,created_at")
    .eq("author_id", userId);
  if (error) throw error;
  return data || [];
}

export async function fetchMyReplies(userId) {
  if (!userId || !isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("forum_replies")
    .select("id,post_id,created_at")
    .eq("author_id", userId);
  if (error) throw error;
  return data || [];
}
