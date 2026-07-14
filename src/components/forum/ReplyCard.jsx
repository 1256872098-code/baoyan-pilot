import React from "react";
import { Bookmark, Reply, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import AuthorAvatar from "./AuthorAvatar.jsx";
import InteractionButton from "./InteractionButton.jsx";
import { formatForumTime, getSafeCount } from "./forumUtils.js";

export default function ReplyCard({
  reply,
  postAuthorId,
  currentUserId,
  busyKeys,
  onToggleLike,
  onToggleDislike,
  onToggleBookmark,
  onReply,
  onDelete,
}) {
  const isReplyOwner = Boolean(currentUserId) && currentUserId === reply.author_id;
  const isPostOwner = Boolean(currentUserId) && currentUserId === postAuthorId;
  const canDeleteReply = isReplyOwner || isPostOwner;
  const likeKey = `reply-like:${reply.id}`;
  const dislikeKey = `reply-dislike:${reply.id}`;
  const bookmarkKey = `reply-bookmark:${reply.id}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <AuthorAvatar name={reply.author_name} avatarUrl={reply.author_avatar} />
          {reply.author_name}
        </span>
        <span>{formatForumTime(reply.created_at)}</span>
      </div>
      {reply.reply_to_author_name && (
        <p className="mt-2 text-xs font-semibold text-brand-700">回复 @{reply.reply_to_author_name}</p>
      )}
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{reply.content}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <InteractionButton
          icon={ThumbsUp}
          label="点赞"
          count={getSafeCount(reply.likeCount)}
          active={reply.likedByCurrentUser}
          disabled={busyKeys.has(likeKey) || busyKeys.has(dislikeKey)}
          onClick={() => onToggleLike(reply.id)}
        />
        <InteractionButton
          icon={ThumbsDown}
          label="点踩"
          count={getSafeCount(reply.dislikeCount)}
          active={reply.dislikedByCurrentUser}
          activeTone="warning"
          disabled={busyKeys.has(dislikeKey) || busyKeys.has(likeKey)}
          onClick={() => onToggleDislike(reply.id)}
        />
        <InteractionButton
          icon={Bookmark}
          label="收藏"
          count={getSafeCount(reply.bookmarkCount)}
          active={reply.bookmarkedByCurrentUser}
          disabled={busyKeys.has(bookmarkKey)}
          onClick={() => onToggleBookmark(reply.id)}
        />
        <InteractionButton icon={Reply} label="回复" onClick={() => onReply(reply)} />
        {canDeleteReply && <InteractionButton icon={Trash2} label="删除" onClick={() => onDelete(reply)} />}
      </div>
    </div>
  );
}
