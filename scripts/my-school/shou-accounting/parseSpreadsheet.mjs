import { parseRecommendationSpreadsheet } from "../parseRecommendationSpreadsheet.mjs";

export async function parseSpreadsheetSource(source) {
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`表格抓取失败：HTTP ${response.status}`);
  return parseRecommendationSpreadsheet({
    buffer: Buffer.from(await response.arrayBuffer()),
    url: source.url,
    source,
  });
}
