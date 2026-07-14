import * as cheerio from "cheerio";
import path from "node:path";
import {
  getSchoolByName,
  isCliModule,
  makeMajorId,
  normalizeWhitespace,
  parseArgs,
  readJson,
  rootDir,
  shouName,
  writeJsonAtomic,
} from "../my-school/common.mjs";

const shouMajorSource = {
  url: "https://jwc.shou.edu.cn/11202/list.htm",
  title: "上海海洋大学专业设置情况及说明（截至202309）",
  sourceOrganization: "上海海洋大学教务处",
};

const groupToCollegeName = {
  "生命": "水产与生命学院",
  "食品": "食品学院",
  "经管": "经济管理学院",
  "工程": "工程学院",
  "信息": "信息学院",
  "外语": "外国语学院",
  "爱恩": "爱恩学院",
};

const supplementalCollegeSources = [
  {
    collegeName: "海洋生物资源与管理学院",
    url: "https://hyxy.shou.edu.cn/7405/list.htm",
    title: "上海海洋大学海洋生物资源与管理学院学院简介",
    sourceOrganization: "上海海洋大学海洋生物资源与管理学院",
    extract(text) {
      const names = new Set();
      for (const match of text.matchAll(/([\u4e00-\u9fa5（）()A-Za-z]+?)专业入选/g)) {
        const name = normalizeWhitespace(match[1]).replace(/^其中/, "");
        if (name && name.length <= 20) names.add(name);
      }
      return [...names];
    },
  },
  {
    collegeName: "海洋科学与生态环境学院",
    url: "https://hkxy.shou.edu.cn/8796/list.htm",
    title: "上海海洋大学海洋科学与生态环境学院学院简介",
    sourceOrganization: "上海海洋大学海洋科学与生态环境学院",
    extract(text) {
      const match = text.match(/设有(.+?)等\s*4\s*个本科专业/);
      if (!match) return [];
      return match[1]
        .split(/[、，,和]/)
        .map((item) => normalizeWhitespace(item))
        .filter(Boolean);
    },
  },
];

function parseGroupName(value) {
  const normalized = normalizeWhitespace(value).replace(/[（(]\d+[）)]/g, "");
  return normalized || "";
}

function parseMajorRows(html) {
  const $ = cheerio.load(html);
  const rows = [];
  let currentGroup = "";

  $("table tr").each((_, tr) => {
    const cells = [];
    $(tr)
      .find("th,td")
      .each((__, cell) => cells.push(normalizeWhitespace($(cell).text())));

    if (!cells.length || cells[0] === "序号") return;
    if (!/^\d+$/.test(cells[0])) return;

    let group = currentGroup;
    let majorName = "";
    let startYear = "";
    let discipline = "";
    let degreeType = "";
    let honors = "";

    if (cells.length >= 7) {
      group = parseGroupName(cells[1]);
      currentGroup = group;
      [, , majorName, startYear, discipline, degreeType, honors] = cells;
    } else {
      [, majorName, startYear, discipline, degreeType, honors] = cells;
    }

    if (!majorName || !group) return;
    rows.push({
      group,
      majorName,
      startYear: startYear || null,
      discipline: discipline || null,
      degreeType: degreeType || null,
      honors: honors || "",
      status: /停招/.test(honors) ? "inactive" : "active",
    });
  });

  return rows;
}

async function fetchMajorRows() {
  const response = await fetch(shouMajorSource.url, {
    headers: {
      "User-Agent": "BaoyanPilot academic major crawler (official public pages only)",
    },
  });
  if (!response.ok) throw new Error(`专业设置页面抓取失败：HTTP ${response.status}`);
  return parseMajorRows(await response.text());
}

function buildCollegeMajors({ school, college, rows }) {
  const now = new Date().toISOString();
  return {
    schoolId: school.id,
    schoolName: school.name,
    collegeId: college.id,
    collegeName: college.name,
    lastUpdatedAt: now,
    dataStatus: rows.length ? "verified" : "pending-review",
    majors: rows.map((row) => ({
      id: makeMajorId(college.id, row.majorName),
      name: row.majorName,
      code: null,
      degreeType: row.degreeType,
      educationLevel: "本科",
      aliases: [],
      status: row.status,
      sourceUrl: shouMajorSource.url,
      sourceTitle: shouMajorSource.title,
      sourceOrganization: shouMajorSource.sourceOrganization,
      confidence: 1,
      lastCheckedAt: now,
      meta: {
        discipline: row.discipline,
        startYear: row.startYear,
        honors: row.honors,
      },
    })),
  };
}

function buildSupplementalMajors({ school, college, names, source }) {
  const now = new Date().toISOString();
  return {
    schoolId: school.id,
    schoolName: school.name,
    collegeId: college.id,
    collegeName: college.name,
    lastUpdatedAt: now,
    dataStatus: names.length ? "verified" : "pending-review",
    majors: names.map((name) => ({
      id: makeMajorId(college.id, name),
      name,
      code: null,
      degreeType: null,
      educationLevel: "本科",
      aliases: [],
      status: "active",
      sourceUrl: source.url,
      sourceTitle: source.title,
      sourceOrganization: source.sourceOrganization,
      confidence: 1,
      lastCheckedAt: now,
    })),
  };
}

async function fetchSupplementalMajors(source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "BaoyanPilot academic major crawler (official public pages only)",
    },
  });
  if (!response.ok) throw new Error(`学院专业页面抓取失败：HTTP ${response.status}`);
  const html = await response.text();
  const text = normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<style[\s\S]*?<\/style>/g, " ")
      .replace(/<[^>]+>/g, " "),
  );
  return source.extract(text);
}

export async function crawlSchoolMajors({ schoolName = shouName, collegeName } = {}) {
  const school = await getSchoolByName(schoolName);
  if (school.name !== shouName) {
    throw new Error("本阶段专业目录抓取仅允许处理上海海洋大学。");
  }

  const detailPath = path.join(rootDir, `public/data/school-details/${school.id}.json`);
  const detail = await readJson(detailPath, null);
  const units = Array.isArray(detail?.academicUnits) ? detail.academicUnits : [];
  const rows = await fetchMajorRows();
  const outputDir = path.join(rootDir, `public/data/college-majors/${school.id}`);
  const written = [];
  const skippedGroups = [];

  for (const [group, targetCollegeName] of Object.entries(groupToCollegeName)) {
    if (collegeName && collegeName !== targetCollegeName) continue;
    const college = units.find((unit) => unit.name === targetCollegeName);
    const groupRows = rows.filter((row) => row.group === group);
    if (!college || !groupRows.length) {
      skippedGroups.push({ group, targetCollegeName, reason: college ? "未解析到专业" : "school-details中未找到学院" });
      continue;
    }

    const data = buildCollegeMajors({ school, college, rows: groupRows });
    const outputPath = path.join(outputDir, `${college.id}.json`);
    const existing = await readJson(outputPath, null);
    if (existing?.majors?.length && !data.majors.length) {
      throw new Error(`${targetCollegeName} 新抓取专业为空，已阻止覆盖旧数据。`);
    }
    await writeJsonAtomic(outputPath, data, { backup: Boolean(existing) });
    written.push({
      collegeId: college.id,
      collegeName: college.name,
      majorCount: data.majors.length,
      activeMajorCount: data.majors.filter((major) => major.status === "active").length,
      outputPath: `public/data/college-majors/${school.id}/${college.id}.json`,
      majors: data.majors.map((major) => major.name),
    });
  }

  for (const source of supplementalCollegeSources) {
    if (collegeName && collegeName !== source.collegeName) continue;
    const college = units.find((unit) => unit.name === source.collegeName);
    if (!college) {
      skippedGroups.push({ group: source.collegeName, targetCollegeName: source.collegeName, reason: "school-details中未找到学院" });
      continue;
    }
    const names = await fetchSupplementalMajors(source);
    if (!names.length) {
      skippedGroups.push({ group: source.collegeName, targetCollegeName: source.collegeName, reason: "未解析到专业" });
      continue;
    }
    const data = buildSupplementalMajors({ school, college, names, source });
    const outputPath = path.join(outputDir, `${college.id}.json`);
    const existing = await readJson(outputPath, null);
    await writeJsonAtomic(outputPath, data, { backup: Boolean(existing) });
    written.push({
      collegeId: college.id,
      collegeName: college.name,
      majorCount: data.majors.length,
      activeMajorCount: data.majors.length,
      outputPath: `public/data/college-majors/${school.id}/${college.id}.json`,
      majors: data.majors.map((major) => major.name),
    });
  }

  return {
    schoolId: school.id,
    schoolName: school.name,
    sourceUrl: shouMajorSource.url,
    parsedMajorRows: rows.length,
    written,
    skippedGroups,
  };
}

if (isCliModule(import.meta.url)) {
  const args = parseArgs();
  crawlSchoolMajors({
    schoolName: args["school-name"] || shouName,
    collegeName: args["college-name"],
  })
    .then((result) => {
      console.log(`学校实际schoolId：${result.schoolId}`);
      console.log(`官方专业来源：${result.sourceUrl}`);
      console.log(`解析本科专业行数：${result.parsedMajorRows}`);
      for (const item of result.written) {
        console.log(`${item.collegeName}（${item.collegeId}）：${item.majorCount}个专业，写入 ${item.outputPath}`);
        console.log(`专业列表：${item.majors.join("、")}`);
      }
      if (result.skippedGroups.length) {
        console.log(`跳过分组：${JSON.stringify(result.skippedGroups)}`);
      }
    })
    .catch((error) => {
      console.error(`专业目录抓取失败：${error.message}`);
      process.exit(1);
    });
}
