import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

export async function extractRecommendationDataWithAI() {
  if (!process.env.DEEPSEEK_API_KEY) {
    return {
      used: false,
      reason: "未配置 DEEPSEEK_API_KEY，已使用规则解析并将低置信度内容进入人工复核。",
    };
  }

  return {
    used: false,
    reason: "本试点当前使用规则解析；DeepSeek 结构化抽取接口已预留，后续可在此接入。",
  };
}
