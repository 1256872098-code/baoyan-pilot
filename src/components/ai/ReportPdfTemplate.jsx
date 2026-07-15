import React, { forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const ReportPdfTemplate = forwardRef(function ReportPdfTemplate(
  { content, generatedAt = new Date(), title = "保研院校梯度规划报告" },
  ref,
) {
  const generatedDate =
    generatedAt instanceof Date
      ? generatedAt.toLocaleDateString("zh-CN")
      : new Date(generatedAt).toLocaleDateString("zh-CN");

  return (
    <article ref={ref} className="bg-white p-10 text-slate-900">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold text-brand-700">保研领航员 Baoyan Pilot</p>
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">生成日期：{generatedDate}</p>
      </header>

      <main className="prose prose-slate mt-6 max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </main>

      <footer className="mt-8 border-t border-slate-200 pt-4 text-xs leading-6 text-slate-500">
        本报告由 BaoyanPilot AI 辅助生成，仅供升学规划参考。招生政策、推免资格和院校要求请以学校官方最新通知为准。
      </footer>
    </article>
  );
});
