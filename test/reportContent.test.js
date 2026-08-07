import assert from "node:assert/strict";
import test from "node:test";
import { createRecommendationPdfBlob } from "../src/utils/recommendationPdf.js";
import { sanitizeRecommendationReportContent } from "../src/utils/reportContent.js";

const sampleReport = `<!-- baoyanpilot-report -->
# BaoyanPilot 保研院校梯度规划报告

> 本报告仅供保研规划参考，不承诺保研成功，请以学校官网最新通知为准。

## 1. 用户信息核验摘要

| 项目 | 内容 |
| --- | --- |
| GPA / 均分 | 3.94 / 4.0 |
| 英语 | CET-6 575 |

## 6. 院校梯度建议

### 6.1 冲：冲刺院校
- A 大学

### 6.2 稳：稳妥匹配院校
- B 大学

### 6.3 保：保底保障院校
- C 大学

## 8. 未来 30 天行动清单

- 这部分不得出现在最终报告中
- 整理材料

## 9. 风险说明与官网核验清单

- 推荐结果仅供规划参考。`;

test("报告清洗会完整删除未来 30 天章节并连续编号", () => {
  const sanitized = sanitizeRecommendationReportContent(sampleReport);

  assert.doesNotMatch(sanitized, /未来\s*30\s*天/);
  assert.doesNotMatch(sanitized, /这部分不得出现在最终报告中|整理材料/);
  assert.match(sanitized, /## 8\. 风险说明与官网核验清单/);
  assert.doesNotMatch(sanitized, /## 9\. 风险说明与官网核验清单/);
});

test("正式 PDF 使用独立中英文字体、粗体标题和真实多页对象", async () => {
  const repeatedReport = `${sampleReport}\n\n${"正文排版测试 BaoyanPilot 2026 GPA 3.94/4.0。".repeat(180)}`;
  const blob = createRecommendationPdfBlob({
    content: repeatedReport,
    generatedAt: new Date("2026-08-07T00:00:00+08:00"),
  });
  const pdf = Buffer.from(await blob.arrayBuffer()).toString("latin1");

  assert.equal(blob.type, "application/pdf");
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /\/BaseFont \/STSong-Light/);
  assert.match(pdf, /\/BaseFont \/Helvetica\b/);
  assert.match(pdf, /\/BaseFont \/Helvetica-Bold\b/);
  assert.match(pdf, /\/Count [2-9]\b/);
  assert.doesNotMatch(pdf, /FEFF/);
});
