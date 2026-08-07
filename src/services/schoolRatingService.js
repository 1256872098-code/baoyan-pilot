import { supabase } from "../lib/supabaseClient.js";
import {
  createLocalSchoolReview,
  deleteLocalSchoolReview,
  getLocalCurrentUserSchoolReview,
  getLocalSchoolReviewById,
  getLocalSchoolReviews,
  listLocalSchoolReviews,
} from "./schoolRatingLocalStore.js";
import {
  activateLocalSchoolRatingFallback,
  isSchoolRatingFallbackError,
  shouldUseLocalSchoolRating,
} from "./schoolRatingRuntime.js";

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

function buildLocalSummaries(ids) {
  const reviews = getLocalSchoolReviews();
  return Object.fromEntries(
    ids.map((id) => [id, buildSummary(reviews.filter((review) => review.school_id === id))]),
  );
}

function switchReviewsToLocal(error) {
  activateLocalSchoolRatingFallback("reviews", error);
}

function getServiceError(error, fallback) {
  const status = Number(error?.status || error?.statusCode || 0);
  let serviceError;
  if (status === 401 || status === 403 || error?.code === "42501") {
    serviceError = new Error("学校评价服务权限配置异常，请联系管理员处理。");
  } else {
    serviceError = new Error(fallback);
  }
  serviceError.isSchoolRatingServiceError = true;
  return serviceError;
}

function fallbackRead(error, loadLocal, fallback) {
  if (error?.isSchoolRatingServiceError) throw error;
  if (isSchoolRatingFallbackError(error)) {
    switchReviewsToLocal(error);
    return loadLocal();
  }
  throw getServiceError(error, fallback);
}

function isReviewRpcMissing(error) {
  return ["42883", "PGRST202"].includes(String(error?.code || "")) || /get_school_reviews/i.test(error?.message || "");
}

export async function fetchSchoolRatingSummaries(schoolIds = []) {
  const ids = [...new Set((schoolIds || []).filter(Boolean))];
  if (!ids.length) return {};
  if (shouldUseLocalSchoolRating("reviews") || !supabase) return buildLocalSummaries(ids);

  try {
    const { data, error } = await supabase.from("school_reviews").select("school_id,rating").in("school_id", ids);

    if (error) {
      return fallbackRead(error, () => buildLocalSummaries(ids), "学校评分加载失败，请稍后重试。");
    }
    if (shouldUseLocalSchoolRating("reviews")) return buildLocalSummaries(ids);

    const grouped = new Map();
    ids.forEach((id) => grouped.set(id, []));
    (data || []).forEach((row) => {
      grouped.set(row.school_id, [...(grouped.get(row.school_id) || []), row]);
    });

    return Object.fromEntries(ids.map((id) => [id, buildSummary(grouped.get(id) || [])]));
  } catch (error) {
    return fallbackRead(error, () => buildLocalSummaries(ids), "学校评分加载失败，请稍后重试。");
  }
}

export async function fetchSchoolRatingSummary(schoolId) {
  const summaries = await fetchSchoolRatingSummaries([schoolId]);
  return summaries[schoolId] || buildSummary([]);
}

export async function fetchSchoolReviews({ schoolId, sort = "newest", limit = 20, offset = 0 }) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 50));
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const loadLocal = () => listLocalSchoolReviews({ schoolId, sort, limit: safeLimit, offset: safeOffset });
  if (shouldUseLocalSchoolRating("reviews") || !supabase) return loadLocal();

  const loadDirectly = async () => {
    let query = supabase
      .from("school_reviews")
      .select("id,school_id,user_id,user_name,rating,content,created_at")
      .eq("school_id", schoolId);
    query = query.order("created_at", { ascending: sort === "oldest" });
    const { data, error } = await query.range(safeOffset, safeOffset + safeLimit - 1);
    if (error) return fallbackRead(error, loadLocal, "评价列表加载失败，请稍后重试。");
    if (shouldUseLocalSchoolRating("reviews")) return loadLocal();
    return data || [];
  };

  try {
    const { data, error } = await supabase.rpc("get_school_reviews", {
      p_school_id: schoolId,
      p_sort: sort || "newest",
      p_limit: safeLimit,
      p_offset: safeOffset,
    });

    if (error) {
      if (isReviewRpcMissing(error)) return loadDirectly();
      return fallbackRead(error, loadLocal, "评价列表加载失败，请稍后重试。");
    }
    if (shouldUseLocalSchoolRating("reviews")) return loadLocal();
    return data || [];
  } catch (error) {
    return fallbackRead(error, loadLocal, "评价列表加载失败，请稍后重试。");
  }
}

export async function fetchSchoolReviewById({ schoolId, reviewId }) {
  if (!schoolId || !reviewId) return null;
  const loadLocal = () => getLocalSchoolReviewById({ schoolId, reviewId });
  if (shouldUseLocalSchoolRating("reviews") || !supabase) return loadLocal();

  try {
    const { data, error } = await supabase
      .from("school_reviews")
      .select("id,school_id,user_id,user_name,rating,content,created_at")
      .eq("school_id", schoolId)
      .eq("id", reviewId)
      .maybeSingle();

    if (error) {
      return fallbackRead(error, loadLocal, "评价详情加载失败，请稍后重试。");
    }
    if (shouldUseLocalSchoolRating("reviews")) return loadLocal();
    return data || null;
  } catch (error) {
    return fallbackRead(error, loadLocal, "评价详情加载失败，请稍后重试。");
  }
}

export async function fetchCurrentUserSchoolReview({ schoolId, userId }) {
  if (!schoolId || !userId) return null;
  const loadLocal = () => getLocalCurrentUserSchoolReview({ schoolId, userId });
  if (shouldUseLocalSchoolRating("reviews") || !supabase) return loadLocal();

  try {
    const { data, error } = await supabase
      .from("school_reviews")
      .select("*")
      .eq("school_id", schoolId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return fallbackRead(error, loadLocal, "你的评价加载失败，请稍后重试。");
    }
    if (shouldUseLocalSchoolRating("reviews")) return loadLocal();
    return data || null;
  } catch (error) {
    return fallbackRead(error, loadLocal, "你的评价加载失败，请稍后重试。");
  }
}

export async function createSchoolReview({ schoolId, userId, userName, rating, content = "" }) {
  const normalizedRating = Number(rating);
  const normalizedContent = String(content || "").trim().slice(0, 500);

  if (!schoolId || !userId) {
    throw new Error("请先登录后再评价学校。");
  }

  if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw new Error("请选择 1 到 5 星评分。");
  }

  const createLocal = () =>
    createLocalSchoolReview({
      schoolId,
      userId,
      userName,
      rating: normalizedRating,
      content: normalizedContent,
    });

  if (shouldUseLocalSchoolRating("reviews") || !supabase) return createLocal();

  const existing = await fetchCurrentUserSchoolReview({ schoolId, userId });
  if (existing) {
    throw new Error("你已经评价过该学校。评价发布后不能修改，如需重新评价，请先删除原评价。");
  }
  if (shouldUseLocalSchoolRating("reviews")) return createLocal();

  const payload = {
    school_id: schoolId,
    user_id: userId,
    user_name: userName || "保研用户",
    rating: normalizedRating,
    content: normalizedContent,
  };

  try {
    const { data, error } = await supabase.from("school_reviews").insert([payload]).select("*").single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("你已经评价过该学校。评价发布后不能修改，如需重新评价，请先删除原评价。");
      }
      throw getServiceError(error, "评价提交结果未能确认，请刷新页面核对后再操作。");
    }
    return data;
  } catch (error) {
    if (/已经评价过/.test(error?.message || "")) throw error;
    if (/结果未能确认|权限配置异常/.test(error?.message || "")) throw error;
    throw getServiceError(error, "评价提交结果未能确认，请刷新页面核对后再操作。");
  }
}

export async function deleteSchoolReview({ schoolId, userId }) {
  if (!schoolId || !userId) {
    throw new Error("请先登录后再删除评价。");
  }
  const deleteLocal = () => deleteLocalSchoolReview({ schoolId, userId });
  if (shouldUseLocalSchoolRating("reviews") || !supabase) return deleteLocal();

  try {
    const { error } = await supabase.from("school_reviews").delete().eq("school_id", schoolId).eq("user_id", userId);

    if (error) {
      throw getServiceError(error, "评价删除结果未能确认，请刷新页面核对后再操作。");
    }
    return true;
  } catch (error) {
    if (/结果未能确认|权限配置异常/.test(error?.message || "")) throw error;
    throw getServiceError(error, "评价删除结果未能确认，请刷新页面核对后再操作。");
  }
}
