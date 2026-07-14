import * as cheerio from "cheerio";
import { createUnitId } from "./normalizeAcademicUnits.mjs";

const unitPattern = /(学院|学部|系|研究院|研究所|培养单位|招生单位)$/;
const negativePattern = /(专业|方向|考试科目|参考书|拟招生|推免|复试|初试|备注|代码|人数)$/;

function compactText(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function cleanName(value) {
  return compactText(value)
    .replace(/^\d{2,6}\s*/, "")
    .replace(/^[（(]?\d+[）)]?/, "")
    .replace(/[:：].*$/, "")
    .trim();
}

function inferUnitType(name) {
  if (name.includes("学部")) return "学部";
  if (name.endsWith("系")) return "系";
  if (name.includes("研究院") || name.includes("研究所")) return "研究院";
  if (name.includes("学院")) return "学院";
  if (name.includes("中心")) return "研究中心";
  return "其他";
}

function isLikelyAdmissionUnit(name) {
  if (!name || name.length < 2 || name.length > 50) return false;
  if (negativePattern.test(name)) return false;
  return unitPattern.test(name) || /(学院|学部|研究院|研究所|培养单位|招生单位)/.test(name);
}

function toUnit({ name, sourceUrl, year }) {
  return {
    id: createUnitId(name),
    name,
    unitType: inferUnitType(name),
    aliases: [],
    officialWebsite: "",
    sourceUrl,
    sourceYear: year || null,
    graduateAdmissionsRelevant: true,
    dataStatus: "pending-review",
    confidence: 0.55,
    lastCheckedAt: new Date().toISOString(),
  };
}

export function parseGraduateAdmissionUnits({ html, sourceUrl, year = null }) {
  const $ = cheerio.load(html || "");
  $("script, style, noscript, svg").remove();
  const candidates = [];

  $("table tr").each((_, row) => {
    const cells = $(row)
      .find("th,td")
      .map((__, cell) => compactText($(cell).text()))
      .get();
    for (const cell of cells.slice(0, 3)) {
      const name = cleanName(cell);
      if (isLikelyAdmissionUnit(name)) candidates.push(toUnit({ name, sourceUrl, year }));
    }
  });

  $("li, p, div").each((_, element) => {
    const text = compactText($(element).text());
    if (text.length > 80) return;
    const name = cleanName(text);
    if (isLikelyAdmissionUnit(name)) candidates.push(toUnit({ name, sourceUrl, year }));
  });

  return [...new Map(candidates.map((unit) => [unit.name, unit])).values()];
}

