import React from "react";
import { formatPercent, getSourceLevelLabel } from "../../services/mySchoolDataService.js";

function scale(value, min, max, size) {
  if (max === min) return size / 2;
  return size - ((value - min) / (max - min)) * size;
}

function buildPoints(rows, key, width, height, padding) {
  const values = rows.map((row) => row[key]).filter((value) => value != null && !Number.isNaN(Number(value)));
  if (values.length < 2) return [];
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  return rows
    .map((row, index) => {
      if (row[key] == null || Number.isNaN(Number(row[key]))) return null;
      const x = padding + (index / Math.max(1, rows.length - 1)) * (width - padding * 2);
      const y = padding + scale(Number(row[key]), min, max, height - padding * 2);
      return { x, y, row };
    })
    .filter(Boolean);
}

function pathFromPoints(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export default function AccountingRecommendationTrendChart({ history = [] }) {
  const rows = [...history].filter((item) => item.graduationYear).sort((a, b) => a.graduationYear - b.graduationYear);
  const countPoints = buildPoints(rows, "recommendedCount", 640, 260, 44);
  const ratePoints = buildPoints(rows, "recommendationRate", 640, 260, 44);
  const canRender = countPoints.length >= 2 || ratePoints.length >= 2;

  if (!canRender) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-500">
        <p className="font-semibold text-slate-700">当前可比年度数据不足，暂不生成趋势图。</p>
        <p className="mt-1">至少需要两个年度的可比推免人数或保研率数据。缺失值不会按0补齐。</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-5 rounded-full bg-brand-600" />
          会计学推免人数
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-5 rounded-full bg-emerald-500" />
          会计学保研率
        </span>
        {!ratePoints.length && <span className="text-amber-700">暂无同口径毕业生人数，保研率折线不绘制。</span>}
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox="0 0 640 260" className="h-[260px] min-w-[560px] w-full" role="img" aria-label="会计学推免人数和保研率趋势">
          <line x1="44" y1="216" x2="596" y2="216" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="44" y1="44" x2="44" y2="216" stroke="#cbd5e1" strokeWidth="1" />
          {rows.map((row, index) => {
            const x = 44 + (index / Math.max(1, rows.length - 1)) * (640 - 88);
            return (
              <g key={row.graduationYear}>
                <line x1={x} y1="216" x2={x} y2="221" stroke="#94a3b8" />
                <text x={x} y="241" textAnchor="middle" className="fill-slate-500 text-[12px]">
                  {row.graduationYear}
                </text>
              </g>
            );
          })}
          {countPoints.length >= 2 && <path d={pathFromPoints(countPoints)} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />}
          {ratePoints.length >= 2 && (
            <path d={pathFromPoints(ratePoints)} fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="6 4" strokeLinecap="round" />
          )}
          {countPoints.map((point) => (
            <g key={`count-${point.row.graduationYear}`}>
              <circle cx={point.x} cy={point.y} r="5" fill="#2563eb" />
              <text x={point.x} y={point.y - 10} textAnchor="middle" className="fill-slate-700 text-[12px] font-semibold">
                {point.row.recommendedCount}人
              </text>
            </g>
          ))}
          {ratePoints.map((point) => (
            <g key={`rate-${point.row.graduationYear}`}>
              <circle cx={point.x} cy={point.y} r="5" fill="#10b981" />
              <text x={point.x} y={point.y + 20} textAnchor="middle" className="fill-emerald-700 text-[12px] font-semibold">
                {formatPercent(point.row.recommendationRate)}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-3">
        {rows.map((row) => (
          <div key={row.graduationYear} className="rounded-lg bg-slate-50 px-3 py-2">
            <span className="font-semibold text-slate-700">{row.graduationYear}届</span>
            <span className="ml-2">{getSourceLevelLabel(row.sourceLevel, row.dataStatus)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
