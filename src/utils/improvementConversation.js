export const CONVERSATION_STAGES = Object.freeze({
  RECOMMENDATION: "recommendation",
  RECOMMENDATION_COMPLETE: "recommendation_complete",
  IMPROVEMENT_OFFER: "improvement_offer",
  IMPROVEMENT_ADVICE: "improvement_advice",
});

export const IMPROVEMENT_OFFER_MESSAGE =
  "院校定位已经完成。需要我结合你的个人背景，进一步分析接下来最值得投入的努力方向吗？";

const NEGATIVE_PATTERNS = [
  /不需要/,
  /不可以/,
  /不要/,
  /不好/,
  /不用(?:了)?/,
  /暂时不/,
  /先不/,
  /不必/,
  /不了/,
  /不想/,
  /不行/,
  /没必要/,
  /拒绝/,
  /算了/,
  /以后再说/,
  /下次再说/,
  /^(?:否|no)$/,
];

const AFFIRMATIVE_PATTERNS = [
  /需要/,
  /可以/,
  /好的?/,
  /好啊/,
  /好呀/,
  /行(?:的|啊|呀)?/,
  /没问题/,
  /当然/,
  /愿意/,
  /想要/,
  /请(?:帮我)?分析/,
  /帮我分析/,
  /继续/,
  /^嗯+$/,
  /^ok(?:ay)?$/,
  /^yes$/,
  /^要$/,
];

const FOLLOW_UP_PATTERNS = [
  /[?？]/,
  /哪个/,
  /多少/,
  /怎么/,
  /如何/,
  /应该/,
  /具体/,
  /重要/,
  /优先/,
  /提升/,
  /准备/,
  /科研/,
  /竞赛/,
  /英语/,
  /六级/,
  /雅思/,
  /托福/,
  /论文/,
  /实习/,
  /绩点/,
  /排名/,
];

function normalizeReply(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s，。！？、,.!；;：:]/g, "");
}

export function classifyImprovementReply(value) {
  const normalized = normalizeReply(value);
  if (!normalized) return "unclear";
  if (NEGATIVE_PATTERNS.some((pattern) => pattern.test(normalized))) return "negative";
  if (AFFIRMATIVE_PATTERNS.some((pattern) => pattern.test(normalized))) return "affirmative";
  if (FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(normalized))) return "affirmative";
  return "unclear";
}

export function normalizeConversationStage(value, messages = []) {
  const allowedStages = new Set(Object.values(CONVERSATION_STAGES));
  if (allowedStages.has(value)) return value;

  const normalizedMessages = Array.isArray(messages) ? messages : [];
  if (normalizedMessages.some((message) => message?.messageType === "improvement_advice")) {
    return CONVERSATION_STAGES.IMPROVEMENT_ADVICE;
  }
  if (normalizedMessages.some((message) => message?.messageType === "improvement_offer")) {
    return CONVERSATION_STAGES.IMPROVEMENT_OFFER;
  }
  if (normalizedMessages.some((message) => message?.messageType === "report")) {
    return CONVERSATION_STAGES.RECOMMENDATION_COMPLETE;
  }
  return CONVERSATION_STAGES.RECOMMENDATION;
}
