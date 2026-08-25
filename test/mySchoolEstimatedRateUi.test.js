import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../src/pages/MySchoolPage.jsx", import.meta.url), "utf8");

test("我的院校将估算保研率与官方推免人数明确区分", () => {
  assert.match(pageSource, /官方人数 · 估算率/);
  assert.match(pageSource, /官方人数 \/ 估算率/);
  assert.match(pageSource, /row\.rateStatus === "estimated"/);
  assert.match(pageSource, /estimatedRate \? "约 " : ""/);
  assert.match(pageSource, /毕业生人数根据学校公开的分专业学生数据估算/);
});

test("我的院校不再宣称缺少分母时拒绝估算", () => {
  assert.doesNotMatch(pageSource, /不使用其他口径估算/);
  assert.match(pageSource, /未直接公开时根据学校分专业学生数据估算/);
});
