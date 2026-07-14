import React from "react";
import { ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import InteractionButton from "../forum/InteractionButton.jsx";
import StarRating from "./StarRating.jsx";
import { formatForumTime, getSafeCount } from "../forum/forumUtils.js";

export default function SchoolReviewCard({
  review,
  currentUserId,
  busyKeys,
  onToggleLike,
  onToggleDislike,
  onDeleteMine,
  onRequireLogin,
  highlighted = false,
}) {
  const isMine = currentUserId && currentUserId === review.user_id;
  const userName = review.user_name || "保研用户";
  const likeKey = `school-review-like:${review.id}`;
  const dislikeKey = `school-review-dislike:${review.id}`;
  const voteDisabled = isMine || busyKeys?.has(likeKey) || busyKeys?.has(dislikeKey);

  const handleLike = () => {
    if (!currentUserId) {
      onRequireLogin?.();
      return;
    }
    if (!isMine) onToggleLike?.(review);
  };

  const handleDislike = () => {
    if (!currentUserId) {
      onRequireLogin?.();
      return;
    }
    if (!isMine) onToggleDislike?.(review);
  };

  return (
    <div
      id={`school-review-${review.id}`}
      className={[
        "rounded-lg border p-4 transition-colors",
        highlighted ? "border-brand-300 bg-blue-50 shadow-sm" : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{userName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <StarRating value={review.rating} readOnly size={16} />
            <span>{formatForumTime(review.created_at)}</span>
            {isMine && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-brand-700">我的评价</span>}
          </div>
        </div>
        {isMine && (
          <button
            type="button"
            className="btn-secondary border-red-200 px-3 py-1.5 text-xs text-red-600 hover:border-red-300 hover:text-red-700"
            onClick={() => onDeleteMine?.()}
          >
            <Trash2 size={14} aria-hidden="true" />
            删除
          </button>
        )}
      </div>
      {review.content && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{review.content}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isMine ? (
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-500">
            不能评价自己的内容
          </span>
        ) : (
          <>
            <InteractionButton
              icon={ThumbsUp}
              label="点赞"
              count={getSafeCount(review.likeCount)}
              active={review.likedByCurrentUser}
              disabled={voteDisabled}
              onClick={handleLike}
            />
            <InteractionButton
              icon={ThumbsDown}
              label="点踩"
              count={getSafeCount(review.dislikeCount)}
              active={review.dislikedByCurrentUser}
              activeTone="warning"
              disabled={voteDisabled}
              onClick={handleDislike}
            />
          </>
        )}
      </div>
    </div>
  );
}
