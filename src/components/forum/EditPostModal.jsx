import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export default function EditPostModal({ open, post, categories, saving, errorMessage, onClose, onSubmit }) {
  const modalRef = useRef(null);
  const [form, setForm] = useState({
    title: "",
    category: "",
    content: "",
  });
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open || !post) return;
    setForm({
      title: post.title || "",
      category: post.category || categories[0] || "",
      content: post.content || "",
    });
    setLocalError("");
    modalRef.current?.scrollTo({ top: 0 });
  }, [categories, open, post]);

  if (!open || !post) return null;

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setLocalError("");
  };

  const handleSubmit = () => {
    const title = form.title.trim();
    const content = form.content.trim();
    const category = form.category;

    if (!title) {
      setLocalError("标题不能为空。");
      return;
    }

    if (!category) {
      setLocalError("分类不能为空。");
      return;
    }

    if (!content) {
      setLocalError("正文不能为空。");
      return;
    }

    onSubmit({ title, category, content });
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/45">
      <div className="flex min-h-dvh items-center justify-center px-4 py-6">
        <div ref={modalRef} className="max-h-[calc(100dvh-48px)] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950">编辑帖子</h2>
              <p className="mt-1 text-sm text-slate-500">只会修改标题、分类和正文，作者与发布时间不会改变。</p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              onClick={onClose}
              disabled={saving}
              aria-label="关闭"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 grid gap-4">
            <label className="block">
              <span className="field-label">标题</span>
              <input
                className="field-control"
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                placeholder="请输入帖子标题"
              />
            </label>
            <label className="block">
              <span className="field-label">分类</span>
              <select
                className="field-control"
                value={form.category}
                onChange={(event) => updateField("category", event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">正文</span>
              <textarea
                className="field-control min-h-[180px] resize-y"
                value={form.content}
                onChange={(event) => updateField("content", event.target.value)}
                placeholder="请写下你的经验、问题或资料信息"
              />
            </label>
          </div>

          {(localError || errorMessage) && (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {localError || errorMessage}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              取消
            </button>
            <button
              type="button"
              className="btn-primary disabled:cursor-not-allowed disabled:bg-slate-300"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "保存中..." : "保存修改"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
