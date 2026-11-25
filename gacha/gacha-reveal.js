// ガチャ演出の画面の流れ。タメ（そば打ち×金の稲妻）→ 1体ずつめくる → 初登場キャラのカットイン。
// 色や内容はサーバーが返した結果だけで決める（GachaCore）。光や音は GachaFX が描く。
// index.html の CHARACTERS / RARITY_COLOR / T / audioContext を使う。
(function () {
    const GLOW = { R: "#7cc8ff", SR: "#c45cff", SSR: "#ffc61a" };
    const WAIT_GLOW = "#ffb36b";
    const SPECIAL_GUARD_MS = 400; // カットインは出てすぐのタップを無視（読む前に飛ばさない）
    const FX = () => window.GachaFX;

    let root = null;
    let st = null; // { steps, i, onDone, flipped, specialAt, ready }
    let waitDismissed = false; // 通信待ちの間にプレイヤーが閉じた
    let timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
    const $ = (sel) => root.querySelector(sel);

    function build() {
        if (root) return;
        root = document.createElement("div");
        root.id = "gachaReveal";
        root.innerHTML = `
<section class="grCharge">
  <div class="grWall"></div>
  <div class="grNoren"><span>越</span><span>前</span><span>蕎</span><span>麦</span></div>
  <div class="grPotArea"><div class="grFire"></div><div class="grPot"><div class="grLid"></div></div></div>
  <div class="grChargeText"></div>
</section>
<section class="grCardWrap"><div class="grCounter"></div><div class="grCard"></div><div class="grHint"></div></section>
<section class="grSpecial">
  <div class="grRays"></div>
  <div class="grBands"><i></i><i></i><i></i></div>
  <div class="grBig"></div>
  <div class="grSpText"><div class="grSpRar"></div><div class="grSpName"></div><div class="grSpQuote"></div></div>
  <div class="grStamp">NEW!</div>
  <div class="grHint"></div>
</section>
<canvas class="grFx"></canvas>
<button class="grSkip" type="button"></button>`;
        document.body.appendChild(root);
        FX().attach($(".grFx"));
        root.addEventListener("click", onTap);
        $(".grSkip").addEventListener("click", (e) => {
            e.stopPropagation();
            if (st) { finish(); return; }
            waitDismissed = true; close(); // 通信が返らないときの逃げ道
        });
    }
    const setPhase = (p) => { root.dataset.phase = p; };
    const chr = (id) => (typeof CHARACTERS !== "undefined" && CHARACTERS[id]) || { name: id, nameEn: id, emoji: "❔", r: "N" };
    const nameOf = (c) => T(c.name, c.nameEn || c.name);
    const rc = (r) => (typeof RARITY_COLOR !== "undefined" && RARITY_COLOR[r]) || "#aaaaaa";
    const fxColor = (r) => GLOW[r] || GLOW.R;
    // キャラ絵。画像が読めなければ絵文字に切り替える
    function pic(el, c) {
        el.textContent = "";
        if (!c.img) { el.textContent = c.emoji; return; }
        const img = document.createElement("img");
        img.alt = nameOf(c); img.draggable = false;
        img.onerror = () => { el.textContent = c.emoji; };
        img.src = c.img;
        el.appendChild(img);
    }
    // 要素の中心（Canvas の座標）
    function center(sel) {
        const r = $(sel).getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    }
    function setText(sel, ja, en) { const el = $(sel); el.textContent = T(ja, en); el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }

    function begin() {
        build();
        clearTimers();
        st = null;
        waitDismissed = false;
        root.className = "open";
        root.style.setProperty("--glow", WAIT_GLOW);
        $(".grSkip").textContent = T("スキップ ⏭", "Skip ⏭");
        setText(".grChargeText", "釜に火を入れている…", "Firing up the pot...");
        setPhase("charge");
        FX().clear(); FX().start();
        FX().embers(WAIT_GLOW, 14);
        FX().sfx.drone();
        later(() => { $(".grSkip").textContent = T("閉じる ✕", "Close ✕"); root.classList.add("canClose"); }, GachaReveal.WAIT_CLOSE_MS);
    }

    // タメ演出：のれんが吹き飛ぶ → 包丁の一閃で麺が舞う → 釜が沸く →（SR以上）稲妻 → 光の柱
    function play(results, onDone) {
        if (waitDismissed) { waitDismissed = false; if (onDone) onDone(); return; }
        if (!root || !root.classList.contains("open")) begin();
        clearTimers();
        root.classList.remove("canClose");
        $(".grSkip").textContent = T("スキップ ⏭", "Skip ⏭");
        st = { steps: GachaCore.revealSteps(results), i: 0, onDone, flipped: false, specialAt: 0, ready: false };
        if (!st.steps.length) { finish(); return; }
        const plan = GachaCore.chargePlan(GachaCore.bestRarity(results), Math.random);
        const fx = FX(), S = fx.sfx;
        const big = plan.to === "SSR";
        const total = big ? 3000 : plan.to === "SR" ? 2700 : 2300;
        const { W, H } = fx.size();

        root.classList.add("blown");
        S.taiko(0, 0.55); S.whoosh(0);
        later(() => {
            fx.slash(W * 0.05, H * 0.2, W * 0.95, H * 0.62, "#ffe9b0");
            fx.flash("#fff", 0.55); S.slash();
            fx.burst(W / 2, H * 0.42, ["#f3e2b8", "#e8d3a0", "#fff4d6"], 60, 700, { grav: 900, drag: 0.97, size: 1.3, life: 1.4 });
            setText(".grChargeText", "一閃！", "Slice!");
        }, 220);
        later(() => {
            root.classList.add("lit");
            root.style.setProperty("--glow", fxColor(plan.from));
            const p = center(".grPot");
            fx.steam(p.x, p.y - p.h * 0.4, fxColor(plan.from), 26);
            fx.embers(fxColor(plan.from), 40, 3);
            S.boil(0); S.riser(0, total / 1000 - 0.6);
            setText(".grChargeText", "釜が煮えたぎる…！", "The pot is boiling...!");
        }, 560);
        if (plan.to !== "R") {
            later(() => {
                const p = center(".grPot");
                root.style.setProperty("--glow", fxColor(plan.to));
                const col = fxColor(plan.to);
                for (let k = 0; k < (big ? 4 : 2); k++) later(() => fx.lightning(Math.random() * W, -10, p.x + (Math.random() - 0.5) * 60, p.y - p.h * 0.3, col), k * 110);
                fx.flash(col, 0.7); fx.shake(big ? 14 : 8, 0.6); S.thunder();
                fx.steam(p.x, p.y - p.h * 0.4, col, 30);
                setText(".grChargeText", plan.from !== plan.to ? "なにか来る…！？" : "雷鳴が轟く！", plan.from !== plan.to ? "Something's coming...!?" : "Thunder roars!");
            }, 1250);
        }
        later(() => {
            const p = center(".grPot"), col = fxColor(plan.to);
            fx.pillar(p.x, col, 1.4, big ? 170 : 110);
            fx.shockwave(p.x, p.y, col); fx.burst(p.x, p.y, [col, "#fff"], big ? 220 : 120, big ? 1300 : 900);
            S.boom(0);
            if (big) { fx.shake(18, 0.8); fx.goldRain(["#ffd84a", "#fff3b0", "#ffb300"], 60, 2.5); later(() => fx.pillar(p.x - W * 0.25, col, 1, 70), 120); later(() => fx.pillar(p.x + W * 0.25, col, 1, 70), 200); }
        }, total - 750);
        later(() => fx.flash("#fff", 1), total - 180);
        later(toCards, total);
        st.ready = true;
    }

    function toCards() {
        clearTimers();
        root.classList.remove("blown", "lit");
        FX().clear();
        showCard();
    }

    function showCard() {
        const s = st.steps[st.i];
        const c = chr(s.id);
        st.flipped = false;
        root.style.setProperty("--rc", rc(s.rarity));
        root.style.setProperty("--fx", fxColor(s.rarity));
        root.dataset.rar = s.rarity;
        $(".grCounter").textContent = st.steps.length > 1 ? `${st.i + 1} / ${st.steps.length}` : "";
        const card = $(".grCard");
        card.className = "grCard";
        card.innerHTML = `<div class="grCardIn"><div class="grBack"><span>蕎</span></div><div class="grFront"><div class="grRar"></div><div class="grPic"></div><div class="grNm"></div><div class="grTag"></div></div></div>`;
        void card.offsetWidth; // 配るアニメーションをやり直す
        card.querySelector(".grRar").textContent = s.rarity;
        pic(card.querySelector(".grPic"), c);
        card.querySelector(".grNm").textContent = nameOf(c);
        const tag = card.querySelector(".grTag");
        if (s.isNew) { tag.textContent = "NEW!"; tag.classList.add("new"); } else tag.textContent = T("かぶり", "Dupe");
        $(".grCardWrap .grHint").textContent = T("タップでめくる", "Tap to flip");
        setPhase("card");
        FX().clear(); FX().sfx.whoosh();
        if (s.rarity === "SSR" || s.rarity === "SR") FX().embers(fxColor(s.rarity), s.rarity === "SSR" ? 50 : 25);
    }

    function flip() {
        const s = st.steps[st.i];
        const fx = FX(), col = fxColor(s.rarity);
        st.flipped = true;
        $(".grCard").classList.add("flipped");
        fx.sfx.flip();
        later(() => {
            const p = center(".grCard");
            fx.shockwave(p.x, p.y, col, Math.max(p.w, p.h) * 2.2, 12);
            fx.burst(p.x, p.y, [col, "#fff"], s.rarity === "SSR" ? 160 : s.rarity === "SR" ? 90 : 35, s.rarity === "SSR" ? 1100 : 700);
            if (s.rarity === "SSR") { fx.shake(12, 0.5); fx.goldRain(["#ffd84a", "#fff3b0"], 40, 1.5); fx.flash(col, 0.5); }
            else if (s.rarity === "SR") fx.flash(col, 0.3);
            fx.sfx.reveal(s.rarity);
        }, 200);
        $(".grCardWrap .grHint").textContent = T("タップで次へ", "Tap for next");
        // 初登場は、めくったカードを少し見せてから自動でカットインへ
        if (s.special) later(showSpecial, 1000);
    }

    // 初登場：斜めの帯 → キャラが飛び込む → レア度が叩きつけられる → ファンファーレ
    function showSpecial() {
        clearTimers();
        const s = st.steps[st.i];
        const c = chr(s.id);
        const fx = FX(), col = fxColor(s.rarity);
        st.specialAt = Date.now();
        const box = $(".grSpecial");
        // アニメーションを毎回やり直すため作り直す
        const fresh = box.cloneNode(true); box.replaceWith(fresh);
        fresh.classList.toggle("ssr", s.rarity === "SSR");
        fresh.classList.toggle("sr", s.rarity === "SR");
        pic(fresh.querySelector(".grBig"), c);
        fresh.querySelector(".grSpRar").textContent = s.rarity;
        fresh.querySelector(".grSpName").textContent = nameOf(c);
        const q = T(c.quote || "", c.quoteEn || c.quote || "");
        const qe = fresh.querySelector(".grSpQuote");
        qe.textContent = q ? T(`「${q}」`, `“${q}”`) : ""; qe.style.display = q ? "" : "none";
        fresh.querySelector(".grHint").textContent = T("タップで次へ", "Tap for next");
        setPhase("special");
        fx.clear(); fx.sfx.whoosh(0); fx.sfx.whoosh(0.15);
        later(() => {
            const { W, H } = fx.size();
            fx.flash(col, 0.6); fx.shake(s.rarity === "SSR" ? 16 : 8, 0.4);
            fx.shockwave(W / 2, H * 0.4, col); fx.burst(W / 2, H * 0.4, [col, "#fff"], s.rarity === "SSR" ? 200 : 90, 1000);
            fx.sfx.taiko(0, 0.6);
        }, 650);
        later(() => {
            fx.sfx.fanfare();
            if (s.rarity === "SSR") fx.goldRain(["#ffd84a", "#fff3b0", "#ff8fb1", "#8fd8ff", "#ffffff"], 45);
            else fx.embers(col, 30);
        }, 800);
    }

    function next() {
        st.i++;
        if (st.i >= st.steps.length) finish(); else showCard();
    }

    function onTap() {
        if (!st || !st.ready) return; // 通信待ちのタップは無視
        const p = root.dataset.phase;
        if (p === "charge") toCards();
        else if (p === "card") {
            if (!st.flipped) flip();
            else if (st.steps[st.i].special) showSpecial();
            else next();
        } else if (p === "special") {
            if (Date.now() - st.specialAt < SPECIAL_GUARD_MS) return;
            next();
        }
    }

    function close() {
        clearTimers();
        if (root) { root.className = ""; root.dataset.phase = ""; }
        if (FX()) FX().stop();
    }
    function finish() {
        const cb = st && st.onDone;
        st = null;
        close();
        if (cb) cb();
    }
    function cancel() { st = null; waitDismissed = false; close(); }
    const isOpen = () => !!root && root.classList.contains("open");

    // WAIT_CLOSE_MS: 通信待ちがこれより長いと「閉じる」を出す
    const GachaReveal = { begin, play, cancel, isOpen, WAIT_CLOSE_MS: 8000 };
    window.GachaReveal = GachaReveal;
})();
