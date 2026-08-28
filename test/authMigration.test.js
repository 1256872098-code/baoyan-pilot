import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authSource = readFileSync(new URL("../src/contexts/AuthContext.jsx", import.meta.url), "utf8");
const loginSource = readFileSync(new URL("../src/components/LoginModal.jsx", import.meta.url), "utf8");
const profileSource = readFileSync(new URL("../src/pages/ProfilePage.jsx", import.meta.url), "utf8");
const mySchoolSource = readFileSync(new URL("../src/pages/MySchoolPage.jsx", import.meta.url), "utf8");
const profileSql = readFileSync(new URL("../supabase/auth-profiles.sql", import.meta.url), "utf8");
const rlsSql = readFileSync(new URL("../supabase/auth-rls-migration.sql", import.meta.url), "utf8");

test("邮箱密码注册登录使用 Supabase Auth 并订阅真实会话", () => {
  ["signUp", "signInWithPassword", "signOut", "getSession", "onAuthStateChange"].forEach((method) => {
    assert.match(authSource, new RegExp(`supabase\\.auth\\.${method}\\(`));
  });
  assert.match(loginSource, />邮箱</);
  assert.match(loginSource, />密码</);
  assert.match(loginSource, />确认密码</);
  assert.match(loginSource, />昵称</);
  assert.match(loginSource, /password\.length < 8/);
  assert.match(loginSource, /minLength=\{8\}/);
  assert.match(loginSource, /placeholder="至少 8 位"/);
  assert.match(authSource, /若该邮箱尚未注册，请先注册/);
  assert.doesNotMatch(loginSource, /至少 6 位|minLength=\{6\}/);
  assert.doesNotMatch(`${authSource}\n${loginSource}`, /loginWithPhone|123456|baoyanpilot_mock_accounts|baoyanpilot_mock_user/);
});

test("个人资料和我的院校改为云端保存且游客不能写入", () => {
  assert.match(profileSource, /updateUserProfile/);
  assert.match(profileSource, /个人资料已保存到云端/);
  assert.doesNotMatch(profileSource, /baoyanpilot_profile_/);
  assert.match(mySchoolSource, /saveMySchoolBinding/);
  assert.match(mySchoolSource, /fetchMySchoolBinding/);
  assert.doesNotMatch(mySchoolSource, /baoyanpilot_my_school_/);
  assert.match(authSource, /isAuthenticated,/);
});

test("profiles、我的院校与业务表均使用 auth.uid RLS", () => {
  assert.match(profileSql, /create table if not exists public\.profiles/i);
  assert.match(profileSql, /references auth\.users\(id\)/i);
  assert.match(profileSql, /create table if not exists public\.user_school_bindings/i);
  assert.match(profileSql, /auth\.uid\(\)/i);
  [
    "forum_posts",
    "forum_replies",
    "school_reviews",
    "user_notifications",
    "user_feedback",
    "student_verifications",
  ].forEach((table) => assert.match(rlsSql, new RegExp(`public\\.${table}`)));
  assert.match(rlsSql, /auth\.uid\(\)::text/);
  assert.doesNotMatch(`${authSource}\n${loginSource}\n${profileSource}`, /SUPABASE_SERVICE_ROLE_KEY/);
});
