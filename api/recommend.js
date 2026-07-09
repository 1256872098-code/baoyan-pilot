const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-flash";
// If deepseek-v4-flash is unavailable, temporarily change the model to "deepseek-chat".

const SYSTEM_PROMPT = `
你是 BaoyanPilot 的 AI 院校推荐助手，定位是大学生保研规划顾问。

你需要根据用户的 background、目标方向、意向城市和风险偏好，帮助用户推荐适合关注的预推免、夏令营或九推院校。

工作流程：
1. 先判断用户信息是否足够。关键信息包括：年级、专业、学校层次、绩点或排名、英语成绩、科研经历、竞赛经历、实习实践、目标专业方向、意向城市或地区、风险偏好。
2. 如果用户信息不足，必须先追问缺失的关键信息，不得直接推荐院校。
3. 如果信息足够，按以下结构输出：
   - 当前用户画像
   - 适合申请路径
   - 冲刺院校
   - 匹配院校
   - 稳妥院校
   - 下一步行动建议
   - 风险提醒

输出原则：
1. 不得承诺保研成功。
2. 不得给出绝对录取判断。
3. 不得编造用户没有提供的经历、奖项、论文、实习、成绩或排名。
4. 推荐结果必须按照“冲刺院校、匹配院校、稳妥院校”三个梯度输出。
5. 每所院校都要说明推荐理由，理由要基于用户已提供的信息。
6. 必须提醒用户：具体政策、报名时间、材料要求和考核方式以学校官网最新通知为准。

输出风格：
使用中文，专业、清晰、克制。可以使用 Markdown 标题和列表，方便在聊天窗口阅读。
`.trim();

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

async function readJsonBody(request) {
  if (request.body) {
    return typeof request.body === "string" ? JSON.parse(request.body) : request.body;
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : {};
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => ["user", "assistant"].includes(message?.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").slice(0, 6000),
    }))
    .filter((message) => message.content.trim())
    .slice(-20);
}

function parseJsonSafely(text) {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractDeepSeekReply(payload) {
  return payload?.choices?.[0]?.message?.content?.trim() || "";
}

async function callDeepSeek(messages, apiKey) {
  return fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.35,
      max_tokens: 2200,
      stream: false,
    }),
  });
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "只支持 POST 请求。" });
    return;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    sendJson(response, 500, {
      error: "服务端未配置 DEEPSEEK_API_KEY，请在 Vercel 环境变量中添加 DeepSeek API Key。",
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const messages = normalizeMessages(body.messages);

    if (!messages.some((message) => message.role === "user")) {
      sendJson(response, 400, { error: "请提供至少一条用户消息。" });
      return;
    }

    const deepSeekResponse = await callDeepSeek(messages, apiKey);
    const responseText = await deepSeekResponse.text();
    const responsePayload = parseJsonSafely(responseText);

    if (!deepSeekResponse.ok) {
      const message =
        responsePayload?.error?.message ||
        responsePayload?.message ||
        responsePayload?.raw ||
        `DeepSeek API 请求失败，状态码 ${deepSeekResponse.status}。`;

      sendJson(response, deepSeekResponse.status, { error: message });
      return;
    }

    const reply = extractDeepSeekReply(responsePayload);
    if (!reply) {
      sendJson(response, 502, { error: "DeepSeek API 没有返回有效回复。" });
      return;
    }

    sendJson(response, 200, { reply });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof SyntaxError ? "请求体不是有效 JSON。" : "服务端调用 DeepSeek API 失败。",
    });
  }
}
