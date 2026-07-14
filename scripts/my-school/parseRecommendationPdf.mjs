import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cacheDir, normalizeWhitespace, sha256 } from "./common.mjs";
import { inferPublishedAt, inferSourceOrganization } from "./parseRecommendationHtml.mjs";

const execFileAsync = promisify(execFile);

async function findPdfToText() {
  const candidates = [
    "pdftotext",
    "C:/texlive/2024/bin/windows/pdftotext.exe",
  ];
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ["-v"]);
    } catch (error) {
      const output = `${error.stderr || ""}${error.stdout || ""}`;
      if (/pdftotext|version/i.test(output) || error.code === 99) return candidate;
      continue;
    }
    return candidate;
  }
  throw new Error("未找到 pdftotext，无法解析 PDF 正文。");
}

export async function parseRecommendationPdf({ buffer, url, source }) {
  const pdfToText = await findPdfToText();
  const dir = path.join(cacheDir, "attachments");
  await fs.mkdir(dir, { recursive: true });
  const base = sha256(url).slice(0, 16);
  const pdfPath = path.join(dir, `${base}.pdf`);
  const textPath = path.join(dir, `${base}.txt`);
  await fs.writeFile(pdfPath, buffer);
  await execFileAsync(pdfToText, ["-layout", "-enc", "UTF-8", pdfPath, textPath], { timeout: 60000 });
  const text = await fs.readFile(textPath, "utf8");
  const normalized = normalizeWhitespace(text);

  return {
    ...source,
    url,
    title: source.name || source.title || "",
    publishedAt: source.publishedAt || inferPublishedAt(normalized),
    sourceOrganization: inferSourceOrganization(url, normalized),
    text: normalized,
    rawText: text,
    tables: [],
    attachments: [],
    contentType: "pdf",
    cachePath: textPath,
  };
}
