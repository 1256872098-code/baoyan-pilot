import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink, FileText, RefreshCcw, Trash2 } from "lucide-react";
import { Card, CardHeader } from "../components/Card.jsx";
import LoginModal from "../components/LoginModal.jsx";
import AccountingRecommendationTrendChart from "../components/my-school/AccountingRecommendationTrendChart.jsx";
import SearchableMajorSelect from "../components/school/SearchableMajorSelect.jsx";
import SearchableSchoolSelect from "../components/school/SearchableSchoolSelect.jsx";
import SchoolRatingSection from "../components/school-rating/SchoolRatingSection.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { fetchCollegeMajors, getActiveMajors } from "../services/collegeMajorService.js";
import {
  fetchMySchoolRecommendationData,
  formatDate,
  formatPercent,
  getLatestThreeAccountingYears,
  getMatchedRecommendationData,
  getSourceLevelLabel,
} from "../services/mySchoolDataService.js";
import { getAcademicUnits } from "../utils/academicUnits.js";
import { fetchCollegeDetail, fetchSchoolDetail, fetchSchools } from "../utils/schoolData.js";

const gradeOptions = ["", "大一", "大二", "大三", "大四", "研究生", "其他"];
const emptyBinding = {
  schoolId: "",
  schoolName: "",
  collegeId: "",
  collegeName: "",
  majorId: "",
  majorName: "",
  majorCode: null,
  grade: "",
  graduationYear: null,
};

function getBindingKey(userId) {
  return `baoyanpilot_my_school_${userId}`;
}

function readBinding(user) {
  if (typeof window === "undefined" || !user?.id) return null;
  try {
    const stored = window.localStorage.getItem(getBindingKey(user.id));
    return stored ? normalizeBinding(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

function normalizeBinding(binding) {
  if (!binding) return null;
  return {
    ...emptyBinding,
    ...binding,
    majorId: binding.majorId || "",
    majorName: binding.majorName || binding.major || "",
    majorCode: binding.majorCode ?? null,
    graduationYear: binding.graduationYear ?? inferGraduationYear(binding.grade),
  };
}

function inferGraduationYear(grade) {
  const month = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const academicStartYear = month >= 8 ? currentYear : currentYear - 1;
  const offsetMap = {
    大一: 4,
    大二: 3,
    大三: 2,
    大四: 1,
  };
  return offsetMap[grade] ? academicStartYear + offsetMap[grade] : null;
}

function saveBinding(userId, binding) {
  window.localStorage.setItem(getBindingKey(userId), JSON.stringify(binding));
}

function removeBinding(userId) {
  window.localStorage.removeItem(getBindingKey(userId));
}

function getRegionText(school) {
  if (!school) return "";
  return school.city ? `${school.province} · ${school.city}` : school.province;
}

function EmptyInfo({ title, description }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-500">
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1">{description}</p>
    </div>
  );
}

function FieldList({ title, items }) {
  const normalizedItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!normalizedItems.length) return null;
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
        {normalizedItems.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
            <span>{typeof item === "string" ? item : item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceDisclosure({ sources }) {
  const normalizedSources = (Array.isArray(sources) ? sources : []).filter((source) => source?.sourceUrl || source?.url);
  if (!normalizedSources.length) return null;
  return (
    <details className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-semibold text-brand-700">查看来源</summary>
      <div className="mt-2 space-y-2">
        {normalizedSources.map((source, index) => {
          const url = source.sourceUrl || source.url;
          return (
            <a
              key={`${url}-${index}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-md bg-white px-3 py-2 text-slate-600 transition hover:text-brand-700"
            >
              <span className="block font-semibold text-slate-800">{source.sourceTitle || source.title || "官方来源"}</span>
              <span className="mt-1 block text-xs text-slate-500">
                {source.sourceOrganization || "官方发布"} {formatDate(source.publishedAt) || ""}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                前往官方原文
                <ExternalLink size={13} aria-hidden="true" />
              </span>
            </a>
          );
        })}
      </div>
    </details>
  );
}

function DataMetric({ label, value, helper, sources, emptyText = "官方字段暂未公开" }) {
  const hasValue = value !== null && value !== undefined && value !== "";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${hasValue ? "text-slate-950" : "text-slate-400"}`}>
        {hasValue ? value : emptyText}
      </p>
      {helper && <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>}
      <SourceDisclosure sources={sources} />
    </div>
  );
}

function SourceButton({ source }) {
  const url = source?.url || source?.sourceUrl;
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-1 rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:border-brand-400 hover:bg-blue-50"
    >
      前往官方原文
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

function methodLabel(method) {
  if (method === "official-quota") return "官方专业名额";
  if (method === "official-list-count") return "官方名单计数";
  if (method === "college-list-count") return "学院名单按专业计数";
  if (method === "credible-reference") return "公开参考统计";
  if (method === "third-party-estimate") return "第三方估算";
  return "未识别";
}

function AccountingYearCard({ item }) {
  const missing = item.dataStatus === "missing" || item.recommendedCount == null;
  const sourceLabel = getSourceLevelLabel(item.sourceLevel, item.dataStatus);
  const sourceTone =
    item.sourceLevel === "official"
      ? "border-blue-100 bg-blue-50 text-brand-700"
      : item.sourceLevel === "third-party-estimate"
        ? "border-amber-100 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-950">{item.graduationYear}届</h3>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${sourceTone}`}>{sourceLabel}</span>
      </div>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">会计学推免人数</p>
          <p className={`mt-1 text-2xl font-bold ${missing ? "text-slate-400" : "text-slate-950"}`}>
            {missing ? "暂未找到可核验数据" : `${item.recommendedCount}人`}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-500">会计学保研率</p>
          <p className="mt-1 text-xl font-bold text-slate-400">
            {formatPercent(item.recommendationRate) || "暂无法计算"}
          </p>
          {!item.recommendationRate && !missing && (
            <p className="mt-1 text-xs leading-5 text-slate-500">未找到同届会计学本科毕业生人数，不使用其他口径估算。</p>
          )}
        </div>
      </div>
      {item.isEstimated && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">根据公开资料估算，仅供参考。</p>}
      {(item.sources || []).length > 0 && (
        <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-semibold text-brand-700">查看来源</summary>
          <div className="mt-3 space-y-3">
            {item.sources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg bg-white px-3 py-2 text-slate-600 transition hover:text-brand-700"
              >
                <span className="block font-semibold text-slate-800">{source.title}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {source.organization} {formatDate(source.publishedAt)}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  数据类型：{source.sourceType || "recommendation-list"} · 统计方法：{methodLabel(source.countMethod || item.countMethod)}
                </span>
                {item.calculationMethod && <span className="mt-1 block text-xs text-slate-500">计算公式：{item.calculationMethod}</span>}
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                  官方原文链接
                  <ExternalLink size={13} aria-hidden="true" />
                </span>
              </a>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default function MySchoolPage() {
  const { user } = useAuth();
  const [schools, setSchools] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [binding, setBinding] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyBinding);
  const [schoolDetail, setSchoolDetail] = useState(null);
  const [collegeDetail, setCollegeDetail] = useState(null);
  const [majorData, setMajorData] = useState(null);
  const [majorsLoading, setMajorsLoading] = useState(false);
  const [majorsError, setMajorsError] = useState("");
  const [recommendationData, setRecommendationData] = useState(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);

  const canSave = Boolean(user && user.loginType === "phone_mock");

  useEffect(() => {
    const controller = new AbortController();
    async function loadSchools() {
      setSchoolsLoading(true);
      setLoadError("");
      try {
        setSchools(await fetchSchools({ signal: controller.signal }));
      } catch (error) {
        if (error.name !== "AbortError") {
          setLoadError("院校数据加载失败，请稍后刷新页面。");
          setSchools([]);
        }
      } finally {
        if (!controller.signal.aborted) setSchoolsLoading(false);
      }
    }
    loadSchools();
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const nextBinding = readBinding(user);
    setBinding(nextBinding);
    setEditing(!nextBinding);
    setForm(nextBinding || emptyBinding);
    setMessage("");
    setErrorMessage("");
  }, [user]);

  const selectedSchoolId = editing ? form.schoolId || "" : binding?.schoolId || "";
  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId) || null,
    [schools, selectedSchoolId],
  );
  const boundSchool = useMemo(
    () => schools.find((school) => school.id === binding?.schoolId) || null,
    [binding?.schoolId, schools],
  );

  useEffect(() => {
    if (!selectedSchoolId) {
      setSchoolDetail(null);
      return undefined;
    }

    const controller = new AbortController();
    async function loadDetail() {
      try {
        setSchoolDetail(await fetchSchoolDetail(selectedSchoolId, { signal: controller.signal }));
      } catch (error) {
        if (error.name !== "AbortError") setSchoolDetail(null);
      }
    }
    loadDetail();
    return () => controller.abort();
  }, [selectedSchoolId]);

  useEffect(() => {
    if (!binding?.schoolId || !binding?.collegeId) {
      setCollegeDetail(null);
      return undefined;
    }

    const controller = new AbortController();
    async function loadCollegeDetail() {
      try {
        setCollegeDetail(await fetchCollegeDetail(binding.schoolId, binding.collegeId, { signal: controller.signal }));
      } catch (error) {
        if (error.name !== "AbortError") setCollegeDetail(null);
      }
    }
    loadCollegeDetail();
    return () => controller.abort();
  }, [binding?.collegeId, binding?.schoolId]);

  useEffect(() => {
    if (!editing || !form.schoolId || !form.collegeId) {
      setMajorData(null);
      setMajorsError("");
      setMajorsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    async function loadMajors() {
      setMajorsLoading(true);
      setMajorsError("");
      try {
        setMajorData(await fetchCollegeMajors(form.schoolId, form.collegeId, { signal: controller.signal }));
      } catch (error) {
        if (error.name !== "AbortError") {
          setMajorData(null);
          setMajorsError("专业目录加载失败，请稍后重试。");
        }
      } finally {
        if (!controller.signal.aborted) setMajorsLoading(false);
      }
    }

    loadMajors();
    return () => controller.abort();
  }, [editing, form.collegeId, form.schoolId]);

  useEffect(() => {
    if (!binding?.schoolId) {
      setRecommendationData(null);
      setRecommendationError("");
      return undefined;
    }

    const controller = new AbortController();
    async function loadRecommendationData() {
      setRecommendationLoading(true);
      setRecommendationError("");
      try {
        setRecommendationData(await fetchMySchoolRecommendationData(binding.schoolId, { signal: controller.signal }));
      } catch (error) {
        if (error.name !== "AbortError") {
          setRecommendationData(null);
          setRecommendationError("推免资料加载失败，请稍后刷新页面。");
        }
      } finally {
        if (!controller.signal.aborted) setRecommendationLoading(false);
      }
    }

    loadRecommendationData();
    return () => controller.abort();
  }, [binding?.schoolId]);

  const collegeOptions = useMemo(() => getAcademicUnits(schoolDetail), [schoolDetail]);
  const majorOptions = useMemo(() => getActiveMajors(majorData), [majorData]);

  const collegeNotices = Array.isArray(collegeDetail?.notices) ? collegeDetail.notices : [];
  const matchedRecommendation = getMatchedRecommendationData(recommendationData, binding || {});
  const latestPolicy = matchedRecommendation.policy;
  const rankingRule = matchedRecommendation.rankingRule;
  const bonusRules = matchedRecommendation.bonusRules;
  const recommendationNotices = matchedRecommendation.notices;
  const accountingHistory = matchedRecommendation.accountingHistory || [];
  const accountingYearCards = getLatestThreeAccountingYears(accountingHistory);
  const visibleNotices = recommendationNotices.length ? recommendationNotices : collegeNotices;
  const bindingComplete = Boolean(form.schoolId && form.collegeId && form.majorId && form.grade);
  const saveDisabled = !bindingComplete || majorsLoading || Boolean(majorsError) || !majorOptions.length;

  const updateForm = (field, value) => {
    setForm((current) => {
      if (field === "schoolId") {
        const school = schools.find((item) => item.id === value);
        return {
          ...current,
          schoolId: value,
          schoolName: school?.name || "",
          collegeId: "",
          collegeName: "",
          majorId: "",
          majorName: "",
          majorCode: null,
        };
      }

      if (field === "collegeId") {
        const college = collegeOptions.find((unit) => unit.id === value);
        return {
          ...current,
          collegeId: value,
          collegeName: college?.name || "",
          majorId: "",
          majorName: "",
          majorCode: null,
        };
      }

      if (field === "grade") {
        return { ...current, grade: value, graduationYear: inferGraduationYear(value) };
      }

      return { ...current, [field]: value };
    });
    setMessage("");
    setErrorMessage("");
  };

  const handleSchoolChange = (school) => {
    setForm((current) => ({
      ...current,
      schoolId: school?.id || "",
      schoolName: school?.name || "",
      collegeId: "",
      collegeName: "",
      majorId: "",
      majorName: "",
      majorCode: null,
    }));
    setMessage("");
    setErrorMessage("");
  };

  const handleMajorChange = (major) => {
    setForm((current) => ({
      ...current,
      majorId: major?.id || "",
      majorName: major?.name || "",
      majorCode: major?.code ?? null,
    }));
    setMessage("");
    setErrorMessage("");
  };

  const handleSave = () => {
    if (!canSave) {
      setLoginOpen(true);
      return;
    }

    if (!form.schoolId || !form.collegeId || !form.majorId || !form.grade) {
      setErrorMessage("请完整选择本科院校、学院、专业和年级。");
      return;
    }

    if (!majorOptions.length) {
      setErrorMessage("该学院本科专业目录尚未补充，暂时无法完成绑定。");
      return;
    }

    const selectedMajorOption = majorOptions.find((major) => major.id === form.majorId);

    const nextBinding = {
      schoolId: form.schoolId,
      schoolName: form.schoolName || selectedSchool?.name || "",
      collegeId: form.collegeId || null,
      collegeName: form.collegeName || null,
      majorId: form.majorId,
      majorName: selectedMajorOption?.name || form.majorName,
      majorCode: selectedMajorOption?.code ?? form.majorCode ?? null,
      grade: form.grade,
      graduationYear: inferGraduationYear(form.grade),
      updatedAt: new Date().toISOString(),
    };
    saveBinding(user.id, nextBinding);
    setBinding(nextBinding);
    setForm(nextBinding);
    setEditing(false);
    setMessage("我的院校绑定已保存到当前浏览器。");
  };

  const handleUnbind = () => {
    if (!user?.id) return;
    if (!window.confirm("确定解除当前院校绑定吗？这不会删除你的其他数据。")) return;
    removeBinding(user.id);
    setBinding(null);
    setForm(emptyBinding);
    setEditing(true);
    setMessage("已解除院校绑定。");
  };

  const renderBindingForm = () => (
    <Card className="p-6">
      <CardHeader
        eyebrow="院校绑定"
        title="绑定本科院校"
        description="绑定后可以集中查看本校推免政策、相关通知和学校评价。"
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="block lg:col-span-2">
          <span className="field-label">本科院校</span>
          <SearchableSchoolSelect
            schools={schools}
            value={form.schoolId}
            onChange={handleSchoolChange}
            placeholder="请选择学校"
            disabled={schoolsLoading}
            loading={schoolsLoading}
          />
        </div>
        <label className="block">
          <span className="field-label">学院</span>
          <select
            className="field-control"
            value={form.collegeId || ""}
            onChange={(event) => updateForm("collegeId", event.target.value)}
            disabled={!form.schoolId || !collegeOptions.length}
          >
            <option value="">
              {!form.schoolId
                ? "请先选择本科院校"
                : collegeOptions.length
                  ? "请选择学院"
                  : "学院目录尚未补充，暂时无法完成绑定"}
            </option>
            {collegeOptions.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">专业</span>
          <SearchableMajorSelect
            majors={majorOptions}
            value={form.majorId}
            onChange={handleMajorChange}
            placeholder={!form.collegeId ? "请先选择学院" : "请选择专业"}
            disabled={!form.collegeId || majorsLoading || Boolean(majorsError)}
            loading={majorsLoading}
            emptyText={
              form.schoolId === "school-f17pfd"
                ? "该学院本科专业目录尚未补充，暂时无法完成绑定。"
                : "该校专业目录尚未补充，目前试点仅开放上海海洋大学。"
            }
          />
          {majorsError && <p className="mt-2 text-xs text-red-600">{majorsError}</p>}
        </label>
        <label className="block">
          <span className="field-label">年级</span>
          <select className="field-control" value={form.grade || ""} onChange={(event) => updateForm("grade", event.target.value)}>
            {gradeOptions.map((grade) => (
              <option key={grade || "empty"} value={grade}>
                {grade || "请选择"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {errorMessage && <p className="mt-3 text-sm font-semibold text-red-600">{errorMessage}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {binding && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setForm(binding);
              setErrorMessage("");
              setEditing(false);
            }}
          >
            取消修改
          </button>
        )}
        <button type="button" className="btn-primary disabled:cursor-not-allowed disabled:opacity-50" onClick={handleSave} disabled={saveDisabled}>
          保存绑定
        </button>
      </div>
    </Card>
  );

  return (
    <div className="bg-slate-50 py-10">
      <div className="container-page">
        <CardHeader
          eyebrow="个人院校"
          title="我的院校"
          description="绑定你的本科院校和学院后，可以集中查看本校推免政策、推免率、名额、排名规则和历年通知。"
        />

        {!canSave && (
          <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-brand-700">
            当前可以浏览功能框架；保存院校绑定和发布学校评价需要使用手机号体验登录。
          </div>
        )}

        {loadError && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{loadError}</span>
            <button
              type="button"
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-300"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              重新加载
            </button>
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {editing || !binding ? (
            renderBindingForm()
          ) : (
            <Card className="p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-700">当前绑定</p>
                  <h2 className="mt-2 text-3xl font-bold text-slate-950">{binding.schoolName}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                    {binding.collegeName && <span>{binding.collegeName}</span>}
                    {binding.majorName && <span>{binding.majorName}</span>}
                    {binding.grade && <span>{binding.grade}</span>}
                    {binding.graduationYear && <span>{binding.graduationYear}届</span>}
                  </div>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                    当前仅展示与你绑定的学校、学院、专业和届别相匹配的推免资料。
                  </p>
                  {boundSchool && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {boundSchool.levelTags.map((tag) => (
                        <span key={tag} className="badge w-fit">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
                    <RefreshCcw size={16} aria-hidden="true" />
                    修改绑定
                  </button>
                  <button
                    type="button"
                    className="btn-secondary border-red-200 text-red-600 hover:border-red-300 hover:text-red-700"
                    onClick={handleUnbind}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    解除绑定
                  </button>
                  <Link to={`/schools/${binding.schoolId}`} className="btn-primary">
                    查看学校详情
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </Card>
          )}

          {binding && !editing && (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-slate-950">本校概览</h2>
                  <div className="mt-4 grid gap-3 text-sm">
                    <p>
                      <span className="font-semibold text-slate-500">学校：</span>
                      {binding.schoolName}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-500">地区：</span>
                      {getRegionText(boundSchool)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-500">学院：</span>
                      {binding.collegeName || "暂未绑定学院"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-500">专业：</span>
                      {binding.majorName || binding.major || "暂未填写"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-500">对应届别：</span>
                      {binding.graduationYear ? `${binding.graduationYear}届` : "暂未根据年级推断"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-500">最近资料更新时间：</span>
                      {formatDate(recommendationData?.lastUpdatedAt || schoolDetail?.lastUpdated || schoolDetail?.crawlMeta?.lastCrawledAt) || "资料建设中"}
                    </p>
                    {recommendationData?.latestDataYear && (
                      <p>
                        <span className="font-semibold text-slate-500">最新官方公开年份：</span>
                        {recommendationData.latestDataYear}届
                      </p>
                    )}
                  </div>
                  {boundSchool?.typeTags?.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {boundSchool.typeTags.map((tag) => (
                        <span key={tag} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-6">
                  <h2 className="text-xl font-bold text-slate-950">推免数据</h2>
                  {recommendationLoading ? (
                    <EmptyInfo title="正在加载推免数据" description="正在读取本校公开推免资料。" />
                  ) : recommendationError ? (
                    <EmptyInfo title="推免数据加载失败" description={recommendationError} />
                  ) : recommendationData ? (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-brand-700">
                        以下数据仅针对上海海洋大学经济管理学院会计学专业。官方数据优先；部分历史数据可能根据公开名单或其他公开资料整理、估算，仅供参考，请以学校及学院当年正式通知为准。
                      </div>
                      <div className="grid gap-4 xl:grid-cols-3">
                        {accountingYearCards.map((item) => (
                          <AccountingYearCard key={item.graduationYear} item={item} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyInfo
                      title="数据建设中"
                      description="暂未获得该校官方公开推免数据。该校推免率数据正在整理中，后续将根据学校教务处、研究生院及学院官网公开信息持续补充。"
                    />
                  )}
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-slate-950">推免政策</h2>
                  {latestPolicy ? (
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-brand-700">
                          {latestPolicy.year}届 · {latestPolicy.applicabilityLabel || latestPolicy.collegeName || "学校级"}
                        </p>
                        <h3 className="mt-1 font-bold text-slate-950">{latestPolicy.title}</h3>
                      </div>
                      <div className="space-y-4">
                        <FieldList title="基本申请条件" items={latestPolicy.eligibility?.studentStatus} />
                        <FieldList title="课程要求" items={latestPolicy.eligibility?.courseRequirements} />
                        <FieldList title="英语要求" items={latestPolicy.eligibility?.languageRequirements} />
                        <FieldList title="纪律要求" items={latestPolicy.eligibility?.disciplineRequirements} />
                        <FieldList title="特殊学术专长" items={latestPolicy.eligibility?.otherRequirements} />
                        <FieldList title="材料要求" items={latestPolicy.materials} />
                        <FieldList title="申请时间" items={latestPolicy.schedule} />
                        <FieldList title="推荐程序" items={latestPolicy.procedure} />
                      </div>
                      <SourceButton source={latestPolicy.source} />
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                        政策可能随年度调整，请以当年学校及学院官方通知为准。
                      </p>
                    </div>
                  ) : (
                    <EmptyInfo title="暂未收录该校最新推免政策" description="请以学校教务处和学院官方通知为准。" />
                  )}
                </Card>
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-slate-950">综合排名规则</h2>
                  {rankingRule ? (
                    <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                      <p>
                        <span className="font-semibold text-slate-700">推荐成绩公式：</span>
                        {rankingRule.formula}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">排名范围：</span>
                        {rankingRule.rankingScope}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DataMetric label="学业成绩权重" value={rankingRule.academicWeight != null ? `${rankingRule.academicWeight * 100}%` : null} />
                        <DataMetric label="加分绩点权重" value={rankingRule.bonusWeight != null ? `${rankingRule.bonusWeight * 100}%` : null} />
                      </div>
                      <FieldList title="官方规则摘要" items={rankingRule.rules} />
                      <SourceButton source={rankingRule.source} />
                    </div>
                  ) : (
                    <EmptyInfo title="规则资料建设中" description="学业成绩占比、科研竞赛加分、综合素质加分和扣分规则后续将依据官方文件补充。" />
                  )}
                </Card>
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-slate-950">加分项目</h2>
                  {bonusRules.length ? (
                      <div className="mt-4 space-y-4">
                        {bonusRules.map((rule) => (
                          <div key={`${rule.year}-${rule.category}`} className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-950">{rule.category}</p>
                            {rule.applicabilityLabel && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{rule.applicabilityLabel}</span>
                            )}
                          </div>
                          <div className="mt-3 space-y-3">
                            {(rule.items || []).map((item) => (
                              <div key={item.name} className="text-sm leading-6 text-slate-600">
                                <p className="font-semibold text-slate-800">{item.name}</p>
                                {item.condition && <p>适用条件：{item.condition}</p>}
                                {item.scoreRule && <p>加分方式：{item.scoreRule}</p>}
                                {item.cap && <p>上限：{item.cap}</p>}
                              </div>
                            ))}
                          </div>
                          <SourceButton source={rule.source} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyInfo title="加分项目待整理" description="学科竞赛、科研项目、论文专利、英语成绩、社会实践和学生工作等项目将按官方规则归档。" />
                  )}
                </Card>
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-slate-950">历年趋势</h2>
                  {accountingHistory.length ? (
                    <div className="mt-4 space-y-4">
                      <AccountingRecommendationTrendChart history={accountingHistory} />
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="text-xs uppercase text-slate-500">
                            <tr>
                              <th className="px-3 py-2">届别</th>
                              <th className="px-3 py-2">推荐名单计数</th>
                              <th className="px-3 py-2">毕业生人数</th>
                              <th className="px-3 py-2">推免率</th>
                              <th className="px-3 py-2">数据性质</th>
                              <th className="px-3 py-2">来源</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {[...accountingHistory].sort((a, b) => a.graduationYear - b.graduationYear).map((row) => (
                              <tr key={row.graduationYear}>
                                <td className="px-3 py-2">{row.graduationYear}届</td>
                                <td className="px-3 py-2">{row.recommendedCount ?? "未识别"}</td>
                                <td className="px-3 py-2">{row.cohortSize ?? "未找到"}</td>
                                <td className="px-3 py-2">{formatPercent(row.recommendationRate) || "暂无法计算"}</td>
                                <td className="px-3 py-2">{getSourceLevelLabel(row.sourceLevel, row.dataStatus)}</td>
                                <td className="px-3 py-2">
                                  {row.sources?.[0]?.url ? (
                                    <a className="font-semibold text-brand-700 hover:underline" href={row.sources[0].url} target="_blank" rel="noopener noreferrer">
                                      官方原文
                                    </a>
                                  ) : (
                                    "无"
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <EmptyInfo title="暂无可视化数据" description="没有官方数据时不渲染虚假图表；后续将展示年份、推免人数、学生人数和推免率。" />
                  )}
                </Card>
              </div>

              <Card className="p-6">
                <h2 className="text-xl font-bold text-slate-950">相关通知</h2>
                {visibleNotices.length ? (
                  <div className="mt-4 space-y-3">
                    {visibleNotices.slice(0, 8).map((notice) => (
                      <a
                        key={notice.id || notice.source?.url || notice.title}
                        href={notice.source?.url || notice.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand-300"
                      >
                        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                        <span>
                          <span className="block font-semibold text-slate-950">{notice.title}</span>
                          <span className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                            {notice.year && <span>{notice.year}届</span>}
                            {notice.sourceOrganization && <span>{notice.sourceOrganization}</span>}
                            {notice.publishedAt && <span>{formatDate(notice.publishedAt)}</span>}
                            {notice.label && <span className="rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-brand-700">{notice.label}</span>}
                          </span>
                          {notice.summary && <span className="mt-2 block text-sm leading-6 text-slate-600">{notice.summary}</span>}
                          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                            前往官方原文
                            <ExternalLink size={13} aria-hidden="true" />
                          </span>
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <EmptyInfo title="相关通知正在整理中" description="后续将展示推免办法、夏令营、预推免、名额公示、综合排名通知和重要时间节点。" />
                )}
              </Card>

              <SchoolRatingSection schoolId={binding.schoolId} schoolName={binding.schoolName} />
            </>
          )}
        </div>
      </div>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
