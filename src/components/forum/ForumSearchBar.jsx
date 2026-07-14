import React from "react";
import { Search, X } from "lucide-react";

export default function ForumSearchBar({
  value,
  loading = false,
  onChange,
  onSearch,
  onClear,
}) {
  const hasValue = Boolean(String(value || "").trim());

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">搜索帖子</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            className="field-control h-11 pl-9"
            value={value}
            maxLength={50}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSearch();
              }
            }}
            placeholder="搜索帖子标题或正文，例如“保研”“夏令营”"
          />
        </label>
        <div className="flex shrink-0 gap-2">
          {hasValue && (
            <button type="button" className="btn-secondary h-11 px-3" onClick={onClear} disabled={loading}>
              <X size={16} aria-hidden="true" />
              清空
            </button>
          )}
          <button type="button" className="btn-primary h-11 px-4" onClick={onSearch} disabled={loading}>
            <Search size={16} aria-hidden="true" />
            {loading ? "搜索中..." : "搜索"}
          </button>
        </div>
      </div>
    </div>
  );
}
