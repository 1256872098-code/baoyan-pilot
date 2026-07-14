import React, { useMemo } from "react";
import ReplyThread from "./ReplyThread.jsx";
import { buildReplyTree } from "../../utils/buildReplyTree.js";

export default function ReplyList({
  replies,
  postAuthorId,
  currentUserId,
  loading,
  busyKeys,
  expandedThreadIds = new Set(),
  replyingTo,
  replyValue,
  replyError,
  replying,
  onToggleThreadExpanded,
  onStartReply,
  onCancelReply,
  onReplyValueChange,
  onSubmitReply,
  onToggleReplyLike,
  onToggleReplyDislike,
  onToggleReplyBookmark,
  onDeleteReply,
}) {
  const replyThreads = useMemo(() => buildReplyTree(replies), [replies]);

  if (loading) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        正在加载评论...
      </p>
    );
  }

  if (!replyThreads.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        暂时还没有回复。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {replyThreads.map((thread) => (
        <ReplyThread
          key={thread.id}
          thread={thread}
          postAuthorId={postAuthorId}
          currentUserId={currentUserId}
          busyKeys={busyKeys}
          expanded={expandedThreadIds.has(thread.id)}
          replyingTo={replyingTo}
          replyValue={replyValue}
          replyError={replyError}
          replying={replying}
          onToggleExpanded={onToggleThreadExpanded}
          onStartReply={onStartReply}
          onCancelReply={onCancelReply}
          onReplyValueChange={onReplyValueChange}
          onSubmitReply={onSubmitReply}
          onToggleReplyLike={onToggleReplyLike}
          onToggleReplyDislike={onToggleReplyDislike}
          onToggleReplyBookmark={onToggleReplyBookmark}
          onDeleteReply={onDeleteReply}
        />
      ))}
    </div>
  );
}
