import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const searchOrThirdPartyDomains = [
  "baidu.com",
  "bing.com",
  "google.com",
  "sogou.com",
  "so.com",
  "wikipedia.org",
  "baike.baidu.com",
];

const adminKeywords = [
  "办公室",
  "财务",
  "人事",
  "后勤",
  "工会",
  "团委",
  "图书馆",
  "档案馆",
  "党委",
  "党政",
];

function getHostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isSameOrSubdomain(hostname, officialHostname) {
  return Boolean(hostname && officialHostname && (hostname === officialHostname || hostname.endsWith(`.${officialHostname}`)));
}

function isSearchOrThirdParty(url) {
  const hostname = getHostname(url);
  return searchOrThirdPartyDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function validateAcademicUnits({ school, sourceGroup, units, oldUnits = [] }) {
  const errors = [];
  const reviewReasons = [];
  const ids = new Set();
  const officialHostname = getHostname(sourceGroup?.officialWebsite);
  const registeredHosts = new Set(
    [sourceGroup?.officialWebsite, ...(sourceGroup?.candidatePages || []).map((page) => page.url)]
      .map(getHostname)
      .filter(Boolean),
  );

  for (const unit of units) {
    if (!unit.name) errors.push("存在 name 为空的单位。");
    if (ids.has(unit.id)) errors.push(`id 重复：${unit.id}`);
    ids.add(unit.id);
    if (!unit.sourceUrl) errors.push(`${unit.name} 缺少 sourceUrl。`);
    if (unit.dataStatus === "verified" && !unit.sourceUrl) errors.push(`${unit.name} verified 记录缺少来源。`);
    if (unit.confidence < 0 || unit.confidence > 1) errors.push(`${unit.name} confidence 超出 0-1。`);
    if (unit.officialWebsite && isSearchOrThirdParty(unit.officialWebsite)) {
      errors.push(`${unit.name} officialWebsite 是搜索引擎或第三方网站。`);
    }

    const sourceHost = getHostname(unit.sourceUrl);
    if (
      unit.sourceUrl &&
      officialHostname &&
      !isSameOrSubdomain(sourceHost, officialHostname) &&
      !registeredHosts.has(sourceHost)
    ) {
      errors.push(`${unit.name} sourceUrl 不是学校官方域名或已登记官方子域名：${unit.sourceUrl}`);
    }
  }

  if (units.length < 2 || units.length > 100) {
    reviewReasons.push(`单校抓取结果数量异常：${units.length}`);
  }

  if (oldUnits.length && units.length < oldUnits.length * 0.7) {
    reviewReasons.push(`新结果较上次减少超过 30%：旧 ${oldUnits.length}，新 ${units.length}`);
  }

  const adminCount = units.filter((unit) => adminKeywords.some((keyword) => unit.name.includes(keyword))).length;
  if (units.length && adminCount / units.length > 0.3) {
    reviewReasons.push(`疑似行政部门占比超过 30%：${adminCount}/${units.length}`);
  }

  return {
    valid: errors.length === 0,
    needsReview: reviewReasons.length > 0,
    errors,
    reviewReasons,
    schoolId: school?.id || sourceGroup?.schoolId,
  };
}

export async function validateAcademicUnitFiles({ detailsDir = "public/data/school-details" } = {}) {
  const results = [];
  const files = await fs.readdir(detailsDir).catch(() => []);

  for (const file of files.filter((item) => item.endsWith(".json"))) {
    const fullPath = path.join(detailsDir, file);
    const detail = JSON.parse(await fs.readFile(fullPath, "utf8"));
    const units = Array.isArray(detail.academicUnits) ? detail.academicUnits : [];
    results.push({
      file,
      count: units.length,
      duplicateIds: units.length - new Set(units.map((unit) => unit.id)).size,
      missingSources: units.filter((unit) => !unit.sourceUrl).length,
    });
  }

  return results;
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const results = await validateAcademicUnitFiles();
  const failures = results.filter((result) => result.duplicateIds || result.missingSources);
  console.log(JSON.stringify({ checked: results.length, failures, results }, null, 2));
  if (failures.length) process.exitCode = 1;
}
