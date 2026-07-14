import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const __dirname = path.dirname(currentFile);
const rootDir = path.resolve(__dirname, "../..");
const schoolsPath = path.join(rootDir, "public/data/schools.json");
const detailDir = path.join(rootDir, "public/data/school-details");
const registryPath = path.join(rootDir, "scripts/source-registry/school-unit-sources.json");
const reviewPath = path.join(rootDir, "scripts/review/academic-units-review.json");
const progressPath = path.join(rootDir, "scripts/state/academic-units-progress.json");
const reportPath = path.join(rootDir, "scripts/reports/academic-units-report.json");

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function getUnits(detail) {
  return Array.isArray(detail.academicUnits)
    ? detail.academicUnits
    : Array.isArray(detail.colleges)
      ? detail.colleges
      : [];
}

async function readDetailFiles() {
  const files = await fs.readdir(detailDir).catch(() => []);
  const details = [];

  for (const file of files.filter((item) => item.endsWith(".json"))) {
    const fullPath = path.join(detailDir, file);
    const detail = await readJson(fullPath, null);
    if (detail) details.push({ file, detail });
  }

  return details;
}

async function debugAcademicUnits() {
  const schools = await readJson(schoolsPath, []);
  const registry = await readJson(registryPath, []);
  const review = await readJson(reviewPath, []);
  const progress = await readJson(progressPath, {
    schools: {},
    completed: [],
    failed: [],
    pendingReview: [],
  });
  const progressRecords = progress.schools ? Object.values(progress.schools) : [];
  const details = await readDetailFiles();
  const schoolIds = new Set(schools.map((school) => school.id));
  const configuredSourceCount = registry.length;
  const registeredOfficialWebsiteCount = new Set(
    [
      ...schools.filter((school) => school.officialWebsite).map((school) => school.id),
      ...registry.filter((group) => group.officialWebsite).map((group) => group.schoolId),
    ],
  ).size;
  const autoDiscoveredOfficialWebsiteCount = schools.filter(
    (school) => school.websiteSource === "automatic-search" && school.websiteStatus === "verified",
  ).length;
  const registeredAcademicUnitPageCount = registry.reduce(
    (sum, group) => sum + (group.candidatePages || []).filter((page) => page.enabled).length,
    0,
  );
  const autoDiscoveredSourceCount = registry.filter((group) =>
    (group.candidatePages || []).some((page) => page.reason || page.discoveredAt),
  ).length;
  const statusCounts = progressRecords.reduce((acc, record) => {
    acc[record.status] = (acc[record.status] || 0) + 1;
    return acc;
  }, {});
  const idMismatch = [];
  let nonEmpty = 0;
  let empty = 0;
  let frontendDisplayableUnits = 0;
  let pendingUnits = 0;

  for (const { file, detail } of details) {
    const expectedId = file.replace(/\.json$/, "");
    const units = getUnits(detail);
    const displayable = units.filter((unit) => unit.id && unit.name && !["pending-review", "inactive"].includes(unit.dataStatus));
    if (units.length) nonEmpty += 1;
    else empty += 1;
    frontendDisplayableUnits += displayable.length;
    pendingUnits += units.filter((unit) => unit.dataStatus === "pending-review").length;

    if (detail.schoolId !== expectedId || !schoolIds.has(detail.schoolId)) {
      idMismatch.push({
        file,
        fileSchoolId: expectedId,
        detailSchoolId: detail.schoolId,
        existsInSchoolsJson: schoolIds.has(detail.schoolId),
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    schoolsTotal: schools.length,
    registeredOfficialWebsiteCount,
    autoDiscoveredOfficialWebsiteCount,
    pendingWebsiteReviewCount: review.filter((item) => item.reason?.includes("官网")).length,
    sourceNotFoundCount: statusCounts["source-not-found"] || 0,
    schoolDetailsFileCount: details.length,
    academicUnitsNonEmptySchoolCount: nonEmpty,
    academicUnitsEmptySchoolCount: empty,
    configuredSourceCount,
    registeredAcademicUnitPageCount,
    autoDiscoveredSourceCount,
    failedCount: progressRecords.length
      ? progressRecords.filter((record) => record.status === "failed").length
      : progress.failed?.length || 0,
    crawlFailedCount: statusCounts["crawl-failed"] || 0,
    parseFailedCount: statusCounts["parse-failed"] || 0,
    pendingReviewCount: new Set([
      ...(progressRecords.length
        ? Object.entries(progress.schools)
            .filter(([, record]) => record.status === "pending-review")
            .map(([schoolId]) => schoolId)
        : (progress.pendingReview || []).map((item) => item.schoolId)),
      ...review.map((item) => item.schoolId),
    ]).size,
    schoolIdMismatchCount: idMismatch.length,
    frontendDisplayableUnitCount: frontendDisplayableUnits,
    pendingUnitCount: pendingUnits,
    idMismatch,
    sampleDetails: details.slice(0, 10).map(({ file, detail }) => ({
      file,
      schoolId: detail.schoolId,
      name: detail.name,
      units: getUnits(detail).length,
      crawlMeta: detail.crawlMeta || null,
    })),
  };

  await writeJson(reportPath, report);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const report = await debugAcademicUnits();
  console.log(JSON.stringify(report, null, 2));
}

export { debugAcademicUnits };
