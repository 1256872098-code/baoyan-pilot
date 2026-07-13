import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Database } from "lucide-react";
import { Card, CardHeader } from "../components/Card.jsx";
import CollegeSidebar from "../components/school-detail/CollegeSidebar.jsx";
import SchoolHeader from "../components/school-detail/SchoolHeader.jsx";
import { getAcademicUnits } from "../utils/academicUnits.js";
import { fetchSchoolDetail, fetchSchools } from "../utils/schoolData.js";

function LoadErrorCard({ message, onRetry }) {
  return (
    <Card className="p-8 text-center">
      <p className="text-lg font-bold text-slate-950">{message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" className="btn-primary" onClick={onRetry}>
          重试
        </button>
        <Link to="/schools" className="btn-secondary justify-center">
          <ArrowLeft size={16} aria-hidden="true" />
          返回院校资料库
        </Link>
      </div>
    </Card>
  );
}

export default function SchoolDetailPage() {
  const { schoolId } = useParams();
  const [schools, setSchools] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBaseSchools() {
      setLoading(true);
      setLoadError("");

      try {
        setSchools(await fetchSchools({ signal: controller.signal }));
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

    loadBaseSchools();
    return () => controller.abort();
  }, [reloadKey]);

  const school = useMemo(() => schools.find((item) => item.id === schoolId) || null, [schoolId, schools]);

  useEffect(() => {
    if (!schoolId || !school) {
      setDetail(null);
      return undefined;
    }

    const controller = new AbortController();

    async function loadSchoolDetail() {
      setDetailLoading(true);

      try {
        setDetail(await fetchSchoolDetail(schoolId, { signal: controller.signal }));
      } catch (error) {
        if (error.name !== "AbortError") {
          setDetail(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    }

    loadSchoolDetail();
    return () => controller.abort();
  }, [school, schoolId, reloadKey]);

  if (loading) {
    return (
      <div className="bg-slate-50 py-10">
        <div className="container-page">
          <Card className="p-8 text-center text-sm font-semibold text-slate-500">正在加载院校资料...</Card>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-slate-50 py-10">
        <div className="container-page">
          <LoadErrorCard message={loadError} onRetry={() => setReloadKey((value) => value + 1)} />
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="bg-slate-50 py-10">
        <div className="container-page">
          <Card className="p-8 text-center">
            <Database className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-slate-950">未找到该院校</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">该院校 ID 不存在，或本地院校数据尚未同步。</p>
            <Link to="/schools" className="btn-primary mt-5 justify-center">
              <ArrowLeft size={16} aria-hidden="true" />
              返回院校资料库
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const academicUnits = getAcademicUnits(detail);
  const detailStatus = detail?.status || school.detailStatus || "building";

  return (
    <div className="bg-slate-50 py-10">
      <div className="container-page">
        <SchoolHeader school={school} detailStatus={detailStatus} />

        <div className="mt-8">
          <CardHeader
            eyebrow="学院资料"
            title="先选择学院，再查看推免资料"
            description="同一所学校不同学院的招生专业、申请条件和考核方式可能不同。请选择目标学院后查看对应资料框架。"
          />
        </div>

        {detailLoading && (
          <Card className="mt-6 p-5 text-sm font-semibold text-slate-500">正在检查学院目录...</Card>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <CollegeSidebar schoolId={school.id} colleges={academicUnits} activeCollegeId="" />

          <div className="space-y-5">
            {academicUnits.length ? (
              <Card className="p-8 text-center">
                <Database className="mx-auto h-10 w-10 text-brand-600" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-bold text-slate-950">请选择学院或培养单位</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  请从左侧选择学院、学部、系、研究院或其他培养单位，查看对应的招生专业、推免政策和申请资料。
                </p>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <Database className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-bold text-slate-950">学院目录正在补充中</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  当前暂未整理该校学院目录。后续将根据学校研究生院和招生学院官网公开信息持续更新。
                </p>
              </Card>
            )}

            <Card className="border-blue-100 bg-blue-50 p-5">
              <p className="text-sm leading-7 text-slate-700">
                当前院校详情页为资料框架，不包含未经核验的推免信息。学校是否接收推免生、接收专业、报名时间、
                材料要求和考核方式，请以后续学校研究生院及招生学院官网最新通知为准。
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
