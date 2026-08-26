import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../src/pages/MySchoolPage.jsx", import.meta.url), "utf8");
const trendTableSource = pageSource.match(/<table className="w-full min-w-\[540px\] table-fixed[\s\S]*?<\/table>/)?.[0];

test("历年趋势表格使用稳定列宽和舒适行间距", () => {
  assert.ok(trendTableSource);
  assert.match(trendTableSource, /<colgroup>/);
  assert.deepEqual(
    [...trendTableSource.matchAll(/<col className="w-\[(\d+)%\]"/g)].map((match) => Number(match[1])),
    [12, 15, 16, 15, 19, 23],
  );
  assert.match(trendTableSource, /bg-slate-50 text-xs font-semibold text-slate-500/);
  assert.match(trendTableSource, /px-2\.5 py-4/);
  assert.match(trendTableSource, /hover:bg-slate-50\/80/);
});

test("历年趋势数字和来源入口不会被挤成逐字换行", () => {
  assert.match(trendTableSource, /whitespace-nowrap px-2\.5 py-4 font-semibold tabular-nums/);
  assert.match(trendTableSource, /estimated \? "估算率"/);
  assert.match(trendTableSource, /<details className="group">/);
  assert.match(trendTableSource, /查看来源/);
  assert.match(trendTableSource, /inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold/);
  assert.doesNotMatch(trendTableSource, /break-all|break-words|table-auto/);
});
