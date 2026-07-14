import { parseRecommendationHtml } from "./parseRecommendationHtml.mjs";
import { parseRecommendationPdf } from "./parseRecommendationPdf.mjs";
import { parseRecommendationSpreadsheet } from "./parseRecommendationSpreadsheet.mjs";
import { normalizeWhitespace } from "./common.mjs";

async function parseDocx({ buffer, url, source }) {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return {
      ...source,
      url,
      title: source.name || "",
      text: normalizeWhitespace(result.value || ""),
      tables: [],
      attachments: [],
      contentType: "docx",
    };
  } catch {
    return {
      ...source,
      url,
      title: source.name || "",
      text: "",
      tables: [],
      attachments: [],
      contentType: "docx",
      parseError: "当前环境未安装 mammoth，已保留官方附件链接并进入人工复核。",
    };
  }
}

function inferKind(url, contentType) {
  if (/pdf/i.test(contentType) || /\.pdf(\?|$)/i.test(url)) return "pdf";
  if (/spreadsheet|excel/i.test(contentType) || /\.(xlsx?|xls)(\?|$)/i.test(url)) return "spreadsheet";
  if (/word|officedocument/i.test(contentType) || /\.docx?(\?|$)/i.test(url)) return "docx";
  return "html";
}

export async function fetchRecommendationSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  const response = await fetch(source.url, {
    signal: controller.signal,
    headers: {
      "User-Agent": "BaoyanPilot data crawler (planning reference; contact site owner if needed)",
    },
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const kind = inferKind(source.url, contentType);

  if (kind === "html") {
    const html = await response.text();
    const parsed = parseRecommendationHtml({ html, url: source.url, source });
    const parsedAttachments = [];
    for (const attachment of parsed.attachments) {
      try {
        parsedAttachments.push(
          await fetchRecommendationSource({
            ...source,
            name: attachment.title,
            url: attachment.url,
            parentUrl: source.url,
            parentTitle: parsed.title,
            sourceType: source.sourceType,
            year: source.year,
          }),
        );
      } catch (error) {
        parsedAttachments.push({
          ...source,
          name: attachment.title,
          url: attachment.url,
          parentUrl: source.url,
          contentType: "attachment",
          parseError: error.message,
        });
      }
    }
    return { ...parsed, parsedAttachments };
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (kind === "pdf") return parseRecommendationPdf({ buffer, url: source.url, source });
  if (kind === "spreadsheet") return parseRecommendationSpreadsheet({ buffer, url: source.url, source });
  return parseDocx({ buffer, url: source.url, source });
}
