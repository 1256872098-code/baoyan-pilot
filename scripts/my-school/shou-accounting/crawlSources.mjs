import { parseArgs, readJson, sourceRegistryPath, parseYears, getTargetIds, getOutputPath, writeJsonAtomic, reviewPath } from "./common.mjs";
import { parsePdfSource } from "./parsePdf.mjs";
import { parseHtmlSource } from "./parseHtml.mjs";
import { parseAccountingCohortEstimate, parseAccountingListCount } from "./parseLists.mjs";
import { extractPolicyBundle } from "./extractPolicies.mjs";
import { normalizeAccountingData } from "./normalizeData.mjs";
import { validateAccountingData } from "./validateData.mjs";
import { generateAccountingReport } from "./generateReport.mjs";

function isPdf(url) {
  return /\.pdf(\?|$)/i.test(url);
}

async function parseSource(source) {
  if (isPdf(source.url)) return parsePdfSource(source);
  return parseHtmlSource(source);
}

function mergeByYear(existing = [], next = []) {
  const map = new Map();
  for (const item of existing) map.set(item.graduationYear, item);
  for (const item of next) {
    const old = map.get(item.graduationYear);
    const itemHasRateInput = item.cohortSize != null || item.recommendationRate != null;
    const oldHasRateInput = old?.cohortSize != null || old?.recommendationRate != null;
    if (!old || itemHasRateInput || !oldHasRateInput || old.sourceLevel !== "official" || item.sourceLevel === "official") {
      map.set(item.graduationYear, item);
    }
  }
  return [...map.values()].sort((a, b) => b.graduationYear - a.graduationYear);
}

function mergeScopedArray(existing = [], nextItemOrItems, sourceKey = "url") {
  const nextItems = Array.isArray(nextItemOrItems) ? nextItemOrItems.filter(Boolean) : [nextItemOrItems].filter(Boolean);
  const result = [...existing];
  for (const item of nextItems) {
    const key = item.source?.[sourceKey] || `${item.year}-${item.title || item.category}`;
    const index = result.findIndex((current) => (current.source?.[sourceKey] || `${current.year}-${current.title || current.category}`) === key);
    if (index >= 0) result[index] = item;
    else result.push(item);
  }
  return result;
}

async function main() {
  const args = parseArgs();
  const years = parseYears(args.years);
  const ids = await getTargetIds();
  const registry = await readJson(sourceRegistryPath, []);
  const entry = registry[0] || {};
  const sources = (entry.sourcePages || []).filter((source) => source.enabled !== false && source.verified && years.includes(source.graduationYear));
  const parsed = [];
  const counts = [];
  const cohortEstimates = [];
  const failures = [];

  console.log(`处理对象：${ids.school.name} / ${ids.college.name} / 会计学`);
  console.log(`学校ID：${ids.school.id}`);
  console.log(`学院ID：${ids.college.id}`);
  console.log(`专业ID：${ids.majorId}`);
  console.log(`已启用来源：${sources.length}`);

  for (const source of sources) {
    try {
      console.log(`抓取：${source.title}`);
      const parsedSource = await parseSource(source);
      parsed.push({ source, parsed: parsedSource });
      if (source.sourceType === "recommendation-list") {
        const count = parseAccountingListCount(parsedSource, source);
        if (count) counts.push(count);
      }
      if (source.sourceType === "cohort-estimate") {
        const estimate = parseAccountingCohortEstimate(parsedSource, source);
        if (estimate) cohortEstimates.push(estimate);
      }
    } catch (error) {
      failures.push({ title: source.title, url: source.url, error: error.message });
      console.warn(`抓取失败：${source.url} ${error.message}`);
    }
  }

  const policyBundle = extractPolicyBundle(
    parsed.filter((item) => item.source.sourceType === "policy").map((item) => item.parsed),
    { schoolId: ids.school.id, collegeId: ids.college.id, majorId: ids.majorId },
  );
  const countsWithCohort = counts.map((count) => {
    const estimate = cohortEstimates.find((item) => item.graduationYear === count.graduationYear);
    if (!estimate) return count;
    return {
      ...count,
      cohortSize: estimate.cohortSize,
      denominatorSource: estimate.denominatorSource,
      denominatorSourceLevel: estimate.denominatorSourceLevel,
      denominatorMethod: estimate.denominatorMethod,
      denominatorEvidence: estimate.denominatorEvidence,
      sourceLevel: "third-party-estimate",
      sourceLabel: "估算值，仅供参考",
      isEstimated: true,
      dataStatus: "estimated",
      sources: [...(count.sources || []), estimate.denominatorSourceDetail],
    };
  });
  const normalized = normalizeAccountingData({ counts: countsWithCohort, policies: policyBundle, ids });
  const outputPath = getOutputPath(ids.school.id);
  const current = await readJson(outputPath, {});
  const retainedBonusRules = (current.bonusRules || []).filter(
    (item) => !(item.year === 2026 && item.collegeName === "经济管理学院"),
  );
  const nextData = {
    ...current,
    accountingRecommendationHistory: mergeByYear(current.accountingRecommendationHistory, normalized.accountingRecommendationHistory),
    policies: mergeScopedArray(current.policies, policyBundle.policy),
    rankingRules: mergeScopedArray(current.rankingRules, policyBundle.rankingRule),
    bonusRules: mergeScopedArray(retainedBonusRules, policyBundle.bonusRules, "category"),
    lastUpdatedAt: new Date().toISOString(),
  };

  const validation = validateAccountingData(nextData);
  await writeJsonAtomic(outputPath, nextData, { backup: Boolean(current?.schoolId) });
  await writeJsonAtomic(reviewPath, {
    school: "上海海洋大学",
    college: "经济管理学院",
    major: "会计学",
    issues: validation.issues,
    failures,
    generatedAt: new Date().toISOString(),
  });
  const report = await generateAccountingReport();

  console.log("抓取完成");
  console.log(`可用年度：${nextData.accountingRecommendationHistory.map((item) => `${item.graduationYear}届`).join("、")}`);
  console.log(`推免人数年度：${nextData.accountingRecommendationHistory.filter((item) => item.recommendedCount != null).map((item) => item.graduationYear).join("、")}`);
  console.log(`保研率年度：${nextData.accountingRecommendationHistory.filter((item) => item.recommendationRate != null).map((item) => item.graduationYear).join("、") || "无"}`);
  console.log(`失败来源：${failures.length}`);
  console.log(`复核项：${validation.issues.length}`);
  console.log(`输出文件：public/data/my-school/${ids.school.id}.json`);
  console.log(`报告：${JSON.stringify(report)}`);
}

main().catch((error) => {
  console.error(`会计学专项抓取失败：${error.message}`);
  process.exit(1);
});
