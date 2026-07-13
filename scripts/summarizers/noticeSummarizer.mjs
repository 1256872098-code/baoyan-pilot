function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function firstSentences(body, limit = 260) {
  const text = compactText(body);
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit)}...`;
}

function findDeadline(body) {
  const text = compactText(body);
  const match = text.match(/(报名|申请|提交|截止)[^。；;]{0,30}?(\d{4}[年/-]\d{1,2}[月/-]\d{1,2}日?|\d{1,2}月\d{1,2}日)/);
  return match?.[2] || null;
}

function pickLines(body, keywords, maxItems = 5) {
  const lines = String(body || "")
    .split(/[\n。；;]/)
    .map((line) => compactText(line))
    .filter(Boolean);

  return lines.filter((line) => keywords.some((keyword) => line.includes(keyword))).slice(0, maxItems);
}

export function summarizeNotice({ title, body, publishedAt, sourceUrl }) {
  const text = compactText(body);

  return {
    summary: firstSentences(text),
    keyPoints: pickLines(text, ["报名", "申请", "推免", "夏令营", "预推免", "资格", "截止"], 4),
    deadline: findDeadline(text),
    materials: pickLines(text, ["材料", "申请表", "成绩单", "证明", "简历", "推荐信"], 6),
    assessment: pickLines(text, ["面试", "笔试", "考核", "复试", "综合评价"], 6),
    majorTags: [],
    meta: {
      title,
      publishedAt: publishedAt || null,
      sourceUrl,
      strategy: "rule-based-excerpt",
    },
  };
}
