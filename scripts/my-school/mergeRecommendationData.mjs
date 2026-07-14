import { getOutputPath, readJson, writeJsonAtomic } from "./common.mjs";
import { validateRecommendationData } from "./validateRecommendationData.mjs";

export async function mergeRecommendationData({ schoolId, nextData }) {
  const outputPath = getOutputPath(schoolId);
  const current = await readJson(outputPath, null);
  const validation = validateRecommendationData(nextData);

  if (current && nextData?.recommendationData?.schoolLevel?.recommendedCount == null) {
    throw new Error("新抓取结果缺少有效推荐名单计数，已阻止覆盖旧数据。");
  }

  await writeJsonAtomic(outputPath, nextData, { backup: Boolean(current) });
  return {
    outputPath,
    validation,
  };
}
