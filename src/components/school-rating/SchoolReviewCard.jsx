import React from "react";
import StarRating from "./StarRating.jsx";
import { formatForumTime, isEdited } from "../forum/forumUtils.js";

export default function SchoolReviewCard({ review, currentUserId, onEditMine, onDeleteMine }) {
  const isMine = currentUserId && currentUserId === review.user_id;
  const userName = review.user_name || "保研用户";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{userName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <StarRating value={review.rating} readOnly size={16} />
            <span>{formatForumTime(review.created_at)}</span>
            {isEdited(review.created_at, review.updated_at) && <span>已编辑</span>}
            {isMine && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-brand-700">我的评价</span>}
          </div>
        </div>
        {isMine && (
          <div className="flex gap-2">
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => onEditMine?.(review)}>
              编辑
            </button>
            <button
              type="button"
              className="btn-secondary border-red-200 px-3 py-1.5 text-xs text-red-600 hover:border-red-300 hover:text-red-700"
              onClick={() => onDeleteMine?.()}
            >
              删除
            </button>
          </div>
        )}
      </div>
      {review.content && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{review.content}</p>}
    </div>
  );
}
