import path from "node:path";
import {
  getOutputPath,
  getSchoolByName,
  makeMajorId,
  parseArgs,
  readJson,
  rootDir,
  shouCollegeName,
  shouMajorName,
  shouName,
  writeJsonAtomic,
} from "../common.mjs";

export const target = {
  schoolName: shouName,
  collegeName: shouCollegeName,
  majorName: shouMajorName,
};

export const sourceRegistryPath = path.join(rootDir, "scripts/source-registry/shou-accounting-sources.json");
export const reviewPath = path.join(rootDir, "scripts/review/shou-accounting-review.json");
export const reportPath = path.join(rootDir, "scripts/reports/shou-accounting-report.json");

export { getOutputPath, getSchoolByName, makeMajorId, parseArgs, readJson, rootDir, writeJsonAtomic };

export async function getTargetIds() {
  const school = await getSchoolByName(target.schoolName);
  const detail = await readJson(path.join(rootDir, `public/data/school-details/${school.id}.json`), null);
  const college = (detail?.academicUnits || []).find((unit) => unit.name === target.collegeName);
  if (!college) throw new Error("未在上海海洋大学 school-details 中找到经济管理学院。");
  const majorId = makeMajorId(college.id, target.majorName);
  return {
    school,
    college,
    majorId,
  };
}

export function parseYears(value) {
  if (!value) return [2026, 2025, 2024];
  return String(value)
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((year) => Number.isInteger(year));
}

export function sourceLabel(sourceLevel) {
  if (sourceLevel === "official") return "官方数据";
  if (sourceLevel === "credible-reference") return "公开参考数据";
  if (sourceLevel === "third-party-estimate") return "估算值，仅供参考";
  return "待人工核验";
}
