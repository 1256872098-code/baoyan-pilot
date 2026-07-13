import React from "react";
import { ArrowLeft, BookmarkPlus, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

function getRegionText(school) {
  return school.city ? `${school.province} · ${school.city}` : school.province;
}

export default function SchoolHeader({ school, detailStatus, college }) {
  const statusText = detailStatus === "available" ? "已有资料" : "资料建设中";
  const statusClass =
    detailStatus === "available"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-blue-100 bg-blue-50 text-brand-700";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
        <Link to="/schools" className="inline-flex items-center gap-1 transition hover:text-brand-700">
          <ArrowLeft size={16} aria-hidden="true" />
          院校资料库
        </Link>
        <span>&gt;</span>
        <Link to={`/schools/${school.id}`} className="transition hover:text-brand-700">
          {school.name}
        </Link>
        {college && (
          <>
            <span>&gt;</span>
            <span className="text-slate-700">{college.name}</span>
          </>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold leading-tight text-slate-950">{school.name}</h1>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass}`}>{statusText}</span>
          </div>

          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
            <MapPin size={16} aria-hidden="true" />
            {getRegionText(school)}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {school.levelTags.map((tag) => (
              <span key={tag} className="badge w-fit">
                {tag}
              </span>
            ))}
          </div>

          {school.typeTags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {school.typeTags.map((tag) => (
                <span key={tag} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-600">
            不同学院的招生专业、申请条件和考核方式可能不同，请先选择目标学院查看对应资料。
          </p>
        </div>

        <button type="button" className="btn-secondary shrink-0" onClick={() => window.alert("收藏院校功能建设中。")}>
          <BookmarkPlus size={17} aria-hidden="true" />
          收藏院校
        </button>
      </div>
    </div>
  );
}
