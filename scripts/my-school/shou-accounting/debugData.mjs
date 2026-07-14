import { isCliModule } from "../common.mjs";
import { getOutputPath, getTargetIds, readJson } from "./common.mjs";
import { validateAccountingData } from "./validateData.mjs";

if (isCliModule(import.meta.url)) {
  const ids = await getTargetIds();
  const data = await readJson(getOutputPath(ids.school.id), null);
  const history = data?.accountingRecommendationHistory || [];
  const validation = validateAccountingData(data || {});
  console.log(`学校ID：${ids.school.id}`);
  console.log(`学院ID：${ids.college.id}`);
  console.log(`专业ID：${ids.majorId}`);
  for (const item of history.sort((a, b) => b.graduationYear - a.graduationYear)) {
    console.log(
      `${item.graduationYear}届：推免人数=${item.recommendedCount ?? "未找到"}，毕业生人数=${item.cohortSize ?? "未找到"}，保研率=${item.recommendationRate == null ? "暂无法计算" : item.recommendationRate}`,
    );
  }
  console.log(`复核项：${validation.issues.length}`);
}
