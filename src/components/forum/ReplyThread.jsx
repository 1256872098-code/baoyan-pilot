import React from "react";
import ReplyCard from "./ReplyCard.jsx";
import ReplyComposer from "./ReplyComposer.jsx";

export default function ReplyThread({
  thread,
  postAuthorId,
  currentUserId,
  busyKeys,
  expanded,
  replyingTo,
  replyValue,
  replyError,
  replying,
  onToggleExpanded,
  onStartReply,
  onCancelReply,
  onReplyValueChange,
  onSubmitReply,
  onToggleReplyLike,
  onToggleReplyDislike,
  onToggleReplyBookmark,
  onDeleteReply,
}) {
  const children = thread.children || [];
  const shouldCollapse = children.length >= 3;
  const showChildren = !shouldCollapse || expanded;
  const activeComposer = replyingTo?.threadId === thread.id;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <ReplyCard
        reply={thread}
        postAuthorId={postAuthorId}
        currentUserId={currentUserId}
        busyKeys={busyKeys}
        onToggleLike={onToggleReplyLike}
        onToggleDislike={onToggleReplyDislike}
        onToggleBookmark={onToggleReplyBookmark}
        onReply={onStartReply}
        onDelete={onDeleteReply}
      />

      {children.length > 0 && (
        <div className="mt-3 border-l-2 border-blue-100 pl-3 sm:pl-4">
          {shouldCollapse && (
            <button
              type="button"
              className="mb-3 text-sm font-semibold text-brand-700 hover:text-brand-800"
              onClick={() => onToggleExpanded(thread.id)}
            >
              {expanded ? "收起回复" : `查看 ${children.length} 条回复`}
            </button>
          )}

          {showChildren && (
            <div className="space-y-3">
              {children.map((reply) => (
                <ReplyCard
                  key={reply.id}
                  reply={reply}
                  postAuthorId={postAuthorId}
                  currentUserId={currentUserId}
                  busyKeys={busyKeys}
                  onToggleLike={onToggleReplyLike}
                  onToggleDislike={onToggleReplyDislike}
                  onToggleBookmark={onToggleReplyBookmark}
                  onReply={onStartReply}
                  onDelete={onDeleteReply}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeComposer && (
        <div className="mt-3">
          <ReplyComposer
            value={replyValue}
            placeholder={`回复 @${replyingTo.authorName || "该用户"}`}
            submitting={replying}
            errorMessage={replyError}
            onChange={onReplyValueChange}
            onCancel={onCancelReply}
            onSubmit={onSubmitReply}
          />
        </div>
      )}
    </div>
  );
}
