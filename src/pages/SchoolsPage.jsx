import React, { useMemo, useState } from "react";
import { Filter, GraduationCap, MapPin, Search } from "lucide-react";
import { Card, CardHeader } from "../components/Card.jsx";
import { SelectField } from "../components/FormControls.jsx";
import { applicationTypes, directions, schools, schoolTiers } from "../data/schools.js";

export default function SchoolsPage() {
  const [filters, setFilters] = useState({
    tier: "全部",
    direction: "全部",
    type: "全部",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      const tierMatched = filters.tier === "全部" || school.tier === filters.tier;
      const directionMatched =
        filters.direction === "全部" || school.directions.includes(filters.direction);
      const typeMatched =
        filters.type === "全部" || school.applicationTypes.includes(filters.type);
      return tierMatched && directionMatched && typeMatched;
    });
  }, [filters]);

  return (
    <div className="bg-slate-50 py-10">
      <div className="container-page">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <CardHeader
            eyebrow="院校资料库"
            title="按层次、方向和申请类型筛选目标项目"
            description="资料库当前为模拟示例，用来帮助你建立院校梯度和材料准备思路。"
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
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField label="院校层次" name="tier" value={filters.tier} onChange={handleChange} options={schoolTiers} />
            <SelectField label="专业方向" name="direction" value={filters.direction} onChange={handleChange} options={directions} />
            <SelectField label="申请类型" name="type" value={filters.type} onChange={handleChange} options={applicationTypes} />
          </div>
        </Card>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {filteredSchools.map((school) => (
            <Card key={school.name} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                    <MapPin size={16} aria-hidden="true" />
                    {school.city}
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-slate-950">{school.name}</h2>
                </div>
                <span className="badge w-fit">{school.tier}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {school.tags.map((tag) => (
                  <span key={tag} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-5 grid gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">适配方向</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{school.directions.join("、")}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">申请类型</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{school.applicationTypes.join("、")}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <GraduationCap size={16} className="text-brand-700" aria-hidden="true" />
                    资料摘要
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{school.highlights}</p>
                </div>
                <div className="rounded-lg border border-teal-100 bg-teal-50 p-4 text-sm leading-6 text-slate-700">
                  <span className="font-bold text-teal-800">准备建议：</span>
                  {school.advice}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredSchools.length === 0 && (
          <Card className="mt-6 p-8 text-center">
            <p className="text-lg font-bold text-slate-950">暂未找到匹配院校</p>
            <p className="mt-2 text-sm text-slate-500">可以放宽院校层次或申请类型筛选条件。</p>
          </Card>
        )}
      </div>
    </div>
  );
}
