import { searchWeb } from "../search-providers/index.mjs";
import {
  getSchoolByName,
  isOfficialUrl,
  isCliModule,
  readJson,
  registryPath,
  shouName,
  shouOfficialDomains,
  writeJsonAtomic,
} from "./common.mjs";

const blockedHosts = [
  "baike.baidu.com",
  "zhihu.com",
  "bilibili.com",
  "gaokao.cn",
  "shanghairanking.cn",
  "soft-ranking.com",
  "eol.cn",
  "kaoyan.com",
];

function isBlockedUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return blockedHosts.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
  } catch {
    return true;
  }
}

function inferSourceType(title = "", url = "") {
  const text = `${title} ${url}`;
  if (/拟录取|录取名单/.test(text)) return "admission-list";
  if (/接收|招生|复试/.test(text)) return "admission-notice";
  if (/名单|公示/.test(text)) return "recommendation-list";
  if (/名额|指标|分配/.test(text)) return "quota-notice";
  if (/办法|细则|通知|推荐/.test(text)) return "college-policy";
  return "school-policy";
}

function inferYear(text = "") {
  const graduate = String(text).match(/20\d{2}届/);
  if (graduate) return Number(graduate[0].slice(0, 4));
  const year = String(text).match(/20\d{2}年/);
  return year ? Number(year[0].slice(0, 4)) : null;
}

function makeQueries(schoolName) {
  return [
    `${schoolName} 推荐优秀应届本科毕业生 免试攻读研究生 实施办法 site:shou.edu.cn`,
    `${schoolName} 2026届 推免 名额 site:shou.edu.cn`,
    `${schoolName} 2026届 推免 名单 公示 site:shou.edu.cn`,
    `${schoolName} 本科毕业生人数 2026届 site:shou.edu.cn`,
    `${schoolName} 经济管理学院 2026届 推免 site:jmxy.shou.edu.cn`,
    `${schoolName} 经济管理学院 会计学 推免 名额 site:jmxy.shou.edu.cn`,
    `${schoolName} 经济管理学院 综合排名 推免 site:jmxy.shou.edu.cn`,
    `${schoolName} 经济管理学院 推免 加分 site:jmxy.shou.edu.cn`,
    `${schoolName} 教务处 推免 site:jwc.shou.edu.cn`,
    `${schoolName} 信息公开 推免 site:xxgk.shou.edu.cn`,
  ];
}

function normalizeRegistrySource(page) {
  return {
    name: page.name || page.title || page.url,
    url: page.url,
    sourceType: page.sourceType || inferSourceType(page.name, page.url),
    year: page.year || inferYear(`${page.name || ""} ${page.url || ""}`),
    collegeName: page.collegeName ?? null,
    enabled: page.enabled !== false,
    verified: Boolean(page.verified),
    discoveryMethod: page.discoveryMethod || "registry",
  };
}

export async function discoverRecommendationSources({ schoolName = shouName, years = [2026, 2025, 2024] } = {}) {
  const school = await getSchoolByName(schoolName);
  const registry = await readJson(registryPath, []);
  let entry = registry.find((item) => item.schoolId === school.id);

  if (!entry) {
    entry = {
      schoolId: school.id,
      schoolName: school.name,
      officialDomains: shouOfficialDomains,
      sourcePages: [],
    };
    registry.push(entry);
  }

  const knownSources = (entry.sourcePages || []).map(normalizeRegistrySource);
  const queries = makeQueries(school.name);
  const searchCandidates = [];
  const seen = new Set(knownSources.map((item) => item.url));
  const searchErrors = [];

  for (const query of queries) {
    try {
      const results = await Promise.race([
        searchWeb(query, { maxResults: 8, searchDepth: "basic" }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("搜索请求超时")), 12000);
        }),
      ]);
      for (const result of results) {
        if (!result.url || seen.has(result.url)) continue;
        if (isBlockedUrl(result.url)) continue;
        if (!isOfficialUrl(result.url, entry.officialDomains || shouOfficialDomains)) continue;
        if (!years.includes(inferYear(`${result.title} ${result.snippet} ${result.url}`) || years[0])) continue;
        seen.add(result.url);
        searchCandidates.push({
          name: result.title || result.url,
          url: result.url,
          sourceType: inferSourceType(result.title, result.url),
          year: inferYear(`${result.title} ${result.snippet} ${result.url}`) || years[0],
          collegeName: /经济管理学院/.test(`${result.title} ${result.snippet}`) ? "经济管理学院" : null,
          enabled: true,
          verified: false,
          discoveryMethod: "tavily",
          score: result.score ?? null,
        });
      }
    } catch (error) {
      searchErrors.push({ query, error: error.message });
    }
  }

  const mergedPages = knownSources;
  entry.sourcePages = knownSources;
  await writeJsonAtomic(registryPath, registry);

  return {
    school,
    officialDomains: entry.officialDomains || shouOfficialDomains,
    sources: mergedPages.filter((source) => source.enabled !== false),
    searchCandidates,
    registeredCount: knownSources.length,
    searchCandidateCount: searchCandidates.length,
    searchErrors,
  };
}

if (isCliModule(import.meta.url)) {
  const result = await discoverRecommendationSources();
  console.log(
    JSON.stringify(
      {
        schoolId: result.school.id,
        registeredCount: result.registeredCount,
        searchCandidateCount: result.searchCandidateCount,
        sources: result.sources.map((source) => ({ title: source.name, url: source.url, sourceType: source.sourceType })),
      },
      null,
      2,
    ),
  );
}
