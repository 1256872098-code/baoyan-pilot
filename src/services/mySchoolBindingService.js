import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

function ensureCloudAccount(userId) {
  if (!userId || !isSupabaseConfigured || !supabase) {
    throw new Error("请先登录真实账号后再管理我的院校。");
  }
}

function normalizeBinding(row) {
  if (!row) return null;
  return {
    schoolId: row.school_id || "",
    schoolName: row.school_name || "",
    collegeId: row.college_id || "",
    collegeName: row.college_name || "",
    majorId: row.major_id || "",
    majorName: row.major_name || "",
    major: row.major_name || "",
    grade: row.grade || "",
    graduationYear: row.graduation_year || null,
    updatedAt: row.updated_at || "",
  };
}

export async function fetchMySchoolBinding(userId) {
  ensureCloudAccount(userId);
  const { data, error } = await supabase
    .from("user_school_bindings")
    .select("user_id,school_id,school_name,college_id,college_name,major_id,major_name,grade,graduation_year,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("我的院校加载失败，请稍后重试。");
  return normalizeBinding(data);
}

export async function saveMySchoolBinding(userId, binding) {
  ensureCloudAccount(userId);
  const payload = {
    user_id: userId,
    school_id: binding.schoolId || null,
    school_name: binding.schoolName || "",
    college_id: binding.collegeId || null,
    college_name: binding.collegeName || "",
    major_id: binding.majorId || null,
    major_name: binding.majorName || binding.major || "",
    grade: binding.grade || "",
    graduation_year: binding.graduationYear || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("user_school_bindings")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id,school_id,school_name,college_id,college_name,major_id,major_name,grade,graduation_year,updated_at")
    .single();
  if (error) throw new Error("我的院校保存失败，请稍后重试。");
  return normalizeBinding(data);
}

export async function deleteMySchoolBinding(userId) {
  ensureCloudAccount(userId);
  const { error } = await supabase.from("user_school_bindings").delete().eq("user_id", userId);
  if (error) throw new Error("解除绑定失败，请稍后重试。");
  return true;
}
