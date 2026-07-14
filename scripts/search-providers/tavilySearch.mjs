export async function searchWithTavily(query, options = {}) {
  const apiKey = process.env.SEARCH_API_KEY;

  if (!apiKey) {
    const error = new Error("缺少SEARCH_API_KEY，请在项目根目录.env.local中配置Tavily API Key。");
    error.code = "source-discovery-unavailable";
    throw error;
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: options.searchDepth || "basic",
      max_results: options.maxResults || options.count || 8,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily搜索失败：HTTP ${response.status} ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();

  return (data.results || []).map((item) => ({
    title: item.title || "",
    url: item.url || "",
    snippet: item.content || "",
    score: item.score ?? null,
  }));
}
