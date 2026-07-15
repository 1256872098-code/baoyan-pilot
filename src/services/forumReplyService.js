import { supabase, isSupabaseConfigured } from "../lib/supabaseClient.js";
import {
  forumAuthorProfileColumns,
  getForumAuthorPayload,
  isAuthorProfileColumnError,
  stripOptionalAuthorFields,
} from "../utils/forumAuthorProfile.js";

const maxReplyLength = 2000;
const loginRequiredMessage = "请先使用手机号体验登录后再回复帖子。";
const databaseNotConfiguredMessage =
  "论坛数据库暂未配置，请配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。";

const baseReplySelectColumns = [
  "id",
  "post_id",
  "content",
  "author_id",
  "author_name",
  "login_type",
  "created_at",
  "parent_reply_id",
  "root_reply_id",
  "reply_to_author_id",
  "reply_to_author_name",
  "depth",
];

const replySelectColumns = [...baseReplySelectColumns, forumAuthorProfileColumns].join(",");
const legacyReplySelectColumns = baseReplySelectColumns.join(",");

function ensureDatabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(databaseNotConfiguredMessage);
  }
}

function ensureUser(user) {
  if (!user?.id || user.loginType !== "phone_mock") {
    throw new Error(loginRequiredMessage);
  }
}

export async function fetchRepliesByPost(postId) {
  ensureDatabase();
  if (!postId) return [];

  let { data, error } = await supabase
    .from("forum_replies")
    .select(replySelectColumns)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error && isAuthorProfileColumnError(error)) {
    const legacyResult = await supabase
      .from("forum_replies")
      .select(legacyReplySelectColumns)
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) throw error;
  return data || [];
}

export async function createForumReply({ postId, content, currentUser, parentReply = null }) {
  ensureDatabase();
  ensureUser(currentUser);

  const trimmedContent = String(content || "").trim();
  if (!trimmedContent) {
    throw new Error("回复内容不能为空。");
  }

  if (trimmedContent.length > maxReplyLength) {
    throw new Error(`回复内容不能超过 ${maxReplyLength} 字。`);
  }

  const isTopLevel = !parentReply;
  if (!isTopLevel && parentReply.post_id !== postId) {
    throw new Error("不能跨帖子回复评论。");
  }

  const payload = {
    post_id: postId,
    content: trimmedContent,
    parent_reply_id: isTopLevel ? null : parentReply.id,
    root_reply_id: isTopLevel ? null : parentReply.root_reply_id || parentReply.id,
    reply_to_author_id: isTopLevel ? null : parentReply.author_id,
    reply_to_author_name: isTopLevel ? null : parentReply.author_name,
    depth: isTopLevel ? 0 : Math.min((Number(parentReply.depth) || 0) + 1, 5),
    ...getForumAuthorPayload(currentUser),
  };

  let { data, error } = await supabase.from("forum_replies").insert([payload]).select(replySelectColumns).single();

  if (error && isAuthorProfileColumnError(error)) {
    const legacyResult = await supabase
      .from("forum_replies")
      .insert([stripOptionalAuthorFields(payload)])
      .select(legacyReplySelectColumns)
      .single();
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) throw error;
  return data;
}
