import React, { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, FileSearch, LoaderCircle, LogOut, RefreshCcw, ShieldAlert, XCircle } from "lucide-react";
import { Card, CardHeader } from "../components/Card.jsx";
import {
  fetchAdminStudentVerifications,
  reviewStudentVerification,
} from "../services/studentVerificationService.js";

const ADMIN_TOKEN_KEY = "baoyanpilot_student_verification_admin_token";

const statusMeta = {
  pending: { label: "待审核", className: "border-blue-200 bg-blue-50 text-brand-700" },
  needs_more_info: { label: "需补充材料", className: "border-amber-200 bg-amber-50 text-amber-700" },
  verified: { label: "已核验", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  rejected: { label: "未通过", className: "border-red-200 bg-red-50 text-red-700" },
};

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminStudentVerificationsPage() {
  const [adminToken, setAdminToken] = useState(() => window.sessionStorage.getItem(ADMIN_TOKEN_KEY) || "");
  const [tokenInput, setTokenInput] = useState("");
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRows = async (token = adminToken) => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      setRows(await fetchAdminStudentVerifications(token));
    } catch (loadError) {
      setRows([]);
      setError(loadError?.message || "审核列表加载失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminToken) loadRows(adminToken);
    // The token changes only after an explicit admin action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  const handleUnlock = (event) => {
    event.preventDefault();
    const nextToken = tokenInput.trim();
    if (!nextToken) return;
    window.sessionStorage.setItem(ADMIN_TOKEN_KEY, nextToken);
    setAdminToken(nextToken);
    setTokenInput("");
  };

  const handleLock = () => {
    window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken("");
    setRows([]);
    setError("");
    setMessage("");
  };

  const handleReview = async (row, status) => {
    const adminNote = String(notes[row.id] ?? row.admin_note ?? "").trim();
    if (["needs_more_info", "rejected"].includes(status) && !adminNote) {
      setError("要求补充材料或驳回时，请先填写审核说明。");
      return;
    }
    const actionLabel = status === "verified" ? "通过" : status === "rejected" ? "驳回" : "要求补充材料";
    if (!window.confirm(`确认${actionLabel}这份学籍核验申请吗？`)) return;

    setReviewingId(row.id);
    setError("");
    setMessage("");
    try {
      const updated = await reviewStudentVerification({ adminToken, id: row.id, status, adminNote });
      setRows((current) => current.map((item) => (item.id === row.id ? updated : item)));
      setMessage(`已完成操作：${actionLabel}。`);
    } catch (reviewError) {
      setError(reviewError?.message || "审核结果保存失败，请稍后重试。");
    } finally {
      setReviewingId("");
    }
  };

  if (!adminToken) {
    return (
      <div className="bg-slate-50 py-10">
        <div className="container-page max-w-xl">
          <Card className="p-7">
            <ShieldAlert className="h-10 w-10 text-brand-600" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-bold text-slate-950">学籍核验管理员入口</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              请输入服务端配置的管理员审核口令。口令仅保存在当前浏览器会话，不会写入前端代码或URL。
            </p>
            <form className="mt-5" onSubmit={handleUnlock}>
              <label className="block">
                <span className="field-label">管理员审核口令</span>
                <input
                  className="field-control"
                  type="password"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button type="submit" className="btn-primary mt-4 w-full">进入审核页面</button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 py-10">
      <div className="container-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <CardHeader
            eyebrow="管理员人工审核"
            title="学籍核验申请"
            description="AI结果仅供预审参考；只有管理员点击“通过”后，用户端才显示“学籍已核验”。"
          />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => loadRows()} disabled={loading}>
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              刷新
            </button>
            <button type="button" className="btn-secondary" onClick={handleLock}>
              <LogOut size={16} aria-hidden="true" />
              退出审核
            </button>
          </div>
        </div>

        {message && <p className="mt-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p>}
        {error && <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

        {loading ? (
          <Card className="mt-6 flex items-center justify-center gap-2 p-12 text-slate-500">
            <LoaderCircle className="animate-spin" aria-hidden="true" />
            正在加载申请…
          </Card>
        ) : rows.length ? (
          <div className="mt-6 space-y-5">
            {rows.map((row) => {
              const meta = statusMeta[row.status] || statusMeta.pending;
              const reviewing = reviewingId === row.id;
              return (
                <Card key={row.id} className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
                        <span className="text-xs text-slate-500">提交时间：{formatDateTime(row.submitted_at)}</span>
                      </div>
                      <h2 className="mt-3 text-xl font-bold text-slate-950">学校：{row.school_name}</h2>
                      <p className="mt-1 text-sm text-slate-600">学院：{row.college_name} · 专业：{row.major_name}</p>
                    </div>
                    <div className="text-sm text-slate-500 lg:text-right">
                      <p><span className="font-semibold text-slate-700">用户：</span>{row.user_name || "保研用户"}</p>
                      <p className="mt-1 break-all"><span className="font-semibold text-slate-700">用户ID：</span>{row.user_id}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold text-slate-500">在线验证码</p>
                      <p className="mt-2 font-mono text-base font-bold tracking-wider text-slate-950">{row.verification_code}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold text-slate-500">PDF材料</p>
                      {row.report_signed_url ? (
                        <a href={row.report_signed_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                          查看私有PDF（5分钟有效）
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">未上传PDF</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-brand-700">
                      <FileSearch size={17} aria-hidden="true" />
                      AI辅助预审结果（仅供参考）
                    </p>
                    <p className="mt-2 font-bold text-slate-900">{row.ai_review_result || "建议人工复核"}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{row.ai_review_reason || "未生成AI预审说明，请人工核验。"}</p>
                  </div>

                  <label className="mt-4 block">
                    <span className="field-label">管理员审核说明</span>
                    <textarea
                      className="field-control min-h-[88px] resize-y"
                      value={notes[row.id] ?? row.admin_note ?? ""}
                      onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value.slice(0, 1000) }))}
                      placeholder="通过时可选；要求补充材料或驳回时必填。"
                      maxLength={1000}
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn-secondary border-amber-200 text-amber-700" disabled={reviewing} onClick={() => handleReview(row, "needs_more_info")}>
                      <FileSearch size={16} aria-hidden="true" />
                      要求补充材料
                    </button>
                    <button type="button" className="btn-secondary border-red-200 text-red-700" disabled={reviewing} onClick={() => handleReview(row, "rejected")}>
                      <XCircle size={16} aria-hidden="true" />
                      驳回
                    </button>
                    <button type="button" className="btn-primary" disabled={reviewing || row.status === "verified"} onClick={() => handleReview(row, "verified")}>
                      {reviewing ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                      通过
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="mt-6 p-12 text-center text-slate-500">暂时没有学籍核验申请。</Card>
        )}
      </div>
    </div>
  );
}
