import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const __dirname = path.dirname(currentFile);
const rootDir = path.resolve(__dirname, "../..");
const schoolsPath = path.join(rootDir, "public/data/schools.json");
const detailDir = path.join(rootDir, "public/data/school-details");
const registryPath = path.join(rootDir, "scripts/source-registry/school-unit-sources.json");
const progressPath = path.join(rootDir, "scripts/state/academic-units-progress.json");
const reportPath = path.join(rootDir, "scripts/reports/academic-units-full-report.json");
const unresolvedJsonPath = path.join(rootDir, "scripts/review/unresolved-schools.json");
const unresolvedCsvPath = path.join(rootDir, "scripts/review/unresolved-schools.csv");

const finalStatuses = new Set([
  "success",
  "pending-review",
  "source-not-found",
  "crawl-failed",
  "parse-failed",
  "blocked",
  "manual-source-required",
  "skipped",
  "pending",
]);

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

async function writeText(filePath, text) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, text, "utf8");
  await fs.rename(tempPath, filePath);
}

function normalizeStatus(status) {
  if (status === "needs-review") return "pending-review";
  if (status === "not-found" || status === "source-discovery-unavailable") return "source-not-found";
  if (!status || !finalStatuses.has(status)) return "pending";
  return status;
}

function getUnits(detail) {
  if (Array.isArray(detail?.academicUnits)) return detail.academicUnits;
  if (Array.isArray(detail?.colleges)) return detail.colleges;
  return [];
}

async function readDetailSummary(schoolId) {
  const filePath = path.join(detailDir, `${schoolId}.json`);
  const detail = await readJson(filePath, null);
  const units = getUnits(detail);
  return {
    fileExists: Boolean(detail),
    totalCount: units.length,
    verifiedCount: units.filter((unit) => unit.dataStatus === "verified").length,
    pendingCount: units.filter((unit) => unit.dataStatus === "pending-review").length,
    crawlMeta: detail?.crawlMeta || null,
  };
}

function resolveCurrentStatus(record, summary) {
  const detailStatus = normalizeStatus(summary.crawlMeta?.status);
  const progressStatus = normalizeStatus(record.status);
  let status = summary.crawlMeta?.status ? detailStatus : progressStatus;

  if (summary.totalCount > 0 && ["pending", "skipped"].includes(status)) {
    status = "success";
  }

  if (summary.totalCount === 0 && ["success", "skipped"].includes(status)) {
    status = "parse-failed";
  }

  return status;
}

function csvValue(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function recommendedAction({ status, failureStage, currentUnitCount }) {
  if (currentUnitCount > 0) return "核对已抓取学院目录";
  if (status === "blocked") return "官网访问受限，暂缓处理";
  if (status === "manual-source-required") return "人工补充官方来源";
  if (failureStage === "website-discovery" || status === "source-not-found") return "补充学校官网或官方院系页";
  if (failureStage === "academic-unit-page-discovery" || status === "pending-review") {
    return "核对候选院系列表或补充院系设置页";
  }
  if (status === "parse-failed") return "页面结构需要新增解析规则";
  if (status === "crawl-failed") return "检查官方页面访问或网络错误";
  return "继续自动抓取或人工复核";
}

function increaseStatusCount(statusCounts, status) {
  if (status === "pending-review") statusCounts.pendingReview += 1;
  else if (status === "source-not-found") statusCounts.sourceNotFound += 1;
  else if (status === "crawl-failed") statusCounts.crawlFailed += 1;
  else if (status === "parse-failed") statusCounts.parseFailed += 1;
  else if (status === "blocked") statusCounts.blocked += 1;
  else if (status === "manual-source-required") statusCounts.manualSourceRequired += 1;
  else if (status === "skipped") statusCounts.skipped += 1;
  else if (status === "success") statusCounts.success += 1;
  else statusCounts.pending += 1;
}

export async function generateFullReport({ currentRunProcessedSchools = 0, currentRunNewAcademicUnits = 0 } = {}) {
  const schools = await readJson(schoolsPath, []);
  const registry = await readJson(registryPath, []);
  const progress = await readJson(progressPath, { version: 1, totalSchools: schools.length, schools: {} });
  const registryById = new Map(registry.map((item) => [item.schoolId, item]));
  const statusCounts = {
    success: 0,
    pendingReview: 0,
    sourceNotFound: 0,
    crawlFailed: 0,
    parseFailed: 0,
    blocked: 0,
    manualSourceRequired: 0,
    skipped: 0,
    pending: 0,
  };
  let schoolsWithDisplayableUnits = 0;
  let schoolsWithoutUnits = 0;
  let academicUnitsTotal = 0;
  let verifiedUnitsTotal = 0;
  let pendingUnitsTotal = 0;
  let tavilyRequestCount = 0;
  const unresolved = [];

  for (const school of schools) {
    const record = progress.schools?.[school.id] || {};
    const summary = await readDetailSummary(school.id);
    const status = resolveCurrentStatus(record, summary);
    const detailStatus = normalizeStatus(summary.crawlMeta?.status);
    const useDetailMeta = Boolean(summary.crawlMeta?.status) && status === detailStatus;
    const failureStage = useDetailMeta
      ? summary.crawlMeta?.failureStage || record.failureStage || null
      : record.failureStage || summary.crawlMeta?.failureStage || null;
    const lastAttemptAt = useDetailMeta
      ? summary.crawlMeta?.lastCheckedAt || record.lastCheckedAt || null
      : record.lastCheckedAt || summary.crawlMeta?.lastCheckedAt || null;
    const error = useDetailMeta
      ? summary.crawlMeta?.errorMessage || record.error || null
      : record.error || summary.crawlMeta?.errorMessage || null;
    increaseStatusCount(statusCounts, status);

    if (summary.totalCount > 0) schoolsWithDisplayableUnits += 1;
    else schoolsWithoutUnits += 1;
    academicUnitsTotal += summary.totalCount;
    verifiedUnitsTotal += summary.verifiedCount;
    pendingUnitsTotal += summary.pendingCount;
    tavilyRequestCount += record.searchRequestCount || summary.crawlMeta?.searchRequestCount || 0;

    if (summary.totalCount === 0 || status !== "success") {
      const sourceGroup = registryById.get(school.id);
      unresolved.push({
        schoolId: school.id,
        schoolName: school.name,
        status,
        failureStage,
        officialWebsite: sourceGroup?.officialWebsite || school.officialWebsite || summary.crawlMeta?.officialWebsite || "",
        candidateSourcePages: (sourceGroup?.candidatePages || []).map((page) => page.url).filter(Boolean),
        currentUnitCount: summary.totalCount,
        lastAttemptAt,
        attempts: record.attempts || 0,
        error,
        recommendedAction: recommendedAction({
          status,
          failureStage,
          currentUnitCount: summary.totalCount,
        }),
      });
    }
  }

  const coverageRate = schools.length ? Number(((schoolsWithDisplayableUnits / schools.length) * 100).toFixed(2)) : 0;
  const report = {
    schoolsTotal: schools.length,
    schoolsWithDisplayableUnits,
    schoolsWithoutUnits,
    successCount: statusCounts.success,
    pendingReviewCount: statusCounts.pendingReview,
    sourceNotFoundCount: statusCounts.sourceNotFound,
    crawlFailedCount: statusCounts.crawlFailed,
    parseFailedCount: statusCounts.parseFailed,
    blockedCount: statusCounts.blocked,
    manualSourceRequiredCount: statusCounts.manualSourceRequired,
    skippedCount: statusCounts.skipped,
    pendingCount: statusCounts.pending,
    academicUnitsTotal,
    verifiedUnitsTotal,
    pendingUnitsTotal,
    coverageRate,
    tavilyRequestCount,
    currentRunProcessedSchools,
    currentRunNewAcademicUnits,
    unresolvedSchoolCount: unresolved.length,
    lastUpdatedAt: new Date().toISOString(),
  };

  const csvHeader = [
    "schoolId",
    "schoolName",
    "status",
    "failureStage",
    "officialWebsite",
    "candidateSourcePages",
    "currentUnitCount",
    "lastAttemptAt",
    "attempts",
    "error",
    "recommendedAction",
  ];
  const csvRows = unresolved.map((item) =>
    csvHeader.map((key) => csvValue(Array.isArray(item[key]) ? item[key].join(" | ") : item[key])).join(","),
  );

  await writeJson(reportPath, report);
  await writeJson(unresolvedJsonPath, unresolved);
  await writeText(unresolvedCsvPath, `${csvHeader.join(",")}\n${csvRows.join("\n")}\n`);

  return { report, unresolved };
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const { report } = await generateFullReport();
  console.log(`全国学校总数：${report.schoolsTotal}`);
  console.log(`已有学院目录学校数：${report.schoolsWithDisplayableUnits}`);
  console.log(`仍无学院目录学校数：${report.schoolsWithoutUnits}`);
  console.log(`覆盖率：${report.coverageRate}%`);
  console.log(`学院总数：${report.academicUnitsTotal}`);
  console.log(`待人工审核学校数：${report.pendingReviewCount + report.manualSourceRequiredCount}`);
  console.log(`source-not-found：${report.sourceNotFoundCount}`);
  console.log(`crawl-failed：${report.crawlFailedCount}`);
  console.log(`parse-failed：${report.parseFailedCount}`);
  console.log(`blocked：${report.blockedCount}`);
  console.log(`Tavily累计请求数：${report.tavilyRequestCount}`);
  console.log(JSON.stringify(report, null, 2));
}
