import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "../..");
const schoolId = "school-f17pfd";
const schoolName = "上海海洋大学";
const verifiedAt = "2026-08-07T00:00:00.000Z";
const schoolDataPath = path.join(rootDir, "public/data/my-school", `${schoolId}.json`);
const majorCatalogDir = path.join(rootDir, "public/data/college-majors", schoolId);
const attachmentDir = path.join(rootDir, "scripts/cache/my-school/attachments");

const sourcesByYear = {
  2024: {
    attachment: "ab4508be7f161b47.txt",
    total: 243,
    title: "上海海洋大学2024年推荐优秀应届本科毕业生免试攻读研究生名单公示",
    url: "https://jwc.shou.edu.cn/_upload/article/files/c2/1e/d75adce540209dbe408c4b7db522/82c5c436-a467-4e64-8cb0-89dcda39b4c3.pdf",
  },
  2025: {
    attachment: "d240a6abfb07bd14.txt",
    total: 283,
    title: "上海海洋大学2025年推荐优秀应届本科毕业生免试攻读研究生名单公示",
    url: "https://jwc.shou.edu.cn/_upload/article/files/c6/6f/589ed4c94462acba313568ab85c0/931dc139-ff31-42aa-8630-a1a648f52abe.pdf",
  },
  2026: {
    attachment: "d35dac7155dcf009.txt",
    total: 359,
    title: "上海海洋大学2026年推荐优秀应届本科毕业生免试攻读研究生名单公示",
    url: "https://jwc.shou.edu.cn/_upload/article/files/ea/8e/16cb8a5b4f9cb6a3732daea9f73e/e095aa1a-9d19-4589-80e5-4000c9e0f5a5.pdf",
  },
};

const currentCollegeOrder = [
  "水产与生命学院",
  "海洋生物资源与管理学院",
  "海洋科学与生态环境学院",
  "食品学院",
  "经济管理学院",
  "工程学院",
  "信息学院",
  "外国语学院",
  "爱恩学院",
];

const historicalCollegeNames = ["海洋科学学院", "海洋生态与环境学院", "海洋文化与法律学院"];
const environmentLegacyMajors = new Set(["环境工程", "环境科学"]);
const unavailableRateReason = "尚未获得同口径本科毕业生人数，暂无法计算官方推免率。";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadMajorCatalogs() {
  return fs
    .readdirSync(majorCatalogDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => readJson(path.join(majorCatalogDir, fileName)))
    .sort((a, b) => currentCollegeOrder.indexOf(a.collegeName) - currentCollegeOrder.indexOf(b.collegeName));
}

function parseOfficialList(year, knownCollegeNames) {
  const source = sourcesByYear[year];
  const text = fs.readFileSync(path.join(attachmentDir, source.attachment), "utf8");
  const collegeNames = [...knownCollegeNames].sort((a, b) => b.length - a.length);
  const rows = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\f/g, "").trim();
    const serialMatch = line.match(/^(\d{1,3})\s+(.+)$/);
    if (!serialMatch) continue;

    const serial = Number(serialMatch[1]);
    const remainder = serialMatch[2];
    const originalCollegeName = collegeNames.find((collegeName) => remainder.startsWith(collegeName));
    if (!originalCollegeName) continue;

    const rowMatch = remainder
      .slice(originalCollegeName.length)
      .trim()
      .match(/^(.+?)\s+(\d{7,})(?:\s+(.+))?$/);
    invariant(rowMatch, `${year}届名单第${serial}行无法解析：${line}`);

    rows.push({
      year,
      serial,
      originalCollegeName,
      originalMajorName: rowMatch[1].trim(),
      studentNumber: rowMatch[2],
    });
  }

  invariant(rows.length === source.total, `${year}届名单应为${source.total}人，实际解析${rows.length}人。`);
  invariant(new Set(rows.map((row) => row.serial)).size === source.total, `${year}届名单序号存在重复。`);
  for (let serial = 1; serial <= source.total; serial += 1) {
    invariant(rows.some((row) => row.serial === serial), `${year}届名单缺少序号${serial}。`);
  }
  return rows;
}

function currentCollegeNameFor(row) {
  if (row.originalCollegeName === "海洋科学学院") {
    return ["海洋渔业科学与技术", "海洋资源与环境"].includes(row.originalMajorName)
      ? "海洋生物资源与管理学院"
      : "海洋科学与生态环境学院";
  }
  if (row.originalCollegeName === "海洋生态与环境学院") return "海洋科学与生态环境学院";
  if (row.originalCollegeName === "海洋文化与法律学院") {
    return row.originalMajorName === "社会工作" ? "海洋生物资源与管理学院" : "经济管理学院";
  }
  return row.originalCollegeName;
}

function normalizedMajorName(originalMajorName) {
  if (originalMajorName === "生物科学（海洋生物）") return "生物科学";
  if (originalMajorName === "工商管理（食品经济管理）") return "工商管理";
  return originalMajorName;
}

function makeScope(college, major = null) {
  return {
    schoolId,
    collegeId: college?.collegeId || null,
    collegeName: college?.collegeName || null,
    majorId: major?.id || null,
    majorName: major?.name || null,
    appliesToAllColleges: !college,
    appliesToAllMajors: !major,
  };
}

function makeHistorySource(year, evidenceText) {
  const source = sourcesByYear[year];
  return {
    title: source.title,
    url: source.url,
    organization: "上海海洋大学教务处",
    publishedAt: null,
    sourceLevel: "official",
    sourceType: "recommendation-list",
    countMethod: "official-list-count",
    evidenceText,
    crawledAt: verifiedAt,
  };
}

function makeSummarySource(year, value, evidenceText) {
  const source = sourcesByYear[year];
  return {
    value,
    sourceUrl: source.url,
    sourceTitle: source.title,
    publishedAt: null,
    sourceOrganization: "上海海洋大学教务处",
    sourceType: "recommendation-list",
    evidenceText,
    confidence: 1,
    verifiedAt,
  };
}

function buildMappedHistoryRecord({ year, rows, college, major, originalCollegeTotal }) {
  const originalCollegeNames = [...new Set(rows.map((row) => row.originalCollegeName))];
  const originalMajorNames = [...new Set(rows.map((row) => row.originalMajorName))];
  invariant(originalCollegeNames.length === 1, `${year}届${college.collegeName}${major.name}跨历史学院，需人工复核。`);

  return {
    graduationYear: year,
    recommendedCount: rows.length,
    cohortSize: null,
    recommendationRate: null,
    countMethod: "official-list-count",
    sourceLevel: "official",
    sourceLabel: "官方数据",
    isEstimated: false,
    dataStatus: "partial",
    schoolTotalRecommendedCount: sourcesByYear[year].total,
    collegeRecommendedCount: originalCollegeTotal,
    calculationMethod: null,
    numeratorSource: sourcesByYear[year].url,
    denominatorSource: null,
    rateStatus: "unavailable",
    rateUnavailableReason: unavailableRateReason,
    dataAvailabilityNote: "官方名单可核验推荐人数；因未公开同口径本科毕业生人数，暂不计算推免率。",
    originalCollegeName: originalCollegeNames[0],
    originalMajorNames,
    catalogMatchStatus: "matched",
    sources: [
      makeHistorySource(
        year,
        `官方名单中${originalCollegeNames[0]}“${originalMajorNames.join("、")}”记录合计${rows.length}人。`,
      ),
    ],
    scope: makeScope(college, major),
  };
}

function buildLegacyEnvironmentRecord({ year, rows, college, originalCollegeTotal }) {
  const originalCollegeName = rows[0].originalCollegeName;
  const originalMajorName = rows[0].originalMajorName;
  const historicalMajorId = `historical-major-${originalMajorName === "环境工程" ? "environmental-engineering" : "environmental-science"}`;
  return {
    graduationYear: year,
    recommendedCount: rows.length,
    cohortSize: null,
    recommendationRate: null,
    countMethod: "official-list-count",
    sourceLevel: "official",
    sourceLabel: "官方数据",
    isEstimated: false,
    dataStatus: "partial",
    schoolTotalRecommendedCount: sourcesByYear[year].total,
    collegeRecommendedCount: originalCollegeTotal,
    calculationMethod: null,
    numeratorSource: sourcesByYear[year].url,
    denominatorSource: null,
    rateStatus: "unavailable",
    rateUnavailableReason: unavailableRateReason,
    dataAvailabilityNote:
      "官方名单分别列示“环境工程”和“环境科学”。现专业目录使用“环境科学与工程”，为避免错误归并，此处保留原专业名称和独立人数。",
    originalCollegeName,
    originalMajorNames: [originalMajorName],
    catalogMatchStatus: "historical-major-name-unmatched",
    sources: [
      makeHistorySource(year, `官方名单中${originalCollegeName}“${originalMajorName}”记录计数为${rows.length}人。`),
    ],
    scope: {
      ...makeScope(college),
      majorId: historicalMajorId,
      majorName: originalMajorName,
      appliesToAllMajors: false,
    },
  };
}

function missingNoteFor(major) {
  if (major.name === "人工智能") {
    return "2024—2026届官方推免名单未出现“人工智能”专业名称；这不等同于推免人数为0，可能与专业设置及首届毕业时间有关，不归并其他信息类专业人数。";
  }
  if (major.name === "环境科学与工程") {
    return "2024—2026届官方名单按“环境工程”和“环境科学”分别列示，无法可靠映射为当前目录的“环境科学与工程”；不合并旧专业人数。";
  }
  return `该届官方名单未出现“${major.name}”专业名称；这不等同于推免人数为0，可能与专业设置或当届毕业生范围有关。`;
}

function buildUnavailableSummaryMajor(year, college, major) {
  const note = missingNoteFor(major);
  return {
    scope: makeScope(college, major),
    majorId: major.id,
    majorName: major.name,
    recommendationQuota: null,
    recommendedCount: null,
    containsWaitlist: false,
    cohortSize: null,
    recommendationRate: null,
    countMethod: "official-list-name-not-found",
    dataStatus: "missing",
    rateStatus: "unavailable",
    rateUnavailableReason: unavailableRateReason,
    dataAvailabilityNote: note,
    originalCollegeName: college.collegeName,
    originalMajorNames: [],
    catalogMatchStatus: "official-list-name-not-found",
    sources: [makeSummarySource(year, null, note)],
  };
}

function historyToSummaryMajor(record) {
  const major = record.scope.majorId ? { id: record.scope.majorId, name: record.scope.majorName } : null;
  return {
    scope: {
      schoolId,
      collegeId: record.scope.collegeId,
      collegeName: record.scope.collegeName,
      majorId: record.scope.majorId,
      majorName: record.scope.majorName,
      appliesToAllColleges: false,
      appliesToAllMajors: false,
    },
    majorId: major?.id || null,
    majorName: record.scope.majorName,
    recommendationQuota: null,
    recommendedCount: record.recommendedCount,
    countMethod: record.countMethod,
    containsWaitlist: false,
    cohortSize: null,
    recommendationRate: null,
    rateStatus: "unavailable",
    rateUnavailableReason: unavailableRateReason,
    dataStatus: record.dataStatus,
    dataAvailabilityNote: record.dataAvailabilityNote,
    originalCollegeName: record.originalCollegeName,
    originalMajorNames: record.originalMajorNames,
    catalogMatchStatus: record.catalogMatchStatus,
    sources: [
      makeSummarySource(
        record.graduationYear,
        record.recommendedCount,
        record.sources[0]?.evidenceText || record.dataAvailabilityNote,
      ),
    ],
  };
}

function main() {
  const catalogs = loadMajorCatalogs();
  invariant(catalogs.length === 9, `上海海洋大学本科培养学院应为9个，当前为${catalogs.length}个。`);
  invariant(
    currentCollegeOrder.every((collegeName) => catalogs.some((catalog) => catalog.collegeName === collegeName)),
    "学院目录与预期9个本科培养学院不一致。",
  );

  const knownCollegeNames = new Set([...catalogs.map((catalog) => catalog.collegeName), ...historicalCollegeNames]);
  const rowsByYear = Object.fromEntries(
    Object.keys(sourcesByYear).map((year) => [Number(year), parseOfficialList(Number(year), knownCollegeNames)]),
  );

  invariant(
    rowsByYear[2025].filter((row) => row.originalMajorName === "工商管理（食品经济管理）").length === 5,
    "2025届工商管理（食品经济管理）应解析为5人。",
  );
  invariant(
    rowsByYear[2026].filter((row) => row.originalMajorName === "食品质量与安全").length === 7,
    "2026届食品质量与安全应解析为7人。",
  );
  invariant(
    rowsByYear[2026].filter((row) => row.originalCollegeName === "外国语学院" && row.originalMajorName === "英语").length === 6,
    "2026届英语应解析为6人。",
  );

  const catalogByCollegeName = new Map(catalogs.map((catalog) => [catalog.collegeName, catalog]));
  const mappedGroups = new Map();
  const legacyGroups = new Map();

  for (const [yearText, rows] of Object.entries(rowsByYear)) {
    const year = Number(yearText);
    for (const row of rows) {
      const currentCollegeName = currentCollegeNameFor(row);
      const college = catalogByCollegeName.get(currentCollegeName);
      invariant(college, `${year}届“${row.originalCollegeName}/${row.originalMajorName}”无法映射学院。`);

      const normalizedName = normalizedMajorName(row.originalMajorName);
      const major = college.majors.find(
        (candidate) => candidate.name === normalizedName || (candidate.aliases || []).includes(row.originalMajorName),
      );

      if (!major && currentCollegeName === "海洋科学与生态环境学院" && environmentLegacyMajors.has(row.originalMajorName)) {
        const key = `${year}|${college.collegeId}|${row.originalMajorName}`;
        const group = legacyGroups.get(key) || { year, college, rows: [] };
        group.rows.push(row);
        legacyGroups.set(key, group);
        continue;
      }

      invariant(major, `${year}届“${row.originalCollegeName}/${row.originalMajorName}”无法映射当前专业目录。`);
      const key = `${year}|${college.collegeId}|${major.id}`;
      const group = mappedGroups.get(key) || { year, college, major, rows: [] };
      group.rows.push(row);
      mappedGroups.set(key, group);
    }
  }

  const originalCollegeTotals = new Map();
  for (const [yearText, rows] of Object.entries(rowsByYear)) {
    const year = Number(yearText);
    for (const row of rows) {
      const key = `${year}|${row.originalCollegeName}`;
      originalCollegeTotals.set(key, (originalCollegeTotals.get(key) || 0) + 1);
    }
  }

  const history = [];
  for (const group of mappedGroups.values()) {
    const originalCollegeName = group.rows[0].originalCollegeName;
    history.push(
      buildMappedHistoryRecord({
        ...group,
        originalCollegeTotal: originalCollegeTotals.get(`${group.year}|${originalCollegeName}`),
      }),
    );
  }
  for (const group of legacyGroups.values()) {
    const originalCollegeName = group.rows[0].originalCollegeName;
    history.push(
      buildLegacyEnvironmentRecord({
        ...group,
        originalCollegeTotal: originalCollegeTotals.get(`${group.year}|${originalCollegeName}`),
      }),
    );
  }

  const collegeIndex = new Map(currentCollegeOrder.map((collegeName, index) => [collegeName, index]));
  const catalogMajorIndex = new Map();
  for (const catalog of catalogs) {
    catalog.majors.forEach((major, index) => catalogMajorIndex.set(`${catalog.collegeId}|${major.id}`, index));
  }
  history.sort((a, b) => {
    const collegeDifference =
      (collegeIndex.get(a.scope.collegeName) ?? Number.MAX_SAFE_INTEGER) -
      (collegeIndex.get(b.scope.collegeName) ?? Number.MAX_SAFE_INTEGER);
    if (collegeDifference) return collegeDifference;
    const majorDifference =
      (catalogMajorIndex.get(`${a.scope.collegeId}|${a.scope.majorId}`) ?? Number.MAX_SAFE_INTEGER) -
      (catalogMajorIndex.get(`${b.scope.collegeId}|${b.scope.majorId}`) ?? Number.MAX_SAFE_INTEGER);
    if (majorDifference) return majorDifference;
    const nameDifference = String(a.scope.majorName).localeCompare(String(b.scope.majorName), "zh-CN");
    if (nameDifference) return nameDifference;
    return b.graduationYear - a.graduationYear;
  });

  for (const year of Object.keys(sourcesByYear).map(Number)) {
    const numericTotal = history
      .filter((record) => record.graduationYear === year && record.recommendedCount != null)
      .reduce((sum, record) => sum + record.recommendedCount, 0);
    invariant(numericTotal === sourcesByYear[year].total, `${year}届专业历史合计应为${sourcesByYear[year].total}，实际${numericTotal}。`);
  }

  const latestYear = 2026;
  const latestRows = rowsByYear[latestYear];
  const latestCurrentCollegeTotals = new Map();
  for (const row of latestRows) {
    const currentCollegeName = currentCollegeNameFor(row);
    latestCurrentCollegeTotals.set(currentCollegeName, (latestCurrentCollegeTotals.get(currentCollegeName) || 0) + 1);
  }

  const colleges = catalogs.map((college) => {
    const collegeHistory = history.filter(
      (record) => record.graduationYear === latestYear && record.scope.collegeId === college.collegeId,
    );
    const recommendedCount = latestCurrentCollegeTotals.get(college.collegeName) || 0;
    const numericMajorTotal = collegeHistory.reduce(
      (sum, record) => sum + (record.recommendedCount == null ? 0 : record.recommendedCount),
      0,
    );
    invariant(
      numericMajorTotal === recommendedCount,
      `${latestYear}届${college.collegeName}专业合计应为${recommendedCount}，实际${numericMajorTotal}。`,
    );

    const summaryMajors = collegeHistory.map(historyToSummaryMajor);
    const representedMajorIds = new Set(summaryMajors.map((major) => major.majorId));
    for (const major of college.majors.filter((candidate) => candidate.status === "active")) {
      if (!representedMajorIds.has(major.id)) summaryMajors.push(buildUnavailableSummaryMajor(latestYear, college, major));
    }
    summaryMajors.sort((a, b) => {
      const leftIndex = catalogMajorIndex.get(`${college.collegeId}|${a.majorId}`) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = catalogMajorIndex.get(`${college.collegeId}|${b.majorId}`) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      return String(a.majorName).localeCompare(String(b.majorName), "zh-CN");
    });

    return {
      scope: makeScope(college),
      collegeId: college.collegeId,
      collegeName: college.collegeName,
      year: latestYear,
      recommendationQuota: null,
      recommendedCount,
      countMethod: "official-list-count",
      containsWaitlist: false,
      cohortSize: null,
      recommendationRate: null,
      rateStatus: "unavailable",
      rateUnavailableReason: unavailableRateReason,
      majors: summaryMajors,
      sources: [
        makeSummarySource(
          latestYear,
          recommendedCount,
          `官方名单中${college.collegeName}记录计数为${recommendedCount}人。`,
        ),
      ],
    };
  });

  invariant(colleges.length === 9, `推免学院汇总应为9个，实际${colleges.length}个。`);
  invariant(
    colleges.reduce((sum, college) => sum + college.recommendedCount, 0) === sourcesByYear[latestYear].total,
    "2026届学院汇总人数与学校总人数不一致。",
  );

  const schoolData = readJson(schoolDataPath);
  const preserved = {
    policies: JSON.stringify(schoolData.policies),
    rankingRules: JSON.stringify(schoolData.rankingRules),
    bonusRules: JSON.stringify(schoolData.bonusRules),
  };

  schoolData.recommendationData = {
    schoolLevel: {
      scope: makeScope(null),
      year: latestYear,
      recommendationQuota: null,
      recommendedCount: sourcesByYear[latestYear].total,
      countMethod: "official-list-count",
      containsWaitlist: false,
      cohortSize: null,
      recommendationRate: null,
      rateStatus: "unavailable",
      rateUnavailableReason: unavailableRateReason,
      sources: [
        makeSummarySource(
          latestYear,
          sourcesByYear[latestYear].total,
          `上海海洋大学${latestYear}届官方推免名单完整序号1—${sourcesByYear[latestYear].total}，共${sourcesByYear[latestYear].total}人。`,
        ),
      ],
    },
    colleges,
  };
  schoolData.majorRecommendationHistory = history;
  schoolData.accountingRecommendationHistory = history
    .filter((record) => record.scope.majorId === "major-f447fffcf5")
    .map((record) => JSON.parse(JSON.stringify(record)));

  invariant(JSON.stringify(schoolData.policies) === preserved.policies, "脚本不得修改 policies。" );
  invariant(JSON.stringify(schoolData.rankingRules) === preserved.rankingRules, "脚本不得修改 rankingRules。" );
  invariant(JSON.stringify(schoolData.bonusRules) === preserved.bonusRules, "脚本不得修改 bonusRules。" );
  invariant(
    history.every((record) => record.cohortSize === null && record.recommendationRate === null),
    "全校专业历史数据不得写入估算毕业生人数或推免率。",
  );
  invariant(
    schoolData.accountingRecommendationHistory.length === 3 &&
      schoolData.accountingRecommendationHistory.every(
        (record) => record.sourceLevel === "official" && record.cohortSize === null && record.recommendationRate === null,
      ),
    "accountingRecommendationHistory 必须兼容保留3届会计学官方人数，且不得保留估算率。",
  );
  invariant(
    colleges.some((college) =>
      college.majors.some((major) => major.majorName === "人工智能" && major.dataAvailabilityNote),
    ),
    "人工智能必须包含 dataAvailabilityNote。",
  );
  invariant(
    colleges.some((college) =>
      college.majors.some((major) => major.majorName === "环境科学与工程" && major.dataAvailabilityNote),
    ),
    "环境科学与工程必须包含 dataAvailabilityNote。",
  );

  fs.writeFileSync(schoolDataPath, `${JSON.stringify(schoolData, null, 2)}\n`, "utf8");
  readJson(schoolDataPath);

  console.log(
    `已生成${schoolName}推免数据：${colleges.length}个学院，${history.length}条专业年度记录，官方名单总数2024/2025/2026=${Object.values(
      sourcesByYear,
    )
      .map((source) => source.total)
      .join("/")}。`,
  );
}

main();
