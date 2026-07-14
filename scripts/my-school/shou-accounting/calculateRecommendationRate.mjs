export function calculateRecommendationRate(item) {
  if (!item || item.recommendedCount == null || item.cohortSize == null) {
    return {
      ...item,
      recommendationRate: null,
      calculationMethod: null,
    };
  }

  if (item.cohortSize <= 0 || item.recommendedCount > item.cohortSize) {
    return {
      ...item,
      recommendationRate: null,
      calculationMethod: null,
      dataStatus: "manual-review",
    };
  }

  return {
    ...item,
    recommendationRate: item.recommendedCount / item.cohortSize,
    calculationMethod: `推免人数${item.recommendedCount}人 ÷ 同届会计学本科毕业生人数${item.cohortSize}人`,
  };
}
