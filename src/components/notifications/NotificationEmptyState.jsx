import React from "react";
import { Bell } from "lucide-react";

export default function NotificationEmptyState({ unreadOnly = false }) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Bell size={18} aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">
        {unreadOnly ? "暂无未读消息" : "暂无消息通知"}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">新的回复、点赞和院校评价互动会显示在这里。</p>
    </div>
  );
}
