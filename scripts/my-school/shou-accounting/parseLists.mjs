import { sha256, shortEvidence } from "../common.mjs";

const collegeName = "经济管理学院";
const majorName = "会计学";

export function parseAccountingListCount(parsed, source) {
  const rawText = String(parsed.rawText || parsed.text || "");
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let schoolTotal = 0;
  let collegeCount = 0;
  let majorCount = 0;
  const majorLines = [];

  for (const line of lines) {
    const serial = line.match(/^(\d{1,3})\s+/);
    if (serial) schoolTotal = Math.max(schoolTotal, Number(serial[1]));
    if (line.match(new RegExp(`^\\d{1,3}\\s+${collegeName}\\s+`))) collegeCount += 1;
    if (line.match(new RegExp(`^\\d{1,3}\\s+${collegeName}\\s+${majorName}\\s+`))) {
      majorCount += 1;
      majorLines.push(line);
    }
  }

  if (!majorCount) return null;

  return {
    graduationYear: source.graduationYear,
    recommendedCount: majorCount,
    cohortSize: null,
    recommendationRate: null,
    countMethod: "official-list-count",
    sourceLevel: source.sourceLevel,
    sourceLabel: "官方数据",
    isEstimated: false,
    dataStatus: "partial",
    schoolTotalRecommendedCount: schoolTotal || null,
    collegeRecommendedCount: collegeCount || null,
    calculationMethod: null,
    numeratorSource: source.url,
    denominatorSource: null,
    sources: [
      {
        title: source.title,
        url: source.url,
        organization: source.organization,
        publishedAt: parsed.publishedAt || null,
        sourceLevel: source.sourceLevel,
        sourceType: source.sourceType,
        countMethod: "official-list-count",
        evidenceText: shortEvidence(majorLines.join("；"), 180),
        contentHash: sha256(rawText),
        crawledAt: new Date().toISOString(),
      },
    ],
  };
}

export function parseAccountingCohortEstimate(parsed, source) {
  const tables = Array.isArray(parsed.tables) ? parsed.tables : [];
  let row = null;
  for (const table of tables) {
    row = table.find((cells) => cells?.[0] === majorName);
    if (row) break;
  }
  if (!row) return null;

  const collegeExcellentQuota = Number(row[1]);
  const schoolExcellentQuota = Number(row[2]);
  const cityExcellentQuota = Number(row[3]);
  if (!Number.isFinite(cityExcellentQuota) || cityExcellentQuota <= 0) return null;

  const cohortSize = Math.round(cityExcellentQuota / 0.05);
  return {
    graduationYear: source.graduationYear,
    cohortSize,
    denominatorSource: source.url,
    denominatorSourceLevel: source.sourceLevel,
    denominatorMethod: "city-excellent-graduate-quota-divided-by-5-percent",
    denominatorEvidence: `会计学市优推荐名额${cityExcellentQuota}人；页面说明上海市优秀毕业生比例不超过应届全日制本科毕业生人数的5%。`,
    denominatorSourceDetail: {
      title: source.title,
      url: source.url,
      organization: source.organization,
      publishedAt: parsed.publishedAt || null,
      sourceLevel: source.sourceLevel,
      sourceType: source.sourceType,
      countMethod: "cohort-estimate",
      evidenceText: `会计学：学院推荐名额${collegeExcellentQuota}，校优推荐名额${schoolExcellentQuota}，市优推荐名额${cityExcellentQuota}。按市优5%估算毕业生人数约${cohortSize}人。`,
      contentHash: sha256(parsed.text || JSON.stringify(tables)),
      crawledAt: new Date().toISOString(),
    },
  };
}
