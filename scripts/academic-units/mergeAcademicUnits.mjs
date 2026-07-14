import fs from "node:fs/promises";
import path from "node:path";

function nowCompact() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function mergeUnit(existing, incoming) {
  if (existing?.dataStatus === "verified") {
    return {
      ...existing,
      aliases: [...new Set([...(existing.aliases || []), ...(incoming.aliases || [])])],
      officialWebsite: existing.officialWebsite || incoming.officialWebsite,
      sourceUrl: existing.sourceUrl || incoming.sourceUrl,
      lastCheckedAt: incoming.lastCheckedAt || existing.lastCheckedAt,
    };
  }

  return {
    ...existing,
    ...incoming,
    aliases: [...new Set([...(existing?.aliases || []), ...(incoming.aliases || [])])],
  };
}

function indexByStableKey(units) {
  const map = new Map();
  for (const unit of units || []) {
    map.set(unit.id || unit.name, unit);
  }
  return map;
}

function dedupeSources(sources) {
  const seen = new Set();
  return sources.filter((source) => {
    const key = `${source.url}|${source.sourceType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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

function shouldPreserveOldVerifiedUnit(unit, officialWebsite) {
  if (unit?.dataStatus !== "verified") return false;
  if (!officialWebsite) return true;
  const officialHostname = getHostname(officialWebsite);
  const sourceHostname = getHostname(unit.sourceUrl || unit.officialWebsite);
  return Boolean(sourceHostname && isSameOrSubdomain(sourceHostname, officialHostname));
}

export async function mergeAcademicUnits({
  detailPath,
  school,
  newUnits,
  sourceUrls,
  status = "success",
  errorMessage = null,
  officialWebsite = "",
  searchRequestCount = 0,
}) {
  const oldDetail = await readJson(detailPath, {
    schoolId: school.id,
    name: school.name,
    status: "building",
    lastUpdated: null,
    academicUnits: [],
    sources: [],
  });
  const oldUnits = Array.isArray(oldDetail.academicUnits)
    ? oldDetail.academicUnits
    : Array.isArray(oldDetail.colleges)
      ? oldDetail.colleges.map((college) => ({
          ...college,
          unitType: "学院",
          aliases: [],
          sourceUrl: college.officialWebsite || "",
          graduateAdmissionsRelevant: null,
          dataStatus: college.dataStatus || "building",
          confidence: college.officialWebsite ? 0.6 : 0.3,
          lastCheckedAt: "",
        }))
      : [];
  const oldMap = indexByStableKey(oldUnits);
  const nextMap = new Map();
  const consumedOldIds = new Set();
  const stats = {
    added: 0,
    possibleDeleted: 0,
    possibleRenamed: 0,
  };

  for (const unit of newUnits) {
    const existing = oldMap.get(unit.id) || oldUnits.find((oldUnit) => oldUnit.name === unit.name);
    if (!existing) stats.added += 1;
    if (existing?.id) consumedOldIds.add(existing.id);
    nextMap.set(unit.id, mergeUnit(existing, unit));
  }

  for (const oldUnit of oldUnits) {
    if (consumedOldIds.has(oldUnit.id)) continue;
    if (nextMap.has(oldUnit.id)) continue;

    if (shouldPreserveOldVerifiedUnit(oldUnit, officialWebsite)) {
      nextMap.set(oldUnit.id, oldUnit);
      continue;
    }

    if (oldUnit.dataStatus === "verified" && officialWebsite) {
      stats.possibleDeleted += 1;
      continue;
    }

    nextMap.set(oldUnit.id, {
      ...oldUnit,
      dataStatus: "pending-review",
      lastCheckedAt: new Date().toISOString(),
    });
    stats.possibleDeleted += 1;
  }

  const academicUnits = [...nextMap.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  const now = new Date().toISOString();
  const verifiedCount = academicUnits.filter((unit) => unit.dataStatus === "verified").length;
  const pendingCount = academicUnits.filter((unit) => unit.dataStatus === "pending-review").length;
  const previousUnitCount = oldUnits.length;
  const currentUnitCount = academicUnits.length;
  const nextDetail = {
    ...oldDetail,
    schoolId: school.id,
    name: school.name,
    status: "building",
    academicUnits,
    crawlMeta: {
      status,
      officialWebsite: officialWebsite || oldDetail.crawlMeta?.officialWebsite || "",
      sourceUrls,
      lastCrawledAt: now,
      lastCheckedAt: now,
      searchRequestCount,
      previousUnitCount,
      currentUnitCount,
      newUnitCount: stats.added,
      verifiedCount,
      pendingCount,
      errorMessage,
    },
    sources: dedupeSources([
      ...(Array.isArray(oldDetail.sources) ? oldDetail.sources : []),
      ...sourceUrls.map((url) => ({
        title: "学院目录来源",
        url,
        sourceType: "school",
        publishedAt: null,
        crawledAt: now,
        lastCheckedAt: now,
      })),
    ]),
    lastUpdated: now,
  };
  delete nextDetail.colleges;

  await fs.mkdir(path.dirname(detailPath), { recursive: true });

  try {
    await fs.access(detailPath);
    const backupPath = `${detailPath}.${nowCompact()}.bak`;
    await fs.copyFile(detailPath, backupPath);
  } catch {
    // No existing file to back up.
  }

  const tempPath = `${detailPath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(nextDetail, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, detailPath);

  return {
    detail: nextDetail,
    oldCount: oldUnits.length,
    newCount: nextDetail.academicUnits.length,
    verifiedCount,
    pendingCount,
    ...stats,
  };
}
