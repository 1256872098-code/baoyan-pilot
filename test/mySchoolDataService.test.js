import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  getLatestThreeRecommendationYears,
  getMatchedRecommendationData,
} from "../src/services/mySchoolDataService.js";

const schoolData = JSON.parse(
  readFileSync(new URL("../public/data/my-school/school-f17pfd.json", import.meta.url), "utf8"),
);
const majorCatalog = JSON.parse(
  readFileSync(
    new URL(
      "../public/data/college-majors/school-f17pfd/unit-56716fffbe.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const allMajorCatalogs = readdirSync(
  new URL("../public/data/college-majors/school-f17pfd/", import.meta.url),
)
  .filter((fileName) => fileName.endsWith(".json"))
  .map((fileName) =>
    JSON.parse(
      readFileSync(
        new URL(`../public/data/college-majors/school-f17pfd/${fileName}`, import.meta.url),
        "utf8",
      ),
    ),
  );

const SCHOOL_ID = "school-f17pfd";
const COLLEGE_ID = "unit-56716fffbe";
const COLLEGE_NAME = "经济管理学院";

const expectedRecommendedCounts = {
  农林经济管理: 5,
  会计学: 9,
  金融学: 9,
  国际经济与贸易: 7,
  物流管理: 6,
  工商管理: 6,
  行政管理: 8,
  文化产业管理: 2,
};

const activeMajors = majorCatalog.majors.filter((major) => major.status !== "inactive");

function createBinding(major, graduationYear = 2026) {
  return {
    schoolId: SCHOOL_ID,
    schoolName: "上海海洋大学",
    collegeId: COLLEGE_ID,
    collegeName: COLLEGE_NAME,
    majorId: major.id,
    majorName: major.name,
    graduationYear,
  };
}

function createCatalogBinding(catalog, major, graduationYear = 2026) {
  return {
    schoolId: SCHOOL_ID,
    schoolName: "上海海洋大学",
    collegeId: catalog.collegeId,
    collegeName: catalog.collegeName,
    majorId: major.id,
    majorName: major.name,
    graduationYear,
  };
}

function getSourceUrl(source) {
  return source?.url || source?.sourceUrl || "";
}

function assertHasSourceUrl(sources, message) {
  assert.ok(Array.isArray(sources) && sources.length > 0, `${message}应包含来源`);
  sources.forEach((source) => {
    assert.match(getSourceUrl(source), /^https?:\/\//, `${message}应包含有效来源 URL`);
  });
}

test("上海海洋大学经管学院 8 个在招专业均能准确匹配 2026 推免人数且历史记录不串专业", () => {
  assert.deepEqual(
    activeMajors.map((major) => major.name).sort(),
    Object.keys(expectedRecommendedCounts).sort(),
  );

  activeMajors.forEach((major) => {
    const matched = getMatchedRecommendationData(schoolData, createBinding(major));
    const expectedCount = expectedRecommendedCounts[major.name];

    assert.ok(matched.major, `${major.name}应匹配到专业数据`);
    assert.equal(matched.major.majorId, major.id);
    assert.equal(matched.major.majorName, major.name);
    assert.equal(matched.major.recommendedCount, expectedCount);
    assertHasSourceUrl(matched.major.sources, `${major.name}专业摘要`);

    const row2026 = matched.recommendationHistory.find((row) => row.graduationYear === 2026);
    assert.ok(row2026, `${major.name}应包含 2026 届历史记录`);
    assert.equal(row2026.recommendedCount, expectedCount);
    assertHasSourceUrl(row2026.sources, `${major.name} 2026 届历史记录`);

    matched.recommendationHistory.forEach((row) => {
      assert.equal(row.scope?.majorId, major.id, `${major.name}不应混入其他专业 ID`);
      assert.equal(row.scope?.majorName, major.name, `${major.name}不应混入其他专业名称`);
    });
  });
});

test("绑定 2029 届时回退到最新 2027 政策、75-15-10 排名规则及仅 2027 加分项", () => {
  activeMajors.forEach((major) => {
    const matched = getMatchedRecommendationData(schoolData, createBinding(major, 2029));

    assert.equal(matched.policy?.year, 2027, `${major.name}应回退到 2027 届政策`);
    assertHasSourceUrl([matched.policy?.source], `${major.name} 2027 届政策`);

    assert.equal(matched.rankingRule?.year, 2027, `${major.name}应回退到 2027 届排名规则`);
    assert.equal(matched.rankingRule?.academicWeight, 0.75);
    assert.equal(matched.rankingRule?.researchWeight, 0.15);
    assert.equal(matched.rankingRule?.developmentWeight, 0.1);
    assert.match(matched.rankingRule?.formula || "", /75%.*15%.*10%/);
    assertHasSourceUrl([matched.rankingRule?.source], `${major.name} 2027 届排名规则`);

    assert.deepEqual(
      matched.bonusRules.map((rule) => rule.year),
      [2027, 2027],
      `${major.name}只应返回最新 2027 届加分项`,
    );
    assert.deepEqual(
      matched.bonusRules.map((rule) => rule.category).sort(),
      ["全面发展", "科研创新"].sort(),
    );
    matched.bonusRules.forEach((rule) => {
      assertHasSourceUrl([rule.source], `${major.name} ${rule.category}加分项`);
    });
  });
});

test("学院重组前的行政管理记录可追溯，文化产业管理缺失年份不伪造成 0", () => {
  const administration = activeMajors.find((item) => item.name === "行政管理");
  const administrationMatched = getMatchedRecommendationData(
    schoolData,
    createBinding(administration),
  );
  const administration2024 = administrationMatched.recommendationHistory.find(
    (row) => row.graduationYear === 2024,
  );
  assert.equal(administration2024?.recommendedCount, 7);
  assert.equal(administration2024?.originalCollegeName, "海洋文化与法律学院");

  const culturalIndustry = activeMajors.find((item) => item.name === "文化产业管理");
  const culturalMatched = getMatchedRecommendationData(
    schoolData,
    createBinding(culturalIndustry),
  );
  assert.equal(
    culturalMatched.recommendationHistory.some((row) => row.graduationYear === 2024),
    false,
  );

  const row2024 = getLatestThreeRecommendationYears(culturalMatched.recommendationHistory)
    .find((row) => row.graduationYear === 2024);
  assert.ok(row2024, "文化产业管理应补出 2024 届展示占位");
  assert.equal(row2024.dataStatus, "missing");
  assert.equal(row2024.recommendedCount, undefined);
  assert.notEqual(row2024.recommendedCount, 0);
  assert.equal(row2024.recommendationRate, undefined);
});

test("空历史不会伪造三张年份缺失卡", () => {
  assert.deepEqual(getLatestThreeRecommendationYears([]), []);
});

test("上海海洋大学全部本科培养学院的 active 专业均有专业摘要且不伪造推免率", () => {
  assert.equal(allMajorCatalogs.length, 9, "应覆盖 9 个本科培养学院");

  allMajorCatalogs.forEach((catalog) => {
    const activeCatalogMajors = catalog.majors.filter((major) => major.status !== "inactive");
    assert.ok(activeCatalogMajors.length > 0, `${catalog.collegeName}应包含 active 专业`);

    activeCatalogMajors.forEach((major) => {
      const matched = getMatchedRecommendationData(
        schoolData,
        createCatalogBinding(catalog, major),
      );

      assert.ok(matched.major, `${catalog.collegeName}${major.name}应有专业摘要`);
      assert.equal(matched.major.majorId, major.id);
      assert.equal(matched.major.majorName, major.name);
      assert.equal(
        matched.major.recommendationRate,
        null,
        `${catalog.collegeName}${major.name}摘要不得用异口径人数估算推免率`,
      );
      assert.equal(
        matched.major.cohortSize,
        null,
        `${catalog.collegeName}${major.name}摘要不得填入估算毕业生人数`,
      );

      if (matched.recommendationHistory.length === 0) {
        const mayLackSameNameHistory =
          major.name === "人工智能" || major.name === "环境科学与工程";
        assert.ok(
          mayLackSameNameHistory,
          `${catalog.collegeName}${major.name}应有同名官方历史记录`,
        );
        assert.ok(
          matched.major.dataAvailabilityNote,
          `${catalog.collegeName}${major.name}无同名历史时应说明数据可用性`,
        );
      } else {
        matched.recommendationHistory.forEach((row) => {
          assert.equal(row.scope?.majorId, major.id, `${major.name}历史记录不得串专业 ID`);
          assert.equal(row.scope?.majorName, major.name, `${major.name}历史记录不得串专业名称`);
        });
      }
    });
  });
});

test("所有专业历史仅保留官方推荐人数，毕业生人数与推免率均为空", () => {
  const history = [
    ...(schoolData.accountingRecommendationHistory || []),
    ...(schoolData.majorRecommendationHistory || []),
  ];
  assert.ok(history.length > 0, "应包含专业级历史数据");

  history.forEach((row) => {
    const label = `${row.scope?.collegeName || "未知学院"}${row.scope?.majorName || "未知专业"}${row.graduationYear || "未知届别"}`;
    assert.equal(row.sourceLevel, "official", `${label}应为官方名单计数`);
    assert.equal(row.cohortSize, null, `${label}不得保留估算毕业生人数`);
    assert.equal(row.recommendationRate, null, `${label}不得保留估算推免率`);
    assert.equal(row.isEstimated, false, `${label}不得标记为估算记录`);
    assertHasSourceUrl(row.sources, `${label}历史记录`);
  });
});

test("9 个本科培养学院绑定后均能匹配政策、排名规则和加分规则", () => {
  const collegeIds = new Set();

  allMajorCatalogs.forEach((catalog) => {
    collegeIds.add(catalog.collegeId);
    const major = catalog.majors.find((item) => item.status !== "inactive");
    const matched = getMatchedRecommendationData(
      schoolData,
      createCatalogBinding(catalog, major, 2029),
    );

    assert.ok(matched.policy, `${catalog.collegeName}应匹配推免政策`);
    assert.ok(matched.rankingRule, `${catalog.collegeName}应匹配综合排名规则`);
    assert.ok(matched.bonusRules.length > 0, `${catalog.collegeName}应匹配加分规则`);
    assertHasSourceUrl([matched.policy.source], `${catalog.collegeName}推免政策`);
    assertHasSourceUrl([matched.rankingRule.source], `${catalog.collegeName}排名规则`);
    matched.bonusRules.forEach((rule) => {
      assertHasSourceUrl([rule.source], `${catalog.collegeName}${rule.category || "加分"}规则`);
    });
  });

  assert.equal(collegeIds.size, 9);
});
