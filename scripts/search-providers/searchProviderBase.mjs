export class SearchProviderError extends Error {
  constructor(message, code = "search-provider-error") {
    super(message);
    this.name = "SearchProviderError";
    this.code = code;
  }
}

export function normalizeSearchResults(results) {
  return (Array.isArray(results) ? results : [])
    .map((item) => ({
      title: String(item.title || "").trim(),
      url: String(item.url || item.link || "").trim(),
      snippet: String(item.snippet || item.description || "").trim(),
    }))
    .filter((item) => item.title && item.url)
    .slice(0, 10);
}
