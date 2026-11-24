# 福井めぐりストーリーモード Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a story mode where the player tours six Fukui areas (6 chapters × 3 stages = 18 rhythm stages), learns how to eat oroshi bukkake, gets a "soba type" from their taste picks, and is pointed to the official tourism guide. Clearing the story unlocks the gacha.

**Architecture:** The story code lives in new files under `story/`, so `index.html` only gets small hooks. That keeps merge conflicts with the parallel "自動ログインとデータ引き継ぎ" thread small. The pure rules (progression, clear check, soba type, gacha lock) live in `story/story-core.js` and are unit-tested with `node --test`. Progress is saved through a single `StorySave` object (load/save), so the new save system from the other thread can replace the backend without touching the rules. Stages play through the existing Rhythm Mode engine, using a story song override.

**Tech Stack:** Plain browser JS (no build step), `node --test` for unit tests, the pre-installed Playwright for one smoke test.

**Spec:** `docs/superpowers/specs/2026-11-24-fukui-story-mode-design.md`

## Global Constraints

- The existing modes (Rhythm, Reflex 30/60/Endless, Daily, Ranked) stay and are playable from the start. The title screen lets the player choose "ストーリー" or the existing modes.
- Story results are never sent to the rankings (GAS). The ranking save areas stay hidden on story results, and `fetchRankPosition()` is not called.
- The gacha and the character collection (職人図鑑) are hidden until the story is cleared. A player who already owns any character keeps both.
- Story stages are played without character buffs. This already happens because `activeCharacter()` returns null when `isRhythm` is true.
- Every visible string goes through `T(ja, en)`. Both Japanese and English are required.
- History and legend are written as "〜と伝わる / 〜とも言われる", never stated as fact.
- No real shop names. The shop data slot `STORY_SHOPS` ships empty.
- The official guide link goes to FUKU-iro (福井県観光連盟) soba listing. The executor confirms the exact URL resolves before committing it.
- Each explanation in dialogue is at most 2–3 frames (lines) in a row.
- Story progress is stored only through `StorySave`, using the localStorage key `sobamichi_story`. The cloud-save thread copies every `sobamichi_*` key to Firestore automatically. It rewrites localStorage and reloads on account switch, so always read with `StorySave.load()` and never cache state across a page load. Do not touch `tsFooter` or the final `js/cloud-save.js` script tag; those belong to that thread.
- Plan change from the spec, to report to 会長: spec §5.7 promised one free gacha pull on clear. That would need a new GAS action, and a client-only grant could be forged. Instead, story stages earn soba flour through the existing `earnCoins()` like every other play, so a logged-in player has flour ready when the gacha unlocks.

## Review Focus

1. A player who already owns characters (from the server profile) must not lose the gacha or collection. Test: `gachaUnlocked(state, {minarai:1})` is true with an empty story state.
2. Logged-out players can play the whole story (no profile needed). The gacha lock message must not crash when `profile` is null. Test: in the Task 5 smoke test, clear the story without logging in.
3. Quitting or failing mid-stage must not mark it cleared or skip ahead. Test: `recordClear` with rate 0.59 leaves the stage uncleared.
4. Corrupt or old localStorage data (`sobamichi_story` = "garbage" or missing fields) must load as a fresh state, not throw. Test in Task 1.
5. Language switch while on a story screen re-renders in the new language. Covered by rendering through `T()` on every open and checked in the smoke test.

---

## File Structure

- Create `story/story-core.js`: pure rules, no DOM. Works in the browser (`window.StoryCore`) and in Node (`module.exports`).
- Create `story/story-save.js`: `StorySave` with localStorage backend. This is the swap point for the new save system.
- Create `story/story-data.js`: `STORY_CHAPTERS`, `STORY_TASTE_TYPES`, `STORY_GUIDE_URL`, `STORY_SHOPS` (empty). Content only.
- Create `story/story-ui.js`: chapter map screen, dialogue overlay, taste picks, final result screen. It also provides the hooks that `index.html` calls.
- Create `docs/story/content-review.md`: every fact and eating tip, with its source URL, for 会長 to check.
- Modify `index.html`: script tags, a `#story` screen container, a title button, the `switchScreen` list, `rhythmSong()` override, an `endGame()` hook, and the gacha/collection/title-character gating.
- Tests: `tests/story-core.test.js` (node), `tests/story.smoke.mjs` (Playwright).

---

### Task 1: Story rules and save

**Files:**
- Create: `story/story-core.js`, `story/story-save.js`
- Test: `tests/story-core.test.js`

**Interfaces:**
- Produces (on `StoryCore`):
  - `STORY_CLEAR_RATE = 0.6`
  - `newState() -> { v:1, cleared:{}, prefs:{ noodle:null, spice:null }, finished:false }`
  - `normalize(raw:any) -> State` (anything invalid becomes `newState()`, and missing fields are filled in)
  - `stageOrder(chapters) -> string[]` (flat list of stage ids in play order)
  - `isUnlocked(state, chapters, stageId) -> boolean` (first stage always; otherwise the previous stage is cleared)
  - `recordClear(state, stageId, rate:number, grade:string) -> { state, cleared:boolean }` (cleared when `rate >= STORY_CLEAR_RATE`; keeps the best grade; never un-clears; returns a new object)
  - `isStoryCleared(state, chapters) -> boolean` (every stage cleared)
  - `setPref(state, key:"noodle"|"spice", value:"thin"|"thick"|"mild"|"hot") -> State`
  - `tasteTypeId(prefs) -> "thin_mild"|"thin_hot"|"thick_mild"|"thick_hot"|null`
  - `metCharacters(state, chapters) -> string[]` (guide ids of chapters whose first stage is cleared, plus `minarai` and `shokunin` always)
  - `gachaUnlocked(state, chapters, ownedChars:object|null) -> boolean` (story cleared OR any `ownedChars[id] > 0`)
- Produces (on `StorySave`): `load() -> State` and `save(state) -> void`, using key `sobamichi_story` and wrapped in try/catch.

- [ ] **Step 1: Write failing tests** in `tests/story-core.test.js` using `node:test` and `assert`, with a 2-chapter × 2-stage fixture:
  - `newState` shape equals the object above
  - `normalize("garbage")`, `normalize(null)` and `normalize({v:1})` all deep-equal `newState()` (with filled fields)
  - `isUnlocked` is true for the first stage and false for the second, and becomes true after `recordClear(first, 0.6, "B")`
  - `recordClear(s, id, 0.59, "C").cleared === false`; at 0.6 it is true; a later 0.3 run leaves it cleared and keeps the best grade
  - `isStoryCleared` is false until all 4 are cleared
  - `tasteTypeId({noodle:"thick",spice:"hot"}) === "thick_hot"`; with one null it returns null
  - `gachaUnlocked(newState(), ch, null) === false`; `gachaUnlocked(newState(), ch, {minarai:1}) === true`; `gachaUnlocked(newState(), ch, {minarai:0}) === false`; all-cleared returns true
  - `metCharacters(newState(), ch)` deep-equals `["minarai","shokunin"]`
- [ ] **Step 2: Run** `node --test tests/` and expect FAIL (module not found).
- [ ] **Step 3: Implement** `story/story-core.js` (UMD-style: `if (typeof module !== "undefined") module.exports = StoryCore; else window.StoryCore = StoryCore;`) and `story/story-save.js` (uses `StoryCore.normalize` on load).
- [ ] **Step 4: Run** `node --test tests/` and expect all PASS.
- [ ] **Step 5: Commit** with "Add story mode rules and save".

### Task 2: Story content and review sheet

**Files:**
- Create: `story/story-data.js`, `docs/story/content-review.md`
- Test: extend `tests/story-core.test.js` with a data-shape test

**Interfaces:**
- Produces `STORY_CHAPTERS: Chapter[]`, where `Chapter = { id, area:{ja,en}, guides:string[] /* CHARACTERS ids */, stages: Stage[3] }` and `Stage = { id, kind:"meet"|"train"|"taste", title:{ja,en}, diff:"easy"|"normal"|"hard", song:{ style:"matsuri"|"yokai", bpm:number, seed:number, form:Array }, before: Line[], after: Line[], tip?: {ja,en} }`. `Line = { who:string /* CHARACTERS id or "you" */, ja, en }`. Stage 2 of chapter 2 has `ask:"noodle"`, and stage 2 of chapter 4 has `ask:"spice"` (the taste picks).
- Produces `STORY_TASTE_TYPES: { [tasteTypeId]: { name:{ja,en}, hint:{ja,en} } }`, `STORY_GUIDE_URL: string` and `STORY_SHOPS: []`.

Values pinned by the spec:
- Chapter order and guides: 1 越前市（武生）[minarai, shokunin], 2 鯖江市 [megane], 3 南越前町（今庄）[ekiin], 4 福井市（一乗谷）[ashigaru], 5 勝山・大野 [kyoryu, soba_hatake], 6 越前府中の城 [honda, kaneko].
- Chapter topics: 1 how to eat oroshi bukkake, 2 noodle thickness, 3 post-town and soba history, 4 daikon spiciness, 5 soba flowers and new-soba season, 6 origin of Echizen oroshi soba (as legend).
- The stage kinds in each chapter are meet → train → taste.
- The story: the player ("you") is a traveller from outside Fukui; minarai is 兄弟子 and shokunin is 親方. Chapter 6's last stage ends with the player recognised as 一人前.
- Difficulty: chapters 1–2 easy, 3–5 normal, the last stage of chapter 6 hard, and the rest of chapter 6 normal.
- Song `form` is short (about 40–60 s): an I, A, B, C, O pattern in the same format as `RHYTHM_SONGS.hyakki.form`. Each stage has a distinct `seed`.

- [ ] **Step 1: Write a failing test** `story data shape`: it requires `story/story-data.js` and asserts 6 chapters, 3 stages each, unique stage ids, every `who` either "you" or one of the 16 `CHARACTERS` ids (hardcode the list in the test), every Line has non-empty `ja` and `en`, exactly one stage with `ask:"noodle"` and one with `ask:"spice"`, 4 taste types, `STORY_SHOPS.length === 0`, and `STORY_GUIDE_URL` starting with `https://`.
- [ ] **Step 2: Run** `node --test tests/` and expect FAIL.
- [ ] **Step 3: Research and draft content.** Use public sources only (Fukui Prefecture, the cities and towns, 福井県観光連盟 / FUKU-iro, soba associations). For each tip or fact, add a row to `docs/story/content-review.md` with columns stage id, text (ja), source URL and "要確認" notes. Keep the playful tone of the existing `CHARACTERS` bios and quotes, and keep explanations to 2–3 lines.
- [ ] **Step 4: Write `story/story-data.js`** from that draft.
- [ ] **Step 5: Run** `node --test tests/` and expect PASS.
- [ ] **Step 6: Commit** with "Add story mode content draft and review sheet".

### Task 3: Story screens

**Files:**
- Create: `story/story-ui.js`
- Modify: `index.html`, adding `<div id="story"></div>` next to the other screens, `"story"` in the `screens` array of `switchScreen` (line ~1667), and `<script src="story/…">` tags (core, save, data, ui) before the main inline `<script>` (line ~1248).

**Interfaces:**
- Consumes: Task 1 `StoryCore` and `StorySave`, and Task 2 data. From `index.html`, it uses `T`, `CHARACTERS`, `switchScreen`, `RARITY_COLOR` and `LANG`.
- Produces on `window.StoryUI`:
  - `open()`: shows the chapter map (`switchScreen("story")`). Each stage is a button; locked ones are disabled. The final result button appears when the story is cleared.
  - `playStage(stageId)`: shows the `before` dialogue, then calls `startStoryStage(stage)` (Task 4)
  - `onStageEnd(rr:{grade,rate,fc,ap})`: records the result and shows `after` dialogue + `tip` if cleared, or a retry prompt if not. Handles the `ask` pick, saves, and returns to the map. On the first full clear, it shows the unlock notice and the final result.
  - `showResult()`: the soba type name and hint, a "食べ方カード" listing every `tip`, and a link button to `STORY_GUIDE_URL` (`target="_blank" rel="noopener"`)
  - `rerender()`: called after the language switch.
- Dialogue: a tap or click advances one Line. The character image comes from `CHARACTERS[who].img`, and "you" shows no image. A skip button jumps to the end of the dialogue. The look and feel follow the existing menu styles; details are left to the builder.

- [ ] **Step 1: Implement** `story/story-ui.js` and the `index.html` container, switchScreen entry and script tags.
- [ ] **Step 2: Hook the language switch:** in `toggleLang()` (line ~1297, after `LANG` is set), call `window.StoryUI && StoryUI.rerender()`.
- [ ] **Step 3: Manual check:** run `python3 -m http.server 8123` and open `http://localhost:8123/`. Calling `StoryUI.open()` in the console shows 6 chapters, with only stage 1-1 enabled.
- [ ] **Step 4: Commit** with "Add story mode screens".

### Task 4: Play stages through the rhythm engine

**Files:**
- Modify: `index.html`, at `rhythmSong` (line ~1385), `endGame()` (line ~3068) and the title menu (line ~1026)

**Interfaces:**
- Produces global `isStory:boolean`, `storySong:object|null` and `startStoryStage(stage) -> void` in `index.html`.
  - `startStoryStage` sets `storySong = { key:"story_"+stage.id, type:"gen", style, bpm, seed, form, icon:"🗺️", title:()=>T(stage.title.ja, stage.title.en), credit:()=>T("オリジナル曲","Original song"), mood:()=>"" }`, `isStory = true` and `rhythmDiff = RHYTHM_DIFFS[stage.diff]`. It also sets `isRankmaMode=false; isDaily=false; reflexSilent=false; isRhythm=true; isInfinite=false; currentMode="story_"+stage.id`, then `startWithCountdown(...)` the same way `startRhythm` does.
- `rhythmSong` becomes `() => storySong || RHYTHM_SONGS[rhythmSongKey]`.
- Every existing start function (`startRhythm`, `startNormal`, `startNormalInfinite`, `startDaily`, and the Ranked start where `isRankmaMode = true` is set, line ~2103) sets `isStory=false; storySong=null`.
- `endGame()`: when `isStory`, hide `#normalSaveArea` and `#rankmaSaveArea`, skip `fetchRankPosition()`, keep `earnCoins()`, and call `StoryUI.onStageEnd(rhythmResult())`. Do not show the rhythm back button for story; StoryUI owns navigation.
- Title: add a big "🗺️ 福井めぐり（ストーリー）" / "🗺️ Fukui Journey (Story)" button above the existing mode rows, calling `StoryUI.open()`.

- [ ] **Step 1: Implement** the changes above.
- [ ] **Step 2: Manual check:** play stage 1-1 to the end. The result shows no leaderboard save button, the after-dialogue plays, and 1-2 unlocks. Then play a normal Rhythm Mode song and confirm the leaderboard save area is back.
- [ ] **Step 3: Commit** with "Play story stages through Rhythm Mode".

### Task 5: Gacha, collection and title-character lock, plus smoke test

**Files:**
- Modify: `index.html`, at `renderMyPage` (around lines 3500–3545), `pullGacha` (line ~3613) and `renderTitleChars`/`tsNextChar` (around lines 3680–3725)
- Test: `tests/story.smoke.mjs`

**Interfaces:**
- Consumes: `StoryCore.gachaUnlocked(StorySave.load(), STORY_CHAPTERS, profile && profile.chars)` and `StoryCore.metCharacters`.
- Produces global `storyGachaUnlocked() -> boolean` in `index.html`.

- [ ] **Step 1: Write the smoke test** `tests/story.smoke.mjs` (Playwright, `chromium.launch()`), which serves the repo with `python3 -m http.server` on a free port. Assertions:
  - Fresh storage: the title shows the story button, and `#gacha1Btn` and `#mpCollection` are hidden or replaced by the lock notice when My Page renders (call `renderMyPage()` with a stub `profile = {chars:{}, coins:0}`).
  - Calling `StoryUI.onStageEnd({grade:"A",rate:0.9})` after `StoryUI.playStage` for each stage id in order (with `startStoryStage` stubbed to do nothing) ends with `storyGachaUnlocked() === true` and the result screen shows a link whose href equals `STORY_GUIDE_URL`. This runs without logging in.
  - With fresh storage and `profile = {chars:{minarai:1}}`, `storyGachaUnlocked() === true`.
  - `localStorage.sobamichi_story = "garbage"` and a reload give no page error, and `StoryUI.open()` works.
  - After `toggleLang`, the story map text changes language.
- [ ] **Step 2: Run** `node tests/story.smoke.mjs` and expect FAIL on the gacha assertions.
- [ ] **Step 3: Implement the lock:**
  - In `renderMyPage`, when locked, hide the two gacha buttons and the collection grid, and show "ストーリー『福井めぐり』をクリアすると、ガチャと職人図鑑が解放される" in both languages.
  - `pullGacha` returns early when locked.
  - Title characters: when locked, `tsNextChar` only picks from `metCharacters(...)`.
- [ ] **Step 4: Run** `node tests/story.smoke.mjs` and `node --test tests/`, and expect all PASS.
- [ ] **Step 5: Commit** with "Lock gacha and collection until the story is cleared".
