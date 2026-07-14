import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchWeb } from "./index.mjs";

const currentFile = fileURLToPath(import.meta.url);
const __dirname = path.dirname(currentFile);
const rootDir = path.resolve(__dirname, "../..");
const cacheDir = path.join(rootDir, "scripts/cache/search-results");
const defaultTtlMs = 30 * 24 * 60 * 60 * 1000;

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

function sanitizeId(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function cachePathForSchool(schoolId) {
  return path.join(cacheDir, `${sanitizeId(schoolId)}.json`);
}

function findFreshQuery(cache, query, options, now) {
  return (cache.queries || []).find((item) => {
    if (item.query !== query) return false;
    if (Number(item.maxResults || 0) !== Number(options.maxResults || 5)) return false;
    if ((item.searchDepth || "basic") !== (options.searchDepth || "basic")) return false;
    return item.expiresAt && new Date(item.expiresAt).getTime() > now;
  });
}

function uniqueByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export async function searchSchoolWithCache({
  schoolId,
  schoolName,
  query,
  maxResults = 5,
  searchDepth = "basic",
  ttlMs = defaultTtlMs,
  retry = 1,
  force = false,
}) {
  const filePath = cachePathForSchool(schoolId);
  const now = Date.now();
  const options = { maxResults, searchDepth };
  const cache = await readJson(filePath, {
    schoolId,
    schoolName,
    queries: [],
    results: [],
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
  });

  const cachedQuery = !force ? findFreshQuery(cache, query, options, now) : null;
  if (cachedQuery) {
    return {
      results: (cachedQuery.results || []).slice(0, maxResults),
      requestCount: 0,
      fromCache: true,
      cachePath: filePath,
    };
  }

  let lastError = null;
  for (let attempt = 0; attempt <= retry; attempt += 1) {
    try {
      const results = await searchWeb(query, {
        maxResults,
        count: maxResults,
        searchDepth,
      });
      const normalized = uniqueByUrl(results)
        .slice(0, maxResults)
        .map((item) => ({
          title: item.title || "",
          url: item.url || "",
          snippet: item.snippet || "",
          score: item.score ?? null,
          query,
        }));
      const requestedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();
      const nextQueries = (cache.queries || []).filter(
        (item) =>
          item.query !== query ||
          Number(item.maxResults || 0) !== Number(maxResults) ||
          (item.searchDepth || "basic") !== searchDepth,
      );
      nextQueries.push({
        query,
        maxResults,
        searchDepth,
        requestedAt,
        expiresAt,
        resultCount: normalized.length,
        results: normalized,
      });

      const nextCache = {
        schoolId,
        schoolName,
        queries: nextQueries,
        results: uniqueByUrl(nextQueries.flatMap((item) => item.results || [])),
        createdAt: cache.createdAt || requestedAt,
        updatedAt: requestedAt,
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      };
      await writeJson(filePath, nextCache);

      return {
        results: normalized,
        requestCount: 1,
        fromCache: false,
        cachePath: filePath,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retry) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  }

  throw lastError;
}

