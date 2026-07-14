import React from "react";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  loading = false,
  tone = "danger",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const confirmClass =
    tone === "danger"
      ? "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
      : "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500";

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/45">
      <div className="flex min-h-dvh items-center justify-center px-4 py-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          {description && <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
              {cancelText}
            </button>
            <button
              type="button"
              className={`inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 ${confirmClass}`}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "处理中..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
