import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const headerSource = readFileSync(new URL("../src/components/Header.jsx", import.meta.url), "utf8");
const contactSource = readFileSync(new URL("../src/components/ContactModal.jsx", import.meta.url), "utf8");
const sponsorImage = new URL("../public/images/wechat-sponsor-qr.jpg", import.meta.url);

test("桌面和移动账号菜单都在退出登录下方提供联系我们入口", () => {
  assert.equal((headerSource.match(/联系我们/g) || []).length, 2);
  assert.equal((headerSource.match(/onClick=\{handleOpenContact\}/g) || []).length, 2);
  assert.ok(headerSource.indexOf("退出登录") < headerSource.indexOf("联系我们"));
});

test("联系我们弹窗包含商务微信、赞助二维码和反馈意见入口", () => {
  assert.match(contactSource, /商务合作请加 V：/);
  assert.match(contactSource, /CUFEwwsa/);
  assert.match(contactSource, /赞助我们/);
  assert.match(contactSource, /向我们提出反馈意见/);
  assert.match(contactSource, /maxlength=\{500\}/i);
  assert.match(contactSource, /\/images\/wechat-sponsor-qr\.jpg/);
  assert.equal(existsSync(sponsorImage), true);
});
