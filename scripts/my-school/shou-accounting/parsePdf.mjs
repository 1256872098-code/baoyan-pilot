import { parseRecommendationPdf } from "../parseRecommendationPdf.mjs";

export async function parsePdfSource(source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "BaoyanPilot SHOU accounting crawler (official public pages only)",
    },
  });
  if (!response.ok) throw new Error(`PDF抓取失败：HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return parseRecommendationPdf({
    buffer,
    url: source.url,
    source: {
      name: source.title,
      title: source.title,
      url: source.url,
      sourceType: source.sourceType,
      sourceOrganization: source.organization,
      year: source.graduationYear,
      sourceLevel: source.sourceLevel,
    },
  });
}
