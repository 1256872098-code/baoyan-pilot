import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import recommendHandler from "../api/recommend.js";

const apiSource = readFileSync(new URL("../api/recommend.js", import.meta.url), "utf8");

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

function createDeepSeekResponse({ status = 200, content = "", finishReason = "stop" } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    async text() {
      return JSON.stringify({
        choices: [{
          message: {
            content,
            reasoning_content: content ? "" : "模型只生成了推理内容",
          },
          finish_reason: finishReason,
        }],
        ...(status >= 400 ? { error: { message: "temporary upstream error" } } : {}),
      });
    },
  };
}

test("DeepSeek V4 请求显式关闭思考模式，避免推理耗尽最终回复预算", () => {
  assert.match(apiSource, /thinking:\s*\{ type: "disabled" \}/);
  assert.match(apiSource, /process\.env\.DEEPSEEK_MODEL \|\| "deepseek-v4-flash"/);
  assert.doesNotMatch(apiSource, /temporarily change the model to "deepseek-chat"/);
});

test("上游首次返回空 content 时自动重试并返回第二次有效回复", async () => {
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.DEEPSEEK_API_KEY = "test-key";
  const outboundBodies = [];

  globalThis.fetch = async (_url, options) => {
    outboundBodies.push(JSON.parse(options.body));
    return outboundBodies.length === 1
      ? createDeepSeekResponse({ content: "", finishReason: "length" })
      : createDeepSeekResponse({ content: "请继续补充你的年级和专业。" });
  };

  const response = createResponseRecorder();
  try {
    await recommendHandler({
      method: "POST",
      body: { messages: [{ role: "user", content: "你好" }] },
    }, response);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey == null) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousApiKey;
  }

  assert.equal(outboundBodies.length, 2);
  assert.deepEqual(outboundBodies[0].thinking, { type: "disabled" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.reply, "请继续补充你的年级和专业。");
});

test("连续空回复后返回友好错误且不泄露推理内容", async () => {
  const previousApiKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.DEEPSEEK_API_KEY = "test-key";
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    return createDeepSeekResponse({ content: "", finishReason: "length" });
  };

  const response = createResponseRecorder();
  try {
    await recommendHandler({
      method: "POST",
      body: { messages: [{ role: "user", content: "你好" }] },
    }, response);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey == null) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousApiKey;
  }

  assert.equal(callCount, 2);
  assert.equal(response.statusCode, 502);
  assert.match(response.payload.error, /已确认的资料不会丢失/);
  assert.doesNotMatch(response.payload.error, /推理内容/);
});
