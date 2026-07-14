import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { discoverSchoolWebsite, updateSchoolWebsiteFields } from "./discoverSchoolWebsite.mjs";
import { discoverAcademicUnitPage } from "./discoverAcademicUnitPage.mjs";
import { verifyOfficialWebsite } from "./verifyOfficialWebsite.mjs";

dotenv.config({
  path: ".env.local",
  quiet: true,
});

const currentFile = fileURLToPath(import.meta.url);
const __dirname = path.dirname(currentFile);
const rootDir = path.resolve(__dirname, "../..");
const schoolsPath = path.join(rootDir, "public/data/schools.json");
const registryPath = path.join(rootDir, "scripts/source-registry/school-unit-sources.json");
const manualOverridesPath = path.join(rootDir, "scripts/source-registry/manual-source-overrides.json");
const crawlerPath = path.join(rootDir, "scripts/academic-units/crawlAcademicUnits.mjs");
const detailDir = path.join(rootDir, "public/data/school-details");

function parseArgs(argv) {
  const args = {
    school: "",
    force: false,
    includePending: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--school") args.school = argv[index + 1] || "";
    if (arg === "--force") args.force = true;
    if (arg === "--include-pending") args.includePending = true;
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

function getHostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function resolveSchool(selector, schools) {
  return schools.find((school) => school.id === selector || school.name === selector) || null;
}

async function loadSourceGroup(school) {
  const manualOverrides = await readJson(manualOverridesPath, []);
  const override = manualOverrides.find((item) => item.schoolId === school.id);
  if (override) {
    const pages = (override.academicUnitPages || []).map((page) => ({
      name: page.name || "人工登记院系来源",
      url: page.url,
      sourceType: page.sourceType || "academic-units",
      enabled: Boolean(page.url),
      confidence: 1,
      verifiedByHuman: page.verifiedByHuman === true,
      notes: override.notes || "",
    }));
    return {
      schoolId: school.id,
      schoolName: school.name,
      officialWebsite: override.officialWebsite || school.officialWebsite || "",
      officialDomain: getHostname(override.officialWebsite || school.officialWebsite || pages[0]?.url || ""),
      candidatePages: pages,
      crawlStatus: "manual-override",
    };
  }

  const registry = await readJson(registryPath, []);
  const existing = registry.find((item) => item.schoolId === school.id);
  if (existing) return existing;
  return {
    schoolId: school.id,
    schoolName: school.name,
    officialWebsite: school.officialWebsite || "",
    officialDomain: school.officialDomain || "",
    candidatePages: [],
    crawlStatus: "pending",
  };
}

async function upsertSourceGroup(sourceGroup) {
  const registry = await readJson(registryPath, []);
  const index = registry.findIndex((item) => item.schoolId === sourceGroup.schoolId);
  const next = {
    ...sourceGroup,
    officialDomain: sourceGroup.officialDomain || getHostname(sourceGroup.officialWebsite),
  };
  if (index >= 0) registry[index] = { ...registry[index], ...next };
  else registry.push(next);
  await writeJson(registryPath, registry);
  return next;
}

function parseCrawlerResult(stdout, fallback) {
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

function runCrawler({ schoolId, force, includePending, searchRequestCount }) {
  return new Promise((resolve) => {
    const args = [crawlerPath, "--school", schoolId];
    if (force) args.push("--force");
    if (includePending) args.push("--include-pending");

    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        BAOYANPILOT_SEARCH_REQUEST_COUNT: String(searchRequestCount || 0),
      },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      const fallback = {
        schoolId,
        success: code === 0,
        status: code === 0 ? "success" : "crawl-failed",
        failureStage: code === 0 ? null : "crawl",
        searchRequestCount,
        verifiedCount: 0,
        pendingCount: 0,
        outputPath: `public/data/school-details/${schoolId}.json`,
        error: code === 0 ? null : stderr || `单校爬虫退出码 ${code}`,
      };
      resolve({ ...parseCrawlerResult(stdout, fallback), exitCode: code, stdout, stderr });
    });
  });
}

function resultLine(result) {
  console.log(`ACADEMIC_UNITS_RESULT=${JSON.stringify(result)}`);
}

async function writeFailureDetail({ school, result, officialWebsite = "", sourceUrls = [] }) {
  const detailPath = path.join(detailDir, `${school.id}.json`);
  const oldDetail = await readJson(detailPath, null);
  const oldUnits = Array.isArray(oldDetail?.academicUnits)
    ? oldDetail.academicUnits
    : Array.isArray(oldDetail?.colleges)
      ? oldDetail.colleges
      : [];
  const now = new Date().toISOString();
  const nextDetail = {
    ...(oldDetail || {}),
    schoolId: school.id,
    name: school.name,
    status: oldDetail?.status || "building",
    lastUpdated: now,
    academicUnits: oldUnits,
    sources: oldDetail?.sources || [],
    crawlMeta: {
      ...(oldDetail?.crawlMeta || {}),
      status: result.status || "crawl-failed",
      officialWebsite,
      sourceUrls,
      lastCrawledAt: now,
      lastCheckedAt: now,
      searchRequestCount: result.searchRequestCount || 0,
      previousUnitCount: oldUnits.length,
      currentUnitCount: oldUnits.length,
      newUnitCount: 0,
      verifiedCount: oldUnits.filter((unit) => unit.dataStatus === "verified").length,
      pendingCount: oldUnits.filter((unit) => unit.dataStatus === "pending-review").length,
      failureStage: result.failureStage || result.stage || null,
      errorMessage: result.error || null,
    },
  };
  await writeJson(detailPath, nextDetail);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const schools = await readJson(schoolsPath, []);
  const school = resolveSchool(args.school, schools);

  if (!school) {
    const result = {
      schoolId: args.school || null,
      success: false,
      stage: "school-lookup",
      status: "source-not-found",
      error: `未找到学校：${args.school}`,
    };
    resultLine(result);
    process.exitCode = 1;
    return;
  }

  let sourceGroup = await loadSourceGroup(school);
  let discoveryStatus = sourceGroup.officialWebsite ? "registered" : "pending";
  let officialWebsite = sourceGroup.officialWebsite || school.officialWebsite || "";
  let searchRequestCount = 0;

  if (officialWebsite && args.force) {
    const verifiedExisting = await verifyOfficialWebsite({
      school,
      candidate: {
        title: sourceGroup.schoolName || school.name,
        url: officialWebsite,
        snippet: "",
      },
    });
    if (verifiedExisting.status !== "verified") {
      officialWebsite = "";
      sourceGroup = {
        ...sourceGroup,
        officialWebsite: "",
        officialDomain: "",
        candidatePages: [],
        crawlStatus: "website-recheck-failed",
      };
    }
  }

  if (officialWebsite && !school.officialWebsite) {
    await updateSchoolWebsiteFields({
      schoolId: school.id,
      schoolName: school.name,
      officialWebsite,
      officialDomain: sourceGroup.officialDomain || getHostname(officialWebsite),
      confidence: sourceGroup.websiteConfidence || 0.9,
      status: "verified",
      websiteSource: "source-registry",
    });
  }

  if (!officialWebsite) {
    console.log(JSON.stringify({ schoolId: school.id, schoolName: school.name, stage: "website-discovery" }, null, 2));
    const websiteDiscovery = await discoverSchoolWebsite(school);
    searchRequestCount += websiteDiscovery.searchRequestCount || 0;
    discoveryStatus = websiteDiscovery.status;

    if (websiteDiscovery.status !== "verified") {
      const result = {
        schoolId: school.id,
        schoolName: school.name,
        success: false,
        stage: "website-discovery",
        status: websiteDiscovery.status,
        error: websiteDiscovery.error || websiteDiscovery.evidence?.[0] || "未找到通过验证的学校官网。",
        officialWebsite: null,
        sourcePage: null,
        candidateCount: 0,
        verifiedCount: 0,
        pendingCount: 0,
        outputPath: `public/data/school-details/${school.id}.json`,
        failureStage: "website-discovery",
        searchRequestCount,
      };
      await writeFailureDetail({ school, result, officialWebsite: "", sourceUrls: [] });
      resultLine(result);
      process.exitCode = websiteDiscovery.status === "source-discovery-unavailable" ? 3 : 2;
      return;
    }

    await updateSchoolWebsiteFields(websiteDiscovery);
    sourceGroup = await upsertSourceGroup({
      ...sourceGroup,
      officialWebsite: websiteDiscovery.officialWebsite,
      officialDomain: websiteDiscovery.officialDomain,
      crawlStatus: "website-verified",
    });
    officialWebsite = websiteDiscovery.officialWebsite;
  }

  const enabledPages = args.force ? [] : (sourceGroup.candidatePages || []).filter((page) => page.enabled);
  let sourcePage = enabledPages[0]?.url || "";

  if (!sourcePage) {
    console.log(
      JSON.stringify(
        {
          schoolId: school.id,
          schoolName: school.name,
          stage: "academic-unit-page-discovery",
          officialWebsite,
        },
        null,
        2,
      ),
    );
    const pageDiscovery = await discoverAcademicUnitPage({
      ...sourceGroup,
      officialWebsite,
      officialDomain: sourceGroup.officialDomain || getHostname(officialWebsite),
    });
    searchRequestCount += pageDiscovery.searchRequestCount || 0;
    if (pageDiscovery.status !== "verified") {
      const result = {
        schoolId: school.id,
        schoolName: school.name,
        success: false,
        stage: "academic-unit-page-discovery",
        status: pageDiscovery.status,
        error: "未找到可靠院系目录页面。",
        error: pageDiscovery.error || "未找到可靠院系目录页面。",
        officialWebsite,
        sourcePage: null,
        candidateCount: pageDiscovery.candidates?.length || 0,
        verifiedCount: 0,
        pendingCount: 0,
        outputPath: `public/data/school-details/${school.id}.json`,
        failureStage: "academic-unit-page-discovery",
        searchRequestCount,
      };
      await writeFailureDetail({ school, result, officialWebsite, sourceUrls: [] });
      resultLine(result);
      process.exitCode = 2;
      return;
    }

    sourceGroup = await loadSourceGroup(school);
    sourcePage = pageDiscovery.selected.url;
    discoveryStatus = discoveryStatus === "registered" ? "unit-page-discovered" : discoveryStatus;
  }

  const crawlResult = await runCrawler({
    schoolId: school.id,
    force: args.force,
    includePending: args.includePending,
    searchRequestCount,
  });
  const success = crawlResult.success === true || crawlResult.status === "skipped";
  const result = {
    schoolId: school.id,
    schoolName: school.name,
    success,
    officialWebsite,
    sourcePage,
    discoveryStatus,
    status: crawlResult.status,
    failureStage: crawlResult.failureStage || null,
    searchRequestCount,
    candidateCount: crawlResult.candidateCount || 0,
    verifiedCount: crawlResult.verifiedCount || 0,
    pendingCount: crawlResult.pendingCount || 0,
    added: crawlResult.added || 0,
    outputPath: crawlResult.outputPath || `public/data/school-details/${school.id}.json`,
    error: success ? null : crawlResult.error || "学院目录抓取失败。",
  };
  resultLine(result);
  if (!success) process.exitCode = crawlResult.status === "needs-review" ? 2 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    resultLine({
      success: false,
      stage: "pipeline",
      status: "crawl-failed",
      error: error?.message || "unknown error",
    });
    process.exitCode = 1;
  });
}
