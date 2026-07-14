import React from "react";
import { Bookmark, MessageCircle, MessagesSquare, Pencil, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { Card } from "../Card.jsx";
import AuthorAvatar from "./AuthorAvatar.jsx";
import InteractionButton from "./InteractionButton.jsx";
import ReplyComposer from "./ReplyComposer.jsx";
import ReplyList from "./ReplyList.jsx";
import { formatForumTime, getSafeCount, isEdited } from "./forumUtils.js";

export default function PostDetail({
  post,
  replies,
  currentUserId,
  loadingReplies,
  replying,
  replyingTo,
  expandedThreadIds,
  replyContent,
  replyError,
  busyKeys,
  onReplyContentChange,
  onReply,
  onStartReplyToComment,
  onCancelReplyToComment,
  onToggleThreadExpanded,
  onTogglePostLike,
  onTogglePostDislike,
  onTogglePostBookmark,
  onToggleReplyLike,
  onToggleReplyDislike,
  onToggleReplyBookmark,
  onEditPost,
  onDeletePost,
  onDeleteReply,
}) {
  if (!post) {
    return (
      <Card className="p-5">
        <div className="py-16 text-center">
          <MessagesSquare className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-sm text-slate-500">请选择一个帖子查看详情。</p>
        </div>
      </Card>
    );
  }

  const isPostOwner = Boolean(currentUserId) && currentUserId === post.author_id;
  const postLikeKey = `post-like:${post.id}`;
  const postDislikeKey = `post-dislike:${post.id}`;
  const postBookmarkKey = `post-bookmark:${post.id}`;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="badge">{post.category}</span>
          <h2 className="mt-3 text-2xl font-bold leading-8 text-slate-950">{post.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <AuthorAvatar name={post.author_name} avatarUrl={post.author_avatar} />
              {post.author_name}
            </span>
            <span>{formatForumTime(post.created_at)}</span>
            {isEdited(post.created_at, post.updated_at) && <span>已编辑</span>}
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={15} aria-hidden="true" />
              {post.replyCount} 评论
            </span>
            <span>{getSafeCount(post.likeCount)} 点赞</span>
            <span>{getSafeCount(post.dislikeCount)} 点踩</span>
            <span>{getSafeCount(post.bookmarkCount)} 收藏</span>
          </div>
        </div>
        {isPostOwner && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <InteractionButton icon={Pencil} label="编辑" onClick={() => onEditPost(post)} />
            <InteractionButton icon={Trash2} label="删除" onClick={() => onDeletePost(post)} />
          </div>
        )}
      </div>

      <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-700">{post.content}</p>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
        <InteractionButton
          icon={ThumbsUp}
          label="点赞"
          count={getSafeCount(post.likeCount)}
          active={post.likedByCurrentUser}
          disabled={busyKeys.has(postLikeKey) || busyKeys.has(postDislikeKey)}
          onClick={() => onTogglePostLike(post.id)}
        />
        <InteractionButton
          icon={ThumbsDown}
          label="点踩"
          count={getSafeCount(post.dislikeCount)}
          active={post.dislikedByCurrentUser}
          activeTone="warning"
          disabled={busyKeys.has(postDislikeKey) || busyKeys.has(postLikeKey)}
          onClick={() => onTogglePostDislike(post.id)}
        />
        <InteractionButton
          icon={Bookmark}
          label="收藏"
          count={getSafeCount(post.bookmarkCount)}
          active={post.bookmarkedByCurrentUser}
          disabled={busyKeys.has(postBookmarkKey)}
          onClick={() => onTogglePostBookmark(post.id)}
        />
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <h3 className="flex items-center gap-2 font-bold text-slate-950">
          <MessagesSquare size={18} aria-hidden="true" />
          回复列表
        </h3>
        <div className="mt-4">
          <ReplyList
            replies={replies}
            postAuthorId={post.author_id}
            currentUserId={currentUserId}
            loading={loadingReplies}
            busyKeys={busyKeys}
            expandedThreadIds={expandedThreadIds}
            replyingTo={replyingTo}
            replyValue={replyContent}
            replyError={replyError}
            replying={replying}
            onToggleThreadExpanded={onToggleThreadExpanded}
            onStartReply={onStartReplyToComment}
            onCancelReply={onCancelReplyToComment}
            onReplyValueChange={onReplyContentChange}
            onSubmitReply={onReply}
            onToggleReplyLike={onToggleReplyLike}
            onToggleReplyDislike={onToggleReplyDislike}
            onToggleReplyBookmark={onToggleReplyBookmark}
            onDeleteReply={onDeleteReply}
          />
        </div>

        {!replyingTo && (
          <div className="mt-5">
            <ReplyComposer
              value={replyContent}
              placeholder="写下你的建议、经验或补充信息"
              submitting={replying}
              errorMessage={replyError}
              submitLabel="回复"
              onChange={onReplyContentChange}
              onSubmit={onReply}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
