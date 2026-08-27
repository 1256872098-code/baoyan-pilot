import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const headerSource = readFileSync(new URL("../src/components/Header.jsx", import.meta.url), "utf8");
const contactSource = readFileSync(new URL("../src/components/ContactModal.jsx", import.meta.url), "utf8");
const feedbackServiceSource = readFileSync(new URL("../src/services/feedbackService.js", import.meta.url), "utf8");
const feedbackSql = readFileSync(new URL("../supabase/user-feedback.sql", import.meta.url), "utf8");
const sponsorImage = new URL("../public/images/wechat-sponsor-qr.jpg", import.meta.url);

test("桌面和移动账号菜单都在退出登录下方提供联系我们入口", () => {
  assert.equal((headerSource.match(/联系我们/g) || []).length, 2);
  assert.equal((headerSource.match(/onClick=\{handleOpenContact\}/g) || []).length, 2);
  assert.ok(headerSource.indexOf("退出登录") < headerSource.indexOf("联系我们"));
});

test("联系我们弹窗包含商务微信、赞助二维码和反馈意见入口", () => {
  assert.match(contactSource, /商务合作请加 V：/);
  assert.match(contactSource, /CUFEwwsa/);
  assert.match(contactSource, /赞助我们/);
  assert.match(contactSource, /向我们提出反馈意见/);
  assert.match(contactSource, /maxlength=\{500\}/i);
  assert.match(contactSource, /\/images\/wechat-sponsor-qr\.jpg/);
  assert.equal(existsSync(sponsorImage), true);
});

test("微信复制提示只在复制后显示于复制按钮下方", () => {
  const copyButtonIndex = contactSource.indexOf("复制微信号");
  const copyNoticeIndex = contactSource.indexOf("{copyStatus && (");
  const sponsorIndex = contactSource.indexOf("赞助我们");

  assert.ok(copyButtonIndex >= 0);
  assert.ok(copyNoticeIndex > copyButtonIndex);
  assert.ok(copyNoticeIndex < sponsorIndex);
  assert.equal((contactSource.match(/\{copyStatus && \(/g) || []).length, 1);
  assert.match(contactSource, /if \(open\) setCopyStatus\(""\)/);
});

test("反馈表单支持五类站内提交、500 字限制和提交期间禁用", () => {
  ["功能建议", "页面问题", "数据纠错", "使用体验", "其他"].forEach((type) => {
    assert.match(feedbackServiceSource, new RegExp(type));
  });
  assert.match(contactSource, /FEEDBACK_TYPES\.map/);
  assert.match(contactSource, /遇到问题或有功能建议，可以直接提交给我们，我们会持续查看并改进。/);
  assert.match(contactSource, /maxLength=\{500\}/);
  assert.match(contactSource, /required/);
  assert.match(contactSource, /提交反馈/);
  assert.match(contactSource, /反馈提交成功，感谢你的建议！/);
  assert.match(contactSource, /window\.location\.pathname/);
  assert.match(contactSource, /disabled=\{!feedback\.trim\(\) \|\| isSubmitting\}/);
  assert.doesNotMatch(contactSource, /复制反馈内容/);
});

test("反馈服务写入 user_feedback 并为游客和登录用户生成不同身份字段", () => {
  assert.match(feedbackServiceSource, /from\("user_feedback"\)\.insert\(\[payload\]\)/);
  assert.match(feedbackServiceSource, /user\.loginType === "guest"/);
  assert.match(feedbackServiceSource, /user_id: isGuest \? null/);
  assert.match(feedbackServiceSource, /profile\?\.nickname/);
  assert.match(feedbackServiceSource, /反馈提交失败，请稍后重试。/);
});

test("user_feedback RLS 仅向前端角色开放 insert，不开放反馈读取", () => {
  assert.match(feedbackSql, /create table if not exists public\.user_feedback/i);
  assert.match(feedbackSql, /alter table public\.user_feedback enable row level security/i);
  assert.match(feedbackSql, /for insert\s+to anon, authenticated/i);
  assert.match(feedbackSql, /grant insert \(user_id, user_name, feedback_type, content, page_path\)/i);
  assert.match(feedbackSql, /revoke all on table public\.user_feedback from anon, authenticated/i);
  assert.doesNotMatch(feedbackSql, /grant select[^;]*public\.user_feedback/i);
  assert.doesNotMatch(feedbackSql, /for select/i);
});
