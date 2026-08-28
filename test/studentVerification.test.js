import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractPdfTextForReview } from "../api/student-verifications.js";

const profileSource = readFileSync(new URL("../src/pages/ProfilePage.jsx", import.meta.url), "utf8");
const cardSource = readFileSync(new URL("../src/components/profile/StudentVerificationCard.jsx", import.meta.url), "utf8");
const adminPageSource = readFileSync(new URL("../src/pages/AdminStudentVerificationsPage.jsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const userApiSource = readFileSync(new URL("../api/student-verifications.js", import.meta.url), "utf8");
const adminApiSource = readFileSync(new URL("../api/student-verifications-admin.js", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("../src/services/studentVerificationService.js", import.meta.url), "utf8");
const sqlSource = readFileSync(new URL("../supabase/student-verifications.sql", import.meta.url), "utf8");

test("个人中心用学籍核验替换院校认证体验提示并提供五种状态", () => {
  assert.match(profileSource, /StudentVerificationCard/);
  assert.doesNotMatch(profileSource, />院校认证</);
  assert.match(cardSource, /通过《教育部学籍在线验证报告》辅助核验你的本科院校及学籍信息。/);
  ["未核验", "待审核", "需补充材料", "已核验", "未通过"].forEach((label) => {
    assert.match(cardSource, new RegExp(label));
  });
  assert.match(cardSource, /申请学籍核验/);
  assert.match(cardSource, /材料已提交，正在等待审核。/);
});

test("用户表单收集16位验证码、可自由选择的认证学校和可选私有PDF", () => {
  assert.match(cardSource, /学信网16位在线验证码/);
  assert.match(cardSource, /maxLength=\{16\}/);
  assert.match(cardSource, /认证学校/);
  assert.match(cardSource, /SearchableSchoolSelect/);
  assert.match(cardSource, /不受“我的院校”当前绑定限制/);
  assert.match(cardSource, /schoolId: selectedSchool\?\.id/);
  assert.match(cardSource, /schoolName: selectedSchool\?\.name/);
  assert.match(cardSource, />学院</);
  assert.match(cardSource, />专业</);
  assert.match(cardSource, /application\/pdf/);
  assert.match(cardSource, /PDF（可选，最大3MB）/);
  assert.match(serviceSource, /supabase\.auth\.getSession\(\)/);
  assert.match(serviceSource, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.doesNotMatch(serviceSource, /localStorage|getOrCreateAccessToken|verification_access/);
  assert.match(userApiSource, /supabase\.auth\.getUser\(accessToken\)/);
  assert.doesNotMatch(userApiSource, /x-verification-access-token|hashAccessToken/);
});

test("个人资料的学校和专业只由已通过的学籍核验填写且不再展示年级", () => {
  assert.match(profileSource, /latestVerification\?\.status === "verified"/);
  assert.match(profileSource, /学籍核验通过后自动填写/);
  assert.match(profileSource, /该信息来自已通过的学籍核验，不能手动修改。/);
  assert.match(profileSource, /onVerificationChange=\{setLatestVerification\}/);
  assert.doesNotMatch(profileSource, /<span className="field-label">年级<\/span>/);
  assert.match(profileSource, /placeholder="简单介绍一下自己吧~"/);
});

test("AI只生成三类辅助建议，提交时状态始终为pending", () => {
  ["建议通过", "建议人工复核", "建议补充材料"].forEach((label) => {
    assert.match(userApiSource, new RegExp(label));
  });
  assert.match(userApiSource, /status: "pending"/);
  assert.match(cardSource, /AI辅助预审（不代表最终审核）/);
  assert.doesNotMatch(userApiSource, /status:\s*"verified"/);
  assert.match(userApiSource, /不得访问或尝试绕过学信网验证码、登录、反爬机制/);
  assert.doesNotMatch(userApiSource, /https?:\/\/[^"'`]*chsi/i);
});

test("轻量PDF文本层提取可向AI预审提供文本，扫描件仍回退人工复核", () => {
  const sample = Buffer.from("%PDF-1.4\nBT (Shanghai Ocean University) Tj ET\n%%EOF", "latin1");
  assert.match(extractPdfTextForReview(sample), /Shanghai Ocean University/);
  assert.match(userApiSource, /PDF未包含可可靠提取的文本层/);
});

test("管理员页面展示审核字段且只有受保护管理员接口能产生最终状态", () => {
  assert.match(appSource, /path="\/admin\/student-verifications"/);
  ["用户", "学校", "学院", "专业", "在线验证码", "PDF材料", "AI辅助预审结果", "提交时间"].forEach((label) => {
    assert.match(adminPageSource, new RegExp(label));
  });
  assert.match(adminPageSource, /要求补充材料/);
  assert.match(adminPageSource, /驳回/);
  assert.match(adminPageSource, /通过/);
  assert.match(adminApiSource, /STUDENT_VERIFICATION_ADMIN_TOKEN/);
  assert.match(adminApiSource, /status === "verified" \? now : null/);
  assert.match(adminApiSource, /\.update\(\{/);
  assert.doesNotMatch(serviceSource, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("已核验文案准确且不宣称学信网官方认证", () => {
  assert.match(cardSource, /学籍已核验/);
  assert.match(cardSource, /经用户提供的教育部学籍在线验证报告核验。/);
  assert.doesNotMatch(cardSource, /学信网官方认证/);
});

test("student_verifications开启私有RLS且普通用户不能修改审核状态", () => {
  assert.match(sqlSource, /create table if not exists public\.student_verifications/i);
  assert.match(sqlSource, /alter table public\.student_verifications enable row level security/i);
  assert.match(sqlSource, /auth\.uid\(\)::text = user_id/i);
  assert.match(sqlSource, /for select\s+to authenticated/i);
  assert.match(sqlSource, /for insert\s+to authenticated/i);
  assert.doesNotMatch(sqlSource, /for update\s+to authenticated/i);
  assert.doesNotMatch(sqlSource, /grant update/i);
  assert.match(sqlSource, /'student-verification-reports',[\s\S]*?false/i);
  assert.doesNotMatch(sqlSource, /to anon[\s\S]*?grant select/i);
});

test("私有PDF只通过短时签名链接返回且service_role仅存在服务端", () => {
  assert.match(userApiSource, /createSignedUrl\(row\.report_file_url, 600\)/);
  assert.match(adminApiSource, /createSignedUrl\(row\.report_file_url, 300\)/);
  assert.match(userApiSource, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(serviceSource, /service_role|SERVICE_ROLE/);
  assert.doesNotMatch(cardSource, /getPublicUrl/);
});
