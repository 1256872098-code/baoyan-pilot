import assert from "node:assert/strict";
import test from "node:test";
import recommendHandler from "../api/recommend.js";
import {
  REQUIRED_PROFILE_FIELDS,
  extractProfileStatusMarker,
  getMissingProfileLabels,
  isProfileReadyForReport,
  normalizeProfileStatus,
} from "../src/utils/profileCompleteness.js";

const completeProfile = Object.fromEntries(
  REQUIRED_PROFILE_FIELDS.map(({ key, label }) => [key, `${label}已确认`]),
);

function createResponseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    end() {},
  };
}

test("空资料默认缺失全部必备字段", () => {
  const status = normalizeProfileStatus(null);

  assert.equal(status.isComplete, false);
  assert.equal(status.confirmedCount, 0);
  assert.equal(status.missingFields.length, REQUIRED_PROFILE_FIELDS.length);
});

test("明确回答暂无也会被视为已确认", () => {
  const status = normalizeProfileStatus({
    profile: {
      ...completeProfile,
      research: "暂无",
      papers: "没有论文",
      practice: "暂时没有实习或学生工作",
    },
  });

  assert.equal(status.isComplete, true);
  assert.equal(status.confirmedCount, REQUIRED_PROFILE_FIELDS.length);
});

test("任一独立字段缺失时不能生成报告", () => {
  const profile = { ...completeProfile, papers: "未提供" };
  const status = normalizeProfileStatus({ profile });

  assert.equal(status.isComplete, false);
  assert.deepEqual(status.missingFields, ["papers"]);
  assert.deepEqual(getMissingProfileLabels(status), ["论文情况"]);
  assert.equal(isProfileReadyForReport(status, true), false);
});

test("字段摘要中仍写着未提供时保持缺失", () => {
  const status = normalizeProfileStatus({
    profile: {
      ...completeProfile,
      gpa: "GPA 3.8，但满绩点口径未提供",
      english: "六级 570，四级未提供",
    },
  });

  assert.equal(status.fields.gpa, false);
  assert.equal(status.fields.english, false);
  assert.deepEqual(status.missingFields, ["gpa", "english"]);
});

test("基础背景和目标偏好不能用笼统未知占位", () => {
  const status = normalizeProfileStatus({
    profile: {
      ...completeProfile,
      major: "不清楚",
      targetDirection: "还没想好",
      research: "暂无",
    },
  });

  assert.equal(status.fields.major, false);
  assert.equal(status.fields.targetDirection, false);
  assert.equal(status.fields.research, true);
});

test("解析并移除 AI 回复末尾的资料状态标记", () => {
  const content = `必备信息已全部确认，现在可以点击「生成报告」。\n<!-- baoyanpilot-profile-status:${JSON.stringify({ profile: completeProfile })} -->`;
  const parsed = extractProfileStatusMarker(content);

  assert.equal(parsed.hasValidMarker, true);
  assert.equal(parsed.profileStatus.isComplete, true);
  assert.equal(isProfileReadyForReport(parsed.profileStatus, true), true);
  assert.equal(parsed.content, "必备信息已全部确认，现在可以点击「生成报告」。");
});

test("坏标记不会被视为已经通过 AI 核验", () => {
  const parsed = extractProfileStatusMarker(
    "回复正文\n<!-- baoyanpilot-profile-status:{bad json} -->",
    { profile: completeProfile },
  );

  assert.equal(parsed.hasValidMarker, false);
  assert.equal(parsed.profileStatus.isComplete, true);
  assert.equal(parsed.content, "回复正文");
});

test("重复标记或标记后仍有正文时核验失败", () => {
  const marker = `<!-- baoyanpilot-profile-status:${JSON.stringify({ profile: completeProfile })} -->`;
  const duplicate = extractProfileStatusMarker(`回复\n${marker}\n${marker}`);
  const notLast = extractProfileStatusMarker(`${marker}\n还有正文`);

  assert.equal(duplicate.hasValidMarker, false);
  assert.equal(notLast.hasValidMarker, false);
});

test("完整对话会签发状态令牌，持有效令牌的报告不依赖末尾状态标记", async () => {
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.DEEPSEEK_API_KEY = "test-key";
  let modelCallCount = 0;
  globalThis.fetch = async () => {
    modelCallCount += 1;
    const content =
      modelCallCount === 1
        ? `资料已经齐全，可以生成报告。\n<!-- baoyanpilot-profile-status:${JSON.stringify({ profile: completeProfile })} -->`
        : modelCallCount === 3
          ? "<!-- baoyanpilot-report -->\n# BaoyanPilot 保研院校梯度规划报告\n## 1. 用户信息核验摘要"
        : `<!-- baoyanpilot-report -->
# BaoyanPilot 保研院校梯度规划报告
## 1. 用户信息核验摘要
## 2. 当前保研画像
## 3. 核心优势
## 4. 主要短板与风险
## 5. 申请路径建议
## 6. 院校梯度建议
### 6.1 冲：冲刺院校
### 6.2 稳：稳妥匹配院校
### 6.3 保：保底保障院校
## 7. 推荐理由汇总
## 8. 未来 30 天行动清单
## 9. 风险说明与官网核验清单`;

    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          choices: [
            {
              message: { content },
              finish_reason: modelCallCount === 3 ? "length" : "stop",
            },
          ],
        });
      },
    };
  };
  const chatResponse = createResponseRecorder();
  const reportResponse = createResponseRecorder();
  const truncatedReportResponse = createResponseRecorder();

  try {
    await recommendHandler(
      {
        method: "POST",
        body: {
          purpose: "chat",
          messages: [
            {
              role: "user",
              content: Object.values(completeProfile).join("；"),
            },
          ],
        },
      },
      chatResponse,
    );

    await recommendHandler(
      {
        method: "POST",
        body: {
          purpose: "report",
          profileStatus: chatResponse.payload.profileStatus,
          profileStatusValidated: chatResponse.payload.profileStatusValidated,
          profileReadinessToken: chatResponse.payload.profileReadinessToken,
          messages: [{ role: "user", content: "生成报告" }],
        },
      },
      reportResponse,
    );

    await recommendHandler(
      {
        method: "POST",
        body: {
          purpose: "report",
          profileStatus: chatResponse.payload.profileStatus,
          profileStatusValidated: true,
          profileReadinessToken: chatResponse.payload.profileReadinessToken,
          messages: [{ role: "user", content: "再次生成报告" }],
        },
      },
      truncatedReportResponse,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey == null) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previousApiKey;
    }
  }

  assert.equal(chatResponse.statusCode, 200);
  assert.equal(chatResponse.payload.reply, "资料已经齐全，可以生成报告。");
  assert.equal(chatResponse.payload.profileStatus.isComplete, true);
  assert.equal(chatResponse.payload.profileStatusValidated, true);
  assert.match(chatResponse.payload.profileReadinessToken, /^[a-f0-9]{64}$/);
  assert.equal(reportResponse.statusCode, 200);
  assert.equal(reportResponse.payload.profileStatusValidated, true);
  assert.equal(
    reportResponse.payload.profileReadinessToken,
    chatResponse.payload.profileReadinessToken,
  );
  assert.match(reportResponse.payload.reply, /baoyanpilot-report/);
  assert.equal(truncatedReportResponse.statusCode, 502);
  assert.match(truncatedReportResponse.payload.error, /报告不完整/);
  assert.equal(modelCallCount, 3);
});

test("无有效令牌的浏览器快照不会被注入模型上下文", async () => {
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.DEEPSEEK_API_KEY = "test-key";
  let outboundPayload;
  globalThis.fetch = async (_url, options) => {
    outboundPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "请先提供基础信息。\n<!-- baoyanpilot-profile-status:{\"profile\":{}} -->",
              },
              finish_reason: "stop",
            },
          ],
        });
      },
    };
  };
  const response = createResponseRecorder();

  try {
    await recommendHandler(
      {
        method: "POST",
        body: {
          purpose: "chat",
          profileStatus: { profile: completeProfile },
          profileStatusValidated: true,
          profileReadinessToken: "forged-token",
          messages: [{ role: "user", content: "谢谢" }],
        },
      },
      response,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey == null) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previousApiKey;
    }
  }

  const systemPrompt = outboundPayload.messages[0].content;
  assert.match(systemPrompt, /\"grade\":null/);
  assert.doesNotMatch(systemPrompt, /年级已确认/);
  assert.equal(response.payload.profileStatus.isComplete, false);
});

test("服务端拒绝资料未齐的报告请求且不会调用模型", async () => {
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.DEEPSEEK_API_KEY = "test-key";
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("不应调用模型");
  };
  const response = createResponseRecorder();

  try {
    await recommendHandler(
      {
        method: "POST",
        body: {
          purpose: "report",
          profileStatus: { profile: { grade: "大二" } },
          profileStatusValidated: true,
          messages: [{ role: "user", content: "生成报告" }],
        },
      },
      response,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey == null) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previousApiKey;
    }
  }

  assert.equal(response.statusCode, 409);
  assert.match(response.payload.error, /尚未全部确认/);
  assert.equal(response.payload.profileStatus.isComplete, false);
  assert.equal(fetchCalled, false);
});

test("服务端拒绝缺少有效签名令牌的完整快照", async () => {
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.DEEPSEEK_API_KEY = "test-key";
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("不应调用模型");
  };
  const response = createResponseRecorder();

  try {
    await recommendHandler(
      {
        method: "POST",
        body: {
          purpose: "report",
          profileStatus: { profile: completeProfile },
          profileStatusValidated: true,
          profileReadinessToken: "forged-token",
          messages: [{ role: "user", content: "生成报告" }],
        },
      },
      response,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey == null) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previousApiKey;
    }
  }

  assert.equal(response.statusCode, 409);
  assert.match(response.payload.error, /尚未全部确认/);
  assert.equal(fetchCalled, false);
});
