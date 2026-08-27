import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const forumPage = readFileSync(new URL("../src/pages/ForumPage.jsx", import.meta.url), "utf8");
const migrationSql = readFileSync(new URL("../supabase/forum-categories.sql", import.meta.url), "utf8");

const expectedCategories = [
  "全部",
  "保研经验",
  "院校与政策",
  "申请准备",
  "推免阶段",
  "面试考核",
  "竞赛科研",
  "答疑求助",
];

test("论坛筛选和发帖统一使用新的七类内容分类", () => {
  expectedCategories.forEach((category) => {
    assert.match(forumPage, new RegExp(category));
  });

  const categoriesBlock = forumPage.match(/const categories = \[([\s\S]*?)\];/)?.[1] || "";
  ["院校信息", "材料准备", "夏令营", "预推免", "九推", "面试经验"].forEach((legacyCategory) => {
    assert.doesNotMatch(categoriesBlock, new RegExp(legacyCategory));
  });
});

test("历史分类在页面和数据库中迁移到新分类", () => {
  const mappings = {
    院校信息: "院校与政策",
    材料准备: "申请准备",
    夏令营: "推免阶段",
    预推免: "推免阶段",
    九推: "推免阶段",
    面试经验: "面试考核",
  };

  Object.entries(mappings).forEach(([from, to]) => {
    assert.match(forumPage, new RegExp(`${from}: "${to}"`));
    assert.match(migrationSql, new RegExp(`when '${from}' then '${to}'`));
  });
  assert.match(migrationSql, /forum_posts_category_allowed/);
});
