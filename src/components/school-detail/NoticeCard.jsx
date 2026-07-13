import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

const typeLabelMap = {
  policy: "推免总体办法",
  "summer-camp": "夏令营",
  "pre-recommendation": "预推免",
  catalog: "招生专业目录",
  requirement: "申请条件",
  material: "材料清单",
  assessment: "考核流程",
  timeline: "重要时间节点",
  other: "其他通知",
};

function getTypeLabel(type) {
  return typeLabelMap[type] || type || "其他通知";
}

function isExpired(deadline) {
  if (!deadline) {
    return false;
  }

  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) {
    return false;
  }

  return deadlineDate.getTime() < Date.now();
}

function normalizeNotice(notice) {
  const sourceUrl = notice?.source?.url || notice?.sourceUrl || "";
  return {
    id: notice?.id || sourceUrl || notice?.title,
    title: notice?.title || "未命名资料",
    type: notice?.type || "other",
    year: notice?.year ?? null,
    majorTags: Array.isArray(notice?.majorTags) ? notice.majorTags : [],
    publishedAt: notice?.publishedAt || null,
    deadline: notice?.deadline || null,
    summary: notice?.summary || "",
    keyPoints: Array.isArray(notice?.keyPoints) ? notice.keyPoints : [],
    materials: Array.isArray(notice?.materials) ? notice.materials : [],
    assessment: Array.isArray(notice?.assessment) ? notice.assessment : [],
    source: {
      title: notice?.source?.title || notice?.sourceDepartment || "官方来源",
      url: sourceUrl,
      sourceType: notice?.source?.sourceType || notice?.sourceType || "official-notice",
    },
    crawledAt: notice?.crawledAt || null,
    lastCheckedAt: notice?.lastCheckedAt || null,
    contentHash: notice?.contentHash || null,
  };
}

function InfoLine({ label, value }) {
  if (!value) {
    return null;
  }

  return (
    <span className="inline-flex items-center rounded-md bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
      {label}：{value}
    </span>
  );
}

function SimpleList({ title, items }) {
  if (!items?.length) {
    return null;
  }

  return (
    <div>
      <p className="text-sm font-bold text-slate-950">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function NoticeCard({ notice }) {
  const [expanded, setExpanded] = useState(false);
  const normalizedNotice = useMemo(() => normalizeNotice(notice), [notice]);
  const expired = isExpired(normalizedNotice.deadline);
  const hasDetail = normalizedNotice.materials.length > 0 || normalizedNotice.assessment.length > 0;

  return (
    <article
      className={[
        "rounded-xl border bg-white p-5 shadow-sm transition",
        expired ? "border-slate-200 opacity-75" : "border-slate-200 hover:border-blue-200 hover:shadow-soft",
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="badge">{getTypeLabel(normalizedNotice.type)}</span>
            {normalizedNotice.year && (
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {normalizedNotice.year}
              </span>
            )}
            {expired && (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500">
                可能已过期
              </span>
            )}
          </div>

          <h3 className="mt-3 text-lg font-bold leading-7 text-slate-950">{normalizedNotice.title}</h3>

          <div className="mt-3 flex flex-wrap gap-2">
            <InfoLine label="发布时间" value={normalizedNotice.publishedAt} />
            <InfoLine label="适用专业" value={normalizedNotice.majorTags.length ? normalizedNotice.majorTags.join("、") : ""} />
            <InfoLine label="报名截止" value={normalizedNotice.deadline} />
            <InfoLine label="来源单位" value={normalizedNotice.source.title} />
            <InfoLine label="最近检查" value={normalizedNotice.lastCheckedAt} />
          </div>
        </div>

        {normalizedNotice.source.url ? (
          <a
            className="btn-secondary shrink-0 justify-center"
            href={normalizedNotice.source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} aria-hidden="true" />
            前往官方原文
          </a>
        ) : (
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-400">
            原文链接待补充
          </span>
        )}
      </div>

      {normalizedNotice.summary && (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3">
          <p className="line-clamp-6 text-sm leading-7 text-slate-700">{normalizedNotice.summary}</p>
          <p className="mt-2 text-xs font-semibold text-brand-700">自动整理，请以官方原文为准。</p>
        </div>
      )}

      <SimpleList title="关键信息" items={normalizedNotice.keyPoints} />

      {hasDetail && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 transition hover:text-brand-800"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            {expanded ? "收起详情" : "展开详情"}
          </button>

          {expanded && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SimpleList title="申请材料" items={normalizedNotice.materials} />
              <SimpleList title="考核方式" items={normalizedNotice.assessment} />
            </div>
          )}
        </div>
      )}

      {normalizedNotice.source.url && expired && (
        <p className="mt-4 text-xs font-semibold text-slate-500">原文链接可能已失效或该通知可能已过期，请打开官方原文核验。</p>
      )}
    </article>
  );
}

export { normalizeNotice, typeLabelMap };
