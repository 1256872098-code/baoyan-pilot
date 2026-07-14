import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { searchSchoolWithCache } from "../search-providers/cachedSearch.mjs";
import { verifyOfficialWebsite } from "./verifyOfficialWebsite.mjs";

dotenv.config({
  path: ".env.local",
  quiet: true,
});

const currentFile = fileURLToPath(import.meta.url);
const __dirname = path.dirname(currentFile);
const rootDir = path.resolve(__dirname, "../..");
const schoolsPath = path.join(rootDir, "public/data/schools.json");
const reviewPath = path.join(rootDir, "scripts/review/school-websites-review.json");
const reportPath = path.join(rootDir, "scripts/reports/school-website-discovery-report.json");

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

function uniqueByUrl(results) {
  const seen = new Set();
  return results.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function buildEduRootFallbackCandidates({ school, candidates }) {
  const urls = new Set();
  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate.url);
      const host = parsed.hostname.replace(/^www\./, "");
      if (!host.endsWith("edu.cn")) continue;
      urls.add(new URL("/", parsed.origin).toString());
      const labels = host.split(".");
      if (labels.length > 3) {
        const parentDomain = labels.slice(-3).join(".");
        urls.add(`https://www.${parentDomain}/`);
        urls.add(`http://www.${parentDomain}/`);
        urls.add(`https://${parentDomain}/`);
        urls.add(`http://${parentDomain}/`);
      }
    } catch {
      // Ignore malformed search result URLs.
    }
  }

  return [...urls].map((url) => ({
    title: school.name,
    url,
    snippet: "edu.cn root fallback",
    query: "edu-root-fallback",
  }));
}

export async function updateSchoolWebsiteFields(discovery) {
  if (discovery.status !== "verified" || !discovery.officialWebsite) return false;

  const schools = await readJson(schoolsPath, []);
  const index = schools.findIndex((school) => school.id === discovery.schoolId);
  if (index < 0) return false;

  const old = schools[index];
  const nextSource = discovery.websiteSource || "automatic-search";
  if (
    old.websiteStatus === "verified" &&
    old.officialWebsite &&
    old.officialWebsite === discovery.officialWebsite &&
    old.websiteConfidence >= discovery.confidence &&
    old.websiteSource === nextSource
  ) {
    return false;
  }

  schools[index] = {
    ...old,
    officialWebsite: discovery.officialWebsite,
    officialDomain: discovery.officialDomain,
    websiteStatus: "verified",
    websiteSource: nextSource,
    websiteConfidence: discovery.confidence,
    lastWebsiteCheckedAt: new Date().toISOString(),
  };

  const backupPath = `${schoolsPath}.${new Date().toISOString().replace(/[:.]/g, "-")}.bak`;
  await fs.copyFile(schoolsPath, backupPath).catch(() => {});
  await writeJson(schoolsPath, schools);
  return true;
}

async function verifyCandidates({ school, candidates }) {
  const verified = [];
  for (const candidate of candidates) {
    verified.push(await verifyOfficialWebsite({ school, candidate }));
  }
  const priority = (item) => (item.status === "verified" ? 2 : item.status === "pending-review" ? 1 : 0);
  verified.sort((a, b) => priority(b) - priority(a) || b.confidence - a.confidence);
  return verified;
}

export async function discoverSchoolWebsite(school) {
  const queries = [`${school.name} 官网 院系设置`, `${school.name} 教学单位 学院`];
  const searchedAt = new Date().toISOString();
  let searchRequestCount = 0;

  try {
    const results = [];
    let verified = [];
    let best = null;

    for (const query of queries) {
      const searchResult = await searchSchoolWithCache({
        schoolId: school.id,
        schoolName: school.name,
        query,
        maxResults: 5,
        searchDepth: "basic",
        retry: 1,
      });
      searchRequestCount += searchResult.requestCount;
      results.push(...searchResult.results.map((item) => ({ ...item, query })));

      const candidates = uniqueByUrl(results).slice(0, 10);
      verified = await verifyCandidates({ school, candidates });
      best = verified[0] || null;
      if (best?.status === "verified" && best.confidence >= 0.85) break;
    }

    const candidates = uniqueByUrl(results).slice(0, 10);
    if (best?.status !== "verified") {
      const fallbackCandidates = buildEduRootFallbackCandidates({ school, candidates });
      if (fallbackCandidates.length) {
        const fallbackVerified = await verifyCandidates({ school, candidates: fallbackCandidates });
        verified = [...verified, ...fallbackVerified].sort((a, b) => {
          const priority = (item) => (item.status === "verified" ? 2 : item.status === "pending-review" ? 1 : 0);
          return priority(b) - priority(a) || b.confidence - a.confidence;
        });
        best = verified[0] || best;
      }
    }
    best = best || {
      schoolId: school.id,
      schoolName: school.name,
      officialWebsite: null,
      officialDomain: null,
      confidence: 0,
      evidence: [],
      candidateUrls: [],
      status: "not-found",
    };
    best.searchRequestCount = searchRequestCount;

    const review = await readJson(reviewPath, []);
    if (best.status !== "verified") {
      review.push({
        schoolId: school.id,
        schoolName: school.name,
        candidates: verified.map((item) => ({
          url: item.officialWebsite || item.candidateUrls?.[0] || "",
          title: item.title || "",
          confidence: item.confidence,
          evidence: item.evidence,
        })),
        reason: best.status === "pending-review" ? "官网候选需要人工核验。" : "未找到通过核验的学校官网。",
        searchRequestCount,
        createdAt: searchedAt,
      });
      await writeJson(reviewPath, review);
    }

    const report = await readJson(reportPath, []);
    report.push({
      schoolId: school.id,
      schoolName: school.name,
      status: best.status,
      officialWebsite: best.officialWebsite,
      confidence: best.confidence,
      candidateCount: candidates.length,
      searchRequestCount,
      searchedAt,
    });
    await writeJson(reportPath, report);

    if (best.status === "verified") {
      await updateSchoolWebsiteFields(best);
    }

    return best;
  } catch (error) {
    const common = {
      schoolId: school.id,
      schoolName: school.name,
      officialWebsite: null,
      officialDomain: null,
      confidence: 0,
      evidence: [error.message],
      candidateUrls: [],
      error: error.message,
      searchRequestCount,
    };

    if (
      error.code === "source-discovery-unavailable" ||
      error.message?.includes("SEARCH_API_KEY") ||
      error.message?.includes("SEARCH_PROVIDER")
    ) {
      return {
        ...common,
        status: "source-discovery-unavailable",
      };
    }

    return {
      ...common,
      status: "source-not-found",
    };
  }
}
