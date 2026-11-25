// 自動ログイン（パスワードなし）の動作テスト（ブラウザ）。実行: node tests/login.smoke.mjs
// サーバー(GAS)への通信は横取りして、gas/Code.gs をメモリ上のスプレッドシートで動かして答える。
import { createRequire } from "node:module";
import { spawn, execSync } from "node:child_process";
import assert from "node:assert";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(execSync("npm root -g").toString().trim() + "/playwright")); }
const { makeSheet, makeGas } = require("./gas-mock.cjs");

const port = 8700 + Math.floor(Math.random() * 200);
const server = spawn("python3", ["-m", "http.server", String(port)], { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore" });
await new Promise(r => setTimeout(r, 800));
const url = `http://localhost:${port}/`;
const browser = await chromium.launch();
const shots = process.env.SHOTS_DIR || "";
let failed = 0;

function oldWorld() {
  return makeGas({
    players: makeSheet([["名前", "パスワード", "累計極上", "UUID", "最終更新"], ["たろう", "pass1234", 5, "", ""]]),
    profiles: makeSheet([["名前", "データ", "更新日時"], ["たろう", JSON.stringify({ coins: 1234, chars: { sennin: 1 }, selected: "sennin" }), ""]]),
  });
}

// ctx: ブラウザの保存領域ごと（同じ ctx で開き直す＝同じ端末でもう一度開く）
async function check(name, fn, opts = {}) {
  const gas = opts.gas || makeGas({});
  const ctx = await browser.newContext({ locale: "ja-JP", viewport: opts.viewport || { width: 1280, height: 800 } });
  await ctx.route(/script\.google\.com/, async route => {
    const req = route.request();
    let body;
    if (req.method() === "POST") body = gas.post(JSON.parse(req.postData()));
    else body = Object.fromEntries(new URL(req.url()).searchParams);
    if (req.method() !== "POST") body = gas.get(body);
    if (opts.apiVersion && body.apiVersion) body.apiVersion = opts.apiVersion;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  if (opts.init) await ctx.addInitScript(opts.init);
  const errors = [];
  const open = async () => {
    const page = await ctx.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(url); await page.waitForTimeout(600);
    await page.evaluate(() => { try { closeHowTo(); } catch (e) {} });
    return page;
  };
  try {
    await fn(open, gas);
    assert.deepStrictEqual(errors, [], "page errors");
    console.log("ok   " + name);
  } catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message.split("\n")[0]); }
  await ctx.close();
}
const modalOpen = page => page.evaluate(() => document.getElementById("nameModal").classList.contains("open"));
const passShown = page => page.evaluate(() => document.getElementById("nameModalPass").style.display !== "none");
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("sobamichi_player") || "null"));
const coins = page => page.evaluate(() => document.getElementById("mpCoins").textContent);
async function waitFor(page, fn, what) {
  for (let i = 0; i < 40; i++) { if (await page.evaluate(fn)) return; await page.waitForTimeout(100); }
  throw new Error("timeout: " + what);
}

await check("はじめての人：名前だけで登録 → 開き直しても自動ログイン", async (open, gas) => {
  let page = await open();
  await page.evaluate(() => openMyPage());
  await waitFor(page, () => document.getElementById("nameModal").classList.contains("open"), "modal");
  assert.strictEqual(await passShown(page), false, "password field hidden");
  if (shots) await page.screenshot({ path: shots + "/new-player.png" });
  await page.fill("#nameModalInput", "はなこ");
  await page.click("#nameModalConfirm");
  await waitFor(page, () => document.getElementById("mpCoins").textContent.includes("300"), "coins");
  const acc = await stored(page);
  assert.strictEqual(acc.name, "はなこ");
  assert.match(acc.key, /^sk_[0-9a-f]{32}$/);
  assert.strictEqual(gas.sheets.players.data.length, 2);
  await page.close();
  page = await open(); // 同じ端末でもう一度開く
  await page.evaluate(() => openMyPage());
  await page.waitForTimeout(400);
  assert.strictEqual(await modalOpen(page), false, "no login needed");
  assert.match(await coins(page), /300/);
});

await check("前の名前＋パスワードの人：一度だけ入れて引き継ぎ（そば粉・職人そのまま）", async (open) => {
  const page = await open();
  await page.evaluate(() => openMyPage());
  await waitFor(page, () => document.getElementById("nameModal").classList.contains("open"), "modal");
  await page.click("#nameModalSwitch");
  assert.strictEqual(await passShown(page), true, "password field for transfer");
  if (shots) await page.screenshot({ path: shots + "/transfer.png" });
  await page.fill("#nameModalInput", "たろう");
  await page.fill("#nameModalPass", "wrong");
  await page.click("#nameModalConfirm");
  await waitFor(page, () => document.getElementById("nameModalMsg").innerText.includes("パスワードが違う"), "wrong pass msg");
  await page.fill("#nameModalPass", "pass1234");
  await page.click("#nameModalConfirm");
  await waitFor(page, () => document.getElementById("mpCoins").textContent.includes("1234"), "coins");
  assert.strictEqual((await stored(page)).name, "たろう");
}, { gas: oldWorld() });

await check("登録で使われている名前を選ぶと、引き継ぎを案内する", async (open) => {
  const page = await open();
  await page.evaluate(() => openMyPage());
  await waitFor(page, () => document.getElementById("nameModal").classList.contains("open"), "modal");
  await page.fill("#nameModalInput", "たろう");
  await page.click("#nameModalConfirm");
  await waitFor(page, () => document.getElementById("nameModalMsg").innerText.includes("引き継ぐ"), "taken msg");
}, { gas: oldWorld() });

await check("前の版でログインしたままの人は、裏で自動ログインに切り替わる", async (open) => {
  const page = await open();
  await waitFor(page, () => !!localStorage.getItem("sobamichi_player"), "upgraded");
  assert.strictEqual((await stored(page)).name, "たろう");
  assert.strictEqual(await page.evaluate(() => sessionStorage.getItem("sobamichi_account")), null, "old session cleared");
}, { gas: oldWorld(), init: () => { if (!sessionStorage.getItem("x")) { sessionStorage.setItem("x", "1"); sessionStorage.setItem("sobamichi_account", JSON.stringify({ name: "たろう", pass: "pass1234" })); } } });

await check("職人がいれば、ランクマは名前を聞かずにすぐ始まる", async (open) => {
  const page = await open();
  await page.evaluate(() => openMyPage());
  await waitFor(page, () => document.getElementById("nameModal").classList.contains("open"), "modal");
  await page.fill("#nameModalInput", "はなこ");
  await page.click("#nameModalConfirm");
  await waitFor(page, () => !!localStorage.getItem("sobamichi_player"), "registered");
  await page.evaluate(() => openRankma("30"));
  await page.waitForTimeout(300);
  assert.strictEqual(await modalOpen(page), false);
  assert.strictEqual(await page.evaluate(() => rankmaName), "はなこ");
});

await check("サーバー(GAS)がまだ古いときは、今までどおり名前＋パスワード", async (open) => {
  const page = await open();
  await page.evaluate(() => openMyPage());
  await waitFor(page, () => document.getElementById("nameModal").classList.contains("open"), "modal");
  assert.strictEqual(await passShown(page), true);
  assert.strictEqual(await page.evaluate(() => document.getElementById("nameModalSwitch").style.display), "none");
}, { apiVersion: 6 });

await check("設定画面：自動ログイン中と表示（Google連携は準備中）", async (open) => {
  const page = await open();
  await page.evaluate(() => openMyPage());
  await waitFor(page, () => document.getElementById("nameModal").classList.contains("open"), "modal");
  await page.fill("#nameModalInput", "はなこ");
  await page.click("#nameModalConfirm");
  await waitFor(page, () => !!localStorage.getItem("sobamichi_player"), "registered");
  await page.evaluate(() => { switchScreen("titleScreen"); openCloudSettings(); });
  await page.waitForTimeout(300);
  const txt = await page.evaluate(() => document.getElementById("cloudSettings").innerText);
  assert.ok(txt.includes("自動ログイン中"), txt);
  assert.ok(!txt.includes("ログアウト"), "no logout for auto-login player");
  if (shots) await page.screenshot({ path: shots + "/settings.png" });
}, { viewport: { width: 390, height: 844 } });

await browser.close();
server.kill();
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log("all ok");
