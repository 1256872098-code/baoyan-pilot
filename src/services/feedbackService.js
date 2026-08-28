import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

export const FEEDBACK_TYPES = ["功能建议", "页面问题", "数据纠错", "使用体验", "其他"];

const FRIENDLY_SUBMIT_ERROR = "反馈提交失败，请稍后重试。";

function normalizeText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export function buildFeedbackPayload({ user, profile, feedbackType, content, pagePath }) {
  const normalizedContent = normalizeText(content, 500);
  const normalizedType = FEEDBACK_TYPES.includes(feedbackType) ? feedbackType : "其他";
  const isGuest = !user?.id || user.loginType === "guest" || user.isGuest || user.loginType !== "supabase";

  if (!normalizedContent) {
    throw new Error("请填写反馈内容。");
  }

  return {
    user_id: isGuest ? null : normalizeText(user.id, 128),
    user_name: normalizeText(isGuest ? "游客" : profile?.nickname || user?.nickname || "用户", 80) || "游客",
    feedback_type: normalizedType,
    content: normalizedContent,
    page_path: normalizeText(pagePath, 500) || "/",
  };
}

export async function submitUserFeedback(input) {
  const payload = buildFeedbackPayload(input);

  if (!isSupabaseConfigured || !supabase) {
    throw new Error(FRIENDLY_SUBMIT_ERROR);
  }

  const { error } = await supabase.from("user_feedback").insert([payload]);

  if (error) {
    if (import.meta.env.DEV) {
      // Do not expose the database error to users or log credentials.
      // eslint-disable-next-line no-console
      console.error("[Feedback] submit failed", { code: error.code, message: error.message });
    }
    throw new Error(FRIENDLY_SUBMIT_ERROR);
  }

  return { ok: true };
}
