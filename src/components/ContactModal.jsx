import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Gift, Handshake, LoaderCircle, MessageSquareText, Send, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { FEEDBACK_TYPES, submitUserFeedback } from "../services/feedbackService.js";

const BUSINESS_WECHAT = "CUFEwwsa";

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export default function ContactModal({ open, onClose }) {
  const { user, profile } = useAuth();
  const [feedbackType, setFeedbackType] = useState(FEEDBACK_TYPES[0]);
  const [feedback, setFeedback] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const handleCopyWechat = async () => {
    try {
      await copyText(BUSINESS_WECHAT);
      setCopyStatus("微信号已复制");
    } catch {
      setCopyStatus(`请手动复制微信号：${BUSINESS_WECHAT}`);
    }
  };

  const handleSubmitFeedback = async (event) => {
    event.preventDefault();
    const content = feedback.trim();
    if (!content || isSubmitting) return;

    setIsSubmitting(true);
    setFeedbackStatus({ type: "", message: "" });
    try {
      const pagePath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      await submitUserFeedback({ user, profile, feedbackType, content, pagePath });
      setFeedback("");
      setFeedbackType(FEEDBACK_TYPES[0]);
      setFeedbackStatus({ type: "success", message: "反馈提交成功，感谢你的建议！" });
    } catch (error) {
      setFeedbackStatus({ type: "error", message: error?.message || "反馈提交失败，请稍后重试。" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
          <div>
            <p className="text-sm font-bold text-brand-700">联系与支持</p>
            <h2 id="contact-modal-title" className="mt-1 text-2xl font-bold text-slate-950">
              联系我们
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">商务合作、赞助支持或产品建议，都可以在这里联系我们。</p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            onClick={onClose}
            aria-label="关闭联系我们弹窗"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-5 px-5 py-6 sm:px-6">
          <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-5" aria-labelledby="business-cooperation-title">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sm">
                <Handshake size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 id="business-cooperation-title" className="font-bold text-slate-950">商务合作</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  商务合作请加 V：<strong className="text-slate-950">{BUSINESS_WECHAT}</strong>
                </p>
                <button type="button" className="btn-secondary mt-3 px-3 py-2 text-sm" onClick={handleCopyWechat}>
                  <Copy size={15} aria-hidden="true" />
                  复制微信号
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-5" aria-labelledby="sponsor-title">
            <div className="flex items-center gap-2">
              <Gift size={19} className="text-emerald-700" aria-hidden="true" />
              <h3 id="sponsor-title" className="font-bold text-slate-950">赞助我们</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">感谢你的支持，可使用微信扫描下方二维码。</p>
            <div className="mt-4 flex justify-center rounded-xl border border-emerald-100 bg-white p-3">
              <img
                src="/images/wechat-sponsor-qr.jpg"
                alt="赞助保研领航员的微信支付二维码"
                className="h-auto w-full max-w-[300px] rounded-lg object-contain"
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 p-5" aria-labelledby="feedback-title">
            <div className="flex items-center gap-2">
              <MessageSquareText size={19} className="text-brand-700" aria-hidden="true" />
              <h3 id="feedback-title" className="font-bold text-slate-950">向我们提出反馈意见</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              遇到问题或有功能建议，可以直接提交给我们，我们会持续查看并改进。
            </p>
            <form className="mt-4" onSubmit={handleSubmitFeedback}>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">反馈类型</span>
                <select
                  value={feedbackType}
                  onChange={(event) => {
                    setFeedbackType(event.target.value);
                    setFeedbackStatus({ type: "", message: "" });
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                >
                  {FEEDBACK_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">反馈内容</span>
                <textarea
                  value={feedback}
                  onChange={(event) => {
                    setFeedback(event.target.value);
                    setFeedbackStatus({ type: "", message: "" });
                  }}
                  maxLength={500}
                  required
                  rows={5}
                  placeholder="例如：功能建议、页面问题、资料纠错或使用体验……"
                  className="w-full resize-y rounded-lg border border-slate-300 px-3.5 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-400">{feedback.length}/500</p>
                <button
                  type="submit"
                  className="btn-primary px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!feedback.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Send size={16} aria-hidden="true" />
                  )}
                  {isSubmitting ? "提交中…" : "提交反馈"}
                </button>
              </div>
              {feedbackStatus.message && (
                <p
                  className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                    feedbackStatus.type === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                  role="status"
                >
                  {feedbackStatus.type === "success" && <Check size={15} className="mr-1 inline" aria-hidden="true" />}
                  {feedbackStatus.message}
                </p>
              )}
            </form>
          </section>

          {copyStatus && (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-600" role="status">
              {copyStatus}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
