import React from "react";
import { Bookmark, MessageCircle, Pencil, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import AuthorAvatar from "./AuthorAvatar.jsx";
import AuthorSchoolBadge from "./AuthorSchoolBadge.jsx";
import InteractionButton from "./InteractionButton.jsx";
import { formatForumTime, getExcerpt, getSafeCount, isEdited } from "./forumUtils.js";

export default function PostCard({
  post,
  selected,
  currentUserId,
  busyKeys,
  onSelect,
  onToggleLike,
  onToggleDislike,
  onToggleBookmark,
  onEdit,
  onDelete,
}) {
  const isOwner = Boolean(currentUserId) && currentUserId === post.author_id;
  const likeKey = `post-like:${post.id}`;
  const dislikeKey = `post-dislike:${post.id}`;
  const bookmarkKey = `post-bookmark:${post.id}`;

  return (
    <button
      type="button"
      className={[
        "block w-full rounded-lg border bg-white p-4 text-left shadow-sm transition",
        selected ? "border-blue-200 ring-2 ring-blue-100" : "border-slate-200 hover:border-brand-300 hover:bg-blue-50/40",
      ].join(" ")}
      onClick={() => onSelect(post.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="line-clamp-2 font-bold leading-6 text-slate-950">{post.title}</h2>
        <span className="badge shrink-0">{post.category}</span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{getExcerpt(post.content)}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <AuthorAvatar name={post.author_name} avatarUrl={post.author_avatar} />
          {post.author_name}
        </span>
        <AuthorSchoolBadge schoolName={post.author_school_name} levelTags={post.author_school_level_tags} />
        <span>{formatForumTime(post.created_at)}</span>
        {isEdited(post.created_at, post.updated_at) && <span className="text-slate-400">已编辑</span>}
        <span className="inline-flex items-center gap-1">
          <MessageCircle size={14} aria-hidden="true" />
          {post.replyCount} 评论
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <InteractionButton
          icon={ThumbsUp}
          label="点赞"
          count={getSafeCount(post.likeCount)}
          active={post.likedByCurrentUser}
          disabled={busyKeys.has(likeKey) || busyKeys.has(dislikeKey)}
          onClick={() => onToggleLike(post.id)}
        />
        <InteractionButton
          icon={ThumbsDown}
          label="点踩"
          count={getSafeCount(post.dislikeCount)}
          active={post.dislikedByCurrentUser}
          activeTone="warning"
          disabled={busyKeys.has(dislikeKey) || busyKeys.has(likeKey)}
          onClick={() => onToggleDislike(post.id)}
        />
        <InteractionButton
          icon={Bookmark}
          label="收藏"
          count={getSafeCount(post.bookmarkCount)}
          active={post.bookmarkedByCurrentUser}
          disabled={busyKeys.has(bookmarkKey)}
          onClick={() => onToggleBookmark(post.id)}
        />
        {isOwner && (
          <>
            <InteractionButton icon={Pencil} label="编辑" onClick={() => onEdit(post)} />
            <InteractionButton icon={Trash2} label="删除" onClick={() => onDelete(post)} />
          </>
        )}
      </div>
    </button>
  );
}
