// ストーリーモードの動作テスト（ブラウザ）。実行: node tests/story.smoke.mjs
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
async function check(name, fn) {
  const page = await browser.newPage({ locale: "ja-JP" });
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
const clearStory = (page) => page.evaluate(() => {
  window.startStoryStage = () => {};
  for (const id of StoryCore.stageOrder(STORY_CHAPTERS)) {
    StoryUI.playStage(id);
    document.getElementById("storyDlg").classList.remove("open");
    StoryUI.onStageEnd({ grade: "A", rate: 0.9 });
    // 会話を最後まで進める（好みの選択は最初の選択肢）
    for (let k = 0; k < 50 && document.getElementById("storyDlg").classList.contains("open"); k++) {
      const c = document.querySelector("#storyDlg .sdChoices button");
      if (c) c.click(); else document.querySelector("#storyDlg .sdSkip").click();
    }
  }
});
const hidden = (page, sel) => page.evaluate(s => { const el = document.querySelector(s); return !el || el.offsetParent === null || getComputedStyle(el).display === "none"; }, sel);

await check("title has story button", async (page) => {
  assert.ok(await page.evaluate(() => !!document.getElementById("tsStoryBtn")));
});
await check("gacha and collection locked on fresh storage", async (page) => {
  await page.evaluate(() => { profile = { coins: 0, chars: {}, selected: "", plays: 0 }; switchScreen("mypage"); renderMyPage(); });
  assert.strictEqual(await page.evaluate(() => storyGachaUnlocked()), false);
  assert.ok(await hidden(page, "#gacha1Btn"), "gacha button visible");
  assert.ok(await hidden(page, "#mpCollection"), "collection visible");
  assert.ok(await page.evaluate(() => document.getElementById("mpStoryLock").textContent.includes("福井めぐり")));
});
await check("pullGacha does nothing while locked", async (page) => {
  const called = await page.evaluate(async () => { profile = { coins: 999, chars: {} }; let n = 0; const orig = playerAction; playerAction = async () => { n++; return null; }; await pullGacha(1); playerAction = orig; return n; });
  assert.strictEqual(called, 0);
});
await check("clearing the story (logged out) unlocks gacha and shows guide link", async (page) => {
  await clearStory(page);
  assert.strictEqual(await page.evaluate(() => storyGachaUnlocked()), true);
  const href = await page.evaluate(() => document.getElementById("stGuideLink") && document.getElementById("stGuideLink").href);
  assert.strictEqual(href, await page.evaluate(() => STORY_GUIDE_URL));
  assert.ok(await page.evaluate(() => StoryCore.tasteTypeId(StorySave.load().prefs) === "thin_mild"));
  await page.evaluate(() => { profile = { coins: 0, chars: {}, selected: "", plays: 0 }; switchScreen("mypage"); renderMyPage(); });
  assert.ok(!(await hidden(page, "#gacha1Btn")), "gacha still hidden after clear");
});
await check("players who already own characters keep the gacha", async (page) => {
  await page.evaluate(() => { profile = { coins: 0, chars: { minarai: 1 }, selected: "", plays: 0 }; });
  assert.strictEqual(await page.evaluate(() => storyGachaUnlocked()), true);
});
await check("title characters limited to met characters while locked", async (page) => {
  const ids = await page.evaluate(() => { const seen = new Set(); for (let i = 0; i < 40; i++) seen.add(tsNextChar([])); return [...seen].sort(); });
  assert.deepStrictEqual(ids, ["minarai", "shokunin"]);
});
await check("title never repeats the left character when every option is skipped", async (page) => {
  const r = await page.evaluate(() => [tsNextChar(["minarai", "shokunin"]), tsNextChar(["shokunin", "minarai"])]);
  assert.deepStrictEqual(r, ["shokunin", "minarai"]);
});
await check("corrupt save loads as a fresh story", async (page) => {
  await page.evaluate(() => localStorage.setItem("sobamichi_story", "garbage"));
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(() => { try { closeHowTo(); } catch (e) {} StoryUI.open(); });
  assert.deepStrictEqual(await page.evaluate(() => [...document.querySelectorAll("#story .stStage:not(:disabled)")].map(b => b.dataset.stage)), ["1-1"]);
});
await check("english after language switch", async (page) => {
  await page.evaluate(() => localStorage.setItem("sobamichi_lang", "en"));
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(() => { try { closeHowTo(); } catch (e) {} StoryUI.open(); });
  assert.ok(await page.evaluate(() => document.querySelector("#story h1").textContent.includes("Fukui Journey")));
});

await browser.close(); server.kill();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
