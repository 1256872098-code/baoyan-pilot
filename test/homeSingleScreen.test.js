import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const homeSource = readFileSync(new URL("../src/pages/HomePage.jsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

test("首页只渲染一个不可滚动的单屏封面", () => {
  assert.equal((homeSource.match(/<section/g) || []).length, 1);
  assert.match(homeSource, /h-\[calc\(100svh-4rem\)\] overflow-hidden/);
  assert.doesNotMatch(homeSource, /核心功能|使用流程|重要说明|StatCard|CardHeader/);
  assert.match(appSource, /const isHomePage = location\.pathname === "\/"/);
  assert.match(appSource, /isHomePage \? "h-\[100svh\] overflow-hidden" : "min-h-screen"/);
  assert.match(appSource, /const hideFooter = isHomePage \|\| location\.pathname === "\/ai-recommend"/);
  assert.match(globalStyles, /min-height: 100svh/);
});

test("首页使用新版插画背景并保留核心封面内容", () => {
  assert.match(homeSource, /src="\/images\/hero-planning-v2\.png"/);
  assert.match(homeSource, /面向大学生的 AI 保研规划助手/);
  assert.match(homeSource, /保研领航员/);
  assert.match(homeSource, /开始AI院校推荐/);

  const imageStats = statSync(new URL("../public/images/hero-planning-v2.png", import.meta.url));
  assert.ok(imageStats.size > 100_000);
});
