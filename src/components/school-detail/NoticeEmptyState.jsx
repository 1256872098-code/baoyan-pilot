import React from "react";
import { FileSearch } from "lucide-react";

export default function NoticeEmptyState({ message = "该部分资料正在整理中，后续将根据学校研究生院和招生学院官网公开信息持续更新。" }) {
  return (
    <div className="rounded-lg border border-dashed border-blue-100 bg-blue-50/70 px-4 py-8 text-center">
      <FileSearch className="mx-auto h-9 w-9 text-brand-600" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-slate-700">{message}</p>
    </div>
  );
}
