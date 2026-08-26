import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { featureFlags } from "../src/config/features.js";

const readSource = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("院校资料库默认处于隐藏状态", () => {
  assert.equal(featureFlags.schoolDatabase, false);
});

test("桌面和移动导航共用功能开关，不展示院校资料库入口", () => {
  const source = readSource("../src/components/Header.jsx");

  assert.match(source, /featureFlags\.schoolDatabase \? \[\{ path: "\/schools"/);
  assert.equal((source.match(/navItems\.map/g) || []).length, 2);
});

test("关闭功能后，院校资料库深链会回到首页", () => {
  const source = readSource("../src/App.jsx");

  assert.match(source, /featureFlags\.schoolDatabase \?/);
  assert.match(source, /path="\/schools\/\*" element=\{<Navigate to="\/" replace \/>\}/);
});

test("首页和我的院校中的资料库入口也受同一开关控制", () => {
  const homeSource = readSource("../src/pages/HomePage.jsx");
  const mySchoolSource = readSource("../src/pages/MySchoolPage.jsx");

  assert.match(homeSource, /featureFlags\.schoolDatabase &&/);
  assert.match(mySchoolSource, /featureFlags\.schoolDatabase &&/);
});

test("搜索摘要和院校评价通知不再把用户带入隐藏模块", () => {
  const indexSource = readSource("../index.html");
  const notificationSource = readSource("../src/components/notifications/NotificationBell.jsx");

  assert.doesNotMatch(indexSource, /content="[^"]*院校资料库/);
  assert.match(notificationSource, /!featureFlags\.schoolDatabase && isSchoolReviewNotification \? "\/my-school"/);
});
