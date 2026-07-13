import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");
const rawCacheDir = path.join(rootDir, "scripts", "cache", "raw");

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function stripHtml(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(nav|footer|aside|header)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractTitle(html, fallback) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = h1 || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return stripHtml(title || fallback || "");
}

function extractPublishedAt(text) {
  const match = text.match(/(20\d{2}[年/-]\d{1,2}[月/-]\d{1,2}日?)/);
  return match?.[1] || null;
}

async function cacheRawHtml(source, html) {
  await fs.mkdir(rawCacheDir, { recursive: true });
  const safeName = `${source.schoolId || "school"}-${source.collegeId || "college"}-${Date.now()}.html`;
  await fs.writeFile(path.join(rawCacheDir, safeName), html, "utf8");
}

export async function crawlStaticPage(source, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "BaoyanPilotBot/0.1 (+https://baoyanpilot.local; planning prototype)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    await cacheRawHtml(source, html);
    const body = stripHtml(html);

    return {
      title: extractTitle(html, source.name),
      body,
      publishedAt: extractPublishedAt(body),
      source,
      fetchedAt: new Date().toISOString(),
      strategy: "static-fetch",
    };
  } finally {
    clearTimeout(timer);
  }
}
