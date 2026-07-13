import crypto from "node:crypto";

const administrativeKeywords = [
  "党委",
  "党政",
  "办公室",
  "财务",
  "人事",
  "后勤",
  "工会",
  "团委",
  "图书馆",
  "档案馆",
  "校友",
  "保卫",
  "采购",
  "资产",
  "宣传部",
  "统战部",
  "纪委",
];

function normalizeText(value) {
  return String(value || "")
    .replace(/[（]/g, "（")
    .replace(/[）]/g, "）")
    .replace(/^[\d一二三四五六七八九十]+[、.．\s-]*/, "")
    .replace(/(进入官网|查看更多|更多|点击进入|详情|>>|>|›|→)$/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function removeSchoolPrefix(name, schoolName) {
  const normalizedSchoolName = normalizeText(schoolName);
  if (normalizedSchoolName && name.startsWith(normalizedSchoolName)) {
    return name.slice(normalizedSchoolName.length);
  }

  return name;
}

export function createUnitId(name) {
  const hash = crypto.createHash("sha1").update(name).digest("hex").slice(0, 10);
  return `unit-${hash}`;
}

export function inferUnitType(name) {
  if (name.includes("学部")) return "学部";
  if (name.endsWith("系") || name.includes("系（")) return "系";
  if (name.includes("研究院")) return "研究院";
  if (name.includes("书院")) return "书院";
  if (name.includes("研究中心") || name.includes("实验室")) return "研究中心";
  if (name.includes("学院") || name.includes("院（部）") || name.includes("学院（部）")) return "学院";
  return "其他";
}

function isAdministrativeCandidate(name) {
  return administrativeKeywords.some((keyword) => name.includes(keyword));
}

function mergeCandidate(existing, candidate) {
  const aliases = new Set([...(existing.aliases || [])]);
  if (existing.name !== candidate.name) aliases.add(candidate.name);
  if (candidate.name !== existing.name) aliases.add(existing.name);

  return {
    ...existing,
    aliases: [...aliases],
    officialWebsite: existing.officialWebsite || candidate.officialWebsite,
    rawTexts: [...new Set([...(existing.rawTexts || []), ...(candidate.rawTexts || [])])],
    confidence: Math.max(existing.confidence || 0, candidate.confidence || 0),
  };
}

export function normalizeAcademicUnits({ schoolName, candidates }) {
  const byName = new Map();
  const byLink = new Map();
  const rejected = [];

  for (const candidate of candidates || []) {
    const originalName = normalizeText(candidate.name || candidate.text);
    const name = removeSchoolPrefix(originalName, schoolName);
    if (!name || name.length < 2) continue;

    const rejectedCandidate = isAdministrativeCandidate(name);
    const unitType = inferUnitType(name);
    const normalizedCandidate = {
      id: createUnitId(name),
      name,
      unitType,
      aliases: originalName !== name ? [originalName] : [],
      officialWebsite: candidate.url || "",
      sourceUrl: candidate.sourceUrl || "",
      graduateAdmissionsRelevant: null,
      dataStatus: rejectedCandidate ? "pending-review" : "building",
      confidence: rejectedCandidate ? 0.35 : unitType === "其他" ? 0.55 : 0.75,
      lastCheckedAt: new Date().toISOString(),
      rawTexts: [candidate.rawText || candidate.text || name].filter(Boolean),
      rejectedCandidate,
    };

    if (rejectedCandidate) {
      rejected.push(normalizedCandidate);
      continue;
    }

    const linkKey = normalizedCandidate.officialWebsite || "";
    const existingByLink = linkKey ? byLink.get(linkKey) : null;
    if (existingByLink) {
      const merged = mergeCandidate(existingByLink, normalizedCandidate);
      byName.set(merged.name, merged);
      byLink.set(linkKey, merged);
      continue;
    }

    const existingByName = byName.get(name);
    if (existingByName) {
      byName.set(name, mergeCandidate(existingByName, normalizedCandidate));
      continue;
    }

    byName.set(name, normalizedCandidate);
    if (linkKey) byLink.set(linkKey, normalizedCandidate);
  }

  return {
    accepted: [...byName.values()].map(({ rejectedCandidate, rawTexts, ...unit }) => unit),
    rejected,
    needsReview: [...byName.values()]
      .filter((unit) => unit.unitType === "其他" || !unit.officialWebsite)
      .map(({ rejectedCandidate, rawTexts, ...unit }) => ({
        ...unit,
        dataStatus: "pending-review",
      })),
  };
}

export async function classifyAcademicUnits({ schoolName, sourceUrl, candidates }) {
  // Optional AI hook. In this stage, and whenever no AI key is configured,
  // use deterministic rule-based normalization only. AI implementations must
  // never add units that do not exist in `candidates`.
  const normalized = normalizeAcademicUnits({ schoolName, sourceUrl, candidates });
  return {
    accepted: normalized.accepted,
    rejected: normalized.rejected,
    needsReview: normalized.needsReview,
    mode: "rule-based",
  };
}
