import { discoverRecommendationSources } from "./discoverRecommendationSources.mjs";
import { fetchRecommendationSource } from "./fetchRecommendationSource.mjs";
import { normalizeRecommendationData } from "./normalizeRecommendationData.mjs";
import { mergeRecommendationData } from "./mergeRecommendationData.mjs";
import { generateRecommendationReport } from "./generateRecommendationReport.mjs";
import { extractRecommendationDataWithAI } from "./extractRecommendationDataWithAI.mjs";
import { parseArgs, parseYears, reviewPath, shouName, writeJsonAtomic } from "./common.mjs";

async function main() {
  const args = parseArgs();
  const schoolName = args["school-name"] || shouName;
  const years = parseYears(args.years);
  const discovered = await discoverRecommendationSources({ schoolName, years });
  const parsedSources = [];
  const failedSources = [];

  console.log(`学校实际schoolId：${discovered.school.id}`);
  console.log(`搜索/登记候选来源数：${discovered.sources.length}`);

  for (const source of discovered.sources) {
    if (!source.enabled) continue;
    if (!source.verified) continue;
    try {
      console.log(`抓取来源：${source.url}`);
      const parsed = await fetchRecommendationSource(source);
      parsedSources.push(parsed);
    } catch (error) {
      failedSources.push({ url: source.url, title: source.name, error: error.message });
      console.warn(`来源抓取失败：${source.url} ${error.message}`);
    }
  }

  const ai = await extractRecommendationDataWithAI();
  const nextData = await normalizeRecommendationData({ school: discovered.school, parsedSources, ai });
  nextData.parseMeta = {
    ...(nextData.parseMeta || {}),
    searchCandidateCount: discovered.searchCandidateCount,
    registeredCount: discovered.registeredCount,
    failedSources,
    ai,
  };

  const mergeResult = await mergeRecommendationData({ schoolId: discovered.school.id, nextData });
  const report = await generateRecommendationReport({ schoolName: discovered.school.name });
  await writeJsonAtomic(reviewPath, {
    schoolId: discovered.school.id,
    schoolName: discovered.school.name,
    issues: mergeResult.validation.issues,
    failedSources,
    generatedAt: new Date().toISOString(),
  });

  const schoolLevel = nextData.recommendationData?.schoolLevel || {};
  const college = nextData.recommendationData?.colleges?.[0] || {};
  const major = college.majors?.[0] || {};
  const flatSources = parsedSources.flatMap((source) => [source, ...(source.parsedAttachments || [])]);

  console.log("抓取完成");
  console.log(`通过官方域名验证的来源数：${nextData.parseMeta.verifiedSources || 0}`);
  console.log(`HTML来源数：${flatSources.filter((source) => source.contentType === "html").length}`);
  console.log(`PDF来源数：${flatSources.filter((source) => source.contentType === "pdf").length}`);
  console.log(`Excel来源数：${flatSources.filter((source) => source.contentType === "spreadsheet").length}`);
  console.log(`解析成功数：${flatSources.filter((source) => !source.parseError).length}`);
  console.log(`进入人工审核数：${mergeResult.validation.issues.length}`);
  console.log(`学校级推荐名单计数字段：${schoolLevel.recommendedCount ?? "未识别"}`);
  console.log(`经济管理学院推荐名单计数字段：${college.recommendedCount ?? "未识别"}`);
  console.log(`会计学推荐名单计数字段：${major.recommendedCount ?? "未识别"}`);
  console.log(`可计算推免率数量：${[schoolLevel, college, major].filter((item) => item.recommendationRate != null).length}`);
  console.log(`无分母无法计算的字段：${[schoolLevel, college, major].filter((item) => item.recommendedCount != null && item.recommendationRate == null).length}`);
  console.log(`输出JSON路径：${mergeResult.outputPath}`);
  console.log(`前端可展示模块数量：${["recommendationData", "policies", "rankingRules", "bonusRules", "timeline", "notices"].filter((key) => nextData[key] || nextData.recommendationData).length}`);
  console.log(`报告路径：scripts/reports/shou-recommendation-report.json`);
  console.log(`报告摘要：${JSON.stringify(report)}`);
}

main().catch((error) => {
  console.error(`抓取失败：${error.message}`);
  process.exit(1);
});
