# ガチャ演出の強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ガチャを引いたとき、結果一覧の前に「タメ → 1体ずつめくる → 初登場キャラの特別演出」を挟む。

**Architecture:** ストーリーモードと同じ形で、画面に関係しない決まりごとを `gacha/gacha-core.js`（node でテスト）、画面と効果音を `gacha/gacha-reveal.js`（ブラウザで動作テスト）に分ける。index.html の `pullGacha` は通信前に演出を始め、結果が来たら演出に渡し、演出が終わったら今の `showGachaResult` を呼ぶ。

**Tech Stack:** 素の JavaScript（ビルドなし）、CSS アニメーション、WebAudio（既存の `audioContext`）、node:test、Playwright（既存の smoke テストと同じ方式）。

**Spec:** `docs/superpowers/specs/2026-11-25-gacha-reveal-design.md`

## Global Constraints
- 確率・そば粉・`gas/Code.gs` は変更しない。演出の色・内容はサーバーが返した `results`（`{id, rarity, dup, refund}`）だけで決める。
- 新しい音声・画像・動画ファイルは足さない。キャラ絵は `CHARACTERS[id].img`、セリフは `quote` / `quoteEn`。
- 文言はすべて `T(日本語, 英語)` で日英両対応。
- `prefers-reduced-motion: reduce` のとき揺れ・紙吹雪を出さない。
- タップで早送り、右上「スキップ」で残りを飛ばして一覧へ。
- 初登場 ＝ `dup === false`。
- レア度の色は既存の `RARITY_COLOR`（N #aaaaaa / R #44aaff / SR #cc66ff / SSR #ffcc00）に合わせる。

## Review Focus
1. 通信失敗・`no_coins`・サーバー未対応のとき、演出の暗転が残って画面が操作できなくなる → 演出を閉じて今のエラー表示に戻ること。（Task 3 の smoke で確認）
2. 連打（演出中にもう一度「引く」）→ 2つ目は始まらない（既存の `isPulling` を演出終了まで保つ）。（Task 3）
3. 10連でスキップを押す → 残りの初登場演出も飛ばして一覧に、一覧は10体すべて出る。（Task 2）
4. 音が止まっている状態（`audioContext` が suspended、または効果音生成で例外）でも演出は止まらない。（Task 2：効果音は try/catch で包む）
5. 画像が読み込めないキャラ → 絵文字にフォールバック（`charCardHtml` と同じ）。（Task 2）

---

### Task 1: 演出の決まりごと（gacha-core）

**Files:**
- Create: `gacha/gacha-core.js`（story-core.js と同じ即時関数＋ `module.exports` / `window.GachaCore` 形式）
- Test: `tests/gacha-core.test.js`

**Interfaces:**
- Produces:
  - `GachaCore.RANK = { SSR: 0, SR: 1, R: 2, N: 3 }`
  - `GachaCore.bestRarity(results) -> "SSR"|"SR"|"R"|"N"`（空配列は "N"）
  - `GachaCore.chargePlan(best, rand) -> { from: rarity, to: rarity }` — 釜の光の最初の色と最後の色。`best` が SR/SSR で `rand() < 0.3` のとき `from` を一段下（SSR→SR は使わず SSR→R、SR→R）にする格上げ演出。それ以外は `from === to`。N と R は区別せず `"R"`（青白）。
  - `GachaCore.revealSteps(results) -> Array<{ index, id, rarity, isNew, special }>` — 引いた順のまま。`isNew = !dup`、`special = isNew`（初登場演出の有無）。

- [ ] **Step 1: テストを書く** `tests/gacha-core.test.js`
  - `bestRarity([{rarity:"N"},{rarity:"SR"},{rarity:"R"}]) === "SR"`、`bestRarity([]) === "N"`
  - `chargePlan("SSR", () => 0.1)` → `{from:"R", to:"SSR"}`；`chargePlan("SSR", () => 0.9)` → `{from:"SSR", to:"SSR"}`
  - `chargePlan("SR", () => 0.1)` → `{from:"R", to:"SR"}`
  - `chargePlan("N", () => 0)` → `{from:"R", to:"R"}`；`chargePlan("R", () => 0)` → `{from:"R", to:"R"}`
  - `revealSteps([{id:"a",rarity:"N",dup:true},{id:"b",rarity:"SSR",dup:false}])` → `[{index:0,id:"a",rarity:"N",isNew:false,special:false},{index:1,id:"b",rarity:"SSR",isNew:true,special:true}]`
- [ ] **Step 2: 失敗を確認** `node --test tests/gacha-core.test.js` → モジュールが見つからず FAIL
- [ ] **Step 3: `gacha/gacha-core.js` を実装**
- [ ] **Step 4: 通過を確認** `node --test tests/` → 全部 PASS（story-core のテストも）
- [ ] **Step 5: コミット** `feat: gacha reveal rules (best rarity, charge plan, steps)`

### Task 2: 演出画面と効果音（gacha-reveal）

**Files:**
- Create: `gacha/gacha-reveal.js`（`window.GachaReveal`）
- Create: `gacha/gacha-reveal.css`
- Modify: `index.html`（`<head>` に css の `<link>`、`story/story-ui.js` の `<script>` の後に core と reveal の `<script>`）
- Test: `tests/gacha.smoke.mjs`（story.smoke.mjs と同じ起動方法・`check()` の形）

**Interfaces:**
- Consumes: `GachaCore.*`（Task 1）、グローバルの `CHARACTERS`, `RARITY_COLOR`, `T`, `audioContext`
- Produces:
  - `GachaReveal.begin()` — 全画面の演出要素 `#gachaReveal` を開き、釜のタメを始める（色はまだ白）。通信中ずっとループ。
  - `GachaReveal.play(results, onDone)` — タメを `chargePlan` の色で締めて（約2秒。タップで早送り）、`revealSteps` を順に見せ、最後に `#gachaReveal` を閉じて `onDone()` を呼ぶ。`onDone` は必ず1回だけ呼ぶ。
  - `GachaReveal.cancel()` — 何もせず閉じる（`onDone` は呼ばない）。
  - `GachaReveal.isOpen() -> boolean`

**画面の中身（各段階は `#gachaReveal` の `data-phase` で切り替え。テストもこれを見る）:**
- `charge`：のれん（上部の布）＋そば釜＋湯気。釜の光の色を `--glow` で指定。`to` が SSR なら最後に画面揺れ（reduced-motion では無し）。格上げは途中で `from` の色から `to` の色に切り替え、強い光と鐘の音。
- `card`：裏向きカード1枚（裏面の縁がレア度の色）。タップでめくって表（`charCardHtml(id,{count:1, badge})` と同じ見た目で可）。めくった瞬間にレア度の光と音。もう一度タップで次へ。
- `special`（`special` のときだけ、めくった後に入る）：キャラ絵を大きく、名前、レア度、セリフ（`T(quote, quoteEn)`）、「NEW!」判子。SSR は後光（回転する光）と紙吹雪（reduced-motion では無し）。タップで次へ。
- 右上に `.grSkip`「スキップ」ボタン（`charge` 以外で常時）。押すと即 `onDone()`。
- 効果音（WebAudio 合成、各関数は内部で try/catch）：タメの上昇音、めくり音、SR 以上の鐘、初登場のジングル。

- [ ] **Step 1: smoke テストを書く** `tests/gacha.smoke.mjs`。結果はテストで直接渡す（サーバーは使わない）。
  - 「1回引き・かぶり N」：`begin()` → `play([{id:"minarai",rarity:"N",dup:true,refund:10}], done)` → `data-phase` が `charge`→`card` になる。タップ2回で `done` が1回呼ばれ `isOpen()` が false。
  - 「初登場 SSR」：`[{id:"sennin",rarity:"SSR",dup:false}]` → めくった後 `data-phase="special"`、画面に「越前そば仙人」とセリフ「ふぉっふぉっ」が出る。
  - 「10連スキップ」：10件（うち初登場3件）→ 最初のカードで `.grSkip` を押すと `done` が1回だけ呼ばれ閉じる。
  - 「cancel」：`begin()` → `cancel()` → `isOpen()` false、`#gachaReveal` が見えない。
  - 「画像なし」：`CHARACTERS.minarai.img` を存在しないパスにして初登場演出 → ページエラーなしで絵文字が出る。
  - 「英語表示」でも同じ流れがエラーなく通る（`lang` を英語にする既存の方法で）。
  - 「音なし」：`audioContext.close()` してから一連の流れ → ページエラーなし。
- [ ] **Step 2: 失敗を確認** `node tests/gacha.smoke.mjs` → `GachaReveal is not defined` で FAIL
- [ ] **Step 3: `gacha/gacha-reveal.js` と `gacha/gacha-reveal.css` を実装し、index.html に読み込みを足す**
- [ ] **Step 4: 通過を確認** `node tests/gacha.smoke.mjs` → 全部 ok。スマホ幅（390×844）と PC 幅でスクリーンショットを撮って見た目を確認。
- [ ] **Step 5: コミット** `feat: gacha reveal scene with charge, card flips and first-time showcase`

### Task 3: 引く処理につなぐ

**Files:**
- Modify: `index.html` の `pullGacha`（現 3933 行付近）
- Test: `tests/gacha.smoke.mjs` に追記

**Interfaces:**
- Consumes: `GachaReveal.begin/play/cancel`（Task 2）、既存の `playerAction`, `showGachaResult`, `renderMyPage`

**変更内容:** 通信の前に `GachaReveal.begin()`。結果 `ok` なら `GachaReveal.play(res.results, () => { showGachaResult(res.results); isPulling = false; renderMyPage(); })`。それ以外（null・`no_coins`・エラー・例外）は `GachaReveal.cancel()` してから今と同じ文言を出し、`isPulling = false; renderMyPage();`。`isPulling` は演出が終わるまで true のまま。

- [ ] **Step 1: smoke テストを追記**（`playerAction` をテスト内で差し替え）
  - 「ok」：`playerAction` が `{status:"ok", results:[…1件]}` を返す → 演出を最後まで進めると `#gachaOverlay` が `open`。
  - 「no_coins」：→ `#gachaReveal` が閉じていて、`#mpStatus` に「そば粉が足りない」。
  - 「例外」：`playerAction` が throw → `#gachaReveal` が閉じ、`#mpStatus` に「通信失敗」。
  - 「連打」：演出中に `pullGacha(1)` をもう一度呼ぶ → `playerAction` の呼び出しは1回だけ。
- [ ] **Step 2: 失敗を確認** `node tests/gacha.smoke.mjs` → 追記分が FAIL
- [ ] **Step 3: `pullGacha` を変更**
- [ ] **Step 4: 通過を確認** `node tests/gacha.smoke.mjs` と `node tests/story.smoke.mjs` と `node --test tests/` → 全部 ok
- [ ] **Step 5: コミット** `feat: play gacha reveal before results`
