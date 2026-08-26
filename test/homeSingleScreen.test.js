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

test("首页使用新版插画背景并展示指定封面文案", () => {
  assert.match(homeSource, /src="\/images\/hero-planning-v2\.png"/);
  assert.match(homeSource, /面向大学生的 AI 保研规划助手/);
  assert.match(homeSource, /保研领航员/);
  assert.match(homeSource, /聚合院校资料、推免政策、个人院校信息与保研经验交流/);
  assert.match(homeSource, /院校及推免信息持续更新，具体政策与报名要求请以各高校官网最新通知为准/);
  assert.doesNotMatch(homeSource, /开始AI院校推荐|to="\/ai-recommend"|ArrowRight|react-router-dom/);

  const imageStats = statSync(new URL("../public/images/hero-planning-v2.png", import.meta.url));
  assert.ok(imageStats.size > 100_000);
});

test("Hero 文案字号和宽度兼顾桌面与移动端", () => {
  assert.match(homeSource, /max-w-\[570px\]/);
  assert.match(homeSource, /text-base[^"]*lg:text-lg/);
  assert.match(homeSource, /text-5xl[^"]*sm:text-\[64px\][^"]*lg:text-\[72px\]/);
  assert.match(homeSource, /text-lg leading-\[1\.7\][^"]*sm:text-xl lg:text-\[22px\]/);
  assert.match(homeSource, /text-sm leading-\[1\.7\][^"]*sm:text-base/);
});
