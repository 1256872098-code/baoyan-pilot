import crypto from "node:crypto";
import { summarizeNotice } from "../summarizers/noticeSummarizer.mjs";

function compactText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function createHash(value) {
  return crypto.createHash("sha256").update(value || "").digest("hex");
}

function inferYear(publishedAt, body) {
  const source = publishedAt || body || "";
  const match = String(source).match(/20\d{2}/);
  return match ? Number(match[0]) : null;
}

function inferType(title, body) {
  const text = `${title} ${body}`;
  if (/夏令营/.test(text)) return "summer-camp";
  if (/预推免|推免预报名/.test(text)) return "pre-recommendation";
  if (/专业目录|招生目录/.test(text)) return "catalog";
  if (/条件|资格/.test(text)) return "requirement";
  if (/材料|申请表|成绩单/.test(text)) return "material";
  if (/考核|面试|笔试/.test(text)) return "assessment";
  if (/时间|日程|安排|截止/.test(text)) return "timeline";
  if (/推免|推荐免试|免试/.test(text)) return "policy";
  return "other";
}

function createNoticeId(sourceUrl, contentHash) {
  const urlHash = createHash(sourceUrl).slice(0, 12);
  return `notice-${urlHash}-${contentHash.slice(0, 8)}`;
}

export function parseNoticePage({ title, body, publishedAt, source, fetchedAt }) {
  const normalizedTitle = compactText(title) || source.name || "未命名通知";
  const normalizedBody = compactText(body);
  const sourceUrl = source.url;
  const contentHash = createHash(`${normalizedTitle}\n${publishedAt || ""}\n${normalizedBody}`);
  const summary = summarizeNotice({
    title: normalizedTitle,
    body: normalizedBody,
    publishedAt,
    sourceUrl,
  });

  return {
    id: createNoticeId(sourceUrl, contentHash),
    title: normalizedTitle,
    type: inferType(normalizedTitle, normalizedBody),
    year: inferYear(publishedAt, normalizedBody),
    majorTags: summary.majorTags,
    publishedAt: publishedAt || null,
    deadline: summary.deadline,
    summary: summary.summary,
    keyPoints: summary.keyPoints,
    materials: summary.materials,
    assessment: summary.assessment,
    source: {
      title: source.name || source.sourceDepartment || "官方来源",
      url: sourceUrl,
      sourceType: source.sourceType || "official-notice",
    },
    crawledAt: fetchedAt,
    lastCheckedAt: fetchedAt,
    contentHash,
  };
}
