import * as cheerio from "cheerio";

const actionTextPattern = /(进入官网|查看更多|更多|查看详情|详情|点击进入|English|EN)$/i;
const negativeTextPattern = /首页|新闻|通知|公告|招聘|下载|登录|邮箱|English|EN|更多|详情|信息公开|联系我们/i;
const likelyUnitPattern = /(学院|学部|系|研究院|研究所|书院|研究中心|实验室)$/;

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
  if (!name || name.length < 2 || name.length > 50) return false;
  if (negativeTextPattern.test(name)) return false;
  if (/^(院系|学院|学部|教学单位|教学科研单位|组织机构)$/.test(name)) return true;
  return likelyUnitPattern.test(name) || /学院|学部|研究院|研究中心|实验室/.test(name);
}

function getPageTitle($) {
  return compactText($("h1").first().text()) || compactText($("title").first().text());
}

function getContext($, element) {
  return compactText(
    $(element)
      .parents("section, article, div, table")
      .first()
      .find("h1,h2,h3,h4,.title,.hd,.tit,.column-title")
      .first()
      .text(),
  );
}

function candidateFromElement($, element, sourceUrl, pageTitle, context = "") {
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
    pageTitle,
    rawText: compactText($element.text()),
    sourceUrl,
    fetchedAt: new Date().toISOString(),
  };
}

export function parseAcademicUnits({ html, sourceUrl }) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();

  const candidates = [];
  const pageTitle = getPageTitle($);
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
    ".menu a",
    ".subnav a",
    "select option",
  ];

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const candidate = candidateFromElement($, element, sourceUrl, pageTitle, getContext($, element));
      if (candidate) candidates.push(candidate);
    });
  }

  $("td, li, .card, .item, .list-item, .wp_article_list_table .list_item").each((_, element) => {
    const candidate = candidateFromElement($, element, sourceUrl, pageTitle, getContext($, element));
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
