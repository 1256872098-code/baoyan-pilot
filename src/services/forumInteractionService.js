import { supabase, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { forumAuthorProfileColumns, isAuthorProfileColumnError } from "../utils/forumAuthorProfile.js";

const loginRequiredMessage = "请先使用手机号体验登录后再操作。";
const databaseNotConfiguredMessage =
  "论坛数据库暂未配置，请配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。";

function ensureDatabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(databaseNotConfiguredMessage);
  }
}

function ensureUser(userId) {
  if (!userId) {
    throw new Error(loginRequiredMessage);
  }
}

function createEmptyStats(ids) {
  return Object.fromEntries(
    ids.map((id) => [
      id,
      {
        likeCount: 0,
        dislikeCount: 0,
        bookmarkCount: 0,
        likedByCurrentUser: false,
        dislikedByCurrentUser: false,
        bookmarkedByCurrentUser: false,
      },
    ]),
  );
}

function increase(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

async function fetchRows(tableName, selectColumns, idColumn, ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from(tableName).select(selectColumns).in(idColumn, ids);
  if (error) throw error;
  return data || [];
}

function buildStats(ids, userId, likeRows, dislikeRows, bookmarkRows, idColumn) {
  const stats = createEmptyStats(ids);
  const likeCounts = new Map();
  const dislikeCounts = new Map();
  const bookmarkCounts = new Map();
  const userLiked = new Set();
  const userDisliked = new Set();
  const userBookmarked = new Set();

  likeRows.forEach((row) => {
    increase(likeCounts, row[idColumn]);
    if (userId && row.user_id === userId) userLiked.add(row[idColumn]);
  });

  dislikeRows.forEach((row) => {
    increase(dislikeCounts, row[idColumn]);
    if (userId && row.user_id === userId) userDisliked.add(row[idColumn]);
  });

  bookmarkRows.forEach((row) => {
    increase(bookmarkCounts, row[idColumn]);
    if (userId && row.user_id === userId) userBookmarked.add(row[idColumn]);
  });

  ids.forEach((id) => {
    stats[id] = {
      likeCount: likeCounts.get(id) || 0,
      dislikeCount: dislikeCounts.get(id) || 0,
      bookmarkCount: bookmarkCounts.get(id) || 0,
      likedByCurrentUser: userLiked.has(id),
      dislikedByCurrentUser: userDisliked.has(id),
      bookmarkedByCurrentUser: userBookmarked.has(id),
    };
  });

  return stats;
}

export async function fetchPostInteractionStats(postIds, userId) {
  ensureDatabase();
  const ids = [...new Set((postIds || []).filter(Boolean))];
  if (!ids.length) return {};

  const [likeRows, dislikeRows, bookmarkRows] = await Promise.all([
    fetchRows("forum_post_likes", "post_id,user_id", "post_id", ids),
    fetchRows("forum_post_dislikes", "post_id,user_id", "post_id", ids),
    fetchRows("forum_post_bookmarks", "post_id,user_id", "post_id", ids),
  ]);

  return buildStats(ids, userId, likeRows, dislikeRows, bookmarkRows, "post_id");
}

export async function fetchReplyInteractionStats(replyIds, userId) {
  ensureDatabase();
  const ids = [...new Set((replyIds || []).filter(Boolean))];
  if (!ids.length) return {};

  const [likeRows, dislikeRows, bookmarkRows] = await Promise.all([
    fetchRows("forum_reply_likes", "reply_id,user_id", "reply_id", ids),
    fetchRows("forum_reply_dislikes", "reply_id,user_id", "reply_id", ids),
    fetchRows("forum_reply_bookmarks", "reply_id,user_id", "reply_id", ids),
  ]);

  return buildStats(ids, userId, likeRows, dislikeRows, bookmarkRows, "reply_id");
}

async function selectExistingInteraction(tableName, targetColumn, targetId, userId) {
  const { data, error } = await supabase
    .from(tableName)
    .select("id")
    .eq(targetColumn, targetId)
    .eq("user_id", userId)
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

async function deleteExistingInteraction(tableName, interactionId, userId) {
  if (!interactionId) return;
  const { error } = await supabase.from(tableName).delete().eq("id", interactionId).eq("user_id", userId);
  if (error) throw error;
}

async function insertInteraction(tableName, targetColumn, targetId, userId) {
  const { error } = await supabase.from(tableName).insert([{ [targetColumn]: targetId, user_id: userId }]);
  if (error && error.code !== "23505") throw error;
}

async function toggleInteraction({ tableName, targetColumn, targetId, userId }) {
  ensureDatabase();
  ensureUser(userId);

  const existing = await selectExistingInteraction(tableName, targetColumn, targetId, userId);
  if (existing) {
    await deleteExistingInteraction(tableName, existing.id, userId);
    return { active: false };
  }

  await insertInteraction(tableName, targetColumn, targetId, userId);
  return { active: true };
}

async function toggleVote({ likeTable, dislikeTable, targetColumn, targetId, userId, vote }) {
  ensureDatabase();
  ensureUser(userId);

  const [existingLike, existingDislike] = await Promise.all([
    selectExistingInteraction(likeTable, targetColumn, targetId, userId),
    selectExistingInteraction(dislikeTable, targetColumn, targetId, userId),
  ]);

  if (vote === "like") {
    if (existingLike) {
      await deleteExistingInteraction(likeTable, existingLike.id, userId);
      if (existingDislike) await deleteExistingInteraction(dislikeTable, existingDislike.id, userId);
      return { liked: false, disliked: false };
    }

    if (existingDislike) await deleteExistingInteraction(dislikeTable, existingDislike.id, userId);
    await insertInteraction(likeTable, targetColumn, targetId, userId);
    return { liked: true, disliked: false };
  }

  if (vote === "dislike") {
    if (existingDislike) {
      await deleteExistingInteraction(dislikeTable, existingDislike.id, userId);
      if (existingLike) await deleteExistingInteraction(likeTable, existingLike.id, userId);
      return { liked: false, disliked: false };
    }

    if (existingLike) await deleteExistingInteraction(likeTable, existingLike.id, userId);
    await insertInteraction(dislikeTable, targetColumn, targetId, userId);
    return { liked: false, disliked: true };
  }

  throw new Error("不支持的投票类型。");
}

export async function togglePostLike(postId, userId) {
  return toggleVote({
    likeTable: "forum_post_likes",
    dislikeTable: "forum_post_dislikes",
    targetColumn: "post_id",
    targetId: postId,
    userId,
    vote: "like",
  });
}

export async function togglePostDislike(postId, userId) {
  return toggleVote({
    likeTable: "forum_post_likes",
    dislikeTable: "forum_post_dislikes",
    targetColumn: "post_id",
    targetId: postId,
    userId,
    vote: "dislike",
  });
}

export async function togglePostBookmark(postId, userId) {
  return toggleInteraction({
    tableName: "forum_post_bookmarks",
    targetColumn: "post_id",
    targetId: postId,
    userId,
  });
}

export async function toggleReplyLike(replyId, userId) {
  return toggleVote({
    likeTable: "forum_reply_likes",
    dislikeTable: "forum_reply_dislikes",
    targetColumn: "reply_id",
    targetId: replyId,
    userId,
    vote: "like",
  });
}

export async function toggleReplyDislike(replyId, userId) {
  return toggleVote({
    likeTable: "forum_reply_likes",
    dislikeTable: "forum_reply_dislikes",
    targetColumn: "reply_id",
    targetId: replyId,
    userId,
    vote: "dislike",
  });
}

export async function toggleReplyBookmark(replyId, userId) {
  return toggleInteraction({
    tableName: "forum_reply_bookmarks",
    targetColumn: "reply_id",
    targetId: replyId,
    userId,
  });
}

export async function updateForumPost(postId, userId, values) {
  ensureDatabase();
  ensureUser(userId);

  const payload = {
    title: values.title,
    content: values.content,
    category: values.category,
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from("forum_posts")
    .update(payload)
    .eq("id", postId)
    .eq("author_id", userId)
    .select(`id,title,content,category,author_id,author_name,login_type,created_at,updated_at,${forumAuthorProfileColumns}`)
    .single();

  if (error && isAuthorProfileColumnError(error)) {
    const legacyResult = await supabase
      .from("forum_posts")
      .update(payload)
      .eq("id", postId)
      .eq("author_id", userId)
      .select("id,title,content,category,author_id,author_name,login_type,created_at,updated_at")
      .single();
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) throw error;
  if (!data) throw new Error("只能编辑自己发布的帖子。");
  return data;
}

export async function deleteForumPost({ postId, postAuthorId, currentUserId }) {
  ensureDatabase();
  ensureUser(currentUserId);

  if (currentUserId !== postAuthorId) {
    throw new Error("你只能删除自己发布的帖子。");
  }

  const { data: replyRows, error: repliesError } = await supabase
    .from("forum_replies")
    .select("id")
    .eq("post_id", postId);

  if (repliesError) throw repliesError;

  const replyIds = (replyRows || []).map((reply) => reply.id);
  if (replyIds.length) {
    const { error: replyLikeError } = await supabase.from("forum_reply_likes").delete().in("reply_id", replyIds);
    if (replyLikeError) throw replyLikeError;

    const { error: replyDislikeError } = await supabase.from("forum_reply_dislikes").delete().in("reply_id", replyIds);
    if (replyDislikeError) throw replyDislikeError;

    const { error: replyBookmarkError } = await supabase.from("forum_reply_bookmarks").delete().in("reply_id", replyIds);
    if (replyBookmarkError) throw replyBookmarkError;

    const { error: replyDeleteError } = await supabase.from("forum_replies").delete().in("id", replyIds);
    if (replyDeleteError) throw replyDeleteError;
  }

  const { error: postLikeError } = await supabase.from("forum_post_likes").delete().eq("post_id", postId);
  if (postLikeError) throw postLikeError;

  const { error: postDislikeError } = await supabase.from("forum_post_dislikes").delete().eq("post_id", postId);
  if (postDislikeError) throw postDislikeError;

  const { error: postBookmarkError } = await supabase.from("forum_post_bookmarks").delete().eq("post_id", postId);
  if (postBookmarkError) throw postBookmarkError;

  const { error } = await supabase.from("forum_posts").delete().eq("id", postId).eq("author_id", currentUserId);
  if (error) throw error;
  return true;
}

export async function deleteForumReply({ replyId, replyAuthorId, postAuthorId, currentUserId }) {
  ensureDatabase();
  ensureUser(currentUserId);

  const canDelete = currentUserId === replyAuthorId || currentUserId === postAuthorId;
  if (!canDelete) {
    throw new Error("你没有权限删除这条评论。");
  }

  const { error: likeError } = await supabase.from("forum_reply_likes").delete().eq("reply_id", replyId);
  if (likeError) throw likeError;

  const { error: dislikeError } = await supabase.from("forum_reply_dislikes").delete().eq("reply_id", replyId);
  if (dislikeError) throw dislikeError;

  const { error: bookmarkError } = await supabase.from("forum_reply_bookmarks").delete().eq("reply_id", replyId);
  if (bookmarkError) throw bookmarkError;

  const { error } = await supabase.from("forum_replies").delete().eq("id", replyId);
  if (error) throw error;
  return true;
}
