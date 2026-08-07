import { supabase } from "../lib/supabaseClient.js";
import {
  getLocalSchoolReviewInteractionStats,
  toggleLocalSchoolReviewInteraction,
} from "./schoolRatingLocalStore.js";
import {
  activateLocalSchoolRatingFallback,
  getSchoolRatingRuntimeStatus,
  isSchoolRatingFallbackError,
  shouldUseLocalSchoolRating,
} from "./schoolRatingRuntime.js";

const loginRequiredMessage = "请先使用手机号体验登录后再操作。";

function ensureUser(userId) {
  if (!userId) {
    throw new Error(loginRequiredMessage);
  }
}

function createEmptyStats(ids) {
  return Object.fromEntries(
    ids.map((id) => [
      id,
      {
        likeCount: 0,
        dislikeCount: 0,
        likedByCurrentUser: false,
        dislikedByCurrentUser: false,
      },
    ]),
  );
}

function increase(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

async function fetchRows(tableName, reviewIds) {
  if (!reviewIds.length) return [];
  const { data, error } = await supabase.from(tableName).select("id,review_id,user_id").in("review_id", reviewIds);
  if (error) throw error;
  return data || [];
}

export async function fetchSchoolReviewInteractionStats(reviewIds = [], userId = "") {
  const ids = [...new Set((reviewIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const loadLocal = () => getLocalSchoolReviewInteractionStats(ids, userId);
  if (shouldUseLocalSchoolRating("interactions") || !supabase) return loadLocal();

  try {
    const [likeRows, dislikeRows] = await Promise.all([
      fetchRows("school_review_likes", ids),
      fetchRows("school_review_dislikes", ids),
    ]);

    const stats = createEmptyStats(ids);
    const likeCounts = new Map();
    const dislikeCounts = new Map();
    const userLiked = new Set();
    const userDisliked = new Set();

    likeRows.forEach((row) => {
      increase(likeCounts, row.review_id);
      if (userId && row.user_id === userId) userLiked.add(row.review_id);
    });

    dislikeRows.forEach((row) => {
      increase(dislikeCounts, row.review_id);
      if (userId && row.user_id === userId) userDisliked.add(row.review_id);
    });

    ids.forEach((id) => {
      stats[id] = {
        likeCount: likeCounts.get(id) || 0,
        dislikeCount: dislikeCounts.get(id) || 0,
        likedByCurrentUser: userLiked.has(id),
        dislikedByCurrentUser: userDisliked.has(id),
      };
    });

    return stats;
  } catch (error) {
    if (isSchoolRatingFallbackError(error)) {
      activateLocalSchoolRatingFallback("interactions", error);
      return loadLocal();
    }
    throw new Error("评价互动数据加载失败，请稍后重试。");
  }
}

async function selectExisting(tableName, reviewId, userId) {
  const { data, error } = await supabase
    .from(tableName)
    .select("id")
    .eq("review_id", reviewId)
    .eq("user_id", userId)
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

async function deleteExisting(tableName, interactionId, userId) {
  if (!interactionId) return;
  const { error } = await supabase.from(tableName).delete().eq("id", interactionId).eq("user_id", userId);
  if (error) throw error;
}

async function insertInteraction(tableName, reviewId, userId) {
  const { error } = await supabase.from(tableName).insert([{ review_id: reviewId, user_id: userId }]);
  if (error && error.code !== "23505") {
    throw error;
  }
}

async function toggleVote({ reviewId, userId, vote }) {
  ensureUser(userId);
  if (!reviewId) throw new Error("评价不存在或已被删除。");
  const toggleLocal = () => toggleLocalSchoolReviewInteraction({ reviewId, userId, vote });
  if (shouldUseLocalSchoolRating("interactions") || !supabase) {
    if (getSchoolRatingRuntimeStatus().usesLocalReviews) return toggleLocal();
    throw new Error("云端评价互动服务暂不可用，请稍后重试。");
  }

  try {
    const [existingLike, existingDislike] = await Promise.all([
      selectExisting("school_review_likes", reviewId, userId),
      selectExisting("school_review_dislikes", reviewId, userId),
    ]);

    if (vote === "like") {
      if (existingLike) {
        await deleteExisting("school_review_likes", existingLike.id, userId);
        if (existingDislike) await deleteExisting("school_review_dislikes", existingDislike.id, userId);
        return { liked: false, disliked: false };
      }

      if (existingDislike) await deleteExisting("school_review_dislikes", existingDislike.id, userId);
      await insertInteraction("school_review_likes", reviewId, userId);
      return { liked: true, disliked: false };
    }

    if (vote === "dislike") {
      if (existingDislike) {
        await deleteExisting("school_review_dislikes", existingDislike.id, userId);
        if (existingLike) await deleteExisting("school_review_likes", existingLike.id, userId);
        return { liked: false, disliked: false };
      }

      if (existingLike) await deleteExisting("school_review_likes", existingLike.id, userId);
      await insertInteraction("school_review_dislikes", reviewId, userId);
      return { liked: false, disliked: true };
    }

    throw new Error("不支持的评价互动类型。");
  } catch (error) {
    if (/不支持/.test(error?.message || "")) throw error;
    if (isSchoolRatingFallbackError(error)) activateLocalSchoolRatingFallback("interactions", error);
    throw new Error("评价互动结果未能确认，请刷新页面核对后再操作。");
  }
}

export async function toggleSchoolReviewLike({ reviewId, userId }) {
  return toggleVote({ reviewId, userId, vote: "like" });
}

export async function toggleSchoolReviewDislike({ reviewId, userId }) {
  return toggleVote({ reviewId, userId, vote: "dislike" });
}
