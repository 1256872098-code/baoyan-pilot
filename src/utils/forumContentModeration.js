export const FORUM_CONTENT_BLOCKED_MESSAGE = "内容包含辱骂、威胁或其他不友善用语，请修改后再发布。";

const blockedTerms = [
  "傻逼",
  "傻b",
  "傻比",
  "傻币",
  "煞笔",
  "草泥马",
  "操你妈",
  "艹你妈",
  "草你妈",
  "你妈逼",
  "尼玛逼",
  "他妈的",
  "妈的",
  "狗娘养的",
  "狗东西",
  "王八蛋",
  "杂种",
  "贱人",
  "婊子",
  "脑残",
  "智障",
  "滚你妈",
  "滚蛋",
  "去死",
  "死全家",
  "全家死",
  "杀了你",
  "弄死你",
  "打死你",
  "烧死你",
  "砍死你",
  "燃烧吧家人",
  "fuckyou",
  "motherfucker",
  "asshole",
  "shithead",
  "bitch",
];

export function normalizeForumModerationText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\u2060\uFEFF]/gu, "")
    .replace(/[\s\p{P}\p{S}_]+/gu, "");
}

export function containsBlockedForumContent(...values) {
  const normalized = normalizeForumModerationText(values.filter(Boolean).join(" "));
  if (!normalized) return false;

  return blockedTerms.some((term) => normalized.includes(normalizeForumModerationText(term)));
}

export function getForumContentModerationError(...values) {
  return containsBlockedForumContent(...values) ? FORUM_CONTENT_BLOCKED_MESSAGE : "";
}

export function assertForumContentAllowed(...values) {
  const message = getForumContentModerationError(...values);
  if (!message) return;

  const error = new Error(message);
  error.code = "FORUM_CONTENT_BLOCKED";
  throw error;
}
