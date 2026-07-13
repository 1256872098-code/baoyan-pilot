import { supabase, isSupabaseConfigured } from "../lib/supabaseClient.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isRealAuthUserId(userId) {
  return uuidPattern.test(String(userId || ""));
}

function normalizeProfile(userId, profile = {}) {
  return {
    id: userId,
    nickname: profile.nickname || "",
    avatar_url: profile.avatar_url || "",
    school_name: profile.school_name || "",
    major: profile.major || "",
    grade: profile.grade || "",
    bio: profile.bio || "",
    verification_status: profile.verification_status || "unverified",
    created_at: profile.created_at || new Date().toISOString(),
    updated_at: profile.updated_at || new Date().toISOString(),
  };
}

function ensureSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase 未配置，请先设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。");
  }
}

function getPublicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

export async function fetchProfile(userId) {
  if (!userId) {
    return null;
  }

  if (!isRealAuthUserId(userId)) {
    return null;
  }

  ensureSupabase();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    throw error;
  }

  return data ? normalizeProfile(userId, data) : null;
}

export async function createProfile(userId, profile) {
  if (!userId) {
    throw new Error("缺少用户 ID，无法创建个人资料。");
  }

  if (!isRealAuthUserId(userId)) {
    throw new Error("需要真实登录账号后才能创建个人资料。");
  }

  ensureSupabase();
  const payload = {
    id: userId,
    nickname: profile.nickname || "保研用户",
    avatar_url: profile.avatar_url || null,
    school_name: profile.school_name || "",
    major: profile.major || "",
    grade: profile.grade || "",
    bio: profile.bio || "",
    verification_status: "unverified",
  };

  const { data, error } = await supabase.from("profiles").insert([payload]).select("*").single();
  if (error) {
    throw error;
  }

  return normalizeProfile(userId, data);
}

export async function updateProfile(userId, profile) {
  if (!userId) {
    throw new Error("缺少用户 ID，无法保存个人资料。");
  }

  const payload = {
    nickname: profile.nickname,
    avatar_url: profile.avatar_url || null,
    school_name: profile.school_name || "",
    major: profile.major || "",
    grade: profile.grade || "",
    bio: profile.bio || "",
  };

  if (!isRealAuthUserId(userId)) {
    throw new Error("需要真实登录账号后才能保存个人资料。");
  }

  ensureSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normalizeProfile(userId, data);
}

export async function uploadAvatar(userId, file) {
  if (!userId) {
    throw new Error("缺少用户 ID，无法上传头像。");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";

  if (!isRealAuthUserId(userId)) {
    throw new Error("需要真实登录账号后才能上传头像。");
  }

  ensureSupabase();
  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return getPublicUrl("avatars", path);
}

export async function uploadVerificationMaterial(userId, file) {
  if (!isRealAuthUserId(userId)) {
    throw new Error("真实账号系统接入后开放院校认证。");
  }

  ensureSupabase();
  const extension = file.name.split(".").pop()?.toLowerCase() || "dat";
  const path = `${userId}/verification-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("school-verification-materials").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return path;
}

export async function submitSchoolVerificationRequest(userId, request) {
  if (!isRealAuthUserId(userId)) {
    throw new Error("真实账号系统接入后开放院校认证。");
  }

  ensureSupabase();
  const { error } = await supabase.from("school_verification_requests").insert([
    {
      user_id: userId,
      school_name: request.school_name,
      major: request.major,
      grade: request.grade,
      verification_method: request.verification_method,
      material_path: request.material_path,
      status: "pending",
    },
  ]);

  if (error) {
    throw error;
  }
}

export async function fetchMyPosts(userId) {
  if (!userId || !isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("forum_posts")
    .select("id,title,category,created_at")
    .eq("author_id", userId);

  if (error) {
    throw error;
  }

  return data || [];
}

export async function fetchMyReplies(userId) {
  if (!userId || !isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("forum_replies")
    .select("id,post_id,created_at")
    .eq("author_id", userId);

  if (error) {
    throw error;
  }

  return data || [];
}
