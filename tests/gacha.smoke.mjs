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

// 「引く」ボタンからの流れ。サーバーの代わりに playerAction を差し替える
const wire = (page, mode) => page.evaluate(m => {
  window.__calls = 0;
  profile = { name: "t", coins: 1000, chars: {} };
  window.storyGachaUnlocked = () => true;
  window.renderMyPage = () => {};
  window.playerAction = async () => {
    window.__calls++;
    await new Promise(r => setTimeout(r, 200));
    if (m === "ok") return { status: "ok", results: [{ id: "minarai", rarity: "N", dup: true, refund: 10 }] };
    if (m === "no_coins") return { status: "no_coins" };
    if (m === "null") return null;
    throw new Error("net");
  };
}, mode);
const overlayOpen = (page) => page.evaluate(() => document.getElementById("gachaOverlay").classList.contains("open"));
const status = (page) => page.evaluate(() => document.getElementById("mpStatus").textContent);

await check("引く→演出→結果一覧", async (page) => {
  await wire(page, "ok");
  await page.evaluate(() => { pullGacha(1); });
  await page.waitForTimeout(50);
  assert.strictEqual(await phase(page), "charge", "演出は通信中から始まる");
  await waitPhase(page, "card");
  assert.strictEqual(await overlayOpen(page), false);
  await runThrough(page);
  assert.strictEqual(await overlayOpen(page), true);
  assert.strictEqual(await page.evaluate(() => isPulling), false);
});

for (const [mode, want] of [["no_coins", "そば粉が足りない"], ["null", "対応していない"], ["throw", "通信失敗"]]) {
  await check(`引く→${mode}：演出を閉じてメッセージ`, async (page) => {
    await wire(page, mode);
    await page.evaluate(() => pullGacha(1));
    assert.strictEqual(await isOpen(page), false);
    assert.ok((await status(page)).includes(want), await status(page));
    assert.strictEqual(await page.evaluate(() => isPulling), false);
  });
}

await check("演出中にもう一度引いても始まらない", async (page) => {
  await wire(page, "ok");
  await page.evaluate(() => { pullGacha(1); });
  await waitPhase(page, "card");
  await page.evaluate(() => { pullGacha(1); });
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => window.__calls), 1);
  await runThrough(page);
});

await check("通信が返らないとき、しばらくすると閉じられる", async (page) => {
  await page.evaluate(() => { window.__done = 0; GachaReveal.WAIT_CLOSE_MS = 300; GachaReveal.begin(); });
  const skipShown = () => page.evaluate(() => getComputedStyle(document.querySelector("#gachaReveal .grSkip")).display !== "none");
  assert.strictEqual(await skipShown(), false);
  await page.waitForTimeout(450);
  assert.strictEqual(await skipShown(), true);
  await page.evaluate(() => document.querySelector("#gachaReveal .grSkip").click());
  assert.strictEqual(await isOpen(page), false);
  // あとから結果が届いたら、演出は出さずに結果一覧へ
  await page.evaluate(() => GachaReveal.play([{ id: "minarai", rarity: "N", dup: true }], () => { window.__done++; }));
  assert.strictEqual(await done(page), 1);
  assert.strictEqual(await isOpen(page), false);
});

await check("横向きスマホでも初登場演出とカードが画面に収まる", async (page) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await start(page, [{ id: "sennin", rarity: "SSR", dup: false }]);
  await waitPhase(page, "card");
  await page.waitForTimeout(400);
  const card = await page.evaluate(() => { const r = document.querySelector("#gachaReveal .grCard").getBoundingClientRect(), h = document.querySelector("#gachaReveal .grCardWrap .grHint").getBoundingClientRect(); return { top: r.top, bottom: r.bottom, hintTop: h.top }; });
  assert.ok(card.top >= 0 && card.bottom <= card.hintTop, JSON.stringify(card));
  await tap(page); await waitPhase(page, "special");
  await page.waitForTimeout(1500);
  const sp = await page.evaluate(() => { const q = document.querySelector("#gachaReveal .grSpQuote").getBoundingClientRect(), b = document.querySelector("#gachaReveal .grBig").getBoundingClientRect(), h = document.querySelector("#gachaReveal .grSpecial .grHint").getBoundingClientRect(); return { bigTop: b.top, bigBottom: b.bottom, qBottom: q.bottom, hintTop: h.top, H: innerHeight }; });
  assert.ok(sp.bigTop >= 0 && sp.bigBottom <= sp.H && sp.qBottom <= sp.hintTop, JSON.stringify(sp));
});

await browser.close();
server.kill();
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log("all ok");
