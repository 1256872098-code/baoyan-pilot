import React from "react";
import SchoolReviewCard from "./SchoolReviewCard.jsx";

const sortOptions = [
  { value: "newest", label: "最新发布" },
  { value: "oldest", label: "最早发布" },
  { value: "most-liked", label: "点赞最多" },
];

export default function SchoolReviewList({
  reviews,
  sort,
  onSortChange,
  currentUserId,
  loading,
  highlightReviewId = "",
  onDeleteMine,
  busyKeys,
  onToggleLike,
  onToggleDislike,
  onRequireLogin,
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-bold text-slate-950">评价列表</h3>
        <select
          className="field-control h-10 w-full sm:w-36"
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">正在加载评价...</p>
      ) : reviews.length ? (
        <div className="mt-4 space-y-3">
          {reviews.map((review) => (
            <SchoolReviewCard
              key={review.id}
              review={review}
              currentUserId={currentUserId}
              highlighted={highlightReviewId === review.id}
              onDeleteMine={onDeleteMine}
              busyKeys={busyKeys}
              onToggleLike={onToggleLike}
              onToggleDislike={onToggleDislike}
              onRequireLogin={onRequireLogin}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          暂时还没有评价，登录后可以发布第一条评价。
        </p>
      )}
    </div>
  );
}
