// 福井めぐりストーリーの画面（章の地図・会話・好みの選択・最後の結果）
// index.html の T / CHARACTERS / switchScreen / startStoryStage を使う（呼ばれたときに参照する）
(function () {
    const css = `
#story { text-align:center; padding:16px 12px 40px; box-sizing:border-box; background:rgba(0,0,0,0.97); overflow-y:auto; color:#eee; }
#story .stChapter { margin:14px auto; max-width:560px; padding:12px; border:1px solid #6a4a20; border-radius:12px; background:rgba(60,35,10,0.55); text-align:left; }
#story .stChapter h3 { margin:0 0 8px; font-family:'Zen Old Mincho'; color:#ffe9a8; font-size:18px; }
#story .stChapter.locked { opacity:0.45; }
#story .stStages { display:flex; gap:8px; flex-wrap:wrap; }
#story .stStage { flex:1 1 150px; min-height:52px; padding:8px; border-radius:10px; border:2px solid #ffcc44; color:#fff; cursor:pointer;
  background:linear-gradient(135deg,#7a3d00,#d98200); font-family:'Zen Old Mincho'; font-size:14px; }
#story .stStage:disabled { background:#333; border-color:#555; color:#888; cursor:default; }
#story .stStage .stGrade { display:block; font-size:12px; color:#ffe9a8; }
#story .stFinal { margin:16px auto; max-width:560px; }
#storyDlg { position:fixed; inset:0; z-index:400; display:none; background:rgba(0,0,0,0.55); }
#storyDlg.open { display:flex; align-items:flex-end; justify-content:center; }
#storyDlg .sdBox { position:relative; width:min(640px,100%); margin:0 0 16px; padding:16px 16px 44px; box-sizing:border-box; border-radius:14px;
  background:rgba(25,15,5,0.96); border:2px solid #ffcc44; color:#fff; text-align:left; cursor:pointer; min-height:150px; }
#storyDlg .sdWho { font-family:'Zen Old Mincho'; color:#ffcc44; font-weight:bold; margin-bottom:6px; }
#storyDlg .sdText { font-size:17px; line-height:1.6; white-space:pre-wrap; }
#storyDlg .sdImg { position:absolute; right:12px; bottom:100%; height:180px; max-width:45%; object-fit:contain; pointer-events:none; }
#storyDlg .sdNext { position:absolute; right:14px; bottom:10px; color:#ffe9a8; font-size:13px; }
#storyDlg .sdSkip { position:absolute; left:14px; bottom:8px; background:none; border:1px solid #888; color:#ccc; border-radius:8px; padding:3px 10px; cursor:pointer; }
#storyDlg .sdChoices { display:flex; gap:10px; margin-top:12px; }
#storyDlg .sdChoices button { flex:1; padding:12px 6px; border-radius:10px; border:2px solid #ffcc44; color:#fff; font-size:16px; cursor:pointer;
  background:linear-gradient(135deg,#7a3d00,#d98200); font-family:'Zen Old Mincho'; }
#story .stCard { margin:10px auto; max-width:560px; padding:12px 14px; border-radius:12px; background:rgba(60,35,10,0.6); border:1px solid #6a4a20; text-align:left; }
#story .stCard li { margin:6px 0; line-height:1.5; }
#story .stGuide { display:inline-block; margin-top:10px; padding:12px 18px; border-radius:10px; background:linear-gradient(#eaffe0,#8fdc7a); color:#123; font-weight:bold; text-decoration:none; }
`;
    function ensureDom() {
        if (document.getElementById("storyDlg")) return;
        const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
        const dlg = document.createElement("div"); dlg.id = "storyDlg"; document.body.appendChild(dlg);
    }
    const tr = (o) => T(o.ja, o.en);
    const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const chapters = () => window.STORY_CHAPTERS;
    const findStage = (id) => { for (const c of chapters()) for (const s of c.stages) if (s.id === id) return { chapter: c, stage: s }; return null; };
    const whoName = (who) => who === "you" ? T("あなた", "You") : (CHARACTERS[who] ? T(CHARACTERS[who].name, CHARACTERS[who].nameEn) : who);

    // ---- 会話 ----
    // lines を1つずつ見せ、終わったら done()。choice があれば最後に2択を出し、選んだ値で done(value)
    function dialogue(lines, done, choice) {
        ensureDom();
        const dlg = document.getElementById("storyDlg");
        let i = 0;
        const finish = (v) => { dlg.classList.remove("open"); dlg.innerHTML = ""; done && done(v); };
        const showChoice = () => {
            dlg.innerHTML = `<div class="sdBox" style="cursor:default"><div class="sdText">${esc(tr(choice.q))}</div>
              <div class="sdChoices">${choice.options.map((o, k) => `<button data-k="${k}">${esc(tr(o.label))}</button>`).join("")}</div></div>`;
            dlg.querySelectorAll(".sdChoices button").forEach(b => b.onclick = (e) => { e.stopPropagation(); finish(choice.options[Number(b.dataset.k)].value); });
        };
        const show = () => {
            if (i >= lines.length) { choice ? showChoice() : finish(); return; }
            const l = lines[i];
            const ch = l.mask ? null : CHARACTERS[l.who];
            dlg.innerHTML = `<div class="sdBox">${ch && ch.img ? `<img class="sdImg" src="${ch.img}" alt="">` : ""}
              <div class="sdWho">${esc(l.mask ? T("京都から来たそば職人", "Soba maker from Kyoto") : whoName(l.who))}</div><div class="sdText">${esc(T(l.ja, l.en))}</div>
              <button class="sdSkip">${T("スキップ", "Skip")}</button><div class="sdNext">${T("タップで次へ ▶", "Tap to continue ▶")}</div></div>`;
            dlg.querySelector(".sdBox").onclick = () => { i++; show(); };
            dlg.querySelector(".sdSkip").onclick = (e) => { e.stopPropagation(); i = lines.length; show(); };
        };
        dlg.classList.add("open");
        show();
    }

    const ASKS = {
        noodle: { q: { ja: "そばの太さ、あなたはどっちが好み？", en: "Which noodle thickness do you prefer?" },
            options: [{ value: "thin", label: { ja: "細め", en: "Thin" } }, { value: "thick", label: { ja: "太め", en: "Thick" } }] },
        spice: { q: { ja: "大根おろしの辛さ、どっちがいい？", en: "How spicy do you like your daikon?" },
            options: [{ value: "mild", label: { ja: "まろやか", en: "Mellow" } }, { value: "hot", label: { ja: "辛口", en: "Spicy" } }] },
    };

    // ---- 章の地図 ----
    function open() {
        ensureDom();
        const state = StorySave.load();
        const el = document.getElementById("story");
        const cleared = StoryCore.isStoryCleared(state, chapters());
        el.innerHTML = `<div class="mp-wrap">
          <h1>${T("🗺️ 福井めぐり", "🗺️ Fukui Journey")}</h1>
          <div class="mp-note">${T("福井を巡りながら、越前そばの職人をめざそう。職人の能力はなし。", "Tour Fukui and become an Echizen soba maker. Character abilities are off.")}</div>
          ${chapters().map((c, ci) => {
              const anyOpen = c.stages.some(s => StoryCore.isUnlocked(state, chapters(), s.id));
              return `<div class="stChapter${anyOpen ? "" : " locked"}"><h3>${T(`第${ci + 1}章`, `Chapter ${ci + 1}`)}　${esc(tr(c.area))}</h3>
                <div class="stStages">${c.stages.map(s => {
                    const ok = StoryCore.isUnlocked(state, chapters(), s.id);
                    const g = state.cleared[s.id];
                    return `<button class="stStage" data-stage="${s.id}" ${ok ? "" : "disabled"}>${s.id}　${ok ? esc(tr(s.title)) : "？？？"}
                      <span class="stGrade">${g ? T(`クリア（評価 ${g}）`, `Cleared (${g})`) : ""}</span></button>`;
                }).join("")}</div></div>`;
          }).join("")}
          <div class="stFinal">${cleared ? `<button class="menuBtn" id="stResultBtn">${T("🍜 あなたのそばタイプを見る", "🍜 See your soba type")}</button><br>` : ""}
          <button class="menuBtn" id="stBackBtn">${T("タイトルへ", "Title")}</button></div></div>`;
        el.querySelectorAll(".stStage").forEach(b => b.onclick = () => playStage(b.dataset.stage));
        const rb = document.getElementById("stResultBtn"); if (rb) rb.onclick = showResult;
        document.getElementById("stBackBtn").onclick = () => switchScreen("titleScreen");
        switchScreen("story");
    }

    let current = null;
    function playStage(stageId) {
        const f = findStage(stageId);
        if (!f || !StoryCore.isUnlocked(StorySave.load(), chapters(), stageId)) return;
        current = f.stage;
        dialogue(f.stage.before, () => startStoryStage(f.stage));
    }

    // リズムゲームの結果を受け取る（endGame から呼ばれる）
    function onStageEnd(rr) {
        const stage = current;
        if (!stage) return;
        const before = StorySave.load();
        const wasCleared = StoryCore.isStoryCleared(before, chapters());
        const r = StoryCore.recordClear(before, stage.id, rr.rate, rr.grade);
        StorySave.save(r.state);
        if (!r.cleared) {
            dialogue([{ who: "shokunin", ja: `まだまだだな。達成率${Math.round(StoryCore.STORY_CLEAR_RATE * 100)}%以上でクリアだ。もう一度やってみろ。`,
                en: `Not yet. You need a rate of at least ${Math.round(StoryCore.STORY_CLEAR_RATE * 100)}% to clear. Try again.` }]);
            return;
        }
        const lines = [...stage.after];
        if (stage.tip) lines.push({ who: "you", ja: `📝 食べ方メモ：${stage.tip.ja}`, en: `📝 Soba note: ${stage.tip.en}` });
        dialogue(lines, (value) => {
            let s = StorySave.load();
            if (stage.ask && value) { s = StoryCore.setPref(s, stage.ask, value); StorySave.save(s); }
            if (!wasCleared && StoryCore.isStoryCleared(s, chapters())) {
                s.finished = true; StorySave.save(s);
                dialogue([{ who: "you", ja: "🎉 ストーリークリア！ マイページのガチャと職人図鑑が解放された！",
                    en: "🎉 Story cleared! The gacha and Collection on My Page are now unlocked!" }], showResult);
            }
        }, stage.ask ? ASKS[stage.ask] : null);
    }

    // 最後の結果：そばタイプ・食べ方カード・お店探し
    function showResult() {
        ensureDom();
        const state = StorySave.load();
        // 選ぶ前にページを閉じた等で好みが抜けていたら、ここで聞き直す
        const missing = ["noodle", "spice"].find(k => !state.prefs[k]);
        if (missing) {
            dialogue([], (value) => { if (value) StorySave.save(StoryCore.setPref(StorySave.load(), missing, value)); showResult(); }, ASKS[missing]);
            return;
        }
        const type = window.STORY_TASTE_TYPES[StoryCore.tasteTypeId(state.prefs)];
        const tips = chapters().flatMap(c => c.stages).filter(s => s.tip);
        const el = document.getElementById("story");
        el.innerHTML = `<div class="mp-wrap">
          <h1>${T("🍜 あなたのそばタイプ", "🍜 Your Soba Type")}</h1>
          <div class="stCard" style="text-align:center"><div style="font-family:'Zen Old Mincho'; font-size:26px; color:#ffe9a8;">${type ? esc(tr(type.name)) : T("まだ決まっていない", "Not decided yet")}</div>
            <div style="margin-top:8px; line-height:1.6;">${type ? esc(tr(type.hint)) : ""}</div></div>
          <div class="stCard"><h3 style="margin:0 0 6px; color:#ffcc44;">${T("📝 越前おろしそば 食べ方カード", "📝 Echizen Oroshi Soba Card")}</h3>
            <ul style="padding-left:20px; margin:0;">${tips.map(s => `<li>${esc(tr(s.tip))}</li>`).join("")}</ul></div>
          <div class="stCard" style="text-align:center">${T("次は本物の越前そばを食べに、福井へ！", "Next, come to Fukui for the real thing!")}<br>
            <a class="stGuide" id="stGuideLink" href="${window.STORY_GUIDE_URL}" target="_blank" rel="noopener">${T("越前おろしそばのお店を探す（ふくいドットコム）", "Find oroshi soba shops (Fukui tourism site)")}</a></div>
          <button class="menuBtn" id="stMapBtn">${T("地図へ戻る", "Back to map")}</button></div>`;
        document.getElementById("stMapBtn").onclick = open;
        switchScreen("story");
    }

    window.StoryUI = { open, playStage, onStageEnd, showResult, dialogue, rerender: () => { const el = document.getElementById("story"); if (el && el.style.display !== "none") open(); } };
})();
