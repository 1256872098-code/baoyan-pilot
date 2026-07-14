import { isCliModule, writeJsonAtomic } from "../common.mjs";
import { getOutputPath, getTargetIds, readJson, reviewPath } from "./common.mjs";

export function validateAccountingData(data) {
  const issues = [];
  for (const item of data?.accountingRecommendationHistory || []) {
    if (item.sourceLevel === "manual-review") {
      issues.push({ code: "manual-review", message: `${item.graduationYear}届数据需要人工审核。` });
    }
    if (item.recommendedCount != null && (!Number.isInteger(item.recommendedCount) || item.recommendedCount < 0)) {
      issues.push({ code: "invalid-count", message: `${item.graduationYear}届推免人数不是非负整数。` });
    }
    if (item.cohortSize != null && (!Number.isInteger(item.cohortSize) || item.cohortSize <= 0)) {
      issues.push({ code: "invalid-cohort", message: `${item.graduationYear}届毕业生人数无效。` });
    }
    if (item.recommendedCount != null && item.cohortSize != null && item.recommendedCount > item.cohortSize) {
      issues.push({ code: "count-over-cohort", message: `${item.graduationYear}届分子大于分母。` });
    }
    if (item.recommendationRate != null && (item.recommendationRate < 0 || item.recommendationRate > 1)) {
      issues.push({ code: "invalid-rate", message: `${item.graduationYear}届保研率超出合理范围。` });
    }
    if (item.sourceLevel === "official" && !item.sources?.some((source) => /shou\.edu\.cn/.test(source.url))) {
      issues.push({ code: "official-source-missing", message: `${item.graduationYear}届官方数据缺少官方来源。` });
    }
  }
  return {
    valid: !issues.some((issue) => ["invalid-count", "invalid-cohort", "count-over-cohort", "invalid-rate", "official-source-missing"].includes(issue.code)),
    issues,
  };
}

if (isCliModule(import.meta.url)) {
  const ids = await getTargetIds();
  const data = await readJson(getOutputPath(ids.school.id), null);
  const result = validateAccountingData(data || {});
  await writeJsonAtomic(reviewPath, {
    school: "上海海洋大学",
    college: "经济管理学院",
    major: "会计学",
    issues: result.issues,
    generatedAt: new Date().toISOString(),
  });
  console.log(`会计学数据验证：${result.valid ? "通过" : "需要复核"}`);
  console.log(`复核项：${result.issues.length}`);
  if (!result.valid) process.exit(1);
}
