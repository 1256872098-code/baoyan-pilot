import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter, MapPin, Search } from "lucide-react";
import { Card, CardHeader } from "../components/Card.jsx";
import { SelectField } from "../components/FormControls.jsx";
import { schoolTiers } from "../data/schoolLevelMaps.js";

const pageSize = 24;
const allOption = "全部";
const provinceOrder = [
  "北京",
  "天津",
  "河北",
  "山西",
  "内蒙古",
  "辽宁",
  "吉林",
  "黑龙江",
  "上海",
  "江苏",
  "浙江",
  "安徽",
  "福建",
  "江西",
  "山东",
  "河南",
  "湖北",
  "湖南",
  "广东",
  "广西",
  "海南",
  "重庆",
  "四川",
  "贵州",
  "云南",
  "西藏",
  "陕西",
  "甘肃",
  "青海",
  "宁夏",
  "新疆",
];

function normalizeSchools(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (school) =>
      school &&
      typeof school.name === "string" &&
      typeof school.province === "string" &&
      Array.isArray(school.levelTags) &&
      school.levelTags.length,
  );
}

function getRegionOptions(schools) {
  const provinces = new Set(schools.map((school) => school.province).filter(Boolean));
  const sorted = [...provinces].sort((a, b) => {
    const aIndex = provinceOrder.indexOf(a);
    const bIndex = provinceOrder.indexOf(b);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b, "zh-CN");
  });

  return [allOption, ...sorted];
}

function matchTier(school, tier) {
  if (tier === allOption) {
    return true;
  }

  if (tier === "普通本科") {
    return school.levelTags.length === 1 && school.levelTags[0] === "普通本科";
  }

  return school.levelTags.includes(tier);
}

function getRegionText(school) {
  return school.city ? `${school.province} · ${school.city}` : school.province;
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState({
    region: allOption,
    tier: allOption,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSchools() {
      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch("/data/schools.json", {
          signal: controller.signal,
          cache: "no-cache",
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const nextSchools = normalizeSchools(await response.json());
        if (!nextSchools.length) {
          throw new Error("empty schools data");
        }

        setSchools(nextSchools);
      } catch (error) {
        if (error.name !== "AbortError") {
          setLoadError("院校数据加载失败，请稍后刷新页面。");
          setSchools([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadSchools();
    return () => controller.abort();
  }, []);

  const regionOptions = useMemo(() => getRegionOptions(schools), [schools]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  useEffect(() => {
    setPage(1);
  }, [filters.region, filters.tier, searchTerm]);

  const filteredSchools = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return schools.filter((school) => {
      const regionMatched = filters.region === allOption || school.province === filters.region;
      const tierMatched = matchTier(school, filters.tier);
      const searchMatched = !keyword || school.name.toLowerCase().includes(keyword);
      return regionMatched && tierMatched && searchMatched;
    });
  }, [filters, schools, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredSchools.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedSchools = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSchools.slice(start, start + pageSize);
  }, [currentPage, filteredSchools]);

  const goPrevPage = () => setPage((current) => Math.max(1, current - 1));
  const goNextPage = () => setPage((current) => Math.min(totalPages, current + 1));

  return (
    <div className="bg-slate-50 py-10">
      <div className="container-page">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <CardHeader
            eyebrow="院校资料库"
            title="按院校层次和地区筛选目标院校"
            description="资料库当前为规划参考数据，帮助你快速建立保研目标院校池。点击院校卡片后，后续可查看院校详情、推免信息和经验内容。"
          />
          <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-brand-700">
            <Search size={17} aria-hidden="true" />
            已匹配 {filteredSchools.length} 所院校
          </div>
        </div>

        <Card className="mt-8 p-5">
          <div className="mb-5 flex items-center gap-2">
            <Filter size={19} className="text-brand-700" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-950">筛选条件</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.9fr_0.9fr]">
            <label className="block">
              <span className="field-label">搜索院校</span>
              <input
                className="field-control"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="请输入学校名称"
              />
            </label>
            <SelectField label="地区" name="region" value={filters.region} onChange={handleChange} options={regionOptions} />
            <SelectField label="院校层次" name="tier" value={filters.tier} onChange={handleChange} options={schoolTiers} />
          </div>
        </Card>

        {loadError && (
          <Card className="mt-6 border-red-100 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-700">{loadError}</p>
          </Card>
        )}

        {loading ? (
          <Card className="mt-6 p-8 text-center">
            <p className="text-sm font-semibold text-slate-500">正在加载院校数据...</p>
          </Card>
        ) : (
          <>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {pagedSchools.map((school) => (
                <Link
                  key={school.id}
                  to={`/schools/${school.id}`}
                  className="group block min-h-[142px] rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm outline-none transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-soft focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-100"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                        <MapPin size={16} aria-hidden="true" />
                        {getRegionText(school)}
                      </div>
                      <h2 className="mt-2 truncate text-xl font-bold text-slate-950 transition group-hover:text-brand-700">
                        {school.name}
                      </h2>
                    </div>
                    <div className="flex max-w-[52%] flex-wrap justify-end gap-2">
                      {school.levelTags.map((tag) => (
                        <span key={tag} className="badge w-fit">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {school.typeTags?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {school.typeTags.map((tag) => (
                        <span key={tag} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {filteredSchools.length > pageSize && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  className="btn-secondary disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  onClick={goPrevPage}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  上一页
                </button>
                <span className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">
                  第 {currentPage}/{totalPages} 页
                </span>
                <button
                  type="button"
                  className="btn-secondary disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  onClick={goNextPage}
                  disabled={currentPage >= totalPages}
                >
                  下一页
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}

        {!loading && filteredSchools.length === 0 && !loadError && (
          <Card className="mt-6 p-8 text-center">
            <p className="text-lg font-bold text-slate-950">暂未找到匹配院校</p>
            <p className="mt-2 text-sm text-slate-500">可以调整搜索词，或放宽地区、院校层次筛选条件。</p>
          </Card>
        )}

        <Card className="mt-6 border-blue-100 bg-blue-50 p-5">
          <p className="text-sm leading-7 text-slate-700">
            院校资料库当前为规划参考数据，学校具有推荐优秀应届本科毕业生免试攻读研究生资格，不代表该校当年所有专业均接收推免生。
            具体推免资格、接收专业、报名时间和材料要求，请以当年官方通知为准。
          </p>
        </Card>

      </div>
    </div>
  );
}
