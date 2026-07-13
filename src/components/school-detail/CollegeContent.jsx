import React, { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Card } from "../Card.jsx";
import NoticeList from "./NoticeList.jsx";

const allOption = "全部";
const dataTypeOptions = [
  { value: "all", label: "全部资料" },
  { value: "policy", label: "推免总体办法" },
  { value: "summer-camp", label: "夏令营" },
  { value: "pre-recommendation", label: "预推免" },
  { value: "catalog", label: "招生专业目录" },
  { value: "requirement", label: "申请条件" },
  { value: "material", label: "材料清单" },
  { value: "assessment", label: "考核流程" },
  { value: "timeline", label: "重要时间节点" },
  { value: "other", label: "其他通知" },
];

function getAllRecords(detail) {
  return Array.isArray(detail?.notices) ? detail.notices : [];
}

function getYearOptions(records) {
  const years = new Set();
  records.forEach((record) => {
    if (record.year) {
      years.add(record.year);
    }
  });

  return [allOption, ...[...years].sort((a, b) => b - a)];
}

function getMajorOptions(college, detail) {
  const majors = new Set([...(college.majorNames || []), ...(detail?.majors || [])]);
  getAllRecords(detail).forEach((record) => {
    (record.majorTags || []).forEach((major) => majors.add(major));
  });
  return [allOption, ...majors];
}

function getPublishedTimeValue(notice) {
  const value = notice.publishedAt || notice.year || "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export default function CollegeContent({ school, college, detail, dataMissing }) {
  const records = useMemo(
    () => [...getAllRecords(detail)].sort((a, b) => getPublishedTimeValue(b) - getPublishedTimeValue(a)),
    [detail],
  );
  const [majorFilter, setMajorFilter] = useState(allOption);
  const [yearFilter, setYearFilter] = useState(allOption);
  const [typeFilter, setTypeFilter] = useState("all");

  const majorOptions = useMemo(() => getMajorOptions(college, detail), [college, detail]);
  const yearOptions = useMemo(() => getYearOptions(records), [records]);

  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const majorMatched =
          majorFilter === allOption ||
          !record.majorTags?.length ||
          record.majorTags.includes(majorFilter);
        const yearMatched = yearFilter === allOption || Number(record.year) === Number(yearFilter);
        const typeMatched = typeFilter === "all" || record.type === typeFilter;
        return majorMatched && yearMatched && typeMatched;
      }),
    [majorFilter, records, typeFilter, yearFilter],
  );

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-700">学院信息</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">{college.name}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">所属学校：{school.name}</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              资料更新时间：{detail?.lastUpdated || "待补充"}
            </p>
          </div>

          {college.officialWebsite || detail?.officialWebsite ? (
            <a
              className="btn-secondary shrink-0"
              href={detail?.officialWebsite || college.officialWebsite}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} aria-hidden="true" />
              学院官网
            </a>
          ) : (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">
              学院官网待补充
            </span>
          )}
        </div>

        {dataMissing && (
          <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-7 text-brand-700">
            该学院资料正在建设中。
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="field-label">专业筛选</span>
            <select className="field-control" value={majorFilter} onChange={(event) => setMajorFilter(event.target.value)}>
              {majorOptions.map((major) => (
                <option key={major} value={major}>
                  {major === allOption ? "全部专业" : major}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="field-label">年份筛选</span>
            <select className="field-control" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year === allOption ? "全部年份" : year}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="field-label">资料类型</span>
            <select className="field-control" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {dataTypeOptions.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-950">资料列表</h2>
          <span className="text-sm font-semibold text-slate-500">{filteredRecords.length} 条</span>
        </div>

        <div className="mt-4">
          <NoticeList notices={filteredRecords} />
        </div>
      </Card>

      <Card className="border-blue-100 bg-blue-50 p-5">
        <p className="text-sm leading-7 text-slate-700">
          本站仅对学校和学院官网公开信息进行整理和概括。具体申请条件、时间安排和材料要求，请以官方原文及当年最新通知为准。
        </p>
      </Card>
    </div>
  );
}
