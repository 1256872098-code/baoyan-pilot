import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = JSON.parse(readFileSync(new URL("../src/data/competitions2026.json", import.meta.url), "utf8"));
const pageSource = readFileSync(new URL("../src/pages/WantBaoyanPage.jsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const headerSource = readFileSync(new URL("../src/components/Header.jsx", import.meta.url), "utf8");

test("Excel 清单完整转换为 101 个 A/B/C 类竞赛项目", () => {
  assert.equal(catalog.year, 2026);
  assert.equal(catalog.items.length, 101);

  const rawCounts = Object.fromEntries(
    Object.entries(Object.groupBy(catalog.items, (item) => item.category)).map(([category, items]) => [
      category,
      items.length,
    ]),
  );
  assert.deepEqual(rawCounts, { "A+": 2, A: 4, B: 17, C: 78 });

  const groupedCounts = Object.fromEntries(
    Object.entries(Object.groupBy(catalog.items, (item) => item.group)).map(([category, items]) => [
      category,
      items.length,
    ]),
  );
  assert.deepEqual(groupedCounts, { A: 6, B: 17, C: 78 });
});

test("竞赛编号、分类和名称均保留原表结构", () => {
  catalog.items.forEach((item, index) => {
    assert.equal(item.order, index + 1);
    assert.equal(item.id, `2026-${String(index + 1).padStart(3, "0")}`);
    assert.ok(["A+", "A", "B", "C"].includes(item.category));
    assert.ok(["A", "B", "C"].includes(item.group));
    assert.ok(item.nationalName || item.regionalName || item.campusName);
  });

  assert.equal(catalog.items[0].nationalName, "中国国际大学生创新创业大赛");
  assert.equal(catalog.items.at(-1).campusName, "汉字文化创意大赛");
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
  assert.match(pageSource, /placeholder="搜索竞赛名称或承办部门"/);
  assert.match(pageSource, /onClick=\{\(\) => setSelectedCompetition\(competition\)\}/);
  assert.match(pageSource, /竞赛介绍待补充/);
  assert.match(pageSource, /国家级竞赛名称/);
  assert.match(pageSource, /省市级竞赛名称/);
  assert.match(pageSource, /独立校级赛事/);
});
