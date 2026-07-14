import { normalizeWhitespace } from "./common.mjs";

export async function parseRecommendationSpreadsheet({ buffer, url, source }) {
  let xlsx;
  try {
    xlsx = await import("xlsx");
  } catch {
    return {
      ...source,
      url,
      title: source.name || "",
      text: "",
      tables: [],
      attachments: [],
      contentType: "spreadsheet",
      parseError: "当前环境未安装 xlsx，已保留官方附件链接并进入人工复核。",
    };
  }

  const workbook = xlsx.read(buffer, { type: "buffer" });
  const tables = workbook.SheetNames.map((sheetName) => {
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
    return rows.map((row) => row.map((cell) => normalizeWhitespace(cell)));
  }).filter((rows) => rows.length);
  const text = tables.flat(2).filter(Boolean).join(" ");

  return {
    ...source,
    url,
    title: source.name || "",
    text,
    tables,
    attachments: [],
    contentType: "spreadsheet",
  };
}
