import React from "react";

export default function ResultSection({ title, children, icon: Icon }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-brand-700">
            <Icon size={17} aria-hidden="true" />
          </span>
        )}
        <h3 className="text-base font-bold text-slate-950">{title}</h3>
      </div>
      {children}
    </div>
  );
}
