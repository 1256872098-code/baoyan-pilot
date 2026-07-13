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

export async function mergeAcademicUnits({ detailPath, school, newUnits, sourceUrls }) {
  const oldDetail = await readJson(detailPath, {
    schoolId: school.id,
    name: school.name,
    status: "building",
    lastUpdated: null,
    academicUnits: [],
    sources: [],
  });
  const oldUnits = Array.isArray(oldDetail.academicUnits) ? oldDetail.academicUnits : [];
  const oldMap = indexByStableKey(oldUnits);
  const nextMap = new Map();
  const stats = {
    added: 0,
    possibleDeleted: 0,
    possibleRenamed: 0,
  };

  for (const unit of newUnits) {
    const existing = oldMap.get(unit.id) || oldUnits.find((oldUnit) => oldUnit.name === unit.name);
    if (!existing) stats.added += 1;
    nextMap.set(unit.id, mergeUnit(existing, unit));
  }

  for (const oldUnit of oldUnits) {
    if (nextMap.has(oldUnit.id)) continue;

    if (oldUnit.dataStatus === "verified") {
      nextMap.set(oldUnit.id, oldUnit);
      continue;
    }

    nextMap.set(oldUnit.id, {
      ...oldUnit,
      dataStatus: "pending-review",
      lastCheckedAt: new Date().toISOString(),
    });
    stats.possibleDeleted += 1;
  }

  const nextDetail = {
    ...oldDetail,
    schoolId: school.id,
    name: school.name,
    status: "building",
    academicUnits: [...nextMap.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
    sources: [
      ...(Array.isArray(oldDetail.sources) ? oldDetail.sources : []),
      ...sourceUrls.map((url) => ({
        title: "院系目录来源",
        url,
        sourceType: "school",
        publishedAt: null,
        crawledAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
      })),
    ],
    lastUpdated: new Date().toISOString(),
  };

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
    ...stats,
  };
}
