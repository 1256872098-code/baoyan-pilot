import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("行政管理与文化产业管理的 2024 届展示 missing 占位而不是 0", () => {
  ["行政管理", "文化产业管理"].forEach((majorName) => {
    const major = activeMajors.find((item) => item.name === majorName);
    assert.ok(major, `${majorName}应属于在招专业`);

    const matched = getMatchedRecommendationData(schoolData, createBinding(major));
    assert.equal(
      matched.recommendationHistory.some((row) => row.graduationYear === 2024),
      false,
      `${majorName}不应伪造 2024 届原始记录`,
    );

    const cards = getLatestThreeRecommendationYears(matched.recommendationHistory);
    const row2024 = cards.find((row) => row.graduationYear === 2024);
    assert.ok(row2024, `${majorName}应补出 2024 届展示占位`);
    assert.equal(row2024.dataStatus, "missing");
    assert.equal(row2024.recommendedCount, undefined);
    assert.notEqual(row2024.recommendedCount, 0);
    assert.equal(row2024.recommendationRate, undefined);
  });
});
