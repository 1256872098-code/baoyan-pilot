import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(__dirname, "../..");
export const schoolsPath = path.join(rootDir, "public/data/schools.json");
export const registryPath = path.join(rootDir, "scripts/source-registry/my-school-recommendation-sources.json");
export const reviewPath = path.join(rootDir, "scripts/review/my-school-recommendation-review.json");
export const shouReportPath = path.join(rootDir, "scripts/reports/shou-recommendation-report.json");
export const mySchoolDataDir = path.join(rootDir, "public/data/my-school");
export const cacheDir = path.join(rootDir, "scripts/cache/my-school");

export const shouName = "上海海洋大学";
export const shouCollegeName = "经济管理学院";
export const shouMajorName = "会计学";

export const shouOfficialDomains = [
  "shou.edu.cn",
  "www.shou.edu.cn",
  "jwc.shou.edu.cn",
  "yjs.shou.edu.cn",
  "xxgk.shou.edu.cn",
  "jmxy.shou.edu.cn",
];

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

export function isCliModule(importMetaUrl) {
  return Boolean(process.argv[1]) && path.resolve(fileURLToPath(importMetaUrl)) === path.resolve(process.argv[1]);
}

export function parseYears(value) {
  if (!value) return [2026, 2025, 2024];
  return String(value)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 2000 && item <= 2100);
}

export async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export async function writeJsonAtomic(filePath, value, { backup = false } = {}) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (backup) {
    try {
      const oldContent = await fs.readFile(filePath, "utf8");
      const backupPath = `${filePath}.${Date.now()}.bak`;
      await fs.writeFile(backupPath, oldContent, "utf8");
    } catch {
      // No existing file to back up.
    }
  }
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  JSON.parse(await fs.readFile(tmpPath, "utf8"));
  await fs.rename(tmpPath, filePath);
}

export async function getSchoolByName(schoolName = shouName) {
  const schools = await readJson(schoolsPath, []);
  const exact = schools.find((school) => school.name === schoolName);
  if (exact) return exact;
  const fallback = schools.find((school) => school.name === shouName);
  if (fallback) return fallback;
  throw new Error(`未在 schools.json 中找到学校：${schoolName}`);
}

export async function getShouCollegeId() {
  const school = await getSchoolByName(shouName);
  const detailPath = path.join(rootDir, `public/data/school-details/${school.id}.json`);
  const detail = await readJson(detailPath, null);
  const units = Array.isArray(detail?.academicUnits) ? detail.academicUnits : [];
  return units.find((unit) => unit.name === shouCollegeName)?.id || "";
}

export function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function shortEvidence(value, maxLength = 140) {
  return normalizeWhitespace(value).slice(0, maxLength);
}

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

export function makeMajorId(collegeId, majorName) {
  return `major-${sha256(`${collegeId}:${majorName}`).slice(0, 10)}`;
}

export function isOfficialUrl(url, officialDomains = shouOfficialDomains) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return officialDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function sourceEvidence({
  value,
  source,
  evidenceText,
  confidence = 1,
}) {
  return {
    value,
    sourceUrl: source.url,
    sourceTitle: source.title || source.name || "",
    publishedAt: source.publishedAt || null,
    sourceOrganization: source.sourceOrganization || "",
    sourceType: source.sourceType || "",
    evidenceText: shortEvidence(evidenceText),
    confidence,
    verifiedAt: new Date().toISOString(),
  };
}

export function getOutputPath(schoolId) {
  return path.join(mySchoolDataDir, `${schoolId}.json`);
}

export function dateOnly(value) {
  if (!value) return null;
  const match = String(value).match(/(20\d{2})[-年/.](\d{1,2})[-月/.](\d{1,2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function latestYearFromTexts(texts) {
  const years = new Set();
  texts.forEach((text) => {
    for (const match of String(text || "").matchAll(/20\d{2}届|20\d{2}年/g)) {
      years.add(Number(match[0].slice(0, 4)));
    }
  });
  return [...years].filter(Boolean).sort((a, b) => b - a)[0] || null;
}
