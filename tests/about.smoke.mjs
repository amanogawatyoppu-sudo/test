// 「このゲームについて」・プライバシーポリシー・旧URL案内ページの動作テスト（ブラウザ）。実行: node tests/about.smoke.mjs
import { createRequire } from "node:module";
import { spawn, execSync } from "node:child_process";
import assert from "node:assert";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(execSync("npm root -g").toString().trim() + "/playwright")); }

const port = 8700 + Math.floor(Math.random() * 200);
const server = spawn("python3", ["-m", "http.server", String(port)], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
await new Promise(r => setTimeout(r, 800));
const url = `http://localhost:${port}/`;
const browser = await chromium.launch();
let failed = 0;
async function check(name, fn, opts = {}) {
  const page = await browser.newPage({ locale: "ja-JP", ...opts });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  try {
    await fn(page, errors);
    assert.deepStrictEqual(errors, [], "page errors");
    console.log("ok   " + name);
  } catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message.split("\n")[0]); }
  await page.close();
}
async function openGame(page) {
  await page.goto(url); await page.waitForTimeout(500);
  await page.evaluate(() => { try { closeHowTo(); } catch (e) {} });
  await page.waitForFunction(() => !!window.openCloudSettings, null, { timeout: 5000 });
}
async function openAboutFromSettings(page) {
  await page.evaluate(() => openCloudSettings());
  await page.evaluate(() => document.querySelector("#cloudSettings .cs-about").click());
}
const isOpen = (page, sel) => page.evaluate(s => !!document.querySelector(s + ".open"), sel);

await check("about: opens from settings", async (page) => {
  await openGame(page); await openAboutFromSettings(page);
  assert.ok(await isOpen(page, "#aboutPanel"), "about not open");
  assert.ok(await isOpen(page, "#cloudSettings"), "settings closed");
});
await check("about: shows author and sources", async (page) => {
  await openGame(page); await openAboutFromSettings(page);
  const r = await page.evaluate(() => ({
    author: document.querySelector("#aboutPanel .ab-author").textContent.trim(),
    expected: ABOUT_INFO.author,
    n: document.querySelectorAll("#aboutPanel .ab-sources li").length,
    links: [...document.querySelectorAll("#aboutPanel .ab-sources a")].map(a => [a.target, a.rel]),
  }));
  assert.strictEqual(r.author, r.expected);
  assert.strictEqual(r.n, 5);
  assert.ok(r.links.length >= 5);
  for (const [t, rel] of r.links) { assert.strictEqual(t, "_blank"); assert.ok(rel.includes("noopener")); }
});
await check("about: no mailto when contact empty", async (page) => {
  await openGame(page);
  await page.evaluate(() => { ABOUT_INFO.contact = ""; openAbout(); });
  assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#aboutPanel .ab-contact a[href^="mailto:"]').length), 0);
  assert.ok((await page.evaluate(() => document.querySelector("#aboutPanel .ab-contact").textContent)).includes("準備中"));
  await page.evaluate(() => { closeAbout(); ABOUT_INFO.contact = "x@example.com"; openAbout(); });
  assert.strictEqual(await page.evaluate(() => document.querySelectorAll('#aboutPanel .ab-contact a[href="mailto:x@example.com"]').length), 1);
});
await check("about: english", async (page) => {
  await openGame(page);
  await page.evaluate(() => { document.documentElement.lang = "en"; openAbout(); });
  const heads = await page.evaluate(() => [...document.querySelectorAll("#aboutPanel h2, #aboutPanel h3")].map(h => h.textContent).join("|"));
  assert.ok(heads.includes("Sources"), heads);
  assert.ok(!heads.includes("出典"), heads);
});
await check("about: fits phone width", async (page) => {
  await openGame(page); await openAboutFromSettings(page);
  const w = await page.evaluate(() => { const b = document.querySelector("#aboutPanel .ab-box"); return [b.scrollWidth, b.getBoundingClientRect().right, document.documentElement.scrollWidth]; });
  assert.ok(w[0] <= 375 && w[1] <= 375, JSON.stringify(w));
  assert.ok(await page.evaluate(() => { const b = document.querySelector("#aboutPanel .ab-box"); return getComputedStyle(b).overflowY === "auto" || getComputedStyle(b).overflowY === "scroll"; }), "box not scrollable");
}, { viewport: { width: 375, height: 667 } });
await check("about: close returns to settings", async (page) => {
  await openGame(page); await openAboutFromSettings(page);
  await page.evaluate(() => document.querySelector("#aboutPanel .ab-close").click());
  assert.ok(!(await isOpen(page, "#aboutPanel")), "about still open");
  assert.ok(await isOpen(page, "#cloudSettings"), "settings closed");
});

await check("privacy: page loads", async (page) => {
  await page.goto(url + "privacy.html"); await page.waitForTimeout(200);
  assert.ok((await page.locator("h1:visible").textContent()).includes("プライバシーポリシー"));
  const body = await page.textContent("body");
  assert.ok(body.includes("Firebase") && body.includes("Google Apps Script"));
});
await check("privacy: english", async (page) => {
  await page.goto(url + "privacy.html");
  await page.evaluate(() => localStorage.setItem("sobamichi_lang", "en"));
  await page.reload(); await page.waitForTimeout(200);
  assert.ok((await page.locator("h1:visible").textContent()).includes("Privacy Policy"));
});
await check("privacy: link from about", async (page) => {
  await openGame(page); await page.evaluate(() => openAbout());
  assert.strictEqual(await page.evaluate(() => document.querySelector("#aboutPanel a.ab-privacy").getAttribute("href")), "privacy.html");
  const r = await page.request.get(url + "privacy.html"); assert.strictEqual(r.status(), 200);
});

await check("redirect: forwards with query", async (page) => {
  const fs = await import("node:fs");
  const html = fs.readFileSync(new URL("../tools/old-url-redirect/index.html", import.meta.url), "utf8");
  const swapped = html.replace(/const NEW_URL = "[^"]*";/, `const NEW_URL = "${url}";`);
  assert.notStrictEqual(swapped, html, "NEW_URL constant not found");
  await page.route("**/old/**", r => r.fulfill({ contentType: "text/html", body: swapped }));
  await page.goto(url + "old/?x=1#h");
  await page.waitForURL(u => !u.pathname.startsWith("/old/"), { timeout: 3000 });
  assert.ok(page.url().endsWith("/?x=1#h"), page.url());
});

await browser.close(); server.kill();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
