import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const apiSource = readFileSync(new URL("../api/student-verifications-admin.js", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../src/pages/AdminStudentVerificationsPage.jsx", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("../src/services/studentVerificationService.js", import.meta.url), "utf8");

test("注册用户总数只通过受管理员口令保护的服务端接口读取", () => {
  assert.match(apiSource, /requireAdmin\(request, body, response\)/);
  assert.match(apiSource, /supabase\.auth\.admin\.listUsers\(\{ page: 1, perPage: 1 \}\)/);
  assert.match(apiSource, /stats: \{ registeredUserCount \}/);
  assert.match(apiSource, /Never expose the Auth user list or email addresses/);
  assert.doesNotMatch(serviceSource, /SUPABASE_SERVICE_ROLE_KEY|auth\.admin\.listUsers/);
});

test("管理员后台展示注册用户统计且统计失败不影响审核列表", () => {
  assert.match(pageSource, /注册用户总数/);
  assert.match(pageSource, /仅管理员后台可读取/);
  assert.match(pageSource, /Promise\.allSettled/);
  assert.match(serviceSource, /action: "stats"/);
  assert.match(serviceSource, /x-admin-token/);
});
