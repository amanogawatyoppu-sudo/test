# 観光連盟への持ち込み準備 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 観光連盟の担当者がゲームを開いたとき「誰が・何のために・内容は正しいか」が分かるようにし、持ち込み用の提案書とメール下書きを用意する。

**Architecture:** 「このゲームについて」パネルを新しいファイル `js/about.js` に作り、設定パネル（`js/cloud-save.js`）からボタンで開く。表記（作った人・連絡先）は `js/about.js` 冒頭の `ABOUT_INFO` だけで差し替えられるようにする。プライバシーポリシーは独立ページ `privacy.html`。URL変更は、改名後に古い `/test/` を新URLへ送る案内ページと手順書を用意する。提案書はA4印刷用HTMLとそのPDF。

**Tech Stack:** 素のHTML/CSS/JS（ビルドなし）、Playwright スモークテスト（`tests/*.smoke.mjs` の既存形式）、node:test。

**Spec:** `docs/superpowers/specs/2026-11-25-kankou-renmei-pitch-design.md`

## Global Constraints

- ゲーム画面に高校生のフルネーム・個人のメールアドレスを出さない。表記は `ABOUT_INFO.author` の1か所だけ
- 学校名は先生のOKまで仮表記: `author` の初期値は `"福井県内の高校生（探究活動）"`。OK後に `"（県立高校名） 探究活動 ○○"` へ差し替える
- 連絡先は会長がゲーム専用アドレスを作るまで `ABOUT_INFO.contact = ""`。空のときは「準備中」と表示し、mailto を出さない
- 「公認」「協力：福井県観光連盟」など、もらっていない肩書きはどこにも書かない
- 日本語/英語の両方（`cloud-save.js` と同じ `t(ja, en)` 方式、`document.documentElement.lang` で判定）
- 外部へのデータ送信を増やさない

## Review Focus

1. 英語表示のとき、パネルとプライバシーページが英語になる（`lang="en"` で開いて確認）
2. `contact` が空のとき mailto リンクが出ない
3. スマホ幅（375px）でパネルが画面からはみ出さず、スクロールできる
4. 設定パネルの上に重ねて開き、閉じると設定パネルに戻る（両方閉じてしまわない）
5. 出典URLが新しいタブで開く（ゲームの進行を失わない）

---

### Task 1: 「このゲームについて」パネル

**Files:**
- Create: `js/about.js`
- Modify: `js/cloud-save.js`（`buildPanel` の閉じるボタンの前にボタン1つ）
- Modify: `index.html:4719` 付近（`<script src="js/about.js"></script>` を cloud-save.js の前に追加）
- Test: `tests/about.smoke.mjs`（`tests/story.smoke.mjs` の `check()` の形をそのまま使う）

**Interfaces:**
- Produces: `window.ABOUT_INFO = { author: string, contact: string, purpose: {ja,en} }`、`window.openAbout(): void`、`window.closeAbout(): void`。パネル要素は `#aboutPanel`（開いている間 `.open`）。中に `.ab-author`、`.ab-contact`、`.ab-sources li`（出典）、`.ab-credits li`（素材）、`a.ab-privacy`（`privacy.html` へ）
- Consumes: なし

パネルの中身（上から）: 作った人 / 作った目的（「越前そばを知って、福井へ食べに来てもらうために作りました」）/ 問い合わせ / 豆知識の出典（`docs/story/content-review.md` の出典略号5件: 農水・福いろ・福いろ今庄・県PDF・ふくいドットコム。名前とURL）/ 素材のクレジット（BGM: Maniira（OpenTracks）、地形: 標高タイル（Terrain Tiles / AWS）、県境: 地球地図日本（国土地理院）、3D表示: three.js）/ プライバシーポリシーへのリンク / 閉じる。見た目は `#cloudSettingsBox` に合わせ、z-index はそれより上。

- [ ] **Step 1: 失敗するテストを書く** `tests/about.smoke.mjs`
  - `about: opens from settings` — `openCloudSettings()` → `#cloudSettings .cs-about` をクリック → `#aboutPanel.open` がある、`#cloudSettings.open` も残っている
  - `about: shows author and sources` — `.ab-author` のテキストが `ABOUT_INFO.author` と一致、`.ab-sources li` が5件、全ての出典リンクが `target="_blank"` と `rel` に `noopener`
  - `about: no mailto when contact empty` — `ABOUT_INFO.contact=""` で開くと `.ab-contact a[href^="mailto:"]` が0件、`.ab-contact` に「準備中」。`ABOUT_INFO.contact="x@example.com"` にして開き直すと1件
  - `about: english` — `document.documentElement.lang="en"` で開くと `.ab-author` 以外の見出しに日本語の「出典」が含まれず `Sources` が含まれる
  - `about: fits phone width` — viewport 375x667 で `#aboutPanel` 内の箱の `scrollWidth <= 375`
  - `about: close returns to settings` — 閉じるで `#aboutPanel.open` が消え、`#cloudSettings.open` は残る
- [ ] **Step 2: 実行して失敗を確認** `node tests/about.smoke.mjs` → FAIL（openAbout が無い）
- [ ] **Step 3: `js/about.js` を実装、`cloud-save.js` にボタン `.cs-about`（「ℹ このゲームについて / About this game」、onclick で `window.openAbout`）、`index.html` に script 追加**。パネルは開くたびに中身を作り直す（`ABOUT_INFO` と言語の変更を反映するため）。文字列は全てエスケープ
- [ ] **Step 4: 実行して通る** `node tests/about.smoke.mjs` → all passed。`node tests/story.smoke.mjs` と `node --test tests/` も通る
- [ ] **Step 5: Commit** `git add js/about.js js/cloud-save.js index.html tests/about.smoke.mjs && git commit -m "Add an About panel with author, sources and credits"`

### Task 2: プライバシーポリシー

**Files:**
- Create: `privacy.html`
- Test: `tests/about.smoke.mjs` に追記

**Interfaces:**
- Consumes: Task 1 の `a.ab-privacy`（`href="privacy.html"`）
- Produces: `privacy.html`。言語は `localStorage.sobamichi_lang`（無ければブラウザ言語）で切り替え

書く内容（実際の仕組みから。増やさない・盛らない）:
- 端末に保存するもの: 遊んだ記録・設定（ブラウザの localStorage、キー `sobamichi_*`）
- 自動ログイン: Firebase の匿名ログインでIDを作る。セーブを Firestore の `users/{ID}` に保存。本人のIDだけが読み書きできる（`firestore.rules`）
- Google連携（任意）: 連携すると Google アカウントのメールアドレスが Firebase に渡り、設定画面に表示される。ほかの人には見えない
- 番付・ガチャ（任意）: 入力したプレイヤー名・合言葉・スコア・そば粉などを Google Apps Script（スプレッドシート）に保存。プレイヤー名と順位は番付で公開される
- 使い道: セーブの引き継ぎと番付だけ。広告・販売・第三者提供はしない
- 消し方: 問い合わせ先へ連絡（`ABOUT_INFO` と同じ表記・連絡先を文中に固定で書く。連絡先が決まるまで「準備中」）
- 作った人の表記、制定日 2026-11-25

- [ ] **Step 1: 失敗するテストを書く** `privacy: page loads` — `privacy.html` を開き h1 に「プライバシーポリシー」、本文に `Firebase` と `Google Apps Script` を含み、ページエラーなし。`privacy: english` — `localStorage.sobamichi_lang="en"` で `Privacy Policy`。`privacy: link from about` — パネルの `a.ab-privacy` の href が `privacy.html`
- [ ] **Step 2: 失敗を確認** `node tests/about.smoke.mjs`
- [ ] **Step 3: `privacy.html` を実装**（ゲームに戻るリンク `./` つき、スマホ幅で読める）
- [ ] **Step 4: 通ることを確認** `node tests/about.smoke.mjs`
- [ ] **Step 5: Commit** `git commit -m "Add a privacy policy page"`

### Task 3: URL変更の準備

**Files:**
- Create: `tools/old-url-redirect/index.html`（古い `/test/` に置く案内ページ）
- Create: `docs/url-rename.md`（会長向け手順）
- Modify: `index.html:12`（canonical）— 改名が終わるまで変えない。手順書に「改名後にClaudeへ頼む」と書く

**Interfaces:**
- Produces: 案内ページは `NEW_URL` 定数1つで行き先を決め、`location.replace(NEW_URL + location.search + location.hash)`。`<meta http-equiv="refresh">` と手で押せるリンクも置く。`<link rel="canonical">` は NEW_URL

手順書の中身: ①リポジトリ名の候補（`mugen-sobado` を推す）②GitHub の Settings → General → Repository name で変更 ③新URLが開けるか確認 ④`test` という名前の新しい空リポジトリを作り、`tools/old-url-redirect/index.html` を入れて Pages を有効にする（古いURLを開いた人を新URLへ送る）⑤Firebase の承認済みドメインは `amanogawatyoppu-sudo.github.io` のままで良い ⑥遊んだ記録（localStorage）は同じドメインなので消えない ⑦改名後、Claude に canonical・root-site の「ゲームをはじめる」リンク・Search Console の再登録を頼む

- [ ] **Step 1: 失敗するテスト** `redirect: forwards with query` — `tools/old-url-redirect/index.html?x=1` を `NEW_URL` を `http://localhost:<port>/` に差し替えて開き（page.route で中身を置換）、最終URLが `/?x=1` で終わる
- [ ] **Step 2〜4: 実装して通す** `node tests/about.smoke.mjs`
- [ ] **Step 5: Commit** `git commit -m "Prepare a redirect page and steps for renaming the game URL"`

### Task 4: 提案書とメール下書き

**Files:**
- Create: `/mnt/project-files/pitch/proposal.html`（A4縦1〜2枚、`@page { size: A4; margin: 15mm }`）
- Create: `/mnt/project-files/pitch/proposal.pdf`（Playwright `page.pdf({ format: "A4" })` で出力）
- Create: `/mnt/project-files/pitch/mail-draft.md`
- 画面写真は `/mnt/project-files/story-mode/realmap-phone.png` など既存の画像を縮小して埋め込む

提案書の構成（設計書 4.3）: 自己紹介（`ABOUT_INFO.author` と同じ仮表記。本名・学校名・先生の名前は `【　】` の空欄にして会長が書き込む）/ ゲームの紹介と画面写真2枚 / 探究で調べたこと（出典つき豆知識を3つほど）/ 観光連盟の越前おろしそば特集へどう案内しているか / お願い3つ（①豆知識の内容チェック ②OKなら「協力：福井県観光連盟」と表示してよいか ③サイトやSNSでの紹介）/ ゲームのURL・連絡先（空欄）。

メール下書き: 件名と本文。短く、提案書PDFとURLを添える前提。先生CCの一文。宛先は空欄（観光連盟の問い合わせ窓口を会長が確認して入れる）。送信はしない。

- [ ] **Step 1: proposal.html を書く**
- [ ] **Step 2: PDF にして2ページ以内か確認**（`pdfinfo proposal.pdf` の Pages ≤ 2、または pdf のページ数をPlaywrightで数える）
- [ ] **Step 3: 画像に書き出して見た目を目で確認**（文字のはみ出し・空欄の位置）
- [ ] **Step 4: mail-draft.md を書く**
- [ ] **Step 5: 会長へ渡す**（提案書PDFを添付。メールは下書きカードで見せる）

### 最後: PR

- [ ] `node tests/about.smoke.mjs && node tests/story.smoke.mjs && node --test tests/` が通る
- [ ] ブランチ `claude/project-thread-lzzg7f` を push、PR を作る（本文に「学校名と連絡先は仮。差し替えは `js/about.js` の `ABOUT_INFO` と `privacy.html` の2か所」）
