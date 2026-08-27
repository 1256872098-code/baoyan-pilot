import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpenText,
  Building2,
  GraduationCap,
  MapPin,
  Search,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import competitionData from "../data/competitions2026.json";

const categoryMeta = [
  {
    id: "A",
    label: "A 类竞赛",
    helper: "包含 A+ 与 A 类项目",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    activeClass: "border-amber-300 bg-amber-50 text-amber-800 ring-2 ring-amber-100",
  },
  {
    id: "B",
    label: "B 类竞赛",
    helper: "学校重点支持竞赛项目",
    badgeClass: "border-blue-200 bg-blue-50 text-brand-700",
    activeClass: "border-blue-300 bg-blue-50 text-brand-700 ring-2 ring-blue-100",
  },
  {
    id: "C",
    label: "C 类竞赛",
    helper: "覆盖多学科与专业方向",
    badgeClass: "border-teal-200 bg-teal-50 text-teal-700",
    activeClass: "border-teal-300 bg-teal-50 text-teal-700 ring-2 ring-teal-100",
  },
];

const groupCounts = Object.fromEntries(
  categoryMeta.map((category) => [
    category.id,
    competitionData.items.filter((item) => item.group === category.id).length,
  ]),
);

function getCompetitionTitle(item) {
  return item.nationalName || item.regionalName || item.campusName || `竞赛项目 ${item.order}`;
}

function getAvailableLevels(item) {
  return [
    item.nationalName && "国家级",
    item.regionalName && "省市级",
    item.campusName && "校级",
  ].filter(Boolean);
}

function CompetitionDetailDialog({ competition, onClose }) {
  if (!competition) return null;

  const category = categoryMeta.find((item) => item.id === competition.group);
  const levelRows = [
    { label: "国家级竞赛名称", value: competition.nationalName, icon: Trophy },
    { label: "省市级竞赛名称", value: competition.regionalName, icon: MapPin },
    { label: "独立校级赛事", value: competition.campusName, icon: GraduationCap },
  ].filter((item) => item.value);

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="competition-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${category?.badgeClass || "badge"}`}>
                {competition.category} 类
              </span>
              <span className="text-xs font-semibold text-slate-500">目录第 {competition.order} 项</span>
            </div>
            <h2 id="competition-dialog-title" className="mt-3 text-xl font-bold leading-8 text-slate-950 sm:text-2xl">
              {getCompetitionTitle(competition)}
            </h2>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Building2 size={15} aria-hidden="true" />
              承办学院/部门：{competition.organizer || "原表未注明"}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            onClick={onClose}
            aria-label="关闭竞赛详情"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-6">
          <div className="grid gap-3">
            {levelRows.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <Icon size={15} className="text-brand-600" aria-hidden="true" />
                  {label}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-5">
            <p className="flex items-center gap-2 font-bold text-brand-700">
              <BookOpenText size={18} aria-hidden="true" />
              竞赛介绍待补充
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              后续可在这里补充赛事简介、参赛对象、报名时间、赛制安排、奖项设置和备赛建议。
            </p>
          </div>

          <p className="text-xs leading-5 text-slate-500">
            数据来源：{competitionData.sourceTitle}，第 {competition.order} 项。
          </p>
        </div>
      </div>
    </div>
  );
}

export default function WantBaoyanPage() {
  const [activeCategory, setActiveCategory] = useState("A");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompetition, setSelectedCompetition] = useState(null);

  useEffect(() => {
    if (!selectedCompetition) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSelectedCompetition(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedCompetition]);

  const filteredCompetitions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("zh-CN");

    return competitionData.items.filter((item) => {
      if (item.group !== activeCategory) return false;
      if (!normalizedQuery) return true;

      const searchableText = [
        item.category,
        item.organizer,
        item.nationalName,
        item.regionalName,
        item.campusName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("zh-CN");
      return searchableText.includes(normalizedQuery);
    });
  }, [activeCategory, searchQuery]);

  const activeMeta = categoryMeta.find((item) => item.id === activeCategory);

  return (
    <div className="min-h-[calc(100svh-4rem)] bg-slate-50 py-9 sm:py-12">
      <div className="container-page">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-brand-700">
              <Sparkles size={17} aria-hidden="true" />
              备战资源
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">我想保研</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              先从竞赛目录开始了解可参与的项目。按 A、B、C 类浏览 2026 年竞赛清单，点击项目即可查看对应级别与承办部门。
            </p>
          </div>
          <div className="shrink-0 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-brand-700">
            已收录 {competitionData.items.length} 个竞赛项目
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {categoryMeta.map((category) => {
            const isActive = activeCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                className={`rounded-xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  isActive ? category.activeClass : "border-slate-200"
                }`}
                onClick={() => setActiveCategory(category.id)}
                aria-pressed={isActive}
              >
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${category.badgeClass}`}>
                  {category.id} 类
                </span>
                <p className="mt-4 text-3xl font-bold text-slate-950">{groupCounts[category.id]}</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{category.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{category.helper}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="竞赛分类">
              {categoryMeta.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === category.id}
                  className={`rounded-lg border px-4 py-2.5 text-sm font-bold transition ${
                    activeCategory === category.id
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
                  }`}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.id} 类 · {groupCounts[category.id]}
                </button>
              ))}
            </div>

            <label className="relative block w-full lg:max-w-sm">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <span className="sr-only">搜索竞赛</span>
              <input
                type="search"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索竞赛名称或承办部门"
              />
            </label>
          </div>
        </div>

        <section className="mt-8" aria-labelledby="competition-list-title">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${activeMeta.badgeClass}`}>
                {activeMeta.id} 类目录
              </p>
              <h2 id="competition-list-title" className="mt-3 text-2xl font-bold text-slate-950">
                {activeMeta.label}
              </h2>
            </div>
            <p className="text-sm text-slate-500">当前显示 {filteredCompetitions.length} 个项目</p>
          </div>

          {filteredCompetitions.length ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCompetitions.map((competition) => {
                const levels = getAvailableLevels(competition);
                const category = categoryMeta.find((item) => item.id === competition.group);

                return (
                  <button
                    key={competition.id}
                    type="button"
                    className="group flex min-h-[210px] flex-col rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                    onClick={() => setSelectedCompetition(competition)}
                    aria-label={`查看${getCompetitionTitle(competition)}详情`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${category.badgeClass}`}>
                        {competition.category} 类
                      </span>
                      <ArrowUpRight
                        size={19}
                        className="shrink-0 text-slate-300 transition group-hover:text-brand-600"
                        aria-hidden="true"
                      />
                    </div>

                    <h3 className="mt-4 break-words text-base font-bold leading-6 text-slate-950">
                      {getCompetitionTitle(competition)}
                    </h3>
                    <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
                      <Building2 size={15} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{competition.organizer || "承办部门未注明"}</span>
                    </p>

                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                      {levels.map((level) => (
                        <span key={level} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {level}
                        </span>
                      ))}
                      <span className="ml-auto text-xs font-bold text-brand-700">查看详情</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
              <Search className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
              <p className="mt-3 font-bold text-slate-700">没有找到匹配的竞赛</p>
              <p className="mt-1 text-sm text-slate-500">可以尝试缩短关键词，或切换其他竞赛分类。</p>
            </div>
          )}
        </section>

        <div className="mt-10 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm leading-6 text-brand-700">
          清单依据《{competitionData.sourceTitle}》整理；A 类目录包含原表中的 A+ 与 A 类项目。竞赛介绍将陆续补充。
        </div>
      </div>

      <CompetitionDetailDialog competition={selectedCompetition} onClose={() => setSelectedCompetition(null)} />
    </div>
  );
}
