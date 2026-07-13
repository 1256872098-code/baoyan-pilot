export function normalizeAcademicUnit(unit) {
  return {
    id: unit.id,
    name: unit.name,
    unitType: unit.unitType || "学院",
    aliases: Array.isArray(unit.aliases) ? unit.aliases : [],
    officialWebsite: unit.officialWebsite || "",
    sourceUrl: unit.sourceUrl || "",
    graduateAdmissionsRelevant:
      typeof unit.graduateAdmissionsRelevant === "boolean" ? unit.graduateAdmissionsRelevant : null,
    dataStatus: unit.dataStatus || "building",
    confidence: typeof unit.confidence === "number" ? unit.confidence : 0,
    lastCheckedAt: unit.lastCheckedAt || "",
    majorNames: Array.isArray(unit.majorNames) ? unit.majorNames : [],
  };
}

export function getAcademicUnits(detail) {
  const rawUnits = Array.isArray(detail?.academicUnits)
    ? detail.academicUnits
    : Array.isArray(detail?.colleges)
      ? detail.colleges.map((college) => ({
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

  return rawUnits
    .map(normalizeAcademicUnit)
    .filter((unit) => unit.id && unit.name && !["pending-review", "inactive"].includes(unit.dataStatus));
}
