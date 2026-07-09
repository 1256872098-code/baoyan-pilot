import React from "react";

export function Card({ children, className = "" }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function CardHeader({ eyebrow, title, description }) {
  return (
    <div>
      {eyebrow && <p className="text-sm font-semibold text-brand-700">{eyebrow}</p>}
      <h2 className="mt-2 text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">
        {title}
      </h2>
      {description && <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{description}</p>}
    </div>
  );
}

export function StatCard({ value, label, helper, tone = "blue" }) {
  const toneClass = {
    blue: "border-blue-100 bg-blue-50 text-brand-700",
    teal: "border-teal-100 bg-teal-50 text-teal-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{label}</p>
      {helper && <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>}
    </div>
  );
}
