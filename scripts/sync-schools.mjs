import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  doubleFirstClassSchools,
  project211Schools,
  project985Schools,
} from "../src/data/schoolLevelMaps.js";
import { schools as existingSchools } from "../src/data/schools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputPath = path.join(rootDir, "public", "data", "schools.json");

const sourceUrl = "https://yz.chsi.com.cn/kyzx/kp/202509/20250918/2293427403.html";
const listYear = 2025;
const minimumSchoolCount = 400;

const provinceMap = {
  北京市: "北京",
  天津市: "天津",
  河北省: "河北",
  山西省: "山西",
  内蒙古自治区: "内蒙古",
  辽宁省: "辽宁",
  吉林省: "吉林",
  黑龙江省: "黑龙江",
  上海市: "上海",
  江苏省: "江苏",
  浙江省: "浙江",
  安徽省: "安徽",
  福建省: "福建",
  江西省: "江西",
  山东省: "山东",
  河南省: "河南",
  湖北省: "湖北",
  湖南省: "湖南",
  广东省: "广东",
  广西壮族自治区: "广西",
  海南省: "海南",
  重庆市: "重庆",
  四川省: "四川",
  贵州省: "贵州",
  云南省: "云南",
  西藏自治区: "西藏",
  陕西省: "陕西",
  甘肃省: "甘肃",
  青海省: "青海",
  宁夏回族自治区: "宁夏",
  新疆维吾尔自治区: "新疆",
};

const provinceFullNames = Object.keys(provinceMap);
const municipalityProvinces = new Set(["北京", "上海", "天津", "重庆"]);
const schoolNameEndingPattern = /(大学|学院|学校|研究院)$/;

const project985Set = new Set(project985Schools);
const project211Set = new Set(project211Schools);
const doubleFirstClassSet = new Set(doubleFirstClassSchools);
const existingSchoolMap = new Map(existingSchools.map((school) => [school.name, school]));

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
      .replace(/<(br|p|div|li|tr|td|th|h\d)\b[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function createStableId(name) {
  let hash = 2166136261;
  for (const char of name) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return `school-${(hash >>> 0).toString(36)}`;
}

function normalizeSchoolName(name) {
  return String(name || "")
    .replace(/\s+/g, "")
    .replace(/（\s*/g, "（")
    .replace(/\s*）/g, "）")
    .trim();
}

function getLevelTags(name) {
  const is985 = project985Set.has(name);
  const is211 = project211Set.has(name);
  const isDoubleFirstClass = doubleFirstClassSet.has(name);

  if (is985) {
    return ["985", "211", "双一流"];
  }

  if (is211) {
    return ["211", "双一流"];
  }

  if (isDoubleFirstClass) {
    return ["双一流"];
  }

  return ["普通本科"];
}

function normalizeProvince(fullProvince) {
  return provinceMap[fullProvince] || "";
}

function getCity(province, existingSchool) {
  if (existingSchool?.city) {
    return existingSchool.city;
  }

  return municipalityProvinces.has(province) ? province : "";
}

function parseOfficialRows(html) {
  const text = stripHtml(html);
  const start = text.indexOf("北京大学");
  if (start < 0) {
    throw new Error("未在官方页面中找到名单起点：北京大学。");
  }

  const endMarkers = ["注：排名不分先后", "责任编辑", "相关阅读", "学信网"];
  const markerPositions = endMarkers
    .map((marker) => text.indexOf(marker, start))
    .filter((index) => index > start);
  const end = markerPositions.length ? Math.min(...markerPositions) : text.length;
  const listText = text.slice(start, end);
  const provincePattern = provinceFullNames.join("|");
  const schoolPattern = /[\u4e00-\u9fa5A-Za-z（）()·\-—]+?/;
  const rowPattern = new RegExp(`(${schoolPattern.source})\\s*(${provincePattern})`, "g");

  const rawRows = [];
  let match;
  while ((match = rowPattern.exec(listText))) {
    const name = normalizeSchoolName(match[1]);
    const province = normalizeProvince(match[2]);
    if (!name || !province) {
      continue;
    }

    if (!schoolNameEndingPattern.test(name) || name.includes("名单") || name.includes("单位名称")) {
      continue;
    }

    rawRows.push({ name, province });
  }

  return rawRows;
}

function dedupeRows(rows) {
  const seen = new Set();
  const deduped = [];
  const duplicates = [];

  for (const row of rows) {
    if (seen.has(row.name)) {
      duplicates.push(row);
      continue;
    }

    seen.add(row.name);
    deduped.push(row);
  }

  return { deduped, duplicates };
}

function buildSchools(rows) {
  return rows.map((row) => {
    const existingSchool = existingSchoolMap.get(row.name);
    return {
      id: createStableId(row.name),
      name: row.name,
      province: row.province,
      city: getCity(row.province, existingSchool),
      levelTags: getLevelTags(row.name),
      typeTags: Array.isArray(existingSchool?.typeTags) ? existingSchool.typeTags : [],
      recommendationQualified: true,
      recommendationListYear: listYear,
      detailStatus: "building",
    };
  });
}

function validateSchools(schools) {
  const errors = [];
  const names = new Set();
  const ids = new Set();

  for (const school of schools) {
    if (names.has(school.name)) {
      errors.push(`学校名称重复：${school.name}`);
    }
    names.add(school.name);

    if (ids.has(school.id)) {
      errors.push(`id 重复：${school.id}`);
    }
    ids.add(school.id);

    if (!school.province) {
      errors.push(`province 为空：${school.name}`);
    }

    if (!Array.isArray(school.levelTags) || !school.levelTags.length) {
      errors.push(`levelTags 为空：${school.name}`);
    }

    if (school.recommendationQualified !== true) {
      errors.push(`recommendationQualified 不是 true：${school.name}`);
    }

    if (
      school.levelTags.includes("普通本科") &&
      (school.levelTags.includes("985") || school.levelTags.includes("211") || school.levelTags.includes("双一流"))
    ) {
      errors.push(`普通本科与高层次标签冲突：${school.name} ${school.levelTags.join("/")}`);
    }
  }

  const expectTags = (name, expectedTags, exact = false) => {
    const school = schools.find((item) => item.name === name);
    if (!school) {
      errors.push(`缺少关键院校：${name}`);
      return;
    }

    const tagSet = new Set(school.levelTags);
    for (const tag of expectedTags) {
      if (!tagSet.has(tag)) {
        errors.push(`${name} 缺少层次标签：${tag}`);
      }
    }

    if (exact && school.levelTags.join("|") !== expectedTags.join("|")) {
      errors.push(`${name} 层次标签应为 ${expectedTags.join("/")}，当前为 ${school.levelTags.join("/")}`);
    }
  };

  expectTags("北京大学", ["985", "211", "双一流"]);
  expectTags("清华大学", ["985", "211", "双一流"]);
  expectTags("上海财经大学", ["211", "双一流"]);
  expectTags("上海海洋大学", ["双一流"], true);

  if (schools.length < minimumSchoolCount) {
    errors.push(`学校数量 ${schools.length} 低于 ${minimumSchoolCount}，名单可能解析失败。`);
  }

  return errors;
}

function buildStats(schools, duplicateCount) {
  const byProvince = {};
  for (const school of schools) {
    byProvince[school.province] = (byProvince[school.province] || 0) + 1;
  }

  return {
    total: schools.length,
    byProvince,
    project985: schools.filter((school) => school.levelTags.includes("985")).length,
    project211: schools.filter((school) => school.levelTags.includes("211")).length,
    doubleFirstClass: schools.filter((school) => school.levelTags.includes("双一流")).length,
    ordinary: schools.filter((school) => school.levelTags.length === 1 && school.levelTags[0] === "普通本科").length,
    duplicates: duplicateCount,
    missingProvince: schools.filter((school) => !school.province).length,
  };
}

async function fetchOfficialHtml() {
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 BaoyanPilot school sync",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`官方页面请求失败：HTTP ${response.status}`);
  }

  return response.text();
}

async function writeSchoolsJson(schools) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const payload = `${JSON.stringify(schools, null, 2)}\n`;
  await fs.writeFile(outputPath, payload, "utf8");
}

async function main() {
  let html;
  try {
    html = await fetchOfficialHtml();
  } catch (error) {
    console.error(error?.message || error);
    console.error("网络失败，已停止同步；不会覆盖已有 schools.json。");
    process.exitCode = 1;
    return;
  }

  let rawRows;
  try {
    rawRows = parseOfficialRows(html);
  } catch (error) {
    console.error(error?.message || error);
    console.error("解析失败，已停止同步；不会覆盖已有 schools.json。");
    process.exitCode = 1;
    return;
  }

  const { deduped, duplicates } = dedupeRows(rawRows);
  const schools = buildSchools(deduped);
  const errors = validateSchools(schools);
  const stats = buildStats(schools, duplicates.length);

  console.log("院校数据生成统计：");
  console.log(`- 学校总数：${stats.total}`);
  console.log(`- 各省数量：${JSON.stringify(stats.byProvince)}`);
  console.log(`- 985数量：${stats.project985}`);
  console.log(`- 211数量：${stats.project211}`);
  console.log(`- 双一流数量：${stats.doubleFirstClass}`);
  console.log(`- 普通本科数量：${stats.ordinary}`);
  console.log(`- 重复数据数量：${stats.duplicates}`);
  console.log(`- 缺少省份数量：${stats.missingProvince}`);

  if (errors.length) {
    console.error("院校数据校验失败：");
    errors.forEach((error) => console.error(`- ${error}`));
    console.error("已停止同步；不会覆盖已有 schools.json。");
    process.exitCode = 1;
    return;
  }

  await writeSchoolsJson(schools);
  console.log(`已写入：${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  console.error("同步异常终止；不会覆盖已有 schools.json。");
  process.exitCode = 1;
});
