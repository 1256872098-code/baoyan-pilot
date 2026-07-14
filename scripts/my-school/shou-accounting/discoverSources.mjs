import { searchWeb } from "../../search-providers/index.mjs";
import { isCliModule, writeJsonAtomic } from "../common.mjs";
import { parseArgs, parseYears, readJson, sourceRegistryPath } from "./common.mjs";

const queries = [
  "上海海洋大学 经济管理学院 会计学 推免 2026届",
  "上海海洋大学 经济管理学院 会计学 推免 2025届",
  "上海海洋大学 经济管理学院 会计学 推免 2024届",
  "上海海洋大学 会计学 保研率",
  "上海海洋大学 会计学 推免人数",
  "上海海洋大学 经济管理学院 推免名单",
  "上海海洋大学 经济管理学院 推免实施细则",
  "上海海洋大学 经济管理学院 综合排名 推免",
  "上海海洋大学 经济管理学院 推免 加分",
  "上海海洋大学 会计学 本科毕业生人数",
  "上海海洋大学 会计学 班级人数",
  "上海海洋大学 本科教学质量报告",
  "site:jmxy.shou.edu.cn 会计学 推免",
  "site:shou.edu.cn 会计学 推免",
  "site:jwc.shou.edu.cn 推免",
  "site:xxgk.shou.edu.cn 推免",
  "site:shou.edu.cn 本科教学质量报告 会计学",
];

export async function discoverAccountingSources({ years = [2026, 2025, 2024] } = {}) {
  const registry = await readJson(sourceRegistryPath, []);
  const entry = registry[0] || { sourcePages: [] };
  const seen = new Set((entry.sourcePages || []).map((item) => item.url));
  const candidates = [];

  for (const query of queries) {
    try {
      const results = await Promise.race([
        searchWeb(query, { maxResults: 8, searchDepth: "basic" }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("搜索请求超时")), 12000)),
      ]);
      for (const result of results) {
        if (!result.url || seen.has(result.url)) continue;
        seen.add(result.url);
        candidates.push({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          score: result.score,
          sourceLevel: /shou\.edu\.cn/.test(result.url) ? "official" : "third-party-estimate",
          enabled: false,
          verified: false,
        });
      }
    } catch (error) {
      candidates.push({ query, error: error.message, sourceLevel: "manual-review" });
    }
  }

  entry.discoveryCandidates = candidates.slice(0, 30);
  entry.lastDiscoveredAt = new Date().toISOString();
  await writeJsonAtomic(sourceRegistryPath, registry);
  return {
    years,
    registeredSources: entry.sourcePages?.length || 0,
    candidates: entry.discoveryCandidates,
  };
}

if (isCliModule(import.meta.url)) {
  const args = parseArgs();
  const result = await discoverAccountingSources({ years: parseYears(args.years) });
  console.log(`已登记来源：${result.registeredSources}`);
  console.log(`搜索候选：${result.candidates.length}`);
}
