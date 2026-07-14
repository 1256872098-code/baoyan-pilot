import { isCliModule, writeJsonAtomic } from "../common.mjs";
import { getOutputPath, getTargetIds, readJson, reportPath } from "./common.mjs";
import { validateAccountingData } from "./validateData.mjs";

export async function generateAccountingReport() {
  const ids = await getTargetIds();
  const data = await readJson(getOutputPath(ids.school.id), null);
  if (!data) throw new Error("未找到上海海洋大学 my-school 数据文件。");
  const history = data.accountingRecommendationHistory || [];
  const validation = validateAccountingData(data);
  const report = {
    school: "上海海洋大学",
    college: "经济管理学院",
    major: "会计学",
    availableYears: history.map((item) => item.graduationYear).sort((a, b) => a - b),
    recommendedCountYears: history.filter((item) => item.recommendedCount != null).map((item) => item.graduationYear),
    recommendationRateYears: history.filter((item) => item.recommendationRate != null).map((item) => item.graduationYear),
    officialDataCount: history.filter((item) => item.countMethod === "official-list-count").length,
    referenceDataCount: history.filter((item) => item.sourceLevel === "credible-reference").length,
    estimatedDataCount: history.filter((item) => item.isEstimated).length,
    policyCount: (data.policies || []).filter((item) => item.scope?.collegeId === ids.college.id).length,
    rankingRuleCount: (data.rankingRules || []).filter((item) => item.scope?.collegeId === ids.college.id).length,
    bonusRuleCount: (data.bonusRules || []).filter((item) => item.scope?.collegeId === ids.college.id).length,
    reviewItems: validation.issues.length,
    generatedAt: new Date().toISOString(),
  };
  await writeJsonAtomic(reportPath, report);
  return report;
}

if (isCliModule(import.meta.url)) {
  const report = await generateAccountingReport();
  console.log(JSON.stringify(report, null, 2));
}
