import { getOutputPath, getSchoolByName, isCliModule, parseArgs, readJson, shouName } from "./common.mjs";
import { validateRecommendationData } from "./validateRecommendationData.mjs";

if (isCliModule(import.meta.url)) {
  const args = parseArgs();
  const school = await getSchoolByName(args["school-name"] || shouName);
  const data = await readJson(getOutputPath(school.id), null);
  if (!data) {
    console.log(`学校ID：${school.id}`);
    console.log("推免数据文件：不存在");
    process.exit(0);
  }

  const schoolLevel = data.recommendationData?.schoolLevel || {};
  const college = data.recommendationData?.colleges?.[0] || {};
  const major = college.majors?.[0] || {};
  const validation = validateRecommendationData(data);

  console.log(`学校ID：${school.id}`);
  console.log(`数据文件：public/data/my-school/${school.id}.json`);
  console.log(`最新官方公开年份：${data.latestDataYear || "未识别"}`);
  console.log(`学校推荐名单计数：${schoolLevel.recommendedCount ?? "未识别"}`);
  console.log(`经济管理学院推荐名单计数：${college.recommendedCount ?? "未识别"}`);
  console.log(`会计学推荐名单计数：${major.recommendedCount ?? "未识别"}`);
  console.log(`可计算推免率数量：${[schoolLevel, college, major].filter((item) => item.recommendationRate != null).length}`);
  console.log(`无分母无法计算字段：${[schoolLevel, college, major].filter((item) => item.recommendedCount != null && item.recommendationRate == null).length}`);
  console.log(`政策数量：${(data.policies || []).length}`);
  console.log(`排名规则数量：${(data.rankingRules || []).length}`);
  console.log(`加分规则数量：${(data.bonusRules || []).length}`);
  console.log(`通知数量：${(data.notices || []).length}`);
  console.log(`复核项：${validation.issues.length}`);
}
