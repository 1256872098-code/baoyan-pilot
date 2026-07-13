import * as cheerio from "cheerio";

const linkKeywords = [
  "院系设置",
  "学院设置",
  "教学单位",
  "教学科研单位",
  "学部院系",
  "院系导航",
  "组织机构",
  "招生单位",
  "培养单位",
];

const sitemapKeywords = [
  "college",
  "school",
  "department",
  "faculty",
  "institute",
  "academics",
  "organization",
  "院系",
  "学院",
  "教学单位",
  "组织机构",
];

function resolveUrl(href, baseUrl) {
  if (!href || href.startsWith("javascript:") || href.startsWith("#")) {
    return "";
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

async function fetchText(url, { signal } = {}) {
  const response = await fetch(url, {
    signal,
    headers: {
      "User-Agent": "BaoyanPilotBot/0.1 academic unit discovery",
      Accept: "text/html,application/xhtml+xml,application/xml,text/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

async function fetchIfAvailable(url, options) {
  try {
    return await fetchText(url, options);
  } catch {
    return "";
  }
}

function extractHomepageCandidates(html, baseUrl) {
  const $ = cheerio.load(html);
  const candidates = [];

  $("a").each((_, element) => {
    const text = $(element).text().replace(/\s+/g, "").trim();
    const href = resolveUrl($(element).attr("href"), baseUrl);
    if (!href) return;

    const matchedKeyword = linkKeywords.find((keyword) => text.includes(keyword));
    if (!matchedKeyword) return;

    candidates.push({
      name: text || matchedKeyword,
      url: href,
      sourceType: matchedKeyword.includes("招生") || matchedKeyword.includes("培养") ? "graduate-admissions-units" : "academic-units",
      confidence: text === matchedKeyword ? 0.9 : 0.75,
      reason: `首页链接匹配：${matchedKeyword}`,
    });
  });

  return candidates;
}

function extractSitemapCandidates(xml, baseUrl) {
  const urls = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => match[1].trim());
  return urls
    .filter((url) => sitemapKeywords.some((keyword) => url.toLowerCase().includes(keyword.toLowerCase())))
    .map((url) => ({
      name: "站点地图候选页",
      url: resolveUrl(url, baseUrl),
      sourceType: "academic-units",
      confidence: 0.55,
      reason: "sitemap 关键词匹配",
    }))
    .filter((candidate) => candidate.url);
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
}

export async function discoverUnitPages(sourceGroup, { signal } = {}) {
  if (!sourceGroup.officialWebsite) {
    return {
      selected: [],
      needsReview: [],
      reason: "缺少学校官网，无法发现院系目录页。",
    };
  }

  const homepage = await fetchText(sourceGroup.officialWebsite, { signal });
  const candidates = extractHomepageCandidates(homepage, sourceGroup.officialWebsite);

  for (const sitemapPath of ["/sitemap.xml", "/sitemap_index.xml"]) {
    const sitemapUrl = new URL(sitemapPath, sourceGroup.officialWebsite).toString();
    const xml = await fetchIfAvailable(sitemapUrl, { signal });
    if (xml) candidates.push(...extractSitemapCandidates(xml, sourceGroup.officialWebsite));
  }

  const deduped = dedupeCandidates(candidates).sort((a, b) => b.confidence - a.confidence);
  const highConfidence = deduped.filter((candidate) => candidate.confidence >= 0.85);

  if (highConfidence.length === 1) {
    return {
      selected: highConfidence,
      needsReview: deduped.filter((candidate) => candidate.url !== highConfidence[0].url),
      reason: "发现唯一高置信院系目录页。",
    };
  }

  return {
    selected: [],
    needsReview: deduped,
    reason: deduped.length ? "无法确定唯一高置信院系目录页。" : "未发现院系目录候选页。",
  };
}
