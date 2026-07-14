import React from "react";
import { Card } from "../Card.jsx";
import PostCard from "./PostCard.jsx";

export default function PostList({
  posts,
  selectedPostId,
  currentUserId,
  loading,
  searchQuery,
  busyKeys,
  onSelectPost,
  onTogglePostLike,
  onTogglePostDislike,
  onTogglePostBookmark,
  onEditPost,
  onDeletePost,
}) {
  if (loading) {
    return <Card className="p-6 text-center text-sm font-semibold text-slate-500">正在加载帖子...</Card>;
  }

  if (!posts.length) {
    return (
      <Card className="p-6 text-center text-sm text-slate-500">
        {searchQuery ? `没有找到包含“${searchQuery}”的帖子，换个关键词试试。` : "当前分类暂无帖子。"}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          selected={post.id === selectedPostId}
          currentUserId={currentUserId}
          busyKeys={busyKeys}
          onSelect={onSelectPost}
          onToggleLike={onTogglePostLike}
          onToggleDislike={onTogglePostDislike}
          onToggleBookmark={onTogglePostBookmark}
          onEdit={onEditPost}
          onDelete={onDeletePost}
        />
      ))}
    </div>
  );
}
