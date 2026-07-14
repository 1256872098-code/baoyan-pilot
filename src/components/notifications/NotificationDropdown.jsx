import React from "react";
import { CheckCheck, Loader2, RefreshCw } from "lucide-react";
import NotificationEmptyState from "./NotificationEmptyState.jsx";
import NotificationItem from "./NotificationItem.jsx";

export default function NotificationDropdown({
  notifications,
  filter,
  unreadCount,
  loading,
  markingAll,
  errorMessage,
  onFilterChange,
  onMarkAllRead,
  onSelect,
  onRetry,
}) {
  const isUnreadOnly = filter === "unread";

  return (
    <div
      className="absolute right-0 top-[calc(100%+8px)] z-[70] w-[min(400px,calc(100vw-24px))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      role="dialog"
      aria-label="消息通知"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-950">消息通知</p>
            <p className="mt-0.5 text-xs text-slate-500">{unreadCount > 0 ? `${unreadCount} 条未读` : "暂无未读消息"}</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:border-brand-200 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
            disabled={!unreadCount || markingAll}
            onClick={onMarkAllRead}
          >
            {markingAll ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CheckCheck size={14} aria-hidden="true" />}
            全部已读
          </button>
        </div>
        <div className="mt-3 inline-flex rounded-lg bg-slate-100 p-1">
          {[
            { value: "all", label: "全部" },
            { value: "unread", label: "未读" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              className={[
                "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                filter === item.value ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-900",
              ].join(" ")}
              onClick={() => onFilterChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="m-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          <div className="flex items-center justify-between gap-3">
            <span>{errorMessage}</span>
            <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={onRetry}>
              <RefreshCw size={13} aria-hidden="true" />
              重试
            </button>
          </div>
        </div>
      )}

      <div className="max-h-[560px] overflow-y-auto">
        {loading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-brand-600" aria-hidden="true" />
            <p className="mt-3">消息加载中...</p>
          </div>
        ) : notifications.length ? (
          notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onSelect={onSelect} />
          ))
        ) : (
          <NotificationEmptyState unreadOnly={isUnreadOnly} />
        )}
      </div>
    </div>
  );
}
