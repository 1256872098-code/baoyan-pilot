import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverUnitPages } from "./discoverUnitPage.mjs";
import { parseAcademicUnits } from "./parseAcademicUnits.mjs";
import { parseGraduateAdmissionUnits } from "./parseGraduateAdmissionUnits.mjs";
import { searchSchoolWithCache } from "../search-providers/cachedSearch.mjs";

const currentFile = fileURLToPath(import.meta.url);
const __dirname = path.dirname(currentFile);
const rootDir = path.resolve(__dirname, "../..");
const registryPath = path.join(rootDir, "scripts/source-registry/school-unit-sources.json");
const reviewPath = path.join(rootDir, "scripts/review/academic-unit-pages-review.json");

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

function isSameOrSubdomain(url, officialDomain) {
  const host = getHostname(url);
  return Boolean(host && officialDomain && (host === officialDomain || host.endsWith(`.${officialDomain}`)));
}

function isLikelySingleAcademicUnitPage(candidate, sourceGroup) {
  const text = `${candidate.name || ""}`.replace(/\s+/g, "");
  if (/期刊|学报|新闻|要闻|联盟|项目|讲座|活动|通知|公告/.test(text)) return true;
  if (/学院简介|学院介绍|系所介绍|学系设置/.test(text)) return true;

  const schoolName = sourceGroup.schoolName || "";
  const schoolIndex = schoolName ? text.indexOf(schoolName) : -1;
  if (schoolIndex < 0) return false;

  const rest = text.slice(schoolIndex + schoolName.length);
  if (!rest) return false;
  return /(学院|学部|研究院|研究所|系)/.test(rest);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "BaoyanPilotBot/0.1 academic unit page discovery",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function scoreAcademicUnitPage(candidate, sourceGroup) {
  try {
    const officialDomain = sourceGroup.officialDomain || getHostname(sourceGroup.officialWebsite);
    if (!isSameOrSubdomain(candidate.url, officialDomain)) {
      return { ...candidate, confidence: 0, reason: "not official domain", accepted: false };
    }
    if (isLikelySingleAcademicUnitPage(candidate, sourceGroup)) {
      return { ...candidate, confidence: 0.2, reason: "likely single academic unit page", accepted: false };
    }

    const html = await fetchHtml(candidate.url);
    let units = parseAcademicUnits({ html, sourceUrl: candidate.url });
    if (!units.length && /招生|目录|培养|研究生/.test(`${candidate.name || ""} ${candidate.url || ""}`)) {
      units = parseGraduateAdmissionUnits({ html, sourceUrl: candidate.url });
    }
    let confidence = candidate.confidence || 0.4;
    if (/院系|学院|教学单位|教学科研单位|组织机构|培养单位|学部/.test(candidate.name || "")) confidence += 0.25;
    if (units.length >= 8) confidence += 0.35;
    else if (units.length >= 3) confidence += 0.2;

    return {
      ...candidate,
      confidence: Math.min(confidence, 1),
      unitCandidateCount: units.length,
      accepted: confidence >= 0.65 && units.length >= 3,
    };
  } catch (error) {
    return {
      ...candidate,
      confidence: 0,
      unitCandidateCount: 0,
      accepted: false,
      reason: error.message,
    };
  }
}

async function searchSiteCandidates(sourceGroup) {
  const domain = sourceGroup.officialDomain || getHostname(sourceGroup.officialWebsite);
  if (!domain) return { candidates: [], searchRequestCount: 0 };

  const query = `site:${domain} 院系设置 教学单位 学部`;
  const searchResult = await searchSchoolWithCache({
    schoolId: sourceGroup.schoolId,
    schoolName: sourceGroup.schoolName,
    query,
    maxResults: 5,
    searchDepth: "basic",
    retry: 1,
  });

  return {
    searchRequestCount: searchResult.requestCount,
    candidates: searchResult.results.map((item) => ({
      name: item.title,
      url: item.url,
      sourceType: "academic-units",
      confidence: 0.5,
      reason: `site search: ${query}`,
    })),
  };
}

export async function upsertAcademicUnitSource(sourceGroup, page) {
  const registry = await readJson(registryPath, []);
  const index = registry.findIndex((item) => item.schoolId === sourceGroup.schoolId);
  const nextPage = {
    name: page.name || "院系目录",
    url: page.url,
    sourceType: "academic-units",
    enabled: true,
    confidence: page.confidence || 0.8,
    discoveredAt: new Date().toISOString(),
  };

  if (index >= 0) {
    const old = registry[index];
    const pages = Array.isArray(old.candidatePages) ? old.candidatePages : [];
    const existingPage = pages.find((item) => item.url === nextPage.url);
    registry[index] = {
      ...old,
      officialWebsite: sourceGroup.officialWebsite || old.officialWebsite,
      officialDomain: sourceGroup.officialDomain || getHostname(sourceGroup.officialWebsite || old.officialWebsite),
      candidatePages: existingPage
        ? pages.map((item) => (item.url === nextPage.url ? { ...item, ...nextPage } : item))
        : [...pages, nextPage],
      crawlStatus: "ready",
    };
  } else {
    registry.push({
      schoolId: sourceGroup.schoolId,
      schoolName: sourceGroup.schoolName,
      officialWebsite: sourceGroup.officialWebsite,
      officialDomain: sourceGroup.officialDomain || getHostname(sourceGroup.officialWebsite),
      candidatePages: [nextPage],
      crawlStatus: "ready",
    });
  }

  await writeJson(registryPath, registry);
}

export async function discoverAcademicUnitPage(sourceGroup) {
  const candidates = [];
  let searchRequestCount = 0;
  const discovered = await discoverUnitPages(sourceGroup).catch((error) => ({
    selected: [],
    needsReview: [],
    reason: error.message,
  }));
  candidates.push(...discovered.selected, ...discovered.needsReview);

  if (!candidates.length) {
    try {
      const searchResult = await searchSiteCandidates(sourceGroup);
      searchRequestCount += searchResult.searchRequestCount;
      candidates.push(...searchResult.candidates);
    } catch (error) {
      if (error.code !== "source-discovery-unavailable") {
        candidates.push({
          name: "search failed",
          url: "",
          confidence: 0,
          reason: error.message,
        });
      }
    }
  }

  const scored = [];
  for (const candidate of candidates.filter((item) => item.url)) {
    scored.push(await scoreAcademicUnitPage(candidate, sourceGroup));
  }
  scored.sort((a, b) => b.confidence - a.confidence);
  const selected = scored.find((item) => item.accepted && item.confidence >= 0.65);

  if (selected) {
    await upsertAcademicUnitSource(sourceGroup, selected);
    return {
      status: "verified",
      selected,
      candidates: scored,
      searchRequestCount,
    };
  }

  const blockedCandidate = scored.find((item) => /HTTP 403|robots|captcha|login/i.test(item.reason || ""));
  const allReadableCandidatesBlocked = scored.length > 0 && scored.every((item) =>
    /HTTP 403|robots|captcha|login/i.test(item.reason || ""),
  );

  const review = await readJson(reviewPath, []);
  review.push({
    schoolId: sourceGroup.schoolId,
    schoolName: sourceGroup.schoolName,
    candidates: scored.map((item) => ({
      url: item.url,
      title: item.name,
      confidence: item.confidence,
      unitCandidateCount: item.unitCandidateCount || 0,
      evidence: [item.reason || ""].filter(Boolean),
    })),
    reason: scored.length ? "未找到通过核验的院系目录页面。" : "没有发现院系目录候选页面。",
    searchRequestCount,
    createdAt: new Date().toISOString(),
  });
  await writeJson(reviewPath, review);

  if (allReadableCandidatesBlocked) {
    return {
      status: "blocked",
      selected: null,
      candidates: scored,
      searchRequestCount,
      error: blockedCandidate?.reason || "official academic unit page is blocked",
    };
  }

  return {
    status: scored.length ? "pending-review" : "parse-failed",
    selected: null,
    candidates: scored,
    searchRequestCount,
  };
}
