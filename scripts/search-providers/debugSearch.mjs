import dotenv from "dotenv";
import { searchWeb } from "./index.mjs";

dotenv.config({
  path: ".env.local",
  quiet: true,
});

async function main() {
  const result = {
    searchProviderConfigured: Boolean(process.env.SEARCH_PROVIDER),
    searchApiKeyConfigured: Boolean(process.env.SEARCH_API_KEY),
    deepseekApiKeyConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    tavilyTestSuccess: false,
    resultCount: 0,
  };

  try {
    const items = await searchWeb("北京大学 官网", {
      maxResults: 5,
      searchDepth: "basic",
    });
    result.tavilyTestSuccess = true;
    result.resultCount = items.length;
  } catch (error) {
    result.tavilyTestSuccess = false;
    result.resultCount = 0;
    result.error = error.message?.slice(0, 160) || "搜索测试失败";
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        searchProviderConfigured: Boolean(process.env.SEARCH_PROVIDER),
        searchApiKeyConfigured: Boolean(process.env.SEARCH_API_KEY),
        deepseekApiKeyConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
        tavilyTestSuccess: false,
        resultCount: 0,
        error: error.message?.slice(0, 160) || "搜索诊断失败",
      },
      null,
      2,
    ),
  );
});
