import * as cheerio from "cheerio";

const actionTextPattern = /(进入官网|查看更多|更多|查看详情|详情|点击进入|English|EN)$/;
const likelyUnitPattern = /(学院|学部|系|研究院|研究所|书院|研究中心|实验室|中心)$/;

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

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

function cleanCandidateName(text) {
  return compactText(text)
    .replace(actionTextPattern, "")
    .replace(/^[\d一二三四五六七八九十]+[、.．\s-]*/, "")
    .trim();
}

function looksLikeUnit(name) {
  if (!name || name.length < 2 || name.length > 40) return false;
  if (/首页|新闻|通知|公告|招生|招聘|下载|登录|邮箱|English|EN/i.test(name)) return false;
  return likelyUnitPattern.test(name) || /学院|学部|研究院|研究中心|实验室/.test(name);
}

function candidateFromElement($, element, sourceUrl, context = "") {
  const $element = $(element);
  const name = cleanCandidateName($element.text());
  if (!looksLikeUnit(name)) return null;

  const linkElement = $element.is("a") ? $element : $element.find("a").first();
  const url = resolveUrl(linkElement.attr("href"), sourceUrl);
  return {
    name,
    url,
    depth: $element.parents().length,
    section: context,
    rawText: compactText($element.text()),
    sourceUrl,
  };
}

export function parseAcademicUnits({ html, sourceUrl }) {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const candidates = [];
  const selectors = [
    "main a",
    ".content a",
    ".main a",
    ".container a",
    "article a",
    "ul li a",
    "table td a",
    ".card a",
    ".list a",
    ".nav a",
    "select option",
  ];

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const context = compactText(
        $(element)
          .parents("section, article, div")
          .first()
          .find("h1,h2,h3,.title,.hd")
          .first()
          .text(),
      );
      const candidate = candidateFromElement($, element, sourceUrl, context);
      if (candidate) candidates.push(candidate);
    });
  }

  $("td, li, .card, .item, .list-item").each((_, element) => {
    const candidate = candidateFromElement($, element, sourceUrl, "");
    if (candidate) candidates.push(candidate);
  });

  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.name}|${candidate.url}|${candidate.sourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
