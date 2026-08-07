const FUTURE_PLAN_HEADING_PATTERN =
  /(?:未来\s*30\s*天|未来三十天).*(?:行动|规划|计划|清单)/i;

function parseHeading(line) {
  const match = String(line || "").match(/^\s*(#{1,6})\s+(.+?)\s*$/);
  return match
    ? { level: match[1].length, marker: match[1], title: match[2] }
    : null;
}

function normalizeRiskSectionNumber(line) {
  return String(line || "").replace(
    /^(\s*#{1,6}\s+)9(\.\s*风险说明与官网核验清单\s*)$/,
    (_match, prefix, suffix) => `${prefix}8${suffix}`,
  );
}

export function sanitizeRecommendationReportContent(content) {
  const lines = String(content || "").split(/\r?\n/);
  const result = [];
  let skippedHeadingLevel = null;

  lines.forEach((line) => {
    const heading = parseHeading(line);

    if (skippedHeadingLevel !== null) {
      if (!heading || heading.level > skippedHeadingLevel) {
        return;
      }
      skippedHeadingLevel = null;
    }

    if (heading && FUTURE_PLAN_HEADING_PATTERN.test(heading.title)) {
      skippedHeadingLevel = heading.level;
      return;
    }

    result.push(normalizeRiskSectionNumber(line));
  });

  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
