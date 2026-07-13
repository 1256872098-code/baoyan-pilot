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

const userAgent = "BaoyanPilotBot/0.1 academic-unit-crawler; purpose=public university directory verification";
const schoolAliases = new Map([
  ["peking-university", "北京大学"],
  ["pku", "北京大学"],
  ["tsinghua-university", "清华大学"],
  ["thu", "清华大学"],
]);

function parseArgs(argv) {
  const args = {
    limit: 10,
    offset: 0,
    school: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--limit") args.limit = Number(argv[index + 1] || 10);
    if (arg === "--offset") args.offset = Number(argv[index + 1] || 0);
    if (arg === "--school") args.school = argv[index + 1] || "";
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
  const jitter = 2000 + Math.floor(Math.random() * 3000);
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
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(1000 + attempt * 1000);
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

async function getOldUnits(schoolId) {
  const detail = await readJson(getDetailPath(schoolId), {});
  return Array.isArray(detail.academicUnits) ? detail.academicUnits : [];
}

function resolveSchoolSelector(selector, schools, registry) {
  if (!selector) return null;

  const normalizedSelector = schoolAliases.get(selector) || selector;
  const byRegistry = registry.find(
    (group) => group.schoolId === normalizedSelector || group.schoolName === normalizedSelector,
  );
  if (byRegistry) return byRegistry;

  const bySchool = schools.find((school) => school.id === normalizedSelector || school.name === normalizedSelector);
  if (!bySchool) return null;

  return {
    schoolId: bySchool.id,
    schoolName: bySchool.name,
    officialWebsite: "",
    candidatePages: [],
    crawlStatus: "pending",
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

function initialStats() {
  return {
    generatedAt: new Date().toISOString(),
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

async function processSchool(sourceGroup, schoolsById, reviewItems) {
  const school = schoolsById.get(sourceGroup.schoolId) || {
    id: sourceGroup.schoolId,
    name: sourceGroup.schoolName,
  };
  const oldUnits = await getOldUnits(sourceGroup.schoolId);
  const stats = {
    schoolId: sourceGroup.schoolId,
    schoolName: sourceGroup.schoolName,
    status: "pending",
    sourceUrls: [],
    oldCount: oldUnits.length,
    newCount: 0,
    added: 0,
    possibleDeleted: 0,
    possibleRenamed: 0,
    message: "",
  };

  const declaredPages = sourceGroup.candidatePages || [];
  let pages = declaredPages.filter((page) => page.enabled);

  if (!pages.length && declaredPages.length) {
    stats.status = "skipped";
    stats.message = "no enabled source pages";
    return stats;
  }

  if (!pages.length && !sourceGroup.officialWebsite) {
    reviewItems.push(
      createReviewItem({
        sourceGroup,
        reason: "缺少官网或已启用的候选页面，无法自动发现学院目录。",
        oldCount: oldUnits.length,
      }),
    );
    stats.status = "needs-review";
    stats.message = "missing official website";
    return stats;
  }

  if (!pages.length) {
    const discovered = await discoverUnitPages(sourceGroup);
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
      stats.status = "needs-review";
      stats.message = "unit page discovery needs review";
      return stats;
    }
  }

  const allUnits = [];
  const sourceUrls = [];

  for (const page of pages) {
    if (!isOfficialDomain(page.url, sourceGroup)) {
      reviewItems.push(
        createReviewItem({
          sourceGroup,
          reason: `候选页面不是已登记的学校官方域名：${page.url}`,
          candidates: [page],
          oldCount: oldUnits.length,
          sourceUrls: [page.url],
        }),
      );
      continue;
    }

    const allowed = await robotsAllows(page.url);
    if (!allowed) {
      reviewItems.push(
        createReviewItem({
          sourceGroup,
          reason: `robots.txt 不允许抓取该页面：${page.url}`,
          candidates: [page],
          oldCount: oldUnits.length,
          sourceUrls: [page.url],
        }),
      );
      continue;
    }

    await politeDelay();
    const { candidates, browserFallbackError } = await parsePageCandidates(page);

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

    allUnits.push(...classified.accepted);
    if (classified.needsReview.length) {
      reviewItems.push(
        createReviewItem({
          sourceGroup,
          reason: "部分候选单位需要人工复核。",
          candidates: classified.needsReview,
          oldCount: oldUnits.length,
          newCount: classified.accepted.length,
          sourceUrls: [page.url],
        }),
      );
    }
    sourceUrls.push(page.url);
  }

  const deduped = [...new Map(allUnits.map((unit) => [unit.id, unit])).values()];
  const validation = validateAcademicUnits({
    school,
    sourceGroup,
    units: deduped,
    oldUnits,
  });

  if (!validation.valid || validation.needsReview) {
    reviewItems.push(
      createReviewItem({
        sourceGroup,
        reason: [...validation.errors, ...validation.reviewReasons].join("；"),
        candidates: deduped,
        oldCount: oldUnits.length,
        newCount: deduped.length,
        sourceUrls,
      }),
    );
    stats.status = validation.valid ? "needs-review" : "failed";
    stats.message = stats.status === "failed" ? "validation failed" : "validation needs review";
    stats.newCount = deduped.length;
    stats.sourceUrls = sourceUrls;
    return stats;
  }

  const mergeStats = await mergeAcademicUnits({
    detailPath: getDetailPath(sourceGroup.schoolId),
    school,
    newUnits: deduped,
    sourceUrls,
  });

  stats.status = "success";
  stats.sourceUrls = sourceUrls;
  stats.newCount = mergeStats.newCount;
  stats.added = mergeStats.added;
  stats.possibleDeleted = mergeStats.possibleDeleted;
  stats.possibleRenamed = mergeStats.possibleRenamed;
  return stats;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const schools = await readJson(schoolsPath, []);
  const registry = await readJson(registryPath, []);
  const reviewItems = await readJson(reviewPath, []);
  const schoolsById = new Map(schools.map((school) => [school.id, school]));
  const report = initialStats();

  let targets = [];
  if (args.school) {
    const selected = resolveSchoolSelector(args.school, schools, registry);
    if (!selected) {
      throw new Error(`未找到学校或来源登记：${args.school}`);
    }
    targets = [selected];
  } else {
    targets = registry.slice(args.offset, args.offset + args.limit);
  }

  if (!targets.length) {
    report.message = "没有待处理的学校来源登记。请先补充 scripts/source-registry/school-unit-sources.json。";
  }

  for (const sourceGroup of targets) {
    report.processedSchools += 1;
    try {
      const schoolStats = await processSchool(sourceGroup, schoolsById, reviewItems);
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
        schoolId: sourceGroup.schoolId,
        schoolName: sourceGroup.schoolName,
        status: "failed",
        message: error?.message || "unknown error",
      });
      reviewItems.push(
        createReviewItem({
          sourceGroup,
          reason: error?.message || "抓取失败。",
        }),
      );
    }
  }

  await writeJson(reviewPath, reviewItems);
  await writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
