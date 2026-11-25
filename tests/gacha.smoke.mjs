// ガチャ演出の動作テスト（ブラウザ）。実行: node tests/gacha.smoke.mjs
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
  const page = await browser.newPage({ locale: "ja-JP" });
  if (opts.lang) await page.addInitScript(l => localStorage.setItem("sobamichi_lang", l), opts.lang);
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  try {
    await page.goto(url); await page.waitForTimeout(500);
    await page.evaluate(() => { try { closeHowTo(); } catch (e) {} });
    await fn(page);
    assert.deepStrictEqual(errors, [], "page errors");
    console.log("ok   " + name);
  } catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message.split("\n")[0]); }
  await page.close();
}
const phase = (page) => page.evaluate(() => document.getElementById("gachaReveal") && document.getElementById("gachaReveal").dataset.phase);
const tap = (page) => page.evaluate(() => document.getElementById("gachaReveal").click());
// 結果を直接渡して演出を始める。done が呼ばれた回数は window.__done に入る
const start = (page, results) => page.evaluate(rs => {
  window.__done = 0;
  GachaReveal.begin();
  GachaReveal.play(rs, () => { window.__done++; });
}, results);
const waitPhase = async (page, want) => {
  for (let i = 0; i < 60; i++) { if (await phase(page) === want) return; await page.waitForTimeout(100); }
  throw new Error(`phase stayed ${await phase(page)}, wanted ${want}`);
};
const done = (page) => page.evaluate(() => window.__done);
const isOpen = (page) => page.evaluate(() => GachaReveal.isOpen());
// 引いた結果を最後まで進める
const runThrough = async (page) => {
  for (let i = 0; i < 80 && await isOpen(page); i++) { await tap(page); await page.waitForTimeout(60); }
};

const ten = [
  ...["minarai", "kamaban", "soba_hatake", "oroshi_musume", "shokunin", "ekiin", "ashigaru"].map(id => ({ id, rarity: id === "shokunin" || id === "ekiin" || id === "ashigaru" ? "R" : "N", dup: true, refund: 10 })),
  { id: "honda", rarity: "SR", dup: false }, { id: "kasumi", rarity: "SR", dup: false }, { id: "sennin", rarity: "SSR", dup: false },
];

await check("1回引き・かぶりN：タメ→カード→2回タップで終わる", async (page) => {
  await start(page, [{ id: "minarai", rarity: "N", dup: true, refund: 10 }]);
  assert.strictEqual(await phase(page), "charge");
  await waitPhase(page, "card");
  await tap(page); await page.waitForTimeout(80);
  assert.strictEqual(await done(page), 0);
  await tap(page); await page.waitForTimeout(80);
  assert.strictEqual(await done(page), 1);
  assert.strictEqual(await isOpen(page), false);
});

await check("タメはタップで早送りできる", async (page) => {
  await start(page, [{ id: "minarai", rarity: "N", dup: true }]);
  await page.waitForTimeout(100);
  await tap(page); await page.waitForTimeout(100);
  assert.strictEqual(await phase(page), "card");
});

await check("初登場SSR：名前とセリフの特別演出", async (page) => {
  await start(page, [{ id: "sennin", rarity: "SSR", dup: false }]);
  await waitPhase(page, "card");
  await tap(page); await page.waitForTimeout(80);
  await waitPhase(page, "special");
  const txt = await page.evaluate(() => document.getElementById("gachaReveal").innerText);
  assert.ok(txt.includes("越前そば仙人"), "name");
  assert.ok(txt.includes("ふぉっふぉっ"), "quote");
  assert.ok(txt.includes("NEW"), "NEW stamp");
  await page.waitForTimeout(350); // 特別演出は出てすぐのタップを無視する（読む前に飛ばさないため）
  await tap(page); await page.waitForTimeout(80);
  assert.strictEqual(await done(page), 1);
});

await check("10連：スキップで一度だけ終わる", async (page) => {
  await start(page, ten);
  await waitPhase(page, "card");
  await page.evaluate(() => document.querySelector("#gachaReveal .grSkip").click());
  await page.waitForTimeout(100);
  assert.strictEqual(await done(page), 1);
  assert.strictEqual(await isOpen(page), false);
  await page.waitForTimeout(300);
  assert.strictEqual(await done(page), 1);
});

await check("10連：最後まで進めると初登場3回を通って一度だけ終わる", async (page) => {
  await start(page, ten);
  await waitPhase(page, "card");
  let specials = 0, last = null;
  for (let i = 0; i < 80 && await isOpen(page); i++) {
    const p = await phase(page);
    if (p === "special" && last !== "special") specials++;
    last = p;
    await tap(page); await page.waitForTimeout(60);
  }
  assert.strictEqual(specials, 3);
  assert.strictEqual(await done(page), 1);
});

await check("cancel：何も残さず閉じる", async (page) => {
  await page.evaluate(() => { window.__done = 0; GachaReveal.begin(); });
  assert.strictEqual(await isOpen(page), true);
  await page.evaluate(() => GachaReveal.cancel());
  assert.strictEqual(await isOpen(page), false);
  const vis = await page.evaluate(() => getComputedStyle(document.getElementById("gachaReveal")).display);
  assert.strictEqual(vis, "none");
});

await check("画像が読めないキャラは絵文字になる", async (page) => {
  await page.evaluate(() => { CHARACTERS.minarai.img = "chars/none.webp"; });
  await start(page, [{ id: "minarai", rarity: "N", dup: false }]);
  await waitPhase(page, "card");
  await tap(page); await waitPhase(page, "special");
  await page.waitForTimeout(400);
  const txt = await page.evaluate(() => document.querySelector("#gachaReveal .grSpecial").innerText);
  assert.ok(txt.includes("👦"), "emoji fallback");
  await runThrough(page);
});

await check("英語表示でも最後まで通る", async (page) => {
  await start(page, [{ id: "sennin", rarity: "SSR", dup: false }]);
  await waitPhase(page, "card");
  await tap(page); await waitPhase(page, "special");
  const txt = await page.evaluate(() => document.getElementById("gachaReveal").innerText);
  assert.ok(txt.includes("Echizen Soba Sage"), "english name");
  await runThrough(page);
  assert.strictEqual(await done(page), 1);
}, { lang: "en" });

await check("音が使えなくても演出は止まらない", async (page) => {
  await page.evaluate(() => audioContext.close());
  await start(page, ten);
  await waitPhase(page, "card");
  await runThrough(page);
  assert.strictEqual(await done(page), 1);
});

await browser.close();
server.kill();
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log("all ok");
