import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Database } from "lucide-react";
import { Card } from "../components/Card.jsx";
import CollegeContent from "../components/school-detail/CollegeContent.jsx";
import CollegeSidebar from "../components/school-detail/CollegeSidebar.jsx";
import SchoolHeader from "../components/school-detail/SchoolHeader.jsx";
import { getAcademicUnits } from "../utils/academicUnits.js";
import { fetchCollegeDetail, fetchSchoolDetail, fetchSchools } from "../utils/schoolData.js";

function ErrorState({ title, description, schoolId, onRetry }) {
  return (
    <Card className="p-8 text-center">
      <Database className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold text-slate-950">{title}</h1>
      {description && <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {onRetry && (
          <button type="button" className="btn-primary" onClick={onRetry}>
            重试
          </button>
        )}
        <Link to={schoolId ? `/schools/${schoolId}` : "/schools"} className="btn-secondary justify-center">
          <ArrowLeft size={16} aria-hidden="true" />
          {schoolId ? "返回学校详情" : "返回院校资料库"}
        </Link>
      </div>
    </Card>
  );
}

export default function CollegeDetailPage() {
  const { schoolId, collegeId } = useParams();
  const [schools, setSchools] = useState([]);
  const [schoolDetail, setSchoolDetail] = useState(null);
  const [collegeDetail, setCollegeDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setLoading(true);
      setLoadError("");

      try {
        const [nextSchools, nextSchoolDetail] = await Promise.all([
          fetchSchools({ signal: controller.signal }),
          fetchSchoolDetail(schoolId, { signal: controller.signal }),
        ]);
        setSchools(nextSchools);
        setSchoolDetail(nextSchoolDetail);

        const nextCollegeDetail = await fetchCollegeDetail(schoolId, collegeId, { signal: controller.signal });
        setCollegeDetail(nextCollegeDetail);
      } catch (error) {
        if (error.name !== "AbortError") {
          setLoadError("院校或学院资料加载失败，请稍后重试。");
          setSchools([]);
          setSchoolDetail(null);
          setCollegeDetail(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => controller.abort();
  }, [collegeId, reloadKey, schoolId]);

  const school = useMemo(() => schools.find((item) => item.id === schoolId) || null, [schoolId, schools]);
  const academicUnits = getAcademicUnits(schoolDetail);
  const college = academicUnits.find((item) => item.id === collegeId) || null;

  if (loading) {
    return (
      <div className="bg-slate-50 py-10">
        <div className="container-page">
          <Card className="p-8 text-center text-sm font-semibold text-slate-500">正在加载学院资料...</Card>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-slate-50 py-10">
        <div className="container-page">
          <ErrorState
            title={loadError}
            schoolId={schoolId}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="bg-slate-50 py-10">
        <div className="container-page">
          <ErrorState title="未找到该院校" description="该院校 ID 不存在，或本地院校数据尚未同步。" />
        </div>
      </div>
    );
  }

  if (!college) {
    return (
      <div className="bg-slate-50 py-10">
        <div className="container-page">
          <SchoolHeader school={school} detailStatus={schoolDetail?.status || school.detailStatus || "building"} />
          <div className="mt-6">
            <ErrorState title="未找到该学院" description="该学院 ID 不存在，或学院目录尚未整理。" schoolId={school.id} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 py-10">
      <div className="container-page">
        <SchoolHeader
          school={school}
          college={college}
          detailStatus={schoolDetail?.status || school.detailStatus || "building"}
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <CollegeSidebar schoolId={school.id} colleges={academicUnits} activeCollegeId={college.id} />

          <CollegeContent
            school={school}
            college={college}
            detail={collegeDetail}
            dataMissing={!collegeDetail}
          />
        </div>
      </div>
    </div>
  );
}
