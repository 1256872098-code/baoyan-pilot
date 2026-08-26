import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../src/pages/MySchoolPage.jsx", import.meta.url), "utf8");

test("我的院校将估算保研率与官方推免人数明确区分", () => {
  assert.match(pageSource, /官方人数 · 估算率/);
  assert.match(pageSource, /row\.rateStatus === "estimated"/);
  assert.match(pageSource, /estimatedRate \? "约 " : ""/);
});

test("推免年份卡只用约字标记估算结果，不展示冗长估算说明", () => {
  assert.doesNotMatch(pageSource, /不使用其他口径估算/);
  assert.doesNotMatch(pageSource, /item\.dataAvailabilityNote \|\|/);
  assert.doesNotMatch(pageSource, /item\.rateReviewNote/);
  assert.doesNotMatch(pageSource, /推免人数按学校官方推荐名单计数；保研率优先使用/);
});
