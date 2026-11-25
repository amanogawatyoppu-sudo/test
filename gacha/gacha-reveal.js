// ガチャ演出の画面と効果音。タメ（釜の光）→ 1体ずつめくる → 初登場キャラの特別演出。
// 色や内容はサーバーが返した結果だけで決める（GachaCore）。index.html の CHARACTERS / RARITY_COLOR / T / audioContext を使う。
(function () {
    const GLOW = { R: "#8fd0ff", SR: "#cc66ff", SSR: "#ffcc00" };
    const WAIT_GLOW = "#ffe9c2";
    const CHARGE_MS = 2000;     // play() からカードまでの長さ
    const SPECIAL_GUARD_MS = 300; // 初登場画面は出てすぐのタップを無視（読む前に飛ばさない）
    const reduceMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

    let root = null;
    let waitDismissed = false; // 通信待ちの間にプレイヤーが閉じた
    let st = null; // { steps, i, onDone, flipped, specialShown, specialAt, ready }
    let timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
    const $ = (sel) => root.querySelector(sel);

    // ---------- 効果音（その場で合成。失敗しても演出は止めない） ----------
    function ctx() {
        try {
            const a = typeof audioContext !== "undefined" ? audioContext : null;
            if (!a || a.state === "closed") return null;
            if (a.state === "suspended") { const r = a.resume(); if (r && r.catch) r.catch(() => {}); }
            return a;
        } catch (e) { return null; }
    }
    function tone(freq, dur, opts = {}) {
        try {
            const a = ctx(); if (!a) return;
            const t = a.currentTime + (opts.at || 0);
            const o = a.createOscillator(), g = a.createGain();
            o.type = opts.type || "sine";
            o.frequency.setValueAtTime(freq, t);
            if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
            const v = opts.vol || 0.18;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.02, dur / 4) + (opts.attack || 0));
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g); g.connect(a.destination);
            o.start(t); o.stop(t + dur + 0.05);
        } catch (e) {}
    }
    const sfx = {
        rumble() { tone(70, 0.9, { type: "triangle", vol: 0.12 }); },
        riser() { tone(180, 1.7, { type: "sawtooth", to: 900, vol: 0.05, attack: 0.8 }); tone(360, 1.7, { type: "sine", to: 1800, vol: 0.05, attack: 0.8 }); },
        upgrade() { [784, 988, 1175, 1568].forEach((f, k) => tone(f, 0.5, { at: k * 0.06, vol: 0.12 })); },
        flip() { tone(520, 0.08, { type: "triangle", to: 260, vol: 0.15 }); },
        bell(r) {
            if (r === "SSR") [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, 1.2, { at: k * 0.07, vol: 0.13 }));
            else if (r === "SR") [880, 1320].forEach((f, k) => tone(f, 0.9, { at: k * 0.08, vol: 0.13 }));
            else tone(660, 0.25, { vol: 0.1 });
        },
        jingle() { [523, 659, 784, 659, 1047].forEach((f, k) => tone(f, 0.35, { at: 0.25 + k * 0.11, type: "triangle", vol: 0.12 })); },
    };

    // ---------- 画面 ----------
    function build() {
        if (root) return;
        root = document.createElement("div");
        root.id = "gachaReveal";
        root.innerHTML = `
<button class="grSkip" type="button"></button>
<section class="grCharge">
  <div class="grNoren"><span>越</span><span>前</span><span>蕎</span></div>
  <div class="grPotArea"><div class="grFire"></div><div class="grSteam"></div><div class="grSteam"></div><div class="grSteam"></div><div class="grPot"></div></div>
  <div class="grChargeText"></div>
  <div class="grFlash"></div>
</section>
<section class="grCardWrap"><div class="grCounter"></div><div class="grCard"></div><div class="grBurst"></div><div class="grHint"></div></section>
<section class="grSpecial"><div class="grRays"></div><div class="grConfetti"></div><div class="grBig"></div><div class="grSpRar"></div><div class="grSpName"></div><div class="grSpQuote"></div><div class="grStamp">NEW!</div><div class="grHint"></div></section>`;
        document.body.appendChild(root);
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

    function begin() {
        build();
        clearTimers();
        st = null;
        waitDismissed = false;
        root.classList.add("open");
        root.classList.remove("lit", "shake", "canClose");
        root.style.setProperty("--glow", WAIT_GLOW);
        $(".grSkip").textContent = T("スキップ ⏭", "Skip ⏭");
        $(".grChargeText").textContent = T("釜に火を入れている…", "Firing up the pot...");
        setPhase("charge");
        sfx.rumble();
        later(() => { $(".grSkip").textContent = T("閉じる ✕", "Close ✕"); root.classList.add("canClose"); }, GachaReveal.WAIT_CLOSE_MS);
    }

    function play(results, onDone) {
        // 待っている間に閉じられていたら、演出は出さずに結果へ進む
        if (waitDismissed) { waitDismissed = false; if (onDone) onDone(); return; }
        if (!root || !root.classList.contains("open")) begin();
        clearTimers();
        root.classList.remove("canClose");
        $(".grSkip").textContent = T("スキップ ⏭", "Skip ⏭");
        st = { steps: GachaCore.revealSteps(results), i: 0, onDone, flipped: false, specialShown: false, specialAt: 0, ready: false };
        if (!st.steps.length) { finish(); return; }
        const plan = GachaCore.chargePlan(GachaCore.bestRarity(results), Math.random);
        const flash = () => { const f = $(".grFlash"); f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); };
        root.classList.add("lit");
        root.style.setProperty("--glow", GLOW[plan.from]);
        $(".grChargeText").textContent = T("湯気が立ちのぼる…！", "The steam is rising...!");
        sfx.riser();
        if (plan.from !== plan.to) later(() => { root.style.setProperty("--glow", GLOW[plan.to]); flash(); sfx.upgrade(); }, 1100);
        if (plan.to === "SSR" && !reduceMotion()) later(() => root.classList.add("shake"), 1300);
        later(() => flash(), CHARGE_MS - 250);
        later(toCards, CHARGE_MS);
        st.ready = true;
    }

    function toCards() {
        clearTimers();
        root.classList.remove("shake");
        showCard();
    }

    function showCard() {
        const s = st.steps[st.i];
        const c = chr(s.id);
        st.flipped = false; st.specialShown = false;
        root.style.setProperty("--rc", rc(s.rarity));
        $(".grCounter").textContent = st.steps.length > 1 ? `${st.i + 1} / ${st.steps.length}` : "";
        const card = $(".grCard");
        card.className = "grCard";
        card.innerHTML = `<div class="grCardIn"><div class="grBack">蕎</div><div class="grFront"><div class="grRar"></div><div class="grPic"></div><div class="grNm"></div><div class="grTag"></div></div></div>`;
        void card.offsetWidth; // 配り直しのアニメーションをやり直す
        card.querySelector(".grRar").textContent = s.rarity;
        pic(card.querySelector(".grPic"), c);
        card.querySelector(".grNm").textContent = nameOf(c);
        const tag = card.querySelector(".grTag");
        if (s.isNew) { tag.textContent = "NEW!"; tag.classList.add("new"); } else tag.textContent = T("かぶり", "Dupe");
        $(".grCardWrap .grHint").textContent = T("タップでめくる", "Tap to flip");
        setPhase("card");
    }

    function flip() {
        const s = st.steps[st.i];
        st.flipped = true;
        $(".grCard").classList.add("flipped");
        sfx.flip();
        later(() => sfx.bell(s.rarity), 180); // スキップしたら鳴らさない
        $(".grCardWrap .grHint").textContent = T("タップで次へ", "Tap for next");
        // 初登場は、めくったカードを少し見せてから自動で特別演出へ
        if (s.special) later(showSpecial, 900);
    }

    function showSpecial() {
        clearTimers();
        const s = st.steps[st.i];
        const c = chr(s.id);
        st.specialShown = true; st.specialAt = Date.now();
        const box = $(".grSpecial");
        box.classList.toggle("ssr", s.rarity === "SSR");
        // アニメーションを毎回やり直すため中身を作り直す
        ["grBig", "grSpRar", "grSpName", "grSpQuote", "grStamp"].forEach(k => { const el = box.querySelector("." + k); const n = el.cloneNode(false); n.textContent = el.className === "grStamp" ? "NEW!" : ""; el.replaceWith(n); });
        pic(box.querySelector(".grBig"), c);
        box.querySelector(".grSpRar").textContent = s.rarity;
        box.querySelector(".grSpName").textContent = nameOf(c);
        const q = T(c.quote || "", c.quoteEn || c.quote || "");
        const qe = box.querySelector(".grSpQuote");
        qe.textContent = q ? T(`「${q}」`, `\u201c${q}\u201d`) : ""; qe.style.display = q ? "" : "none";
        box.querySelector(".grHint").textContent = T("タップで次へ", "Tap for next");
        const conf = box.querySelector(".grConfetti");
        conf.innerHTML = "";
        if (s.rarity === "SSR" && !reduceMotion()) {
            const cols = ["#ffcc00", "#ff6699", "#66ccff", "#ffffff", "#99ff99"];
            for (let k = 0; k < 40; k++) {
                const i = document.createElement("i");
                i.style.left = Math.random() * 100 + "%";
                i.style.background = cols[k % cols.length];
                i.style.animationDuration = (2 + Math.random() * 2) + "s";
                i.style.animationDelay = (Math.random() * 1.2) + "s";
                conf.appendChild(i);
            }
        }
        setPhase("special");
        sfx.jingle();
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
        if (root) { root.classList.remove("open", "lit", "shake", "canClose"); root.dataset.phase = ""; }
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
