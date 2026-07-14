import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

function getSearchableText(major) {
  return [major.name, major.code, ...(Array.isArray(major.aliases) ? major.aliases : [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function SearchableMajorSelect({
  majors = [],
  value = "",
  onChange,
  placeholder = "请选择专业",
  disabled = false,
  loading = false,
  emptyText = "该学院本科专业目录尚未补充，暂时无法完成绑定。",
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedMajor = useMemo(() => majors.find((major) => major.id === value) || null, [majors, value]);
  const filteredMajors = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return majors;
    return majors.filter((major) => getSearchableText(major).includes(normalizedQuery));
  }, [majors, searchQuery]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(Math.max(0, filteredMajors.findIndex((major) => major.id === value)));
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [filteredMajors, open, value]);

  const closeDropdown = () => {
    setOpen(false);
    setSearchQuery("");
  };

  const selectMajor = (major) => {
    if (!major) return;
    onChange?.(major);
    closeDropdown();
  };

  const handleTriggerKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!disabled && !loading && majors.length) setOpen(true);
    }
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
      return;
    }

    if (event.key === "Tab") {
      closeDropdown();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(filteredMajors.length - 1, current + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectMajor(filteredMajors[activeIndex]);
    }
  };

  const triggerDisabled = disabled || loading || !majors.length;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={[
          "field-control flex h-11 w-full items-center justify-between gap-3 text-left",
          triggerDisabled ? "cursor-not-allowed bg-slate-100 text-slate-400" : "bg-white",
        ].join(" ")}
        disabled={triggerDisabled}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={selectedMajor ? "truncate text-slate-900" : "truncate text-slate-400"}>
          {loading ? "专业目录加载中" : selectedMajor?.name || placeholder}
        </span>
        <ChevronDown
          size={17}
          className={["shrink-0 text-slate-400 transition", open ? "rotate-180" : ""].join(" ")}
          aria-hidden="true"
        />
      </button>

      {!loading && !disabled && !majors.length && <p className="mt-2 text-xs leading-5 text-amber-700">{emptyText}</p>}

      {open && (
        <div className="absolute left-0 right-0 z-[80] mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <label className="relative block">
            <span className="sr-only">搜索专业名称</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              className="field-control h-10 pl-9"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="搜索专业名称或代码"
            />
          </label>

          <div id={listboxId} role="listbox" className="mt-3 max-h-[280px] overflow-y-auto pr-1">
            {filteredMajors.length ? (
              <div className="space-y-1">
                {filteredMajors.map((major, index) => {
                  const selected = major.id === value;
                  const active = index === activeIndex;
                  return (
                    <button
                      key={major.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={[
                        "flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition",
                        selected || active ? "bg-blue-50 text-brand-700" : "text-slate-700 hover:bg-blue-50/70",
                      ].join(" ")}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectMajor(major)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{major.name}</span>
                        <span className="mt-1 block truncate text-xs text-slate-500">
                          {[major.code, major.degreeType, major.educationLevel].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {selected && <Check size={17} className="mt-0.5 shrink-0" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                未找到匹配专业
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
