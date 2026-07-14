import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, RefreshCcw, Trash2 } from "lucide-react";
import { Card, CardHeader } from "../components/Card.jsx";
import LoginModal from "../components/LoginModal.jsx";
import SchoolRatingSection from "../components/school-rating/SchoolRatingSection.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getAcademicUnits } from "../utils/academicUnits.js";
import { fetchCollegeDetail, fetchSchoolDetail, fetchSchools } from "../utils/schoolData.js";

const gradeOptions = ["", "大一", "大二", "大三", "大四", "研究生", "其他"];
const emptyBinding = {
  schoolId: "",
  schoolName: "",
  collegeId: "",
  collegeName: "",
  major: "",
  grade: "",
};

function getBindingKey(userId) {
  return `baoyanpilot_my_school_${userId}`;
}

function readBinding(user) {
  if (typeof window === "undefined" || !user?.id) return null;
  try {
    const stored = window.localStorage.getItem(getBindingKey(user.id));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
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

export default function MySchoolPage() {
  const { user } = useAuth();
  const [schools, setSchools] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [binding, setBinding] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyBinding);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolDetail, setSchoolDetail] = useState(null);
  const [collegeDetail, setCollegeDetail] = useState(null);
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
  }, []);

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

  const academicUnits = useMemo(() => getAcademicUnits(schoolDetail), [schoolDetail]);
  const filteredSchools = useMemo(() => {
    const keyword = schoolSearch.trim().toLowerCase();
    return schools
      .filter((school) => !keyword || school.name.toLowerCase().includes(keyword))
      .slice(0, 120);
  }, [schoolSearch, schools]);

  const notices = Array.isArray(collegeDetail?.notices) ? collegeDetail.notices : [];

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
        };
      }

      if (field === "collegeId") {
        const college = academicUnits.find((unit) => unit.id === value);
        return {
          ...current,
          collegeId: value,
          collegeName: college?.name || "",
        };
      }

      return { ...current, [field]: value };
    });
    setMessage("");
    setErrorMessage("");
  };

  const handleSave = () => {
    if (!canSave) {
      setLoginOpen(true);
      return;
    }

    if (!form.schoolId) {
      setErrorMessage("请先选择本科院校。");
      return;
    }

    const nextBinding = {
      schoolId: form.schoolId,
      schoolName: form.schoolName || selectedSchool?.name || "",
      collegeId: form.collegeId || null,
      collegeName: form.collegeName || null,
      major: form.major.trim(),
      grade: form.grade,
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
        description="绑定后可以集中查看本校推免政策、学院目录、相关通知和学校评价。"
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="block lg:col-span-2">
          <span className="field-label">搜索学校</span>
          <input
            className="field-control"
            value={schoolSearch}
            onChange={(event) => setSchoolSearch(event.target.value)}
            placeholder="输入学校名称筛选"
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="field-label">本科院校</span>
          <select
            className="field-control"
            value={form.schoolId}
            onChange={(event) => updateForm("schoolId", event.target.value)}
            disabled={schoolsLoading}
          >
            <option value="">{schoolsLoading ? "正在加载院校..." : "请选择学校"}</option>
            {filteredSchools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">学院</span>
          <select
            className="field-control"
            value={form.collegeId || ""}
            onChange={(event) => updateForm("collegeId", event.target.value)}
            disabled={!form.schoolId || !academicUnits.length}
          >
            <option value="">{academicUnits.length ? "可先不选择学院" : "学院目录尚未补充，可先只绑定学校"}</option>
            {academicUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
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
        <label className="block lg:col-span-2">
          <span className="field-label">专业</span>
          <input
            className="field-control"
            value={form.major || ""}
            onChange={(event) => updateForm("major", event.target.value)}
            placeholder="例如：会计学、计算机科学与技术"
          />
        </label>
      </div>

      {errorMessage && <p className="mt-3 text-sm font-semibold text-red-600">{errorMessage}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {binding && (
          <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
            取消修改
          </button>
        )}
        <button type="button" className="btn-primary" onClick={handleSave}>
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
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
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
                    {binding.major && <span>{binding.major}</span>}
                    {binding.grade && <span>{binding.grade}</span>}
                  </div>
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
                      {binding.major || "暂未填写"}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-500">最近资料更新时间：</span>
                      {schoolDetail?.lastUpdated || schoolDetail?.crawlMeta?.lastCrawledAt || "资料建设中"}
                    </p>
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
                  <EmptyInfo
                    title="数据建设中"
                    description="暂未获得该校官方公开推免数据。该校推免率数据正在整理中，后续将根据学校教务处、研究生院及学院官网公开信息持续补充。"
                  />
                </Card>
              </div>

              <Card className="p-6">
                <h2 className="text-xl font-bold text-slate-950">学院与专业</h2>
                {academicUnits.length ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {academicUnits.slice(0, 12).map((unit) => {
                      const active = unit.id === binding.collegeId;
                      return (
                        <Link
                          key={unit.id}
                          to={`/schools/${binding.schoolId}/colleges/${unit.id}`}
                          className={[
                            "rounded-lg border p-4 text-sm transition hover:border-brand-300 hover:bg-blue-50/50",
                            active ? "border-blue-200 bg-blue-50 text-brand-700" : "border-slate-200 bg-white text-slate-700",
                          ].join(" ")}
                        >
                          <span className="font-semibold">{unit.name}</span>
                          <span className="ml-2 text-xs text-slate-400">{unit.unitType}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyInfo title="学院目录正在补充中" description="当前暂未整理该校学院目录，可以先只绑定学校。" />
                )}
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-slate-950">推免政策</h2>
                  <EmptyInfo title="暂未收录该校最新推免政策" description="请以学校教务处和学院官方通知为准。" />
                </Card>
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-slate-950">综合排名规则</h2>
                  <EmptyInfo title="规则资料建设中" description="学业成绩占比、科研竞赛加分、综合素质加分和扣分规则后续将依据官方文件补充。" />
                </Card>
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-slate-950">加分项目</h2>
                  <EmptyInfo title="加分项目待整理" description="学科竞赛、科研项目、论文专利、英语成绩、社会实践和学生工作等项目将按官方规则归档。" />
                </Card>
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-slate-950">历年趋势</h2>
                  <EmptyInfo title="暂无可视化数据" description="没有官方数据时不渲染虚假图表；后续将展示年份、推免人数、学生人数和推免率。" />
                </Card>
              </div>

              <Card className="p-6">
                <h2 className="text-xl font-bold text-slate-950">相关通知</h2>
                {notices.length ? (
                  <div className="mt-4 space-y-3">
                    {notices.slice(0, 6).map((notice) => (
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
                          <span className="mt-1 block text-xs text-slate-500">前往官方原文</span>
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
