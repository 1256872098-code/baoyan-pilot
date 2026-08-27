import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, FileCheck, LoaderCircle, ShieldCheck, UploadCloud } from "lucide-react";
import { Card } from "../Card.jsx";
import SearchableSchoolSelect from "../school/SearchableSchoolSelect.jsx";
import {
  fetchLatestStudentVerification,
  submitStudentVerification,
  validateVerificationPdf,
} from "../../services/studentVerificationService.js";

const statusMeta = {
  unverified: {
    label: "未核验",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  pending: {
    label: "待审核",
    className: "border-blue-200 bg-blue-50 text-brand-700",
  },
  needs_more_info: {
    label: "需补充材料",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  verified: {
    label: "已核验",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  rejected: {
    label: "未通过",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export default function StudentVerificationCard({
  user,
  userName,
  binding,
  schools = [],
  schoolsLoading = false,
  schoolsError = "",
  onVerificationChange,
}) {
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [selectedSchoolId, setSelectedSchoolId] = useState(binding?.schoolId || "");
  const [collegeName, setCollegeName] = useState(binding?.collegeName || "");
  const [majorName, setMajorName] = useState(binding?.majorName || binding?.major || "");
  const [reportFile, setReportFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const status = verification?.status || "unverified";
  const currentStatusMeta = statusMeta[status] || statusMeta.unverified;
  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === selectedSchoolId) || null,
    [schools, selectedSchoolId],
  );
  const canApply = !["pending", "verified"].includes(status);
  const buttonLabel = useMemo(() => {
    if (status === "needs_more_info") return "补充核验材料";
    if (status === "rejected") return "重新申请学籍核验";
    return "申请学籍核验";
  }, [status]);

  useEffect(() => {
    setSelectedSchoolId((current) => current || binding?.schoolId || "");
    setCollegeName(binding?.collegeName || "");
    setMajorName(binding?.majorName || binding?.major || "");
  }, [binding?.collegeName, binding?.major, binding?.majorName, binding?.schoolId]);

  useEffect(() => {
    if (selectedSchoolId || !schools.length) return;
    const schoolName = verification?.school_name || binding?.schoolName;
    const matchedSchool = schools.find((school) => school.name === schoolName);
    if (matchedSchool) setSelectedSchoolId(matchedSchool.id);
  }, [binding?.schoolName, schools, selectedSchoolId, verification?.school_name]);

  useEffect(() => {
    let active = true;
    async function loadVerification() {
      setLoading(true);
      setError("");
      try {
        const row = await fetchLatestStudentVerification(user?.id);
        if (active) {
          setVerification(row);
          onVerificationChange?.(row);
          if (row) {
            setSelectedSchoolId(row.school_id || "");
            setCollegeName(row.college_name || "");
            setMajorName(row.major_name || "");
          }
        }
      } catch (loadError) {
        if (active) setError(loadError?.message || "核验状态加载失败，请稍后重试。");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (user?.id) loadVerification();
    else setLoading(false);
    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    const fileError = validateVerificationPdf(file);
    if (fileError) {
      event.target.value = "";
      setReportFile(null);
      setError(fileError);
      return;
    }
    setReportFile(file);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const row = await submitStudentVerification({
        user,
        userName,
        schoolId: selectedSchool?.id || "",
        schoolName: selectedSchool?.name || "",
        collegeName,
        majorName,
        verificationCode,
        reportFile,
      });
      setVerification(row);
      onVerificationChange?.(row);
      setVerificationCode("");
      setReportFile(null);
      setShowForm(false);
      setMessage("材料已提交，正在等待审核。");
    } catch (submitError) {
      setError(submitError?.message || "材料提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">学籍核验</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            通过《教育部学籍在线验证报告》辅助核验你的本科院校及学籍信息。
          </p>
        </div>
        <ShieldCheck className="h-8 w-8 shrink-0 text-brand-600" aria-hidden="true" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${currentStatusMeta.className}`}>
          当前状态：{loading ? "加载中" : currentStatusMeta.label}
        </span>
      </div>

      {status === "pending" && (
        <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-brand-700">
          材料已提交，正在等待审核。
        </p>
      )}

      {status === "verified" && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <p className="flex items-center gap-2 font-bold text-emerald-800">
            <CheckCircle2 size={19} aria-hidden="true" />
            学籍已核验
          </p>
          <dl className="mt-3 grid gap-2 text-sm text-slate-700">
            <div><dt className="inline font-semibold">学校：</dt><dd className="inline">{verification.school_name}</dd></div>
            <div><dt className="inline font-semibold">学院：</dt><dd className="inline">{verification.college_name}</dd></div>
            <div><dt className="inline font-semibold">专业：</dt><dd className="inline">{verification.major_name}</dd></div>
            <div><dt className="inline font-semibold">核验日期：</dt><dd className="inline">{formatDate(verification.verified_at) || "—"}</dd></div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-emerald-800">经用户提供的教育部学籍在线验证报告核验。</p>
        </div>
      )}

      {["needs_more_info", "rejected"].includes(status) && (
        <div className={`mt-4 rounded-lg border px-3 py-3 text-sm leading-6 ${
          status === "needs_more_info"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          <p className="font-bold">{status === "needs_more_info" ? "请根据审核说明补充材料。" : "本次申请未通过。"}</p>
          {verification?.admin_note && <p className="mt-1">审核说明：{verification.admin_note}</p>}
        </div>
      )}

      {verification?.ai_review_result && (
        <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">AI辅助预审（不代表最终审核）</summary>
          <p className="mt-2 font-semibold text-slate-800">{verification.ai_review_result}</p>
          <p className="mt-1 leading-6 text-slate-600">{verification.ai_review_reason}</p>
        </details>
      )}

      {verification?.report_signed_url && (
        <a
          href={verification.report_signed_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
        >
          查看已提交PDF（临时安全链接）
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}

      {message && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{message}</p>}
      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {canApply && !showForm && (
        <button
          type="button"
          className="btn-secondary mt-5 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
          onClick={() => {
            setShowForm(true);
            setMessage("");
            setError("");
          }}
        >
          <FileCheck size={16} aria-hidden="true" />
          {buttonLabel}
        </button>
      )}

      {canApply && showForm && (
        <form className="mt-5 space-y-4 border-t border-slate-200 pt-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="field-label">学信网16位在线验证码</span>
            <input
              className="field-control font-mono tracking-wider"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 16))}
              inputMode="numeric"
              autoComplete="off"
              maxLength={16}
              required
              placeholder="请输入16位数字验证码"
            />
          </label>
          <label className="block">
            <span className="field-label">认证学校</span>
            <SearchableSchoolSelect
              schools={schools}
              value={selectedSchoolId}
              onChange={(school) => setSelectedSchoolId(school?.id || "")}
              placeholder="请选择需要核验的学校"
              disabled={schoolsLoading}
              loading={schoolsLoading}
            />
            <span className="mt-1 block text-xs leading-5 text-slate-400">
              可自由选择需要核验的学校，不受“我的院校”当前绑定限制。
            </span>
            {schoolsError && <span className="mt-1 block text-xs font-semibold text-red-600">{schoolsError}</span>}
          </label>
          <label className="block">
            <span className="field-label">学院</span>
            <input className="field-control" value={collegeName} onChange={(event) => setCollegeName(event.target.value)} required maxLength={160} />
          </label>
          <label className="block">
            <span className="field-label">专业</span>
            <input className="field-control" value={majorName} onChange={(event) => setMajorName(event.target.value)} required maxLength={160} />
          </label>
          <label className="block rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <UploadCloud size={17} aria-hidden="true" />
              《教育部学籍在线验证报告》PDF（可选，最大3MB）
            </span>
            <input className="mt-3 block w-full text-sm text-slate-600" type="file" accept="application/pdf,.pdf" onChange={handleFileChange} />
            {reportFile && <span className="mt-2 block truncate text-xs text-slate-500">已选择：{reportFile.name}</span>}
          </label>
          <p className="text-xs leading-5 text-slate-500">
            AI仅辅助提取学校、学院、专业、学籍状态和报告有效期，并给出预审建议；最终结果必须由管理员人工审核。请勿上传身份证照片、家庭住址等无关敏感材料。
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-secondary" disabled={submitting} onClick={() => setShowForm(false)}>取消</button>
            <button
              type="submit"
              className="btn-primary disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={submitting || verificationCode.length !== 16 || !selectedSchool || !collegeName.trim() || !majorName.trim()}
            >
              {submitting ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <FileCheck size={16} aria-hidden="true" />}
              {submitting ? "提交并预审中…" : "提交核验材料"}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
