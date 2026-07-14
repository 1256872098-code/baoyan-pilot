import React, { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "../Card.jsx";
import LoginModal from "../LoginModal.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  deleteSchoolReview,
  fetchCurrentUserSchoolReview,
  fetchSchoolRatingSummary,
  fetchSchoolReviews,
  upsertSchoolReview,
} from "../../services/schoolRatingService.js";
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
  const { user } = useAuth();
  const [summary, setSummary] = useState(emptySummary);
  const [reviews, setReviews] = useState([]);
  const [currentReview, setCurrentReview] = useState(null);
  const [sort, setSort] = useState("latest");
  const [loading, setLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);

  const canWrite = Boolean(user && user.loginType === "phone_mock");
  const currentUserId = canWrite ? user.id : "";

  const loadSummaryAndMine = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setErrorMessage("");

    try {
      const [nextSummary, mine] = await Promise.all([
        fetchSchoolRatingSummary(schoolId),
        currentUserId ? fetchCurrentUserSchoolReview({ schoolId, userId: currentUserId }) : Promise.resolve(null),
      ]);
      setSummary(nextSummary);
      setCurrentReview(mine);
    } catch (error) {
      setErrorMessage(error?.message || "学校评价加载失败，请稍后重试。");
      setSummary(emptySummary);
      setCurrentReview(null);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, schoolId]);

  const loadReviews = useCallback(async () => {
    if (!schoolId) return;
    setReviewsLoading(true);

    try {
      setReviews(await fetchSchoolReviews({ schoolId, sort, limit: 20, offset: 0 }));
    } catch (error) {
      setErrorMessage(error?.message || "评价列表加载失败，请稍后重试。");
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [schoolId, sort]);

  useEffect(() => {
    loadSummaryAndMine();
  }, [loadSummaryAndMine]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const refreshAll = async () => {
    await Promise.all([loadSummaryAndMine(), loadReviews()]);
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
      await upsertSchoolReview({
        schoolId,
        userId: user.id,
        userName: getUserName(user),
        rating,
        content,
      });
      setMessage("学校评价已保存。");
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

    if (!window.confirm("确定删除你的学校评价吗？删除后可以重新发布。")) {
      return;
    }

    setDeleting(true);
    setMessage("");
    setErrorMessage("");

    try {
      await deleteSchoolReview({ schoolId, userId: user.id });
      setMessage("学校评价已删除。");
      await refreshAll();
    } catch (error) {
      setErrorMessage(error?.message || "评价删除失败，请稍后重试。");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditFromList = (review) => {
    setCurrentReview(review);
    setMessage("可在上方表单修改你的评价。");
  };

  return (
    <Card className={compact ? "p-5" : "p-6"}>
      <CardHeader
        eyebrow="用户评价"
        title="学校评价"
        description={`评分来自用户主观体验，仅供参考，不代表${schoolName || "学校"}官方评价或推免结果。`}
      />

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
          onEditMine={handleEditFromList}
          onDeleteMine={handleDelete}
        />
      </div>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </Card>
  );
}
