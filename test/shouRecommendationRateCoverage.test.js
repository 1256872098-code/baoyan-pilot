import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schoolData = JSON.parse(
  readFileSync(
    new URL("../public/data/my-school/school-f17pfd.json", import.meta.url),
    "utf8",
  ),
);

const ACCOUNTING_MAJOR_ID = "major-f447fffcf5";
const AI_MAJOR_ID = "major-b1b51770b2";

function assertHttpUrl(value, message) {
  assert.match(value || "", /^https?:\/\//, message);
}

function findMajorSummary(majorId) {
  return (schoolData.recommendationData?.colleges || [])
    .flatMap((college) => college.majors || [])
    .find((major) => major.majorId === majorId);
}

test("every SHOU major history row with an official numerator has a traceable denominator and rate", () => {
  const historyWithCounts = (schoolData.majorRecommendationHistory || []).filter(
    (row) => Number.isFinite(row.recommendedCount),
  );

  assert.ok(historyWithCounts.length > 0, "expected official major recommendation history");

  historyWithCounts.forEach((row) => {
    const label = `${row.scope?.collegeName || "unknown college"} / ${
      row.scope?.majorName || "unknown major"
    } / ${row.graduationYear || "unknown year"}`;

    assert.ok(row.recommendedCount > 0, `${label}: numerator must be positive`);
    assert.equal(
      row.recommendedCountSourceLevel,
      "official",
      `${label}: recommendation count must remain official`,
    );
    assert.equal(
      row.numeratorSourceLevel,
      "official",
      `${label}: numerator source must remain official`,
    );

    assert.ok(Number.isFinite(row.cohortSize), `${label}: cohortSize must be numeric`);
    assert.ok(row.cohortSize > 0, `${label}: cohortSize must be positive`);
    assert.ok(
      row.cohortSize >= row.recommendedCount,
      `${label}: denominator cannot be smaller than numerator`,
    );

    assert.ok(
      Number.isFinite(row.recommendationRate),
      `${label}: recommendationRate must be numeric`,
    );
    assert.ok(
      row.recommendationRate > 0 && row.recommendationRate <= 1,
      `${label}: recommendationRate must be in (0, 1]`,
    );
    assert.equal(
      row.recommendationRate,
      Number((row.recommendedCount / row.cohortSize).toFixed(6)),
      `${label}: rate must equal official numerator divided by recorded denominator`,
    );

    assert.ok(row.denominatorSourceLevel, `${label}: denominator source level is required`);
    assert.ok(row.denominatorMethod, `${label}: denominator method is required`);
    assert.ok(row.denominatorEvidence, `${label}: denominator evidence is required`);
    assertHttpUrl(row.denominatorSource, `${label}: denominator source URL is required`);
    assert.ok(
      (row.sources || []).some(
        (source) => (source.url || source.sourceUrl) === row.denominatorSource,
      ),
      `${label}: denominator source must be present in the auditable sources list`,
    );
    assert.ok(
      row.rateStatus === "official" || row.rateStatus === "estimated",
      `${label}: rateStatus must disclose whether the denominator is official or estimated`,
    );
  });
});

test("the new artificial-intelligence major does not fabricate recommendation history", () => {
  const aiHistory = (schoolData.majorRecommendationHistory || []).filter(
    (row) => row.scope?.majorId === AI_MAJOR_ID,
  );
  const aiSummary = findMajorSummary(AI_MAJOR_ID);

  assert.deepEqual(aiHistory, []);
  assert.ok(aiSummary, "expected the artificial-intelligence major in the catalog summary");
  assert.equal(aiSummary.recommendedCount, null);
  assert.equal(aiSummary.cohortSize, null);
  assert.equal(aiSummary.recommendationRate, null);
  assert.equal(aiSummary.rateStatus, "unavailable");
});

test("accounting keeps the audited 2024-2026 numerator and denominator values", () => {
  const accountingHistory = (schoolData.majorRecommendationHistory || []).filter(
    (row) => row.scope?.majorId === ACCOUNTING_MAJOR_ID,
  );
  const expectedByYear = new Map([
    [2024, { recommendedCount: 5, cohortSize: 108 }],
    [2025, { recommendedCount: 6, cohortSize: 116 }],
    [2026, { recommendedCount: 9, cohortSize: 116 }],
  ]);

  assert.equal(accountingHistory.length, expectedByYear.size);
  accountingHistory.forEach((row) => {
    const expected = expectedByYear.get(row.graduationYear);
    assert.ok(expected, `unexpected accounting history year ${row.graduationYear}`);
    assert.equal(row.recommendedCount, expected.recommendedCount);
    assert.equal(row.cohortSize, expected.cohortSize);
    assert.equal(
      row.recommendationRate,
      Number((expected.recommendedCount / expected.cohortSize).toFixed(6)),
    );
  });
});

test("2026 school-level rate uses the official expected-graduate denominator", () => {
  const schoolLevel = schoolData.recommendationData?.schoolLevel;

  assert.equal(schoolLevel?.year, 2026);
  assert.equal(schoolLevel?.recommendedCount, 359);
  assert.equal(schoolLevel?.recommendedCountSourceLevel, "official");
  assert.equal(schoolLevel?.cohortSize, 2774);
  assert.equal(schoolLevel?.denominatorMethod, "official-school-expected-graduates");
  assert.equal(schoolLevel?.recommendationRate, Number((359 / 2774).toFixed(6)));
  assertHttpUrl(schoolLevel?.denominatorSource, "school denominator source URL is required");
  assert.ok(schoolLevel?.denominatorEvidence, "school denominator evidence is required");
});
