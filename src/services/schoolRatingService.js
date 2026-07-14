import { supabase, isSupabaseConfigured } from "../lib/supabaseClient.js";

const databaseNotConfiguredMessage =
  "学校评价数据库暂未配置，请配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。";
const tableNotReadyMessage = "学校评价功能暂未初始化，请先在 Supabase 执行 supabase/school-ratings.sql。";

function ensureDatabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(databaseNotConfiguredMessage);
  }
}

function getFriendlyError(error, fallback) {
  if (error?.code === "42P01" || /school_reviews/i.test(error?.message || "")) {
    return tableNotReadyMessage;
  }
  return fallback;
}

function createEmptyDistribution() {
  return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
}

function buildSummary(rows = []) {
  const distribution = createEmptyDistribution();
  let total = 0;

  rows.forEach((row) => {
    const rating = Number(row.rating);
    if (rating >= 1 && rating <= 5) {
      distribution[rating] += 1;
      total += rating;
    }
  });

  const reviewCount = rows.length;
  return {
    averageRating: reviewCount ? Number((total / reviewCount).toFixed(1)) : 0,
    reviewCount,
    distribution,
  };
}

export async function fetchSchoolRatingSummaries(schoolIds = []) {
  ensureDatabase();
  const ids = [...new Set((schoolIds || []).filter(Boolean))];
  if (!ids.length) return {};

  const { data, error } = await supabase.from("school_reviews").select("school_id,rating").in("school_id", ids);

  if (error) {
    throw new Error(getFriendlyError(error, "学校评分加载失败，请稍后重试。"));
  }

  const grouped = new Map();
  ids.forEach((id) => grouped.set(id, []));
  (data || []).forEach((row) => {
    grouped.set(row.school_id, [...(grouped.get(row.school_id) || []), row]);
  });

  return Object.fromEntries(ids.map((id) => [id, buildSummary(grouped.get(id) || [])]));
}

export async function fetchSchoolRatingSummary(schoolId) {
  const summaries = await fetchSchoolRatingSummaries([schoolId]);
  return summaries[schoolId] || buildSummary([]);
}

export async function fetchSchoolReviews({ schoolId, sort = "latest", limit = 20, offset = 0 }) {
  ensureDatabase();

  let query = supabase.from("school_reviews").select("*").eq("school_id", schoolId);

  if (sort === "highest") {
    query = query.order("rating", { ascending: false }).order("created_at", { ascending: false });
  } else if (sort === "lowest") {
    query = query.order("rating", { ascending: true }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const { data, error } = await query.range(safeOffset, safeOffset + safeLimit - 1);

  if (error) {
    throw new Error(getFriendlyError(error, "评价列表加载失败，请稍后重试。"));
  }

  return data || [];
}

export async function fetchCurrentUserSchoolReview({ schoolId, userId }) {
  ensureDatabase();
  if (!schoolId || !userId) return null;

  const { data, error } = await supabase
    .from("school_reviews")
    .select("*")
    .eq("school_id", schoolId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(getFriendlyError(error, "你的评价加载失败，请稍后重试。"));
  }

  return data || null;
}

export async function upsertSchoolReview({ schoolId, userId, userName, rating, content = "" }) {
  ensureDatabase();
  const normalizedRating = Number(rating);
  const normalizedContent = String(content || "").trim().slice(0, 500);

  if (!schoolId || !userId) {
    throw new Error("请先登录后再评价学校。");
  }

  if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw new Error("请选择 1 到 5 星评分。");
  }

  const payload = {
    school_id: schoolId,
    user_id: userId,
    user_name: userName || "保研用户",
    rating: normalizedRating,
    content: normalizedContent,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("school_reviews")
    .upsert(payload, { onConflict: "school_id,user_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(getFriendlyError(error, "评价提交失败，请稍后重试。"));
  }

  return data;
}

export async function deleteSchoolReview({ schoolId, userId }) {
  ensureDatabase();
  if (!schoolId || !userId) {
    throw new Error("请先登录后再删除评价。");
  }

  const { error } = await supabase.from("school_reviews").delete().eq("school_id", schoolId).eq("user_id", userId);

  if (error) {
    throw new Error(getFriendlyError(error, "评价删除失败，请稍后重试。"));
  }

  return true;
}
