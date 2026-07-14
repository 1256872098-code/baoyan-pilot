import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generateFullReport } from "./generateFullReport.mjs";

const currentFile = fileURLToPath(import.meta.url);
const __dirname = path.dirname(currentFile);
const rootDir = path.resolve(__dirname, "../..");
const schoolsPath = path.join(rootDir, "public/data/schools.json");
const registryPath = path.join(rootDir, "scripts/source-registry/school-unit-sources.json");
const progressPath = path.join(rootDir, "scripts/state/academic-units-progress.json");
const batchReportPath = path.join(rootDir, "scripts/reports/academic-units-batch-report.json");
const fullReportPath = path.join(rootDir, "scripts/reports/academic-units-full-report.json");
const singleCrawlerPath = path.join(rootDir, "scripts/academic-units/runAcademicUnitPipeline.mjs");

const defaultStaleDays = 30;
const schoolTimeoutMs = 180 * 1000;
let progressWriteQueue = Promise.resolve();
let stopRequested = false;

function parseArgs(argv) {
  const args = {
    all: false,
    offset: 0,
    limit: 10,
    batchSize: 10,
    concurrency: 2,
    retry: 2,
    force: false,
    failedOnly: false,
    includePending: false,
    resume: false,
    untilComplete: false,
    unprocessedOnly: false,
    retryReview: false,
    retrySourceNotFound: false,
    retryCrawlFailed: false,
    retryParseFailed: false,
    retryBlocked: false,
    staleDays: defaultStaleDays,
    maxNoProgressRounds: 2,
    startAfter: "",
    stopAfter: "",
    maxSchools: null,
    maxSearchRequests: 500,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all") args.all = true;
    if (arg === "--offset") args.offset = Number(argv[index + 1] || 0);
    if (arg === "--limit") args.limit = Number(argv[index + 1] || 10);
    if (arg === "--batch-size") args.batchSize = Number(argv[index + 1] || 10);
    if (arg === "--concurrency") args.concurrency = Math.min(Number(argv[index + 1] || 2), 3);
    if (arg === "--retry") args.retry = Number(argv[index + 1] || 2);
    if (arg === "--force") args.force = true;
    if (arg === "--failed-only") args.failedOnly = true;
    if (arg === "--include-pending") args.includePending = true;
    if (arg === "--resume") args.resume = true;
    if (arg === "--until-complete") args.untilComplete = true;
    if (arg === "--unprocessed-only") args.unprocessedOnly = true;
    if (arg === "--retry-review") args.retryReview = true;
    if (arg === "--retry-source-not-found") args.retrySourceNotFound = true;
    if (arg === "--retry-crawl-failed") args.retryCrawlFailed = true;
    if (arg === "--retry-parse-failed") args.retryParseFailed = true;
    if (arg === "--retry-blocked") args.retryBlocked = true;
    if (arg === "--stale-days") args.staleDays = Number(argv[index + 1] || defaultStaleDays);
    if (arg === "--max-no-progress-rounds") args.maxNoProgressRounds = Number(argv[index + 1] || 2);
    if (arg === "--start-after") args.startAfter = argv[index + 1] || "";
    if (arg === "--stop-after") args.stopAfter = argv[index + 1] || "";
    if (arg === "--max-schools") args.maxSchools = Number(argv[index + 1] || 0) || null;
    if (arg === "--max-search-requests") args.maxSearchRequests = Number(argv[index + 1] || 500);
  }

  args.concurrency = Math.max(1, Math.min(args.concurrency || 2, 3));
  args.retry = Math.max(0, args.retry || 0);
  args.batchSize = Math.max(1, args.batchSize || args.limit || 10);
  args.staleDays = Math.max(1, args.staleDays || defaultStaleDays);
  args.maxNoProgressRounds = Math.max(1, args.maxNoProgressRounds || 2);
  args.maxSearchRequests = Math.max(0, args.maxSearchRequests ?? 500);
  return args;
}

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
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rename(tempPath, filePath);
      return;
    } catch (error) {
      lastError = error;
      if (!["EPERM", "EACCES", "EEXIST"].includes(error.code)) throw error;
      await sleep(150 + attempt * 250);
      if (attempt >= 2) {
        await fs.rm(filePath, { force: true }).catch(() => {});
      }
    }
  }
  throw lastError;
}

async function writeProgress(progress) {
  progressWriteQueue = progressWriteQueue.then(() => writeJson(progressPath, progress));
  return progressWriteQueue;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function politeDelay() {
  await sleep(3000 + Math.floor(Math.random() * 5000));
}

async function completionDelay() {
  await sleep(20000 + Math.floor(Math.random() * 20000));
}

function normalizeProgress(progress, totalSchools, schools = []) {
  const byId = new Map(schools.map((school) => [school.id, school]));
  if (progress?.version === 1 && progress.schools) {
    const nextSchools = {};
    for (const [schoolId, record] of Object.entries(progress.schools)) {
      const school = byId.get(schoolId);
      nextSchools[schoolId] = {
        schoolId,
        schoolName: school?.name || record.schoolName || "",
        status: normalizeResultStatus(record.status || "pending"),
        attempts: record.attempts || 0,
        searchRequestCount: record.searchRequestCount || 0,
        startedAt: record.startedAt || null,
        completedAt: record.completedAt || null,
        lastCheckedAt: record.lastCheckedAt || null,
        verifiedCount: record.verifiedCount || 0,
        pendingCount: record.pendingCount || 0,
        outputPath: record.outputPath || `public/data/school-details/${schoolId}.json`,
        failureStage: record.failureStage || null,
        error: record.error || null,
      };
    }
    return {
      version: 1,
      totalSchools,
      schools: nextSchools,
      lastRunAt: progress.lastRunAt || "",
    };
  }

  return {
    version: 1,
    totalSchools,
    schools: {},
    lastRunAt: progress?.lastRunAt || "",
  };
}

function normalizeResultStatus(status) {
  if (status === "needs-review") return "pending-review";
  if (status === "not-found") return "source-not-found";
  if (status === "source-discovery-unavailable") return "source-not-found";
  if (status === "failed") return "crawl-failed";
  return status || "failed";
}

function isFailureStatus(status) {
  return ["failed", "crawl-failed", "parse-failed", "blocked", "source-not-found", "source-discovery-unavailable", "manual-source-required"].includes(
    normalizeResultStatus(status),
  );
}

function isRecentSuccess(record, detailSummary, staleDays = defaultStaleDays) {
  if (record?.status !== "success" || !record.lastCheckedAt) return false;
  if (!detailSummary?.totalCount) return false;
  return Date.now() - new Date(record.lastCheckedAt).getTime() < staleDays * 24 * 60 * 60 * 1000;
}

function getHostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function readDetailSummary(schoolId) {
  const detailPath = path.join(rootDir, "public/data/school-details", `${schoolId}.json`);
  const detail = await readJson(detailPath, null);
  const units = Array.isArray(detail?.academicUnits)
    ? detail.academicUnits
    : Array.isArray(detail?.colleges)
      ? detail.colleges
      : [];
  return {
    fileExists: Boolean(detail),
    totalCount: units.length,
    verifiedCount: units.filter((unit) => unit.dataStatus === "verified").length,
    pendingCount: units.filter((unit) => unit.dataStatus === "pending-review").length,
    outputPath: `public/data/school-details/${schoolId}.json`,
    status: normalizeResultStatus(detail?.crawlMeta?.status || ""),
    crawlMeta: detail?.crawlMeta || null,
  };
}

function getSchoolDomain(school, registryById) {
  const source = registryById.get(school.id);
  const firstPage = source?.candidatePages?.find((page) => page.enabled)?.url;
  return getHostname(firstPage || source?.officialWebsite || school.officialWebsite) || `no-official-${school.id}`;
}

function parseSingleResult(stdout, fallback) {
  const line = stdout
    .split(/\r?\n/)
    .reverse()
    .find((item) => item.startsWith("ACADEMIC_UNITS_RESULT="));
  if (!line) return fallback;

  try {
    return JSON.parse(line.replace("ACADEMIC_UNITS_RESULT=", ""));
  } catch {
    return fallback;
  }
}

function runSingleCrawler(school, args) {
  return new Promise((resolve) => {
    const childArgs = [singleCrawlerPath, "--school", school.id];
    if (args.force) childArgs.push("--force");
    if (args.includePending) childArgs.push("--include-pending");

    const child = spawn(process.execPath, childArgs, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        BAOYANPILOT_BATCH: "1",
      },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const startedAt = new Date().toISOString();
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill("SIGTERM");
        resolve({
          schoolId: school.id,
          schoolName: school.name,
          success: false,
          status: "crawl-failed",
          failureStage: "timeout",
          searchRequestCount: 0,
          verifiedCount: 0,
          pendingCount: 0,
          added: 0,
          outputPath: `public/data/school-details/${school.id}.json`,
          error: "单校抓取超时。",
          startedAt,
          stdout,
          stderr,
          exitCode: null,
          timedOut: true,
        });
      }
    }, schoolTimeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const fallback = {
        schoolId: school.id,
        schoolName: school.name,
        success: code === 0,
        status: code === 0 ? "success" : "crawl-failed",
        failureStage: code === 0 ? null : "crawl",
        searchRequestCount: 0,
        verifiedCount: 0,
        pendingCount: 0,
        added: 0,
        outputPath: `public/data/school-details/${school.id}.json`,
        error: code === 0 ? null : stderr || `单校爬虫退出码 ${code}`,
      };
      resolve({
        ...parseSingleResult(stdout, fallback),
        startedAt,
        stdout,
        stderr,
        exitCode: code,
        timedOut: false,
      });
    });
  });
}

async function updateProgress(progress, school, result, attempts, startedAt) {
  const completedAt = new Date().toISOString();
  progress.schools[school.id] = {
    schoolId: school.id,
    schoolName: school.name,
    status: normalizeResultStatus(result.status),
    attempts,
    searchRequestCount: result.searchRequestCount || 0,
    startedAt,
    completedAt,
    lastCheckedAt: completedAt,
    verifiedCount: result.verifiedCount || 0,
    pendingCount: result.pendingCount || 0,
    outputPath: result.outputPath || `public/data/school-details/${school.id}.json`,
    failureStage: result.failureStage || null,
    error: result.error || null,
  };
  progress.lastRunAt = completedAt;
  await writeProgress(progress);
}

async function processSchool(school, context) {
  const { args, progress, activeDomains, searchBudget } = context;
  const existing = progress.schools[school.id];
  const beforeSummary = await readDetailSummary(school.id);
  const domain = context.registryById ? getSchoolDomain(school, context.registryById) : `no-official-${school.id}`;

  if (!args.force && isRecentSuccess(existing, beforeSummary, args.staleDays)) {
    const skipped = {
      schoolId: school.id,
      schoolName: school.name,
      success: true,
      status: "skipped",
      failureStage: null,
      searchRequestCount: 0,
      verifiedCount: beforeSummary.verifiedCount,
      pendingCount: beforeSummary.pendingCount,
      added: 0,
      outputPath: beforeSummary.outputPath,
      error: null,
    };
    await updateProgress(progress, school, skipped, existing.attempts || 0, existing.startedAt || new Date().toISOString());
    return skipped;
  }

  while (activeDomains.has(domain)) {
    await sleep(500);
  }
  activeDomains.add(domain);

  const maxAttempts = args.retry + 1;
  let lastResult = null;
  let attempts = 0;
  const startedAt = new Date().toISOString();

  try {
    for (attempts = 1; attempts <= maxAttempts; attempts += 1) {
      progress.schools[school.id] = {
        schoolId: school.id,
        schoolName: school.name,
        status: "running",
        attempts,
        searchRequestCount: progress.schools[school.id]?.searchRequestCount || 0,
        startedAt,
        completedAt: null,
        lastCheckedAt: null,
        verifiedCount: progress.schools[school.id]?.verifiedCount || 0,
        pendingCount: progress.schools[school.id]?.pendingCount || 0,
        outputPath: `public/data/school-details/${school.id}.json`,
        failureStage: null,
        error: null,
      };
      await writeProgress(progress);

      lastResult = await runSingleCrawler(school, args);
      const normalizedStatus = normalizeResultStatus(lastResult.status);
      if (
        lastResult.success ||
        normalizedStatus === "success" ||
        normalizedStatus === "skipped" ||
        normalizedStatus === "pending-review" ||
        normalizedStatus === "source-not-found" ||
        normalizedStatus === "blocked" ||
        normalizedStatus === "parse-failed"
      ) {
        break;
      }
      if (attempts < maxAttempts) await sleep(1500 * attempts);
    }
  } finally {
    activeDomains.delete(domain);
  }

  const afterSummary = await readDetailSummary(school.id);
  let normalized = {
    ...lastResult,
    status: normalizeResultStatus(lastResult?.status),
    searchRequestCount: lastResult?.searchRequestCount || 0,
    verifiedCount: afterSummary.totalCount ? afterSummary.verifiedCount : lastResult?.verifiedCount || 0,
    pendingCount: afterSummary.totalCount ? afterSummary.pendingCount : lastResult?.pendingCount || 0,
    outputPath: afterSummary.outputPath,
  };

  if (normalized.status === "success" && beforeSummary.totalCount === 0 && afterSummary.totalCount === 0) {
    normalized = {
      ...normalized,
      success: false,
      status: "parse-failed",
      failureStage: normalized.failureStage || "parse",
      error: "本次未生成有效 academicUnits，不能标记为 success。",
    };
  }

  const totalAttempts = (existing?.attempts || 0) + attempts;
  if (
    afterSummary.totalCount === 0 &&
    ["source-not-found", "pending-review", "parse-failed"].includes(normalized.status) &&
    totalAttempts >= 2
  ) {
    normalized = {
      ...normalized,
      success: false,
      status: "manual-source-required",
      failureStage: normalized.failureStage || "source-discovery",
      error: normalized.error || "Automatic discovery failed repeatedly; manual official source is required.",
    };
  }

  normalized.added = normalized.added || Math.max(0, afterSummary.totalCount - beforeSummary.totalCount);
  searchBudget.used += normalized.searchRequestCount || 0;
  await updateProgress(progress, school, normalized, attempts, startedAt);

  if (normalized.status !== "skipped") {
    await politeDelay();
    await completionDelay();
  }
  return normalized;
}

async function getSchoolTaskState(school, progress, args) {
  const record = progress.schools?.[school.id] || null;
  const detail = await readDetailSummary(school.id);
  const status = normalizeResultStatus(record?.status || detail.status || "pending");
  const recentSuccess = isRecentSuccess(record, detail, args.staleDays);
  return {
    school,
    record,
    detail,
    status,
    recentSuccess,
    hasDisplayableUnits: detail.totalCount > 0,
  };
}

function explicitRetryStatuses(args) {
  const statuses = new Set();
  if (args.retryReview) statuses.add("pending-review");
  if (args.retrySourceNotFound || args.failedOnly) statuses.add("source-not-found");
  if (args.retryCrawlFailed || args.failedOnly) statuses.add("crawl-failed");
  if (args.retryParseFailed || args.failedOnly) statuses.add("parse-failed");
  if (args.retryBlocked) statuses.add("blocked");
  return statuses;
}

function shouldProcessState(state, args, retryStatuses) {
  const { status, record, detail, recentSuccess, hasDisplayableUnits } = state;
  if (recentSuccess && !args.force) return false;
  if (status === "blocked" && !args.retryBlocked && !args.force) return false;

  if (retryStatuses.size) {
    return retryStatuses.has(status);
  }

  if (args.unprocessedOnly) {
    return !hasDisplayableUnits && status !== "blocked";
  }

  if (!record || status === "pending") return true;
  if (!detail.fileExists || !Array.isArray(detail.crawlMeta?.sourceUrls)) return true;
  if (!hasDisplayableUnits && !["blocked"].includes(status)) return true;
  if (["pending-review", "source-not-found", "crawl-failed", "parse-failed", "manual-source-required"].includes(status)) return true;
  if (status === "success" && !recentSuccess) return true;
  return false;
}

function priorityOfState(state) {
  const { status, record, detail, hasDisplayableUnits } = state;
  if (!record || status === "pending") return 10;
  if (!detail.fileExists) return 11;
  if (!hasDisplayableUnits && status === "pending") return 12;
  if (!hasDisplayableUnits && !["pending-review", "source-not-found", "crawl-failed", "parse-failed", "blocked"].includes(status)) return 13;
  if (status === "pending-review") return 20;
  if (status === "source-not-found") return 21;
  if (status === "crawl-failed") return 22;
  if (status === "parse-failed") return 23;
  if (status === "manual-source-required") return 24;
  if (status === "blocked") return 30;
  if (status === "success" || status === "skipped") return 40;
  return 50;
}

async function selectTargets(schools, progress, args) {
  const retryStatuses = explicitRetryStatuses(args);
  let scopedSchools = schools;
  if (args.startAfter) {
    const index = scopedSchools.findIndex((school) => school.id === args.startAfter || school.name === args.startAfter);
    if (index >= 0) scopedSchools = scopedSchools.slice(index + 1);
  }
  if (args.stopAfter) {
    const index = scopedSchools.findIndex((school) => school.id === args.stopAfter || school.name === args.stopAfter);
    if (index >= 0) scopedSchools = scopedSchools.slice(0, index + 1);
  }
  const states = [];
  for (const school of scopedSchools) {
    states.push(await getSchoolTaskState(school, progress, args));
  }

  let targets = states
    .filter((state) => shouldProcessState(state, args, retryStatuses))
    .sort((a, b) => priorityOfState(a) - priorityOfState(b))
    .map((state) => state.school);

  if (!args.all && !args.failedOnly && !retryStatuses.size && !args.unprocessedOnly) {
    targets = targets.slice(args.offset, args.offset + args.limit);
  } else if (args.offset) {
    targets = targets.slice(args.offset);
  }
  if (args.maxSchools) targets = targets.slice(0, args.maxSchools);
  return targets;
}

async function runWithConcurrency(targets, context) {
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < targets.length && !stopRequested) {
      if (context.searchBudget.used >= context.args.maxSearchRequests) {
        context.stoppedDueToSearchLimit = true;
        break;
      }

      const school = targets[nextIndex];
      nextIndex += 1;
      try {
        const result = await processSchool(school, context);
        results.push({ school, result });
      } catch (error) {
        const result = {
          schoolId: school.id,
          schoolName: school.name,
          success: false,
          status: "failed",
          failureStage: "batch-scheduler",
          searchRequestCount: 0,
          verifiedCount: 0,
          pendingCount: 0,
          added: 0,
          outputPath: `public/data/school-details/${school.id}.json`,
          error: error?.message || "批量调度失败。",
        };
        await updateProgress(context.progress, school, result, 1, new Date().toISOString());
        results.push({ school, result });
      }
    }
  }

  const workerCount = Math.min(context.args.concurrency, targets.length || 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function readAllDetailSummaries(schools) {
  const summaries = new Map();
  for (const school of schools) {
    summaries.set(school.id, await readDetailSummary(school.id));
  }
  return summaries;
}

function createBatchReport({ args, startedAt, completedAt, results, totalSelected, stoppedDueToSearchLimit, searchRequestCount }) {
  const statusOf = (result) => normalizeResultStatus(result.status);
  const failedSchools = results
    .filter(({ result }) => isFailureStatus(statusOf(result)))
    .map(({ school, result }) => ({
      schoolId: school.id,
      schoolName: school.name,
      failureStage: result.failureStage || null,
      error: result.error || "failed",
    }));
  const pendingReviewSchools = results
    .filter(({ result }) => statusOf(result) === "pending-review")
    .map(({ school, result }) => ({
      schoolId: school.id,
      schoolName: school.name,
      failureStage: result.failureStage || null,
      error: result.error || "pending review",
    }));

  return {
    startedAt,
    completedAt,
    offset: args.offset,
    limit: args.limit,
    batchSize: args.batchSize,
    totalSelected,
    processed: results.length,
    success: results.filter(({ result }) => statusOf(result) === "success").length,
    failed: failedSchools.length,
    pendingReview: pendingReviewSchools.length,
    skipped: results.filter(({ result }) => statusOf(result) === "skipped").length,
    sourceNotFound: results.filter(({ result }) => statusOf(result) === "source-not-found").length,
    crawlFailed: results.filter(({ result }) => statusOf(result) === "crawl-failed").length,
    parseFailed: results.filter(({ result }) => statusOf(result) === "parse-failed").length,
    blocked: results.filter(({ result }) => statusOf(result) === "blocked").length,
    manualSourceRequired: results.filter(({ result }) => statusOf(result) === "manual-source-required").length,
    newAcademicUnits: results.reduce((sum, { result }) => sum + (result.added || 0), 0),
    updatedAcademicUnits: 0,
    searchRequestCount,
    averageSearchRequestsPerProcessedSchool: results.length ? Number((searchRequestCount / results.length).toFixed(2)) : 0,
    stoppedDueToSearchLimit,
    stoppedBySignal: stopRequested,
    failedSchools,
    pendingReviewSchools,
  };
}

async function createFullReport({ schools, progress, batchReport, results }) {
  const detailSummaries = await readAllDetailSummaries(schools);
  const records = Object.values(progress.schools || {});
  const statusCounts = records.reduce((acc, record) => {
    const status = normalizeResultStatus(record.status);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  let nonEmpty = 0;
  let empty = 0;
  let totalUnits = 0;
  for (const summary of detailSummaries.values()) {
    if (summary.totalCount) nonEmpty += 1;
    else empty += 1;
    totalUnits += summary.totalCount;
  }
  const totalSearchRequests = records.reduce((sum, record) => sum + (record.searchRequestCount || 0), 0);
  const failedSchools = records
    .filter((record) => isFailureStatus(record.status))
    .map((record) => ({
      schoolId: record.schoolId,
      schoolName: record.schoolName,
      status: normalizeResultStatus(record.status),
      failureStage: record.failureStage || null,
      error: record.error || null,
    }));

  return {
    generatedAt: new Date().toISOString(),
    schoolsTotal: schools.length,
    currentRunProcessedSchools: results.length,
    cumulativeCompletedSchools: records.filter((record) => ["success", "skipped"].includes(normalizeResultStatus(record.status))).length,
    success: statusCounts.success || 0,
    pendingReview: statusCounts["pending-review"] || 0,
    sourceNotFound: statusCounts["source-not-found"] || 0,
    crawlFailed: statusCounts["crawl-failed"] || 0,
    parseFailed: statusCounts["parse-failed"] || 0,
    blocked: statusCounts.blocked || 0,
    skipped: statusCounts.skipped || 0,
    academicUnitsNonEmptySchoolCount: nonEmpty,
    academicUnitsEmptySchoolCount: empty,
    academicUnitsTotalCount: totalUnits,
    currentRunNewAcademicUnits: batchReport.newAcademicUnits,
    tavilyRequestTotal: totalSearchRequests,
    currentRunTavilyRequestCount: batchReport.searchRequestCount,
    averageTavilyRequestsPerProcessedSchool: records.length ? Number((totalSearchRequests / records.length).toFixed(2)) : 0,
    failedSchools,
  };
}

async function writeReports({ args, startedAt, completedAt, allResults, totalSelected, context, schools, progress }) {
  const batchReport = createBatchReport({
    args,
    startedAt,
    completedAt,
    results: allResults,
    totalSelected,
    stoppedDueToSearchLimit: context.stoppedDueToSearchLimit,
    searchRequestCount: context.searchBudget.used,
  });
  await writeJson(batchReportPath, batchReport);
  const { report: fullReport } = await generateFullReport({
    currentRunProcessedSchools: allResults.length,
    currentRunNewAcademicUnits: batchReport.newAcademicUnits,
  });
  return { batchReport, fullReport };
}

function chunkTargets(targets, size) {
  const chunks = [];
  for (let index = 0; index < targets.length; index += size) {
    chunks.push(targets.slice(index, index + size));
  }
  return chunks;
}

async function countDisplayableSchools(schools) {
  let count = 0;
  for (const school of schools) {
    const summary = await readDetailSummary(school.id);
    if (summary.totalCount > 0) count += 1;
  }
  return count;
}

async function main() {
  process.once("SIGINT", () => {
    stopRequested = true;
    console.log("收到退出信号，正在保存当前进度，本轮不会再启动新学校。");
  });

  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const schools = await readJson(schoolsPath, []);
  const registry = await readJson(registryPath, []);
  const rawProgress = await readJson(progressPath, null);
  const progress = normalizeProgress(rawProgress, schools.length, schools);
  const registryById = new Map(registry.map((item) => [item.schoolId, item]));
  const allResults = [];
  const context = {
    args,
    progress,
    registryById,
    activeDomains: new Set(),
    searchBudget: { used: 0 },
    stoppedDueToSearchLimit: false,
  };

  await writeProgress(progress);

  let totalSelected = 0;
  let noProgressRounds = 0;
  let round = 0;

  while (!stopRequested && !context.stoppedDueToSearchLimit) {
    round += 1;
    const displayableBefore = await countDisplayableSchools(schools);
    const targets = await selectTargets(schools, progress, args);
    if (!totalSelected) totalSelected = targets.length;
    if (!targets.length) break;

    const roundTargets = args.untilComplete ? targets : targets.slice(0, args.maxSchools || targets.length);
    for (const batch of chunkTargets(roundTargets, args.batchSize)) {
      if (stopRequested || context.stoppedDueToSearchLimit) break;
      const batchResults = await runWithConcurrency(batch, context);
      allResults.push(...batchResults);
      await writeReports({
        args,
        startedAt,
        completedAt: new Date().toISOString(),
        allResults,
        totalSelected: roundTargets.length,
        context,
        schools,
        progress,
      });
    }

    const displayableAfter = await countDisplayableSchools(schools);
    if (displayableAfter <= displayableBefore) noProgressRounds += 1;
    else noProgressRounds = 0;

    if (!args.untilComplete) {
      totalSelected = roundTargets.length;
      break;
    }
    if (noProgressRounds >= args.maxNoProgressRounds) {
      console.log(`连续 ${noProgressRounds} 轮没有新增可展示学校，已安全停止。`);
      break;
    }
    if (args.maxSchools && allResults.length >= args.maxSchools) break;
  }

  await progressWriteQueue;
  const completedAt = new Date().toISOString();
  const { batchReport } = await writeReports({
    args,
    startedAt,
    completedAt,
    allResults,
    totalSelected: totalSelected || allResults.length,
    context,
    schools,
    progress,
  });

  if (context.stoppedDueToSearchLimit) {
    console.log("已达到本次搜索请求上限，可稍后使用 --resume 继续。");
  }
  if (stopRequested) {
    console.log("已安全停止，当前进度已保存。");
  }

  console.log(`本批学校：${batchReport.processed}/${batchReport.totalSelected}`);
  console.log(`成功：${batchReport.success}`);
  console.log(`失败：${batchReport.failed}`);
  console.log(`待审核：${batchReport.pendingReview}`);
  console.log(`跳过：${batchReport.skipped}`);
  console.log(`新增学院：${batchReport.newAcademicUnits}`);
  console.log(`Tavily 请求：${batchReport.searchRequestCount}`);
  console.log(JSON.stringify(batchReport, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
