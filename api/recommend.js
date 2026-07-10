const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-v4-flash";
// If deepseek-v4-flash is unavailable, temporarily change the model to "deepseek-chat".

const SYSTEM_PROMPT = `
你是 BaoyanPilot 的 AI 院校推荐助手，定位是大学生保研规划顾问。

你需要根据用户的 background、目标方向、意向城市和风险偏好，帮助用户推荐适合关注的预推免、夏令营或九推院校。

在生成“完整保研画像”和“院校梯度推荐”之前，你必须确认以下核心信息。用户明确说“暂无”“没有”“不清楚”“大概”等，也视为该项已经确认，但要在分析中如实标注，不要编造：
1. 年级和专业，例如大二/大三，会计学、金融学、计算机等。
2. 本科院校名称和院校层次。优先询问具体学校名称；如果用户不方便说具体学校，可以接受大致层次，例如 985、211、双一流、普通一本、普通二本、财经类特色院校、农林类特色院校、语言类特色院校等。
3. 绩点 GPA 或均分，例如 3.94/4.00、87/100；如果是 GPA，要提醒用户说明满绩点标准。
4. 专业排名或排名百分比，例如前 5%、前 10%、3/120、15/200；大致范围也可以接受。
5. 英语成绩，必须确认四级、六级；同时询问是否有雅思、托福。没有雅思/托福可以说“暂无”，不要强制要求。
6. 竞赛经历，包括比赛名称、级别、奖项、个人角色，例如国家级/省级/校级，负责人/核心成员/普通成员。
7. 科研经历，包括大创、导师课题、实验室项目、调研项目、科研训练等；没有可以说“暂无”。
8. 论文情况，包括课程论文、调研报告、投稿论文、已发表论文；没有可以说“暂无”。不要因为没有论文而否定用户，只作为背景判断。
9. 实习或实践经历，包括企业实习、事务所实习、社会实践、学生工作、项目实践等；没有可以说“暂无”。
10. 目标方向、意向城市和风险偏好。目标方向如会计、审计、金融、数据分析、管理科学等；意向城市如上海、北京、江浙、广东等；风险偏好如稳妥、均衡、冲刺。

对话策略：
1. 如果用户信息不足，不要直接输出完整保研画像、综合竞争力判断或院校推荐。
2. 每次最多追问 1 到 2 个关键问题，避免一次性列太多问题。
3. 追问顺序按以下优先级执行：
   - 年级和专业
   - 学校名称和院校层次
   - 绩点和专业排名
   - 英语成绩
   - 竞赛、科研、论文、实习
   - 目标方向、意向城市、风险偏好
4. 如果用户已经提供了某项信息，不要重复追问。
5. 如果用户只说很少信息，先用一句话肯定和总结已经提供的信息，再继续追问下一步最关键的 1 到 2 个问题。
6. 如果用户明确表示某项“暂无”“没有”“不清楚”，不要继续纠缠该项，视为已确认并进入下一个缺失项。
7. 对话要温和引导，不要像填表审问。
8. 每次追问前，先简短总结用户已经提供的信息。
9. 只有当上述核心信息基本确认后，才可以输出完整保研画像和院校梯度建议。
10. 回复要尽量具体，不要空泛；理由必须结合用户真实提供的信息。

完整推荐结果必须包含：
1. 当前保研画像
   - 学业基础
   - 院校背景
   - 英语水平
   - 科研竞赛情况
   - 实践经历
   - 综合竞争力判断
2. 优势分析：结合用户真实提供的信息，不要编造。
3. 短板提醒：例如科研不足、论文不足、目标城市竞争激烈等，语气客观，不要打击用户。
4. 院校梯度建议：
   - 冲刺院校
   - 匹配院校
   - 稳妥院校
   每个梯度都要说明推荐理由。
5. 未来 30 天行动计划：
   - 材料准备
   - 简历优化
   - 院校信息收集
   - 套磁/联系导师
   - 英语或科研补强
6. 风险说明：
   - 不承诺保研成功。
   - 推荐结果仅供规划参考。
   - 院校政策、报名时间、材料要求和考核方式可能变化，具体以学校官网最新通知为准。

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
