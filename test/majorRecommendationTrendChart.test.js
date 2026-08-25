import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chartSource = readFileSync(
  new URL("../src/components/my-school/MajorRecommendationTrendChart.jsx", import.meta.url),
  "utf8",
);

test("专业历年趋势图在容器内响应式缩放，不创建横向滚动区", () => {
  assert.match(chartSource, /className="block h-auto w-full"/);
  assert.match(chartSource, /preserveAspectRatio="xMidYMid meet"/);
  assert.doesNotMatch(chartSource, /overflow-x-auto/);
  assert.doesNotMatch(chartSource, /min-w-\[/);
});

test("估算保研率在图例和折线标签中有明确标识", () => {
  assert.match(chartSource, /row\.isEstimated \|\| row\.rateStatus === "estimated"/);
  assert.match(chartSource, /`约 \$\{value\}`/);
  assert.match(chartSource, /hasEstimatedRate \? "（含估算）"/);
});
