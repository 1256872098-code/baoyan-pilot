import React from "react";
import StarRating from "./StarRating.jsx";

const ratings = [5, 4, 3, 2, 1];

export default function SchoolRatingSummary({ summary }) {
  const reviewCount = summary?.reviewCount || 0;
  const averageRating = summary?.averageRating || 0;
  const distribution = summary?.distribution || {};

  if (!reviewCount) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
        暂时还没有评价，登录后可以发布第一条评价。
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-5 text-center">
        <p className="text-4xl font-bold text-slate-950">{averageRating.toFixed(1)}</p>
        <div className="mt-2 flex justify-center">
          <StarRating value={averageRating} readOnly />
        </div>
        <p className="mt-2 text-sm font-semibold text-brand-700">{reviewCount} 人评价</p>
      </div>

      <div className="space-y-2">
        {ratings.map((rating) => {
          const count = distribution[rating] || 0;
          const percent = reviewCount ? Math.round((count / reviewCount) * 100) : 0;
          return (
            <div key={rating} className="grid grid-cols-[42px_minmax(0,1fr)_44px] items-center gap-3 text-sm">
              <span className="font-semibold text-slate-600">{rating}星</span>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${percent}%` }} />
              </div>
              <span className="text-right text-xs font-semibold text-slate-500">{percent}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
