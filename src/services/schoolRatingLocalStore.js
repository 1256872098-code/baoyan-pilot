const reviewsStorageKey = "baoyanpilot_school_reviews_v1";
const interactionsStorageKey = "baoyanpilot_school_review_interactions_v1";

let memoryReviews = [];
let memoryInteractions = {};

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function readJson(key, fallback) {
  const storage = getBrowserStorage();
  if (!storage) return fallback;
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  const storage = getBrowserStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function readReviews() {
  const stored = readJson(reviewsStorageKey, null);
  if (Array.isArray(stored)) return stored;
  return memoryReviews;
}

function writeReviews(reviews) {
  if (typeof window !== "undefined" && !writeJson(reviewsStorageKey, reviews)) {
    throw new Error("浏览器阻止了本地存储，评价未保存。请允许网站存储后重试。");
  }
  memoryReviews = reviews;
}

function readInteractions() {
  const stored = readJson(interactionsStorageKey, null);
  if (stored && typeof stored === "object" && !Array.isArray(stored)) return stored;
  return memoryInteractions;
}

function writeInteractions(interactions) {
  if (typeof window !== "undefined" && !writeJson(interactionsStorageKey, interactions)) {
    throw new Error("浏览器阻止了本地存储，互动操作未保存。请允许网站存储后重试。");
  }
  memoryInteractions = interactions;
}

function createReviewId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getVoteCounts(reviewId, interactions = readInteractions()) {
  const votes = Object.values(interactions[reviewId] || {});
  return {
    likeCount: votes.filter((vote) => vote === "like").length,
    dislikeCount: votes.filter((vote) => vote === "dislike").length,
  };
}

export function getLocalSchoolReviews() {
  return readReviews().map((review) => ({ ...review }));
}

export function getLocalSchoolReviewById({ schoolId, reviewId }) {
  return (
    readReviews().find((review) => review.id === reviewId && (!schoolId || review.school_id === schoolId)) ||
    null
  );
}

export function getLocalCurrentUserSchoolReview({ schoolId, userId }) {
  return readReviews().find((review) => review.school_id === schoolId && review.user_id === userId) || null;
}

export function listLocalSchoolReviews({ schoolId, sort = "newest", limit = 20, offset = 0 }) {
  const interactions = readInteractions();
  const rows = readReviews()
    .filter((review) => review.school_id === schoolId)
    .map((review) => {
      const counts = getVoteCounts(review.id, interactions);
      return { ...review, like_count: counts.likeCount, dislike_count: counts.dislikeCount };
    });

  rows.sort((a, b) => {
    if (sort === "oldest") return String(a.created_at).localeCompare(String(b.created_at));
    if (sort === "most-liked") {
      const likeDiff = Number(b.like_count || 0) - Number(a.like_count || 0);
      if (likeDiff) return likeDiff;
    }
    return String(b.created_at).localeCompare(String(a.created_at));
  });

  return rows.slice(offset, offset + limit);
}

export function createLocalSchoolReview({ schoolId, userId, userName, rating, content }) {
  const reviews = readReviews();
  if (reviews.some((review) => review.school_id === schoolId && review.user_id === userId)) {
    throw new Error("你已经评价过该学校。评价发布后不能修改，如需重新评价，请先删除原评价。");
  }

  const timestamp = new Date().toISOString();
  const review = {
    id: createReviewId(),
    school_id: schoolId,
    user_id: userId,
    user_name: userName || "保研用户",
    rating,
    content: content || "",
    created_at: timestamp,
    updated_at: timestamp,
    storage_scope: "local",
  };
  writeReviews([review, ...reviews]);
  return { ...review };
}

export function deleteLocalSchoolReview({ schoolId, userId }) {
  const reviews = readReviews();
  const removedIds = reviews
    .filter((review) => review.school_id === schoolId && review.user_id === userId)
    .map((review) => review.id);
  writeReviews(reviews.filter((review) => !removedIds.includes(review.id)));

  if (removedIds.length) {
    const interactions = { ...readInteractions() };
    removedIds.forEach((reviewId) => delete interactions[reviewId]);
    writeInteractions(interactions);
  }
  return true;
}

export function getLocalSchoolReviewInteractionStats(reviewIds = [], userId = "") {
  const interactions = readInteractions();
  return Object.fromEntries(
    reviewIds.map((reviewId) => {
      const votes = interactions[reviewId] || {};
      const counts = getVoteCounts(reviewId, interactions);
      return [
        reviewId,
        {
          likeCount: counts.likeCount,
          dislikeCount: counts.dislikeCount,
          likedByCurrentUser: votes[userId] === "like",
          dislikedByCurrentUser: votes[userId] === "dislike",
        },
      ];
    }),
  );
}

export function toggleLocalSchoolReviewInteraction({ reviewId, userId, vote }) {
  const interactions = { ...readInteractions() };
  const reviewVotes = { ...(interactions[reviewId] || {}) };
  reviewVotes[userId] = reviewVotes[userId] === vote ? undefined : vote;
  if (reviewVotes[userId] === undefined) delete reviewVotes[userId];

  if (Object.keys(reviewVotes).length) interactions[reviewId] = reviewVotes;
  else delete interactions[reviewId];
  writeInteractions(interactions);

  return {
    liked: reviewVotes[userId] === "like",
    disliked: reviewVotes[userId] === "dislike",
  };
}

export function resetLocalSchoolRatingStoreForTests() {
  memoryReviews = [];
  memoryInteractions = {};
  const storage = getBrowserStorage();
  try {
    storage?.removeItem(reviewsStorageKey);
    storage?.removeItem(interactionsStorageKey);
  } catch {
    // Tests and privacy-restricted browsers may not expose writable storage.
  }
}
