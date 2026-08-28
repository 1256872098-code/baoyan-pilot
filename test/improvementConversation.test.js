import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import recommendHandler from "../api/recommend.js";
import {
  CONVERSATION_STAGES,
  IMPROVEMENT_OFFER_MESSAGE,
  classifyImprovementReply,
  normalizeConversationStage,
} from "../src/utils/improvementConversation.js";
import { REQUIRED_PROFILE_FIELDS } from "../src/utils/profileCompleteness.js";

const chatSource = readFileSync(new URL("../src/pages/AiRecommendChat.jsx", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../api/recommend.js", import.meta.url), "utf8");
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

test("提升建议邀请能识别肯定、拒绝和直接追问", () => {
  ["需要", "可以", "好的", "行", "帮我分析", "继续"].forEach((value) => {
    assert.equal(classifyImprovementReply(value), "affirmative");
  });
  ["不需要", "暂时不用", "先不了", "不可以", "以后再说"].forEach((value) => {
    assert.equal(classifyImprovementReply(value), "negative");
  });
  assert.equal(classifyImprovementReply("科研和竞赛哪个更重要？"), "affirmative");
  assert.equal(classifyImprovementReply("谢谢"), "unclear");
});

test("报告完成后才进入提升建议阶段，拒绝不会删除报告或关闭 PDF", () => {
  assert.equal(
    normalizeConversationStage(null, [{ role: "assistant", messageType: "report" }]),
    CONVERSATION_STAGES.RECOMMENDATION_COMPLETE,
  );
  assert.equal(
    IMPROVEMENT_OFFER_MESSAGE,
    "院校定位已经完成。需要我结合你的个人背景，进一步分析接下来最值得投入的努力方向吗？",
  );
  assert.match(chatSource, /IMPROVEMENT_OFFER_MESSAGE/);
  assert.match(chatSource, /if \(isReport\)[\s\S]*?IMPROVEMENT_OFFER_MESSAGE/);
  assert.match(chatSource, /messageType:\s*shouldRequestImprovement\s*\?\s*"improvement_advice"/);
  assert.match(chatSource, /已生成的院校推荐和报告会继续保留，不会受到影响/);
  assert.match(chatSource, /\.find\(\(message\) => message\.role === "assistant" && message\.messageType === "report"\)/);
  assert.doesNotMatch(chatSource, /latestReportIndex > latestUserMessageIndex/);
});

test("提升建议使用独立 purpose、既有资料快照和指定输出结构", async () => {
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.DEEPSEEK_API_KEY = "test-key";
  const outboundPayloads = [];
  let modelCallCount = 0;

  globalThis.fetch = async (_url, options) => {
    modelCallCount += 1;
    outboundPayloads.push(JSON.parse(options.body));
    const content = modelCallCount === 1
      ? `资料已经齐全，可以生成报告。\n<!-- baoyanpilot-profile-status:${JSON.stringify({ profile: completeProfile })} -->`
      : "### 下一阶段提升重点\n\n第一优先级：英语\n\n### 当前优势\n\n排名较好\n\n### 不建议过度投入的方向\n\n重复刷分\n\n### 阶段性目标\n\n完成六级提升";
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] });
      },
    };
  };

  const chatResponse = createResponseRecorder();
  const improvementResponse = createResponseRecorder();

  try {
    await recommendHandler({
      method: "POST",
      body: {
        purpose: "chat",
        messages: [{ role: "user", content: Object.values(completeProfile).join("；") }],
      },
    }, chatResponse);

    await recommendHandler({
      method: "POST",
      body: {
        purpose: "improvement",
        conversationStage: "improvement_offer",
        profileStatus: chatResponse.payload.profileStatus,
        profileStatusValidated: chatResponse.payload.profileStatusValidated,
        profileReadinessToken: chatResponse.payload.profileReadinessToken,
        messages: [{ role: "user", content: "需要" }],
      },
    }, improvementResponse);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey == null) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousApiKey;
  }

  const improvementSystemPrompt = outboundPayloads[1].messages[0].content;
  assert.equal(improvementResponse.statusCode, 200);
  assert.equal(improvementResponse.payload.profileStatusValidated, true);
  assert.equal(
    improvementResponse.payload.profileReadinessToken,
    chatResponse.payload.profileReadinessToken,
  );
  assert.match(improvementSystemPrompt, /首次生成提升建议/);
  assert.match(improvementSystemPrompt, /### 下一阶段提升重点/);
  assert.match(improvementSystemPrompt, /### 当前优势/);
  assert.match(improvementSystemPrompt, /### 不建议过度投入的方向/);
  assert.match(improvementSystemPrompt, /### 阶段性目标/);
  assert.match(improvementSystemPrompt, /不得再次推荐院校/);
  assert.doesNotMatch(improvementResponse.payload.reply, /院校梯度建议|baoyanpilot-report/);
  assert.match(apiSource, /purpose === "improvement"/);
});

test("提升建议后续追问直接复用背景，不重复收集资料", () => {
  assert.match(apiSource, /提升建议后续追问/);
  assert.match(apiSource, /直接回答用户本轮的具体追问/);
  assert.match(apiSource, /不要重新询问快照中已有信息/);
  assert.match(apiSource, /不重新收集资料/);
});
