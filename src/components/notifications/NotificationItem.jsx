import React from "react";
import { Reply, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { formatRelativeTime } from "../../utils/formatRelativeTime.js";

const notificationMeta = {
  forum_post_reply: {
    title: "有人回复了你的帖子",
    icon: Reply,
    tone: "text-brand-700 bg-blue-50",
  },
  forum_reply_reply: {
    title: "有人回复了你的评论",
    icon: Reply,
    tone: "text-brand-700 bg-blue-50",
  },
  forum_post_like: {
    title: "有人点赞了你的帖子",
    icon: ThumbsUp,
    tone: "text-emerald-700 bg-emerald-50",
  },
  forum_post_dislike: {
    title: "有人点踩了你的帖子",
    icon: ThumbsDown,
    tone: "text-amber-700 bg-amber-50",
  },
  forum_reply_like: {
    title: "有人点赞了你的评论",
    icon: ThumbsUp,
    tone: "text-emerald-700 bg-emerald-50",
  },
  forum_reply_dislike: {
    title: "有人点踩了你的评论",
    icon: ThumbsDown,
    tone: "text-amber-700 bg-amber-50",
  },
  school_review_like: {
    title: "有人点赞了你的院校评价",
    icon: Star,
    tone: "text-brand-700 bg-blue-50",
  },
  school_review_dislike: {
    title: "有人点踩了你的院校评价",
    icon: Star,
    tone: "text-amber-700 bg-amber-50",
  },
};

export function getNotificationTitle(notification) {
  return notificationMeta[notification?.type]?.title || "新的消息通知";
}

export default function NotificationItem({ notification, onSelect }) {
  const meta = notificationMeta[notification.type] || notificationMeta.forum_post_reply;
  const Icon = meta.icon;
  const isUnread = !notification.is_read;
  const title = getNotificationTitle(notification);

  return (
    <button
      type="button"
      className={[
        "flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0",
        isUnread ? "bg-blue-50/75 hover:bg-blue-50" : "bg-white hover:bg-slate-50",
      ].join(" ")}
      onClick={() => onSelect(notification)}
    >
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
        <Icon size={17} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className={`text-sm leading-5 ${isUnread ? "font-bold text-slate-950" : "font-semibold text-slate-700"}`}>
            {title}
          </span>
          {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />}
        </span>
        {notification.target_title && (
          <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{notification.target_title}</span>
        )}
        {notification.target_preview && (
          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500">{notification.target_preview}</span>
        )}
        <span className="mt-1 block text-xs text-slate-400">{formatRelativeTime(notification.created_at)}</span>
      </span>
    </button>
  );
}
