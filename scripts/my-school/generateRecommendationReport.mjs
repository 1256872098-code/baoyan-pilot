import {
  getOutputPath,
  getSchoolByName,
  isCliModule,
  parseArgs,
  readJson,
  shouName,
  shouReportPath,
  writeJsonAtomic,
} from "./common.mjs";
import { validateRecommendationData } from "./validateRecommendationData.mjs";

export async function generateRecommendationReport({ schoolName = shouName } = {}) {
  const school = await getSchoolByName(schoolName);
  const data = await readJson(getOutputPath(school.id), null);
  if (!data) throw new Error("未找到推免数据文件，请先执行抓取命令。");

  const schoolLevel = data.recommendationData?.schoolLevel || {};
  const college = data.recommendationData?.colleges?.[0] || {};
  const major = college.majors?.[0] || {};
  const validation = validateRecommendationData(data);
  const report = {
    schoolName: school.name,
    schoolId: school.id,
    processedSources: data.parseMeta?.processedSources || 0,
    verifiedSources: data.parseMeta?.verifiedSources || 0,
    failedSources: data.parseMeta?.failedSources || [],
    latestDataYear: data.latestDataYear || null,
    schoolQuotaFound: schoolLevel.recommendationQuota != null,
    collegeQuotaFound: college.recommendationQuota != null,
    accountingQuotaFound: major.recommendationQuota != null,
    cohortSizeFound: Boolean(schoolLevel.cohortSize || college.cohortSize || major.cohortSize),
    schoolRateCalculated: schoolLevel.recommendationRate != null,
    collegeRateCalculated: college.recommendationRate != null,
    majorRateCalculated: major.recommendationRate != null,
    policyFound: (data.policies || []).length > 0,
    rankingRulesFound: (data.rankingRules || []).length > 0,
    bonusRulesFound: (data.bonusRules || []).length > 0,
    noticesFound: (data.notices || []).length,
    reviewItems: validation.issues.length,
    outputPath: `public/data/my-school/${school.id}.json`,
    generatedAt: new Date().toISOString(),
  };

  await writeJsonAtomic(shouReportPath, report);
  return report;
}

if (isCliModule(import.meta.url)) {
  const args = parseArgs();
  const report = await generateRecommendationReport({ schoolName: args["school-name"] || shouName });
  console.log(JSON.stringify(report, null, 2));
}
