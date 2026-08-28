import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardHeader } from "../Card.jsx";
import LoginModal from "../LoginModal.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  createSchoolReview,
  deleteSchoolReview,
  fetchCurrentUserSchoolReview,
  fetchSchoolRatingSummary,
  fetchSchoolReviewById,
  fetchSchoolReviews,
} from "../../services/schoolRatingService.js";
import {
  fetchSchoolReviewInteractionStats,
  toggleSchoolReviewDislike,
  toggleSchoolReviewLike,
} from "../../services/schoolReviewInteractionService.js";
import {
  getSchoolRatingRuntimeStatus,
  resetSchoolRatingRuntime,
} from "../../services/schoolRatingRuntime.js";
import { getSafeCount } from "../forum/forumUtils.js";
import SchoolRatingForm from "./SchoolRatingForm.jsx";
import SchoolRatingSummary from "./SchoolRatingSummary.jsx";
import SchoolReviewList from "./SchoolReviewList.jsx";

const emptySummary = {
  averageRating: 0,
  reviewCount: 0,
  distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
};

function getUserName(user) {
  if (!user) return "保研用户";
  if (user.nickname) return user.nickname;
  if (user.phone) return `手机用户 ${user.phone.slice(0, 3)}****${user.phone.slice(-4)}`;
  return "保研用户";
}

export default function SchoolRatingSection({ schoolId, schoolName, compact = false }) {
  const { user, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const sectionRef = useRef(null);
  const [summary, setSummary] = useState(emptySummary);
  const [reviews, setReviews] = useState([]);
  const [currentReview, setCurrentReview] = useState(null);
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyKeys, setBusyKeys] = useState(() => new Set());
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [highlightReviewId, setHighlightReviewId] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState(() => getSchoolRatingRuntimeStatus());

  const canWrite = Boolean(isAuthenticated && user?.id);
  const currentUserId = canWrite ? user.id : "";
  const shouldFocusReviews = searchParams.get("section") === "reviews";
  const targetReviewId = shouldFocusReviews ? searchParams.get("review") || "" : "";

  const setBusy = (key, value) => {
    setBusyKeys((current) => {
      const next = new Set(current);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const syncRuntimeStatus = useCallback(() => {
    setRuntimeStatus(getSchoolRatingRuntimeStatus());
  }, []);

  const loadSummaryAndMine = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setErrorMessage("");

    try {
      const [summaryResult, mineResult] = await Promise.allSettled([
        fetchSchoolRatingSummary(schoolId),
        currentUserId ? fetchCurrentUserSchoolReview({ schoolId, userId: currentUserId }) : Promise.resolve(null),
      ]);
      if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
      else {
        setSummary(emptySummary);
        setErrorMessage(summaryResult.reason?.message || "学校评分加载失败，请稍后重试。");
      }
      if (mineResult.status === "fulfilled") setCurrentReview(mineResult.value);
      else {
        setCurrentReview(null);
        if (summaryResult.status === "fulfilled") {
          setErrorMessage(mineResult.reason?.message || "你的评价加载失败，请稍后重试。");
        }
      }
    } catch (error) {
      setErrorMessage(error?.message || "学校评价加载失败，请稍后重试。");
      setSummary(emptySummary);
      setCurrentReview(null);
    } finally {
      setLoading(false);
      syncRuntimeStatus();
    }
  }, [currentUserId, schoolId, syncRuntimeStatus]);

  const loadReviews = useCallback(async () => {
    if (!schoolId) return;
    setReviewsLoading(true);

    try {
      let nextReviews = await fetchSchoolReviews({ schoolId, sort, limit: 20, offset: 0 });
      if (targetReviewId && !nextReviews.some((review) => review.id === targetReviewId)) {
        const targetReview = await fetchSchoolReviewById({ schoolId, reviewId: targetReviewId });
        if (targetReview) {
          nextReviews = [targetReview, ...nextReviews];
        }
      }
      const reviewIds = nextReviews.map((review) => review.id);
      let interactionStats = {};
      try {
        interactionStats = await fetchSchoolReviewInteractionStats(reviewIds, currentUserId);
      } catch (statsError) {
        if (typeof import.meta.env !== "undefined" && import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn("[SchoolRating] interaction stats: failed", {
            code: statsError?.code || statsError?.name || "unknown",
            message: statsError?.message || "Unknown error",
          });
        }
      }
      const nextRuntimeStatus = getSchoolRatingRuntimeStatus();
      const useLocalInteractionCounts = nextRuntimeStatus.usesLocalReviews && nextRuntimeStatus.usesLocalInteractions;
      const mergedReviews = nextReviews.map((review) => ({
          ...review,
          likeCount: getSafeCount(
            useLocalInteractionCounts || nextRuntimeStatus.likesAvailable
              ? review.like_count ?? interactionStats[review.id]?.likeCount
              : review.like_count,
          ),
          dislikeCount: getSafeCount(
            useLocalInteractionCounts || nextRuntimeStatus.dislikesAvailable
              ? review.dislike_count ?? interactionStats[review.id]?.dislikeCount
              : review.dislike_count,
          ),
          likedByCurrentUser: Boolean(nextRuntimeStatus.likesAvailable && interactionStats[review.id]?.likedByCurrentUser),
          dislikedByCurrentUser: Boolean(nextRuntimeStatus.dislikesAvailable && interactionStats[review.id]?.dislikedByCurrentUser),
        }));
      if (sort === "most-liked") {
        mergedReviews.sort((a, b) => b.likeCount - a.likeCount || String(b.created_at).localeCompare(String(a.created_at)));
      }
      setReviews(mergedReviews);
    } catch (error) {
      setErrorMessage(error?.message || "评价列表加载失败，请稍后重试。");
      setReviews([]);
    } finally {
      setReviewsLoading(false);
      syncRuntimeStatus();
    }
  }, [currentUserId, schoolId, sort, syncRuntimeStatus, targetReviewId]);

  useEffect(() => {
    loadSummaryAndMine();
  }, [loadSummaryAndMine]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    if (!shouldFocusReviews) return undefined;
    const timer = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [shouldFocusReviews, schoolId]);

  useEffect(() => {
    if (!targetReviewId || reviewsLoading) return undefined;

    const targetReview = reviews.find((review) => review.id === targetReviewId);
    if (!targetReview) {
      setErrorMessage("原内容可能已经被删除或无法查看。");
      return undefined;
    }

    const scrollTimer = window.setTimeout(() => {
      const element = document.getElementById(`school-review-${targetReviewId}`);
      if (!element) {
        setErrorMessage("原内容可能已经被删除或无法查看。");
        return;
      }
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightReviewId(targetReviewId);
    }, 180);

    const clearTimer = window.setTimeout(() => setHighlightReviewId(""), 2400);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [reviews, reviewsLoading, targetReviewId]);

  const refreshAll = async () => {
    await Promise.allSettled([loadSummaryAndMine(), loadReviews()]);
  };

  const handleRetryCloud = async () => {
    resetSchoolRatingRuntime();
    syncRuntimeStatus();
    setErrorMessage("");
    setMessage("");
    await refreshAll();
  };

  const handleRequireLogin = () => {
    setLoginOpen(true);
  };

  const handleSubmit = async ({ rating, content }) => {
    if (!canWrite) {
      handleRequireLogin();
      return;
    }

    setSubmitting(true);
    setMessage("");
    setErrorMessage("");

    try {
      await createSchoolReview({
        schoolId,
        userId: user.id,
        userName: getUserName(user),
        rating,
        content,
      });
      syncRuntimeStatus();
      setMessage(
        getSchoolRatingRuntimeStatus().usesLocalReviews
          ? "评价已保存在当前浏览器，不会自动上传到云端或同步到其他设备。"
          : "学校评价已发布。",
      );
      await refreshAll();
    } catch (error) {
      setErrorMessage(error?.message || "评价提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canWrite) {
      handleRequireLogin();
      return;
    }

    if (!window.confirm("删除后该评价及其点赞、点踩数据将无法恢复。确定删除吗？")) {
      return;
    }

    setDeleting(true);
    setMessage("");
    setErrorMessage("");

    try {
      await deleteSchoolReview({ schoolId, userId: user.id });
      syncRuntimeStatus();
      setMessage(getSchoolRatingRuntimeStatus().usesLocalReviews ? "已删除当前浏览器中保存的评价。" : "学校评价已删除。");
      await refreshAll();
    } catch (error) {
      setErrorMessage(error?.message || "评价删除失败，请稍后重试。");
    } finally {
      setDeleting(false);
    }
  };

  const applyReviewVoteState = (reviewId, nextVoteState) => {
    setReviews((currentReviews) =>
      currentReviews.map((review) => {
        if (review.id !== reviewId) return review;
        const nextLiked = Boolean(nextVoteState.liked);
        const nextDisliked = Boolean(nextVoteState.disliked);
        const likeDelta = nextLiked === Boolean(review.likedByCurrentUser) ? 0 : nextLiked ? 1 : -1;
        const dislikeDelta = nextDisliked === Boolean(review.dislikedByCurrentUser) ? 0 : nextDisliked ? 1 : -1;
        return {
          ...review,
          likedByCurrentUser: nextLiked,
          dislikedByCurrentUser: nextDisliked,
          likeCount: Math.max(0, getSafeCount(review.likeCount) + likeDelta),
          dislikeCount: Math.max(0, getSafeCount(review.dislikeCount) + dislikeDelta),
        };
      }),
    );
  };

  const handleToggleLike = async (review) => {
    if (!canWrite) {
      handleRequireLogin();
      return;
    }
    if (review.user_id === user.id) return;

    const key = `school-review-like:${review.id}`;
    if (busyKeys.has(key) || busyKeys.has(`school-review-dislike:${review.id}`)) return;

    const oldState = {
      liked: review.likedByCurrentUser,
      disliked: review.dislikedByCurrentUser,
    };
    const optimisticState = review.likedByCurrentUser
      ? { liked: false, disliked: false }
      : { liked: true, disliked: false };

    setBusy(key, true);
    setErrorMessage("");
    applyReviewVoteState(review.id, optimisticState);

    try {
      const result = await toggleSchoolReviewLike({ reviewId: review.id, userId: user.id });
      applyReviewVoteState(review.id, result);
      if (sort === "most-liked") await loadReviews();
    } catch (error) {
      applyReviewVoteState(review.id, oldState);
      setErrorMessage(error?.message || "点赞操作失败，请稍后重试。");
    } finally {
      setBusy(key, false);
      syncRuntimeStatus();
    }
  };

  const handleToggleDislike = async (review) => {
    if (!canWrite) {
      handleRequireLogin();
      return;
    }
    if (review.user_id === user.id) return;

    const key = `school-review-dislike:${review.id}`;
    if (busyKeys.has(key) || busyKeys.has(`school-review-like:${review.id}`)) return;

    const oldState = {
      liked: review.likedByCurrentUser,
      disliked: review.dislikedByCurrentUser,
    };
    const optimisticState = review.dislikedByCurrentUser
      ? { liked: false, disliked: false }
      : { liked: false, disliked: true };

    setBusy(key, true);
    setErrorMessage("");
    applyReviewVoteState(review.id, optimisticState);

    try {
      const result = await toggleSchoolReviewDislike({ reviewId: review.id, userId: user.id });
      applyReviewVoteState(review.id, result);
    } catch (error) {
      applyReviewVoteState(review.id, oldState);
      setErrorMessage(error?.message || "点踩操作失败，请稍后重试。");
    } finally {
      setBusy(key, false);
      syncRuntimeStatus();
    }
  };

  return (
    <div ref={sectionRef} id="school-rating-section">
      <Card className={compact ? "p-5" : "p-6"}>
        <CardHeader
          eyebrow="用户评价"
          title="学校评价"
          description={`评分来自用户主观体验，仅供参考，不代表${schoolName || "学校"}官方评价或推免结果。`}
        />

        {(runtimeStatus.usesLocalReviews || !runtimeStatus.likesAvailable || !runtimeStatus.dislikesAvailable) && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {runtimeStatus.usesLocalReviews
                ? "云端评分服务当前不可用，已切换为本机体验模式。本机评价不会自动上传到云端，也不会同步到其他设备或用户。"
                : !runtimeStatus.likesAvailable && !runtimeStatus.dislikesAvailable
                  ? "云端点赞和点踩服务当前不可用；已有云端评价仍可正常查看和发布。"
                  : !runtimeStatus.likesAvailable
                    ? "云端点赞服务当前不可用，点赞已暂停；评价和点踩功能仍可正常使用。"
                    : "云端点踩服务当前不可用，点踩已暂停；评价和点赞功能仍可正常使用。"}
            </span>
            <button
              type="button"
              className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
              onClick={handleRetryCloud}
              disabled={loading || reviewsLoading}
            >
              重试云端服务
            </button>
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mt-5">
          {loading ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              正在加载学校评分...
            </p>
          ) : (
            <SchoolRatingSummary summary={summary} />
          )}
        </div>

        <div className="mt-5">
          <SchoolRatingForm
            currentReview={currentReview}
            submitting={submitting}
            deleting={deleting}
            canWrite={canWrite}
            onRequireLogin={handleRequireLogin}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
          />
        </div>

        <div className="mt-5">
          <SchoolReviewList
            reviews={reviews}
            sort={sort}
            onSortChange={setSort}
            currentUserId={currentUserId}
            loading={reviewsLoading}
            highlightReviewId={highlightReviewId}
            onDeleteMine={handleDelete}
            busyKeys={busyKeys}
            onToggleLike={handleToggleLike}
            onToggleDislike={handleToggleDislike}
            onRequireLogin={handleRequireLogin}
            likeDisabled={!runtimeStatus.usesLocalReviews && !runtimeStatus.likesAvailable}
            dislikeDisabled={!runtimeStatus.usesLocalReviews && !runtimeStatus.dislikesAvailable}
          />
        </div>

        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      </Card>
    </div>
  );
}
