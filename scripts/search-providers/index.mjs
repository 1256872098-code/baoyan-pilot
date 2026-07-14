import dotenv from "dotenv";
import { searchWithTavily } from "./tavilySearch.mjs";

dotenv.config({
  path: ".env.local",
  quiet: true,
});

export async function searchWeb(query, options = {}) {
  const provider = (process.env.SEARCH_PROVIDER || "").toLowerCase();

  if (provider === "tavily") {
    return searchWithTavily(query, options);
  }

  const error = new Error(`不支持的SEARCH_PROVIDER：${provider || "未配置"}`);
  error.code = provider ? "search-provider-unsupported" : "source-discovery-unavailable";
  throw error;
}
