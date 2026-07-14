import { calculateRecommendationRate } from "./calculateRecommendationRate.mjs";

export function normalizeAccountingData({ counts, policies, ids }) {
  const history = counts
    .map((item) => calculateRecommendationRate(item))
    .sort((a, b) => b.graduationYear - a.graduationYear);

  return {
    accountingRecommendationHistory: history.map((item) => ({
      ...item,
      scope: {
        schoolId: ids.school.id,
        collegeId: ids.college.id,
        collegeName: "经济管理学院",
        majorId: ids.majorId,
        majorName: "会计学",
        appliesToAllColleges: false,
        appliesToAllMajors: false,
      },
    })),
    policyBundle: policies,
  };
}
