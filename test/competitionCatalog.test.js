import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = JSON.parse(readFileSync(new URL("../src/data/competitions2026.json", import.meta.url), "utf8"));
const pageSource = readFileSync(new URL("../src/pages/WantBaoyanPage.jsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const headerSource = readFileSync(new URL("../src/components/Header.jsx", import.meta.url), "utf8");

test("Excel 清单仅保留国家级列中的 86 个 A+/A/B/C 类竞赛项目", () => {
  assert.equal(catalog.year, 2026);
  assert.equal(catalog.items.length, 86);

  const rawCounts = Object.fromEntries(
    Object.entries(Object.groupBy(catalog.items, (item) => item.category)).map(([category, items]) => [
      category,
      items.length,
    ]),
  );
  assert.deepEqual(rawCounts, { "A+": 2, A: 4, B: 13, C: 67 });
});

test("竞赛编号、分类和国家级名称保留原表结构且不携带省市级、校级和负责学院字段", () => {
  catalog.items.forEach((item) => {
    assert.equal(item.id, `2026-${String(item.order).padStart(3, "0")}`);
    assert.ok(["A+", "A", "B", "C"].includes(item.category));
    assert.ok(item.nationalName);
    assert.deepEqual(Object.keys(item), ["id", "order", "category", "nationalName"]);
  });

  assert.equal(catalog.items[0].nationalName, "中国国际大学生创新创业大赛");
  assert.equal(catalog.items.at(-1).nationalName, "全国大中学生海洋文化创意设计大赛");
});

test("竞赛清单入口位于保研论坛左侧并同时接入桌面和移动导航", () => {
  assert.match(headerSource, /\{ path: "\/want-baoyan", label: "竞赛清单" \}/);
  assert.ok(headerSource.indexOf('label: "竞赛清单"') < headerSource.indexOf('label: "保研论坛"'));
  assert.match(appSource, /<Route path="\/want-baoyan" element=\{<WantBaoyanPage \/>\} \/>/);
  assert.equal((headerSource.match(/navItems\.map/g) || []).length, 2);
});

test("竞赛目录支持 A+/A/B/C 独立分类、搜索、整卡点击和详情占位", () => {
  assert.match(pageSource, /A\+ 类竞赛/);
  assert.match(pageSource, /A 类竞赛/);
  assert.match(pageSource, /B 类竞赛/);
  assert.match(pageSource, /C 类竞赛/);
  assert.match(pageSource, /item\.category !== activeCategory/);
  assert.doesNotMatch(pageSource, /item\.group !== activeCategory/);
  assert.match(pageSource, /placeholder="搜索国家级竞赛名称"/);
  assert.match(pageSource, /onClick=\{\(\) => setSelectedCompetition\(competition\)\}/);
  assert.match(pageSource, /竞赛介绍待补充/);
  assert.match(pageSource, /国家级竞赛名称/);
  assert.doesNotMatch(pageSource, /省市级竞赛名称/);
  assert.doesNotMatch(pageSource, /独立校级赛事/);
  assert.doesNotMatch(pageSource, /承办学院|承办部门|competition\.organizer/);
});
