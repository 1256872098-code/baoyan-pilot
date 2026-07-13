import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const __dirname = path.dirname(currentFile);
const rootDir = path.resolve(__dirname, "../..");
const detailsDir = path.join(rootDir, "public/data/school-details");
const schoolsPath = path.join(rootDir, "public/data/schools.json");
const reviewPath = path.join(rootDir, "scripts/review/academic-units-review.json");
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

async function readDetails() {
  const files = await fs.readdir(detailsDir).catch(() => []);
  const details = [];

  for (const file of files.filter((item) => item.endsWith(".json"))) {
    const detail = await readJson(path.join(detailsDir, file), null);
    if (detail) details.push({ file, detail });
  }

  return details;
}

function countByStatus(units) {
  return units.reduce((acc, unit) => {
    const status = unit.dataStatus || "building";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

async function generateReport() {
  const schools = await readJson(schoolsPath, []);
  const details = await readDetails();
  const reviewItems = await readJson(reviewPath, []);
  const schoolRows = details.map(({ file, detail }) => {
    const units = Array.isArray(detail.academicUnits)
      ? detail.academicUnits
      : Array.isArray(detail.colleges)
        ? detail.colleges
        : [];

    return {
      schoolId: detail.schoolId || file.replace(/\.json$/, ""),
      schoolName: detail.name || "",
      file,
      unitCount: units.length,
      statusCounts: countByStatus(units),
      sourceCount: Array.isArray(detail.sources) ? detail.sources.length : 0,
      lastUpdated: detail.lastUpdated || null,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    schoolTotal: schools.length,
    detailFileCount: details.length,
    schoolsWithAcademicUnits: schoolRows.filter((row) => row.unitCount > 0).length,
    totalAcademicUnits: schoolRows.reduce((sum, row) => sum + row.unitCount, 0),
    pendingReviewSchools: new Set(reviewItems.map((item) => item.schoolId)).size,
    reviewItemCount: reviewItems.length,
    missingDetailSchools: schools.length - details.length,
    schools: schoolRows.sort((a, b) => b.unitCount - a.unitCount),
  };

  await writeJson(reportPath, report);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const report = await generateReport();
  console.log(JSON.stringify(report, null, 2));
}

export { generateReport };
