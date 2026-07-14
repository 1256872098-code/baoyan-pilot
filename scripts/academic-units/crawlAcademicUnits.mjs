import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverUnitPages } from "./discoverUnitPage.mjs";
import { parseAcademicUnits } from "./parseAcademicUnits.mjs";
import { classifyAcademicUnits } from "./normalizeAcademicUnits.mjs";
import { validateAcademicUnits } from "./validateAcademicUnits.mjs";
import { mergeAcademicUnits } from "./mergeAcademicUnits.mjs";

const currentFile = fileURLToPath(import.meta.url);
const __dirname = path.dirname(currentFile);
const rootDir = path.resolve(__dirname, "../..");
const schoolsPath = path.join(rootDir, "public/data/schools.json");
const detailDir = path.join(rootDir, "public/data/school-details");
const registryPath = path.join(rootDir, "scripts/source-registry/school-unit-sources.json");
const reviewPath = path.join(rootDir, "scripts/review/academic-units-review.json");
const reportPath = path.join(rootDir, "scripts/reports/academic-units-report.json");
const progressPath = path.join(rootDir, "scripts/state/academic-units-progress.json");

const userAgent = "BaoyanPilotBot/0.1 academic-unit-crawler; purpose=public university directory verification";
const recentWindowMs = 30 * 24 * 60 * 60 * 1000;
const schoolAliases = new Map([
  ["peking-university", "北京大学"],
  ["pku", "北京大学"],
  ["bjtu", "北京交通大学"],
  ["shanghai-jiao-tong-university", "上海交通大学"],
  ["sjtu", "上海交通大学"],
  ["shufe", "上海财经大学"],
  ["sufe", "上海财经大学"],
  ["shou", "上海海洋大学"],
]);

function parseArgs(argv) {
  const args = {
    limit: 10,
    offset: 0,
    school: "",
    includePending: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--limit") args.limit = Number(argv[index + 1] || 10);
    if (arg === "--offset") args.offset = Number(argv[index + 1] || 0);
    if (arg === "--school") args.school = argv[index + 1] || "";
    if (arg === "--include-pending") args.includePending = true;
    if (arg === "--force") args.force = true;
  }

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
  await fs.rename(tempPath, filePath);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function politeDelay() {
  const jitter = 3000 + Math.floor(Math.random() * 5000);
  await sleep(jitter);
}

function toHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function isOfficialDomain(url, sourceGroup) {
  const host = toHostname(url).replace(/^www\./, "");
  const hosts = [sourceGroup?.officialWebsite, ...(sourceGroup?.candidatePages || []).map((page) => page.url)]
    .map((item) => toHostname(item).replace(/^www\./, ""))
    .filter(Boolean);
  return hosts.some((officialHost) => host === officialHost || host.endsWith(`.${officialHost}`));
}

function logStage(school, stage, payload = {}) {
  console.log(
    JSON.stringify(
      {
        schoolId: school.id || school.schoolId,
        schoolName: school.name || school.schoolName,
        stage,
        ...payload,
      },
      null,
      2,
    ),
  );
}

async function robotsAllows(url) {
  const parsed = new URL(url);
  const robotsUrl = `${parsed.origin}/robots.txt`;

  try {
    const response = await fetch(robotsUrl, {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return true;

    const text = await response.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim());
    let appliesToAll = false;

    for (const line of lines) {
      if (!line || line.startsWith("#")) continue;
      const [rawKey, ...rest] = line.split(":");
      const key = rawKey.trim().toLowerCase();
      const value = rest.join(":").trim();

      if (key === "user-agent") {
        appliesToAll = value === "*";
        continue;
      }

      if (appliesToAll && key === "disallow" && value) {
        const disallowed = new URL(value, parsed.origin).pathname;
        if (parsed.pathname.startsWith(disallowed)) return false;
      }
    }
  } catch {
    return true;
  }

  return true;
}

async function fetchHtml(url) {
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(1000 + attempt * 1500);
    }
  }

  throw lastError;
}

async function parsePageCandidates(page) {
  const html = await fetchHtml(page.url);
  const candidates = parseAcademicUnits({ html, sourceUrl: page.url });

  if (candidates.length) {
    return {
      candidates,
      usedBrowserFallback: false,
      browserFallbackError: "",
    };
  }

  try {
    const { crawlBrowserPage } = await import("../crawlers/browserCrawler.mjs");
    const browserResult = await crawlBrowserPage({
      url: page.url,
      userAgent,
    });
    const browserHtml = browserResult?.html || browserResult?.bodyHtml || "";
    return {
      candidates: browserHtml ? parseAcademicUnits({ html: browserHtml, sourceUrl: page.url }) : [],
      usedBrowserFallback: true,
      browserFallbackError: "",
    };
  } catch (error) {
    return {
      candidates,
      usedBrowserFallback: false,
      browserFallbackError: error?.message || "browser fallback unavailable",
    };
  }
}

function getDetailPath(schoolId) {
  return path.join(detailDir, `${schoolId}.json`);
}

async function getOldDetail(schoolId) {
  return readJson(getDetailPath(schoolId), null);
}

function getOldUnits(detail) {
  if (!detail) return [];
  if (Array.isArray(detail.academicUnits)) return detail.academicUnits;
  if (Array.isArray(detail.colleges)) return detail.colleges;
  return [];
}

function isRecentlySuccessful(detail) {
  if (detail?.crawlMeta?.status !== "success" || !detail.crawlMeta.lastCrawledAt) return false;
  return Date.now() - new Date(detail.crawlMeta.lastCrawledAt).getTime() < recentWindowMs;
}

function resolveSchoolSelector(selector, schools) {
  if (!selector) return null;

  const normalizedSelector = schoolAliases.get(selector) || selector;
  return schools.find((school) => school.id === normalizedSelector || school.name === normalizedSelector) || null;
}

function createSourceGroup(school, registryById) {
  const sourceGroup = registryById.get(school.id);
  if (!sourceGroup) {
    return {
      schoolId: school.id,
      schoolName: school.name,
      officialWebsite: school.officialWebsite || "",
      candidatePages: [],
      crawlStatus: "pending",
    };
  }

  if (sourceGroup.schoolId !== school.id) {
    throw new Error(`来源登记 schoolId 不一致：${sourceGroup.schoolId} != ${school.id}`);
  }

  return {
    ...sourceGroup,
    schoolName: sourceGroup.schoolName || school.name,
  };
}

function createReviewItem({ sourceGroup, reason, candidates = [], oldCount = 0, newCount = 0, sourceUrls = [] }) {
  return {
    schoolId: sourceGroup.schoolId,
    schoolName: sourceGroup.schoolName,
    reason,
    candidates,
    oldCount,
    newCount,
    sourceUrls,
    createdAt: new Date().toISOString(),
  };
}

function initialStats(args, totalSchools) {
  return {
    generatedAt: new Date().toISOString(),
    mode: args.school ? "school" : "batch",
    offset: args.offset,
    limit: args.limit,
    includePending: args.includePending,
    force: args.force,
    totalSchools,
    processedSchools: 0,
    successSchools: 0,
    failedSchools: 0,
    reviewSchools: 0,
    skippedSchools: 0,
    addedUnits: 0,
    possibleDeletedUnits: 0,
    possibleRenamedUnits: 0,
    missingOfficialWebsite: 0,
    schools: [],
  };
}

function updateProgress(progress, report) {
  const schools = { ...(progress.schools || {}) };

  for (const item of report.schools) {
    const oldRecord = schools[item.schoolId] || {};
    schools[item.schoolId] = {
      schoolId: item.schoolId,
      schoolName: item.schoolName || "",
      status: item.status === "needs-review" ? "pending-review" : item.status,
      attempts: oldRecord.attempts || 1,
      searchRequestCount: item.searchRequestCount || 0,
      startedAt: oldRecord.startedAt || report.generatedAt,
      completedAt: report.generatedAt,
      lastCheckedAt: report.generatedAt,
      verifiedCount: item.verifiedCount || 0,
      pendingCount: item.pendingCount || 0,
      outputPath: item.outputPath || `public/data/school-details/${item.schoolId}.json`,
      failureStage: item.failureStage || null,
      error: item.message || null,
    };
  }

  return {
    version: 1,
    totalSchools: report.totalSchools,
    schools,
    lastRunAt: new Date().toISOString(),
  };
}

function toAcademicUnitsResult(report) {
  const item = report.schools[0] || {};
  const success = item.status === "success" || item.status === "skipped";
  return {
    schoolId: item.schoolId || null,
    schoolName: item.schoolName || "",
    success,
    status: item.status || "unknown",
    failureStage: item.failureStage || null,
    searchRequestCount: item.searchRequestCount || 0,
    candidateCount: item.candidateCount || 0,
    verifiedCount: item.verifiedCount || 0,
    pendingCount: item.pendingCount || 0,
    added: item.added || 0,
    sourcePage: item.sourceUrls?.[0] || null,
    outputPath: item.outputPath || (item.schoolId ? `public/data/school-details/${item.schoolId}.json` : ""),
    error: success ? null : item.message || "unknown error",
  };
}

async function writeFailureMetaIfEmpty({ school, oldDetail, sourceGroup = null, sourceUrls = [], errorMessage }) {
  if (oldDetail && getOldUnits(oldDetail).length) return;

  await mergeAcademicUnits({
    detailPath: getDetailPath(school.id),
    school,
    newUnits: [],
    sourceUrls,
    status: "failed",
    errorMessage,
    officialWebsite: sourceGroup?.officialWebsite || "",
    searchRequestCount: Number(process.env.BAOYANPILOT_SEARCH_REQUEST_COUNT || 0),
  });
}

async function processSchool({ school, sourceGroup, args, reviewItems }) {
  const oldDetail = await getOldDetail(school.id);
  const oldUnits = getOldUnits(oldDetail);
  const stats = {
    schoolId: school.id,
    schoolName: school.name,
    status: "pending",
    sourceUrls: [],
    oldCount: oldUnits.length,
    candidateCount: 0,
    acceptedCount: 0,
    verifiedCount: 0,
    pendingCount: 0,
    newCount: 0,
    added: 0,
    possibleDeleted: 0,
    possibleRenamed: 0,
    message: "",
    outputPath: `public/data/school-details/${school.id}.json`,
    failureStage: null,
    searchRequestCount: Number(process.env.BAOYANPILOT_SEARCH_REQUEST_COUNT || 0),
  };

  logStage(school, "start", { oldCount: oldUnits.length });

  if (!args.force && isRecentlySuccessful(oldDetail)) {
    stats.status = "skipped";
    stats.message = "recently crawled successfully within 30 days";
    stats.newCount = oldUnits.length;
    stats.verifiedCount = oldUnits.filter((unit) => unit.dataStatus === "verified").length;
    stats.pendingCount = oldUnits.filter((unit) => unit.dataStatus === "pending-review").length;
    logStage(school, "skipped", { reason: stats.message });
    return stats;
  }

  let pages = (sourceGroup.candidatePages || []).filter((page) => page.enabled);

  if (!pages.length && !sourceGroup.officialWebsite) {
    const reason = "学校官网尚未登记。";
    reviewItems.push(createReviewItem({ sourceGroup, reason, oldCount: oldUnits.length }));
    await writeFailureMetaIfEmpty({ school, oldDetail, sourceGroup, errorMessage: reason });
    stats.status = "needs-review";
    stats.failureStage = "website-discovery";
    stats.message = reason;
    logStage(school, "source-discovery", { status: "needs-review", reason });
    return stats;
  }

  if (!pages.length) {
    logStage(school, "source-discovery", { officialWebsite: sourceGroup.officialWebsite });
    const discovered = await discoverUnitPages(sourceGroup);
    logStage(school, "source-discovery-result", {
      selectedCount: discovered.selected.length,
      reviewCandidateCount: discovered.needsReview.length,
      reason: discovered.reason,
    });
    if (discovered.selected.length) {
      pages = discovered.selected;
    } else {
      reviewItems.push(
        createReviewItem({
          sourceGroup,
          reason: discovered.reason,
          candidates: discovered.needsReview,
          oldCount: oldUnits.length,
          sourceUrls: discovered.needsReview.map((item) => item.url),
        }),
      );
      await writeFailureMetaIfEmpty({ school, oldDetail, sourceGroup, errorMessage: discovered.reason });
      stats.status = "needs-review";
      stats.failureStage = "academic-unit-page-discovery";
      stats.message = "unit page discovery needs review";
      return stats;
    }
  } else {
    logStage(school, "source-discovery", {
      status: "configured",
      pages: pages.map((page) => page.url),
    });
  }

  const allUnits = [];
  const sourceUrls = [];

  for (const page of pages) {
    if (!isOfficialDomain(page.url, sourceGroup)) {
      const reason = `候选页面不是已登记的学校官方域名：${page.url}`;
      reviewItems.push(createReviewItem({ sourceGroup, reason, candidates: [page], oldCount: oldUnits.length }));
      logStage(school, "source-check", { status: "rejected", reason });
      continue;
    }

    const allowed = await robotsAllows(page.url);
    if (!allowed) {
      const reason = `robots.txt 不允许抓取该页面：${page.url}`;
      reviewItems.push(
        createReviewItem({ sourceGroup, reason, candidates: [page], oldCount: oldUnits.length, sourceUrls: [page.url] }),
      );
      logStage(school, "robots", { status: "blocked", url: page.url });
      continue;
    }

    await politeDelay();
    logStage(school, "fetch", { url: page.url });
    const { candidates, usedBrowserFallback, browserFallbackError } = await parsePageCandidates(page);
    stats.candidateCount += candidates.length;
    logStage(school, "parse", {
      url: page.url,
      candidateCount: candidates.length,
      usedBrowserFallback,
      browserFallbackError: browserFallbackError || null,
    });

    if (!candidates.length && browserFallbackError) {
      reviewItems.push(
        createReviewItem({
          sourceGroup,
          reason: `静态页面未抽取到学院目录，浏览器抓取预留接口暂不可用：${browserFallbackError}`,
          candidates: [page],
          oldCount: oldUnits.length,
          sourceUrls: [page.url],
        }),
      );
    }

    const classified = await classifyAcademicUnits({
      schoolName: sourceGroup.schoolName,
      sourceUrl: page.url,
      candidates,
    });
    logStage(school, "normalize", {
      acceptedCount: classified.accepted.length,
      verifiedCount: classified.accepted.filter((unit) => unit.dataStatus === "verified").length,
      pendingCount: classified.accepted.filter((unit) => unit.dataStatus === "pending-review").length,
      rejectedCount: classified.rejected.length,
      mode: classified.mode,
    });

    allUnits.push(...classified.accepted);
    if (classified.needsReview.length || classified.rejected.length) {
      reviewItems.push(
        createReviewItem({
          sourceGroup,
          reason: "部分候选单位需要人工复核。",
          candidates: [...classified.needsReview, ...classified.rejected],
          oldCount: oldUnits.length,
          newCount: classified.accepted.length,
          sourceUrls: [page.url],
        }),
      );
    }
    sourceUrls.push(page.url);
  }

  const dedupedAll = [...new Map(allUnits.map((unit) => [unit.id, unit])).values()];
  const unitsToWrite = args.includePending
    ? dedupedAll
    : dedupedAll.filter((unit) => unit.dataStatus === "verified");
  stats.acceptedCount = dedupedAll.length;
  stats.verifiedCount = unitsToWrite.filter((unit) => unit.dataStatus === "verified").length;
  stats.pendingCount = unitsToWrite.filter((unit) => unit.dataStatus === "pending-review").length;

  const validation = validateAcademicUnits({
    school,
    sourceGroup,
    units: unitsToWrite,
    oldUnits,
  });
  logStage(school, "validate", {
    valid: validation.valid,
    needsReview: validation.needsReview,
    errors: validation.errors,
    reviewReasons: validation.reviewReasons,
  });

  if (!validation.valid) {
    const errorMessage = validation.errors.join("；") || "学院目录验证失败。";
    reviewItems.push(
      createReviewItem({
        sourceGroup,
        reason: errorMessage,
        candidates: unitsToWrite,
        oldCount: oldUnits.length,
        newCount: unitsToWrite.length,
        sourceUrls,
      }),
    );
    await writeFailureMetaIfEmpty({ school, oldDetail, sourceGroup, sourceUrls, errorMessage });
    stats.status = "failed";
    stats.failureStage = "validate";
    stats.message = errorMessage;
    return stats;
  }

  if (validation.needsReview && !args.includePending) {
    const reason = validation.reviewReasons.join("；");
    reviewItems.push(
      createReviewItem({
        sourceGroup,
        reason,
        candidates: unitsToWrite,
        oldCount: oldUnits.length,
        newCount: unitsToWrite.length,
        sourceUrls,
      }),
    );
    await writeFailureMetaIfEmpty({ school, oldDetail, sourceGroup, sourceUrls, errorMessage: reason });
    stats.status = "needs-review";
    stats.failureStage = "validate";
    stats.message = reason;
    return stats;
  }

  const mergeStats = await mergeAcademicUnits({
    detailPath: getDetailPath(school.id),
    school,
    newUnits: unitsToWrite,
    sourceUrls,
    status: validation.needsReview ? "needs-review" : "success",
    errorMessage: validation.needsReview ? validation.reviewReasons.join("；") : null,
    officialWebsite: sourceGroup.officialWebsite || "",
    searchRequestCount: stats.searchRequestCount,
  });

  stats.status = validation.needsReview ? "needs-review" : "success";
  stats.sourceUrls = sourceUrls;
  stats.newCount = mergeStats.newCount;
  stats.verifiedCount = mergeStats.verifiedCount;
  stats.pendingCount = mergeStats.pendingCount;
  stats.added = mergeStats.added;
  stats.possibleDeleted = mergeStats.possibleDeleted;
  stats.possibleRenamed = mergeStats.possibleRenamed;
  logStage(school, "write", {
    outputPath: stats.outputPath,
    newCount: stats.newCount,
    verifiedCount: stats.verifiedCount,
    pendingCount: stats.pendingCount,
  });

  return stats;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const schools = await readJson(schoolsPath, []);
  const registry = await readJson(registryPath, []);
  const reviewItems = await readJson(reviewPath, []);
  const progress = await readJson(progressPath, {
    totalSchools: schools.length,
    completed: [],
    failed: [],
    pendingReview: [],
    lastRunAt: "",
  });
  const registryById = new Map(registry.map((group) => [group.schoolId, group]));
  const report = initialStats(args, schools.length);

  let targets = [];
  if (args.school) {
    const selected = resolveSchoolSelector(args.school, schools);
    if (!selected) {
      throw new Error(`未找到学校：${args.school}`);
    }
    targets = [selected];
  } else {
    targets = schools.slice(args.offset, args.offset + args.limit);
  }

  if (!targets.length) {
    report.message = "没有待处理学校。请检查 --limit 和 --offset。";
  }

  for (const school of targets) {
    report.processedSchools += 1;
    try {
      const sourceGroup = createSourceGroup(school, registryById);
      const schoolStats = await processSchool({ school, sourceGroup, args, reviewItems });
      report.schools.push(schoolStats);
      report.addedUnits += schoolStats.added || 0;
      report.possibleDeletedUnits += schoolStats.possibleDeleted || 0;
      report.possibleRenamedUnits += schoolStats.possibleRenamed || 0;

      if (schoolStats.status === "success") report.successSchools += 1;
      else if (schoolStats.status === "needs-review") report.reviewSchools += 1;
      else if (schoolStats.status === "skipped") report.skippedSchools += 1;
      else report.failedSchools += 1;

      if (!sourceGroup.officialWebsite) report.missingOfficialWebsite += 1;
    } catch (error) {
      report.failedSchools += 1;
      report.schools.push({
        schoolId: school.id,
        schoolName: school.name,
        status: "failed",
        message: error?.message || "unknown error",
      });
      reviewItems.push(
        createReviewItem({
          sourceGroup: { schoolId: school.id, schoolName: school.name },
          reason: error?.message || "抓取失败。",
        }),
      );
      logStage(school, "failed", { error: error?.message || "unknown error" });
    }
  }

  if (process.env.BAOYANPILOT_BATCH !== "1") {
    await writeJson(reviewPath, reviewItems);
    await writeJson(reportPath, report);
    await writeJson(progressPath, updateProgress(progress, report));
  }
  console.log(JSON.stringify(report, null, 2));
  if (args.school) {
    const result = toAcademicUnitsResult(report);
    console.log(`ACADEMIC_UNITS_RESULT=${JSON.stringify(result)}`);
    if (result.status === "failed") process.exitCode = 1;
    if (result.status === "needs-review") process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
