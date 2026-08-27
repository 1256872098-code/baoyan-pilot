import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FORUM_CONTENT_BLOCKED_MESSAGE,
  assertForumContentAllowed,
  containsBlockedForumContent,
  getForumContentModerationError,
  normalizeForumModerationText,
} from "../src/utils/forumContentModeration.js";

test("论坛内容归一化可识别全角、标点、空格和零宽字符变体", () => {
  assert.equal(normalizeForumModerationText("Ｆ u，c\u200bk！YＯＵ"), "fuckyou");
  assert.equal(containsBlockedForumContent("你这个傻 ！逼"), true);
  assert.equal(containsBlockedForumContent("F U C K - Y O U"), true);
});

test("辱骂、威胁和截图中的攻击性表达会被拦截", () => {
  for (const content of ["滚蛋", "去死吧", "我要弄死你", "燃烧吧家人", "你这个王八蛋"]) {
    assert.equal(getForumContentModerationError(content), FORUM_CONTENT_BLOCKED_MESSAGE);
  }
});

test("正常保研交流内容不会被误拦截", () => {
  for (const content of [
    "双非学生应该怎样准备夏令营？",
    "请问专业排名和英语成绩哪个更重要？",
    "我参加过校园废物利用志愿活动。",
  ]) {
    assert.equal(containsBlockedForumContent(content), false);
  }
});

test("服务层断言返回统一、不可泄露词库的错误", () => {
  assert.doesNotThrow(() => assertForumContentAllowed("正常标题", "正常正文"));
  assert.throws(
    () => assertForumContentAllowed("标题", "草-你-妈"),
    (error) => error.code === "FORUM_CONTENT_BLOCKED" && error.message === FORUM_CONTENT_BLOCKED_MESSAGE,
  );
});

test("发帖、编辑、评论以及数据库触发器均接入内容审核", () => {
  const forumPage = readFileSync(new URL("../src/pages/ForumPage.jsx", import.meta.url), "utf8");
  const editModal = readFileSync(new URL("../src/components/forum/EditPostModal.jsx", import.meta.url), "utf8");
  const replyService = readFileSync(new URL("../src/services/forumReplyService.js", import.meta.url), "utf8");
  const interactionService = readFileSync(
    new URL("../src/services/forumInteractionService.js", import.meta.url),
    "utf8",
  );
  const moderationSql = readFileSync(new URL("../supabase/forum-content-moderation.sql", import.meta.url), "utf8");

  assert.match(forumPage, /getForumContentModerationError\(title, content\)/);
  assert.match(forumPage, /getForumContentModerationError\(content\)/);
  assert.match(editModal, /getForumContentModerationError\(title, content\)/);
  assert.match(replyService, /assertForumContentAllowed\(trimmedContent\)/);
  assert.match(interactionService, /assertForumContentAllowed\(values\.title, values\.content\)/);
  assert.match(moderationSql, /before insert or update of title, content on public\.forum_posts/);
  assert.match(moderationSql, /before insert or update of content on public\.forum_replies/);
});
