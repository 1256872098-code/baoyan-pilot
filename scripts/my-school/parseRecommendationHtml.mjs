import * as cheerio from "cheerio";
import { normalizeWhitespace } from "./common.mjs";

function absoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return "";
  }
}

export function inferSourceOrganization(url, text = "") {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (host.startsWith("jmxy.")) return "上海海洋大学经济管理学院";
  if (host.startsWith("jwc.")) return "上海海洋大学教务处";
  if (host.startsWith("yjs.")) return "上海海洋大学研究生院";
  if (host.startsWith("xxgk.")) return "上海海洋大学信息公开网";
  if (/经济管理学院/.test(text)) return "上海海洋大学经济管理学院";
  return "上海海洋大学";
}

export function inferPublishedAt(text = "") {
  const match =
    String(text).match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/) ||
    String(text).match(/发布时间[:：]?\s*(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return null;
  return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

export function parseRecommendationHtml({ html, url, source }) {
  const $ = cheerio.load(html);
  $("script, style, iframe").remove();
  const title = normalizeWhitespace($("meta[property='og:title']").attr("content") || $("title").first().text() || source.name || "");
  const bodyText = normalizeWhitespace($("body").text());
  const publishedAt = inferPublishedAt(bodyText);
  const attachments = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") || "";
    const label = normalizeWhitespace($(element).text());
    const resolved = absoluteUrl(href, url);
    if (!resolved) return;
    if (/\.(pdf|docx?|xlsx?|xls)(\?|$)/i.test(resolved)) {
      attachments.push({
        title: label || resolved.split("/").pop(),
        url: resolved,
      });
    }
  });

  const tables = [];
  $("table").each((_, table) => {
    const rows = [];
    $(table)
      .find("tr")
      .each((__, row) => {
        const cells = [];
        $(row)
          .find("th,td")
          .each((___, cell) => cells.push(normalizeWhitespace($(cell).text())));
        if (cells.length) rows.push(cells);
      });
    if (rows.length) tables.push(rows);
  });

  return {
    ...source,
    url,
    title,
    publishedAt: source.publishedAt || publishedAt,
    sourceOrganization: inferSourceOrganization(url, bodyText),
    text: bodyText,
    tables,
    attachments,
    contentType: "html",
  };
}
