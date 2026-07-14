import { parseRecommendationHtml } from "../parseRecommendationHtml.mjs";

export async function parseHtmlSource(source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "BaoyanPilot SHOU accounting crawler (public pages only)",
    },
  });
  if (!response.ok) throw new Error(`HTML抓取失败：HTTP ${response.status}`);
  return parseRecommendationHtml({
    html: await response.text(),
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
