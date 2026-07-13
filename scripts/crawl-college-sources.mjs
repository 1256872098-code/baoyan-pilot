import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crawlStaticPage } from "./crawlers/staticCrawler.mjs";
import { parseNoticePage } from "./parsers/noticeParser.mjs";
import { validateCollegeDetail, validateNotice } from "./validators/noticeValidator.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const registryPath = path.join(rootDir, "scripts", "source-registry", "college-sources.json");
const collegeDetailsRoot = path.join(rootDir, "public", "data", "college-details");
const requestDelayMs = 1200;
const maxRetries = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function getDetailPath(sourceGroup) {
  return path.join(collegeDetailsRoot, sourceGroup.schoolId, `${sourceGroup.collegeId}.json`);
}

function createBaseDetail(sourceGroup) {
  return {
    schoolId: sourceGroup.schoolId,
    collegeId: sourceGroup.collegeId,
    collegeName: sourceGroup.collegeName,
    officialWebsite: sourceGroup.officialWebsite || "",
    majors: [],
    notices: [],
    sources: [],
    lastUpdated: null,
  };
}

function mergeNotice(existingNotices, nextNotice) {
  const existingIndex = existingNotices.findIndex((notice) => {
    const sameUrl = notice.source?.url && notice.source.url === nextNotice.source.url;
    const sameHash = notice.contentHash && notice.contentHash === nextNotice.contentHash;
    const sameIdentity =
      notice.title === nextNotice.title &&
      notice.publishedAt === nextNotice.publishedAt &&
      notice.source?.url === nextNotice.source.url;

    return (sameUrl && sameHash) || sameIdentity || (sameUrl && notice.contentHash !== nextNotice.contentHash);
  });

  if (existingIndex < 0) {
    return { notices: [nextNotice, ...existingNotices], status: "new" };
  }

  const existing = existingNotices[existingIndex];
  if (existing.source?.url === nextNotice.source.url && existing.contentHash === nextNotice.contentHash) {
    const notices = [...existingNotices];
    notices[existingIndex] = {
      ...existing,
      lastCheckedAt: nextNotice.lastCheckedAt,
    };
    return { notices, status: "skipped" };
  }

  const notices = [...existingNotices];
  notices[existingIndex] = {
    ...nextNotice,
    crawledAt: nextNotice.crawledAt,
    lastCheckedAt: nextNotice.lastCheckedAt,
  };
  return { notices, status: "updated" };
}

function sortNotices(notices) {
  return [...notices].sort((a, b) => {
    const aTime = new Date(a.publishedAt || a.year || 0).getTime() || 0;
    const bTime = new Date(b.publishedAt || b.year || 0).getTime() || 0;
    return bTime - aTime;
  });
}

async function crawlWithRetry(source) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await crawlStaticPage(source);
    } catch (error) {
      lastError = error;
      await sleep(requestDelayMs * attempt);
    }
  }

  throw lastError;
}

async function processSourceGroup(sourceGroup, stats) {
  const enabledSources = (sourceGroup.sourcePages || []).filter((source) => source.enabled);
  if (!enabledSources.length) {
    stats.skipped += 1;
    return;
  }

  const detailPath = getDetailPath(sourceGroup);
  const existingDetail = await readJson(detailPath, createBaseDetail(sourceGroup));
  let nextDetail = {
    ...createBaseDetail(sourceGroup),
    ...existingDetail,
    schoolId: sourceGroup.schoolId,
    collegeId: sourceGroup.collegeId,
    collegeName: sourceGroup.collegeName,
    officialWebsite: sourceGroup.officialWebsite || existingDetail.officialWebsite || "",
    notices: Array.isArray(existingDetail.notices) ? existingDetail.notices : [],
    sources: Array.isArray(existingDetail.sources) ? existingDetail.sources : [],
  };

  for (const sourcePage of enabledSources) {
    const source = {
      ...sourcePage,
      schoolId: sourceGroup.schoolId,
      collegeId: sourceGroup.collegeId,
      schoolName: sourceGroup.schoolName,
      collegeName: sourceGroup.collegeName,
    };

    try {
      await sleep(requestDelayMs);
      const crawledPage = await crawlWithRetry(source);
      const notice = parseNoticePage(crawledPage);
      const noticeValidation = validateNotice(notice);
      if (!noticeValidation.valid) {
        throw new Error(noticeValidation.errors.join("；"));
      }

      const merged = mergeNotice(nextDetail.notices, notice);
      nextDetail.notices = sortNotices(merged.notices);
      nextDetail.sources = [
        ...nextDetail.sources.filter((item) => item.url !== notice.source.url),
        {
          title: notice.source.title,
          url: notice.source.url,
          sourceType: notice.source.sourceType,
          publishedAt: notice.publishedAt,
          crawledAt: notice.crawledAt,
          lastCheckedAt: notice.lastCheckedAt,
        },
      ];
      nextDetail.lastUpdated = new Date().toISOString();

      if (merged.status === "new") stats.new += 1;
      if (merged.status === "updated") stats.updated += 1;
      if (merged.status === "skipped") stats.skipped += 1;
      stats.success += 1;
    } catch (error) {
      stats.failed += 1;
      console.error(`[failed] ${sourceGroup.schoolName} ${sourceGroup.collegeName} ${sourcePage.url}`);
      console.error(error?.message || error);
    }
  }

  const detailValidation = validateCollegeDetail(nextDetail);
  if (!detailValidation.valid) {
    throw new Error(`学院详情校验失败：${detailValidation.errors.join("；")}`);
  }

  await fs.mkdir(path.dirname(detailPath), { recursive: true });
  await fs.writeFile(detailPath, `${JSON.stringify(nextDetail, null, 2)}\n`, "utf8");
}

async function main() {
  const registry = await readJson(registryPath, []);
  const stats = {
    success: 0,
    failed: 0,
    skipped: 0,
    new: 0,
    updated: 0,
  };

  for (const sourceGroup of registry) {
    try {
      await processSourceGroup(sourceGroup, stats);
    } catch (error) {
      stats.failed += 1;
      console.error(`[group failed] ${sourceGroup.schoolName} ${sourceGroup.collegeName}`);
      console.error(error?.message || error);
    }
  }

  console.log("学院资料抓取统计：");
  console.log(`- 成功：${stats.success}`);
  console.log(`- 失败：${stats.failed}`);
  console.log(`- 跳过：${stats.skipped}`);
  console.log(`- 新增：${stats.new}`);
  console.log(`- 更新：${stats.updated}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
