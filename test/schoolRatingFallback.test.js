import assert from "node:assert/strict";
import test from "node:test";
import {
  createSchoolReview,
  deleteSchoolReview,
  fetchCurrentUserSchoolReview,
  fetchSchoolRatingSummary,
  fetchSchoolReviews,
} from "../src/services/schoolRatingService.js";
import {
  fetchSchoolReviewInteractionStats,
  toggleSchoolReviewDislike,
  toggleSchoolReviewLike,
} from "../src/services/schoolReviewInteractionService.js";
import { resetLocalSchoolRatingStoreForTests } from "../src/services/schoolRatingLocalStore.js";
import {
  getSchoolRatingRuntimeStatus,
  isSchoolRatingFallbackError,
} from "../src/services/schoolRatingRuntime.js";

const schoolId = "school-rating-fallback-test";

test.beforeEach(() => {
  resetLocalSchoolRatingStoreForTests();
});

test("未配置或不可用的云端评分服务会切换到本地模式并保持评分 CRUD 可用", async () => {
  assert.equal(getSchoolRatingRuntimeStatus().usesLocalReviews, true);

  const first = await createSchoolReview({
    schoolId,
    userId: "user-a",
    userName: "用户A",
    rating: 5,
    content: "课程体验很好",
  });
  const second = await createSchoolReview({
    schoolId,
    userId: "user-b",
    userName: "用户B",
    rating: 3,
    content: "信息公开程度一般",
  });
  assert.equal(first.storage_scope, "local");
  assert.equal(second.storage_scope, "local");

  const summary = await fetchSchoolRatingSummary(schoolId);
  assert.equal(summary.reviewCount, 2);
  assert.equal(summary.averageRating, 4);
  assert.equal(summary.distribution[5], 1);
  assert.equal(summary.distribution[3], 1);

  const reviews = await fetchSchoolReviews({ schoolId, sort: "newest" });
  assert.deepEqual(new Set(reviews.map((review) => review.id)), new Set([first.id, second.id]));
  assert.equal((await fetchCurrentUserSchoolReview({ schoolId, userId: "user-a" }))?.id, first.id);

  await assert.rejects(
    createSchoolReview({ schoolId, userId: "user-a", userName: "用户A", rating: 4 }),
    /已经评价过/,
  );

  await deleteSchoolReview({ schoolId, userId: "user-a" });
  assert.equal((await fetchSchoolRatingSummary(schoolId)).reviewCount, 1);
  assert.equal(await fetchCurrentUserSchoolReview({ schoolId, userId: "user-a" }), null);
});

test("本地模式下点赞与点踩互斥并能正确汇总", async () => {
  const review = await createSchoolReview({
    schoolId,
    userId: "author",
    userName: "作者",
    rating: 4,
    content: "测试评价",
  });

  assert.deepEqual(await toggleSchoolReviewLike({ reviewId: review.id, userId: "reader" }), {
    liked: true,
    disliked: false,
  });
  let stats = await fetchSchoolReviewInteractionStats([review.id], "reader");
  assert.equal(stats[review.id].likeCount, 1);
  assert.equal(stats[review.id].dislikeCount, 0);
  assert.equal(stats[review.id].likedByCurrentUser, true);

  assert.deepEqual(await toggleSchoolReviewDislike({ reviewId: review.id, userId: "reader" }), {
    liked: false,
    disliked: true,
  });
  stats = await fetchSchoolReviewInteractionStats([review.id], "reader");
  assert.equal(stats[review.id].likeCount, 0);
  assert.equal(stats[review.id].dislikeCount, 1);
  assert.equal(stats[review.id].dislikedByCurrentUser, true);

  const [listedReview] = await fetchSchoolReviews({ schoolId, sort: "most-liked" });
  assert.equal(listedReview.like_count, 0);
  assert.equal(listedReview.dislike_count, 1);
});

test("只有网络、服务端和缺表类故障允许读操作进入本地降级", () => {
  assert.equal(isSchoolRatingFallbackError({ message: "TypeError: fetch failed", details: "getaddrinfo ENOTFOUND" }), true);
  assert.equal(isSchoolRatingFallbackError({ code: "42P01", message: "relation does not exist" }), true);
  assert.equal(isSchoolRatingFallbackError({ code: "PGRST202", message: "function not found" }), true);
  assert.equal(isSchoolRatingFallbackError({ status: 503, message: "service unavailable" }), true);
  assert.equal(isSchoolRatingFallbackError({ status: 401, message: "invalid api key" }), false);
  assert.equal(isSchoolRatingFallbackError({ code: "42501", message: "permission denied" }), false);
  assert.equal(isSchoolRatingFallbackError({ status: 400, message: "invalid query" }), false);
});
