import React, { useMemo, useState } from "react";
import { Filter, MapPin, Search, X } from "lucide-react";
import { Card, CardHeader } from "../components/Card.jsx";
import { SelectField } from "../components/FormControls.jsx";
import { schoolRegions, schools, schoolTiers } from "../data/schools.js";

export default function SchoolsPage() {
  const [filters, setFilters] = useState({
    region: "全部",
    tier: "全部",
  });
  const [selectedSchool, setSelectedSchool] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      const regionMatched = filters.region === "全部" || school.province === filters.region;
      const tierMatched = filters.tier === "全部" || school.levelTags.includes(filters.tier);
      return regionMatched && tierMatched;
    });
  }, [filters]);

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
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="地区" name="region" value={filters.region} onChange={handleChange} options={schoolRegions} />
            <SelectField label="院校层次" name="tier" value={filters.tier} onChange={handleChange} options={schoolTiers} />
          </div>
        </Card>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {filteredSchools.map((school) => (
            <button
              key={school.id}
              type="button"
              className="group rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-soft"
              onClick={() => setSelectedSchool(school)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                    <MapPin size={16} aria-hidden="true" />
                    {school.province} · {school.city}
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

              <div className="mt-4 flex flex-wrap gap-2">
                {school.typeTags.map((tag) => (
                  <span key={tag} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {filteredSchools.length === 0 && (
          <Card className="mt-6 p-8 text-center">
            <p className="text-lg font-bold text-slate-950">暂未找到匹配院校</p>
            <p className="mt-2 text-sm text-slate-500">可以放宽地区或院校层次筛选条件。</p>
          </Card>
        )}

        <Card className="mt-6 border-blue-100 bg-blue-50 p-5">
          <p className="text-sm leading-7 text-slate-700">
            院校资料库当前为规划参考数据，后续将持续根据教育部、中国研招网和各高校研究生院官网公开信息更新。
            具体推免资格、接收专业、报名时间和材料要求，请以当年官方通知为准。
          </p>
        </Card>

        {selectedSchool && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/45 px-4 py-6">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                    <MapPin size={16} aria-hidden="true" />
                    {selectedSchool.province} · {selectedSchool.city}
                  </div>
                  <h2 className="mt-2 text-2xl font-bold text-slate-950">{selectedSchool.name}</h2>
                </div>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  onClick={() => setSelectedSchool(null)}
                  aria-label="关闭院校详情占位弹窗"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {selectedSchool.levelTags.map((tag) => (
                  <span key={tag} className="badge w-fit">
                    {tag}
                  </span>
                ))}
              </div>

              <p className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-7 text-slate-700">
                院校详情页建设中，后续将补充招生学院、推免信息、材料要求和经验帖。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
