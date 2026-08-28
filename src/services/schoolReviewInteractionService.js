import { supabase } from "../lib/supabaseClient.js";
import {
  getLocalSchoolReviewInteractionStats,
  toggleLocalSchoolReviewInteraction,
} from "./schoolRatingLocalStore.js";
import {
  getSchoolRatingRuntimeStatus,
  isSchoolRatingFeatureAvailable,
  markSchoolRatingRequestFailed,
  markSchoolRatingRequestOk,
  shouldUseLocalSchoolRating,
} from "./schoolRatingRuntime.js";

const loginRequiredMessage = "请先登录账号后再操作。";

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
  let query = supabase.from(tableName).select("id,review_id,user_id");
  query = reviewIds.length ? query.in("review_id", reviewIds) : query.limit(1);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchSchoolReviewInteractionStats(reviewIds = [], userId = "") {
  const ids = [...new Set((reviewIds || []).filter(Boolean))];
  const loadLocal = () => getLocalSchoolReviewInteractionStats(ids, userId);
  if (shouldUseLocalSchoolRating("interactions") || !supabase) return loadLocal();

  const shouldFetchLikes = isSchoolRatingFeatureAvailable("likes");
  const shouldFetchDislikes = isSchoolRatingFeatureAvailable("dislikes");
  const likeRequest = shouldFetchLikes ? fetchRows("school_review_likes", ids) : Promise.resolve([]);
  const dislikeRequest = shouldFetchDislikes ? fetchRows("school_review_dislikes", ids) : Promise.resolve([]);
  const [likeResult, dislikeResult] = await Promise.allSettled([likeRequest, dislikeRequest]);

  const likeRows = likeResult.status === "fulfilled" ? likeResult.value : [];
  const dislikeRows = dislikeResult.status === "fulfilled" ? dislikeResult.value : [];
  if (shouldFetchLikes && likeResult.status === "fulfilled") markSchoolRatingRequestOk("likes");
  else if (shouldFetchLikes) markSchoolRatingRequestFailed("likes", likeResult.reason);
  if (shouldFetchDislikes && dislikeResult.status === "fulfilled") markSchoolRatingRequestOk("dislikes");
  else if (shouldFetchDislikes) markSchoolRatingRequestFailed("dislikes", dislikeResult.reason);

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

  const primaryArea = vote === "like" ? "likes" : "dislikes";
  const primaryTable = vote === "like" ? "school_review_likes" : "school_review_dislikes";
  const otherArea = vote === "like" ? "dislikes" : "likes";
  const otherTable = vote === "like" ? "school_review_dislikes" : "school_review_likes";
  const unavailableMessage = vote === "like" ? "点赞功能暂不可用，请稍后重试。" : "点踩功能暂不可用，请稍后重试。";
  if (!isSchoolRatingFeatureAvailable(primaryArea)) throw new Error(unavailableMessage);

  try {
    const existingPrimary = await selectExisting(primaryTable, reviewId, userId);
    markSchoolRatingRequestOk(primaryArea);

    let existingOther = null;
    if (isSchoolRatingFeatureAvailable(otherArea)) {
      try {
        existingOther = await selectExisting(otherTable, reviewId, userId);
        markSchoolRatingRequestOk(otherArea);
      } catch (otherError) {
        markSchoolRatingRequestFailed(otherArea, otherError);
      }
    }

    if (existingPrimary) {
      await deleteExisting(primaryTable, existingPrimary.id, userId);
      markSchoolRatingRequestOk(primaryArea);
      return { liked: false, disliked: Boolean(existingOther) };
    }

    if (existingOther) {
      try {
        await deleteExisting(otherTable, existingOther.id, userId);
        markSchoolRatingRequestOk(otherArea);
        existingOther = null;
      } catch (otherError) {
        // A secondary feature failure must not disable the primary vote.
        markSchoolRatingRequestFailed(otherArea, otherError);
      }
    }

    await insertInteraction(primaryTable, reviewId, userId);
    markSchoolRatingRequestOk(primaryArea);
    return vote === "like"
      ? { liked: true, disliked: Boolean(existingOther) }
      : { liked: Boolean(existingOther), disliked: true };
  } catch (error) {
    markSchoolRatingRequestFailed(primaryArea, error);
    throw new Error(unavailableMessage);
  }
}

export async function toggleSchoolReviewLike({ reviewId, userId }) {
  return toggleVote({ reviewId, userId, vote: "like" });
}

export async function toggleSchoolReviewDislike({ reviewId, userId }) {
  return toggleVote({ reviewId, userId, vote: "dislike" });
}
