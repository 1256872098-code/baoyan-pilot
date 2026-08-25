import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

let moduleSequence = 0;

function makeReview(overrides = {}) {
  return {
    id: "review-cloud-1",
    school_id: "school-cloud-1",
    user_id: "author-1",
    user_name: "云端用户",
    rating: 5,
    content: "来自云端的评价",
    created_at: "2026-08-25T08:00:00.000Z",
    ...overrides,
  };
}

function createQuery(result, calls, tableName) {
  const query = {
    select(columns) {
      calls.push(["select", tableName, columns]);
      return query;
    },
    eq(column, value) {
      calls.push(["eq", tableName, column, value]);
      return query;
    },
    order(column, options) {
      calls.push(["order", tableName, column, options]);
      return query;
    },
    in(column, values) {
      calls.push(["in", tableName, column, values]);
      return Promise.resolve(result);
    },
    range(from, to) {
      calls.push(["range", tableName, from, to]);
      return Promise.resolve(result);
    },
    maybeSingle() {
      calls.push(["maybeSingle", tableName]);
      return Promise.resolve(result);
    },
  };
  return query;
}

function createFakeSupabase({ rpcResult, tableResults = {} }) {
  const calls = [];
  return {
    calls,
    client: {
      rpc(name, params) {
        calls.push(["rpc", name, params]);
        return Promise.resolve(rpcResult || { data: [], error: null });
      },
      from(tableName) {
        calls.push(["from", tableName]);
        const result = tableResults[tableName] || { data: [], error: null };
        return createQuery(result, calls, tableName);
      },
    },
  };
}

async function loadRatingModules(fakeSupabase) {
  const globalKey = `__BAOYANPILOT_TEST_SUPABASE_${moduleSequence += 1}__`;
  globalThis[globalKey] = fakeSupabase;

  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    root: process.cwd(),
    server: { middlewareMode: true, hmr: false },
    plugins: [
      {
        name: `school-rating-test-supabase-${moduleSequence}`,
        enforce: "pre",
        resolveId(source) {
          if (source.endsWith("/lib/supabaseClient.js") || source === "../lib/supabaseClient.js") {
            return `\0school-rating-test-supabase-${moduleSequence}`;
          }
          return null;
        },
        load(id) {
          if (id === `\0school-rating-test-supabase-${moduleSequence}`) {
            return [
              `export const supabase = globalThis[${JSON.stringify(globalKey)}];`,
              "export const isSupabaseConfigured = true;",
            ].join("\n");
          }
          return null;
        },
      },
    ],
  });

  const [ratingService, interactionService, runtime] = await Promise.all([
    server.ssrLoadModule("/src/services/schoolRatingService.js"),
    server.ssrLoadModule("/src/services/schoolReviewInteractionService.js"),
    server.ssrLoadModule("/src/services/schoolRatingRuntime.js"),
  ]);

  return {
    ratingService,
    interactionService,
    runtime,
    async close() {
      delete globalThis[globalKey];
      await server.close();
    },
  };
}

test("get_school_reviews RPC 失败时改用 school_reviews 普通查询，且不进入本机模式", async (t) => {
  const cloudReview = makeReview();
  const fake = createFakeSupabase({
    rpcResult: {
      data: null,
      error: { code: "42501", message: "permission denied for function get_school_reviews" },
    },
    tableResults: { school_reviews: { data: [cloudReview], error: null } },
  });
  const modules = await loadRatingModules(fake.client);
  t.after(() => modules.close());

  const reviews = await modules.ratingService.fetchSchoolReviews({ schoolId: cloudReview.school_id });

  assert.deepEqual(reviews, [cloudReview]);
  assert.equal(modules.runtime.getSchoolRatingRuntimeStatus().usesLocalReviews, false);
  assert.ok(fake.calls.some(([operation, name]) => operation === "rpc" && name === "get_school_reviews"));
  assert.ok(fake.calls.some(([operation, name]) => operation === "from" && name === "school_reviews"));
});

test("likes 查询失败时仅点赞能力降级，dislikes 与云端评价继续可用", async (t) => {
  const cloudReview = makeReview();
  const fake = createFakeSupabase({
    rpcResult: { data: [cloudReview], error: null },
    tableResults: {
      school_review_likes: {
        data: null,
        error: { code: "42P01", message: 'relation "school_review_likes" does not exist' },
      },
      school_review_dislikes: {
        data: [{ id: "dislike-1", review_id: cloudReview.id, user_id: "reader-1" }],
        error: null,
      },
    },
  });
  const modules = await loadRatingModules(fake.client);
  t.after(() => modules.close());

  const stats = await modules.interactionService.fetchSchoolReviewInteractionStats([cloudReview.id], "reader-1");
  const reviews = await modules.ratingService.fetchSchoolReviews({ schoolId: cloudReview.school_id });

  assert.equal(stats[cloudReview.id].likeCount, 0);
  assert.equal(stats[cloudReview.id].likedByCurrentUser, false);
  assert.equal(stats[cloudReview.id].dislikeCount, 1);
  assert.equal(stats[cloudReview.id].dislikedByCurrentUser, true);
  assert.deepEqual(reviews, [cloudReview]);
  const runtimeStatus = modules.runtime.getSchoolRatingRuntimeStatus();
  assert.equal(runtimeStatus.usesLocalReviews, false);
  assert.equal(runtimeStatus.likesAvailable, false);
  assert.equal(runtimeStatus.dislikesAvailable, true);
  assert.equal(runtimeStatus.likesStatus, "failed");
  assert.equal(runtimeStatus.dislikesStatus, "ok");
});

test("dislikes 查询失败时仅点踩能力降级，likes 与云端评价继续可用", async (t) => {
  const cloudReview = makeReview();
  const fake = createFakeSupabase({
    rpcResult: { data: [cloudReview], error: null },
    tableResults: {
      school_review_likes: {
        data: [{ id: "like-1", review_id: cloudReview.id, user_id: "reader-1" }],
        error: null,
      },
      school_review_dislikes: {
        data: null,
        error: { code: "42501", message: "permission denied for table school_review_dislikes" },
      },
    },
  });
  const modules = await loadRatingModules(fake.client);
  t.after(() => modules.close());

  const stats = await modules.interactionService.fetchSchoolReviewInteractionStats([cloudReview.id], "reader-1");
  const reviews = await modules.ratingService.fetchSchoolReviews({ schoolId: cloudReview.school_id });

  assert.equal(stats[cloudReview.id].likeCount, 1);
  assert.equal(stats[cloudReview.id].likedByCurrentUser, true);
  assert.equal(stats[cloudReview.id].dislikeCount, 0);
  assert.equal(stats[cloudReview.id].dislikedByCurrentUser, false);
  assert.deepEqual(reviews, [cloudReview]);
  const runtimeStatus = modules.runtime.getSchoolRatingRuntimeStatus();
  assert.equal(runtimeStatus.usesLocalReviews, false);
  assert.equal(runtimeStatus.likesAvailable, true);
  assert.equal(runtimeStatus.dislikesAvailable, false);
  assert.equal(runtimeStatus.likesStatus, "ok");
  assert.equal(runtimeStatus.dislikesStatus, "failed");
});

test("只有 RPC 回退后的 school_reviews 核心查询也失败时才进入本机模式", async (t) => {
  const fake = createFakeSupabase({
    rpcResult: {
      data: null,
      error: { code: "42501", message: "permission denied for function get_school_reviews" },
    },
    tableResults: {
      school_reviews: {
        data: null,
        error: { code: "42P01", message: 'relation "school_reviews" does not exist' },
      },
    },
  });
  const modules = await loadRatingModules(fake.client);
  t.after(() => modules.close());

  const reviews = await modules.ratingService.fetchSchoolReviews({ schoolId: "school-cloud-1" });

  assert.deepEqual(reviews, []);
  assert.equal(modules.runtime.getSchoolRatingRuntimeStatus().usesLocalReviews, true);
});

test("开发环境日志分别输出 reviews、likes、dislikes、RPC 状态以及错误 code/message", async (t) => {
  const cloudReview = makeReview();
  const fake = createFakeSupabase({
    rpcResult: {
      data: null,
      error: { code: "PGRST202", message: "get_school_reviews argument mismatch" },
    },
    tableResults: {
      school_reviews: { data: [cloudReview], error: null },
      school_review_likes: {
        data: null,
        error: { code: "42P01", message: "school_review_likes missing" },
      },
      school_review_dislikes: { data: [], error: null },
    },
  });
  const modules = await loadRatingModules(fake.client);
  t.after(() => modules.close());

  const messages = [];
  const originalDebug = console.debug;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const capture = (...args) =>
    messages.push(
      args
        .map((value) => (typeof value === "string" ? value : JSON.stringify(value)))
        .join(" "),
    );
  console.debug = capture;
  console.info = capture;
  console.warn = capture;
  t.after(() => {
    console.debug = originalDebug;
    console.info = originalInfo;
    console.warn = originalWarn;
  });

  await modules.ratingService.fetchSchoolReviews({ schoolId: cloudReview.school_id });
  await modules.interactionService.fetchSchoolReviewInteractionStats([cloudReview.id], "reader-1");

  const output = messages.join("\n");
  assert.match(output, /reviews[^\n]*ok/i);
  assert.match(output, /likes[^\n]*failed/i);
  assert.match(output, /dislikes[^\n]*ok/i);
  assert.match(output, /rpc[^\n]*failed/i);
  assert.match(output, /PGRST202/);
  assert.match(output, /get_school_reviews argument mismatch/);
  assert.match(output, /42P01/);
  assert.match(output, /school_review_likes missing/);
});
