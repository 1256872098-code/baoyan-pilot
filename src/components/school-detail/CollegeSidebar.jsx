import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Card } from "../Card.jsx";

function getStatusClass(status) {
  if (["available", "verified"].includes(status)) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "inactive") {
    return "bg-slate-100 text-slate-500";
  }

  if (status === "pending-review") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-blue-50 text-brand-700";
}

function getStatusText(status) {
  return {
    available: "已有资料",
    verified: "已核验",
    "pending-review": "待复核",
    inactive: "已停用",
    building: "建设中",
  }[status] || "建设中";
}

export default function CollegeSidebar({ schoolId, colleges, activeCollegeId }) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");

  const filteredColleges = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) {
      return colleges;
    }

    return colleges.filter((college) => college.name.toLowerCase().includes(value));
  }, [colleges, keyword]);

  const handleMobileSelect = (event) => {
    const nextCollegeId = event.target.value;
    if (nextCollegeId) {
      navigate(`/schools/${schoolId}/colleges/${nextCollegeId}`);
    }
  };

  return (
    <>
      <Card className="p-4 lg:hidden">
        <label className="block">
          <span className="field-label">选择学院</span>
          <select className="field-control" value={activeCollegeId || ""} onChange={handleMobileSelect}>
            <option value="">请选择学院</option>
            {colleges.map((college) => (
              <option key={college.id} value={college.id}>
                {college.name}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <aside className="hidden lg:block">
        <Card className="sticky top-24 max-h-[calc(100vh-120px)] overflow-hidden p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-slate-950">学院目录</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
              {colleges.length} 个
            </span>
          </div>

          <label className="relative mt-4 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索学院"
            />
          </label>

          <div className="mt-4 max-h-[calc(100vh-250px)] space-y-2 overflow-y-auto pr-1">
            {filteredColleges.length ? (
              filteredColleges.map((college) => {
                const isActive = college.id === activeCollegeId;
                return (
                  <Link
                    key={college.id}
                    to={`/schools/${schoolId}/colleges/${college.id}`}
                    className={[
                      "block rounded-lg border px-3 py-3 text-sm transition",
                      isActive
                        ? "border-blue-200 bg-blue-50 text-brand-700"
                        : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950",
                    ].join(" ")}
                  >
                    <span className="block truncate font-semibold">{college.name}</span>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusClass(college.dataStatus)}`}>
                      {getStatusText(college.dataStatus)}
                    </span>
                  </Link>
                );
              })
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm leading-6 text-slate-500">
                未找到匹配学院。
              </p>
            )}
          </div>
        </Card>
      </aside>
    </>
  );
}
