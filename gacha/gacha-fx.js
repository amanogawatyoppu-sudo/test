// ガチャ演出の描画エンジン（Canvas）と効果音（WebAudio 合成）。
// 光の粒・湯気・稲妻・光の柱・衝撃波・斬撃をまとめて描く。画面の流れは gacha-reveal.js が決める。
(function () {
    const reduceMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

    // ---------- 描画 ----------
    let cv = null, g = null, W = 0, H = 0, dpr = 1, raf = 0, last = 0, running = false;
    let parts = [], waves = [], bolts = [], pillars = [], slashes = [], emitters = [];
    let flashA = 0, flashColor = "#fff", shakeT = 0, shakeAmp = 0;
    const MAX_PARTS = 900;

    function attach(canvas) {
        cv = canvas; g = cv.getContext("2d");
        resize();
        window.addEventListener("resize", resize);
    }
    function resize() {
        if (!cv) return;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = cv.clientWidth || window.innerWidth; H = cv.clientHeight || window.innerHeight;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    function start() {
        if (running || !cv) return;
        running = true; last = performance.now();
        resize();
        raf = requestAnimationFrame(tick);
    }
    function stop() {
        running = false; cancelAnimationFrame(raf);
        clear();
    }
    function clear() {
        parts = []; waves = []; bolts = []; pillars = []; slashes = []; emitters = [];
        flashA = 0; shakeT = 0;
        if (g) g.clearRect(0, 0, cv.width, cv.height);
        if (cv) cv.style.transform = "";
    }
    const rnd = (a, b) => a + Math.random() * (b - a);

    function addPart(p) {
        if (parts.length >= MAX_PARTS) parts.shift();
        parts.push(Object.assign({ life: 0, max: 1, size: 3, vx: 0, vy: 0, grav: 0, drag: 0.98, kind: "spark", color: "#fff", spin: 0, rot: 0 }, p));
    }

    // 爆発する光の粒
    function burst(x, y, color, n, speed, opts = {}) {
        if (reduceMotion()) n = Math.ceil(n / 4);
        for (let i = 0; i < n; i++) {
            const a = rnd(0, Math.PI * 2), s = rnd(speed * 0.3, speed);
            addPart({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: rnd(0.6, 1.4) * (opts.life || 1), size: rnd(1.5, 4) * (opts.size || 1),
                color: Array.isArray(color) ? color[i % color.length] : color, kind: opts.kind || "spark", grav: opts.grav || 0, drag: opts.drag || 0.95 });
        }
    }
    // 湯気（ふくらみながら昇る煙）
    function steam(x, y, color, n) {
        for (let i = 0; i < n; i++) addPart({ x: x + rnd(-60, 60), y: y + rnd(-10, 10), vx: rnd(-30, 30), vy: rnd(-260, -120), max: rnd(1, 2), size: rnd(30, 60), color, kind: "smoke", drag: 0.985 });
    }
    // 舞い上がる火の粉／降る金粉を出し続ける
    function emit(fn, perSec, dur) { emitters.push({ fn, perSec, t: 0, acc: 0, dur: dur || Infinity }); }
    function embers(color, perSec, dur) {
        emit(() => addPart({ x: rnd(0, W), y: H + 10, vx: rnd(-20, 20), vy: rnd(-180, -60), max: rnd(2, 4), size: rnd(1, 3), color, kind: "spark", drag: 0.995 }), perSec, dur);
    }
    function goldRain(colors, perSec, dur) {
        emit(() => addPart({ x: rnd(0, W), y: -10, vx: rnd(-30, 30), vy: rnd(60, 160), max: rnd(3, 5), size: rnd(3, 7), color: colors[Math.floor(Math.random() * colors.length)], kind: "flake", spin: rnd(-8, 8), drag: 0.999 }), perSec, dur);
    }
    function shockwave(x, y, color, maxR, width) { waves.push({ x, y, color, r: 10, maxR: maxR || Math.max(W, H), w: width || 18, life: 0, max: 0.7 }); }
    // 稲妻（ギザギザの線を数フレームだけ光らせる）
    function lightning(x1, y1, x2, y2, color) {
        const pts = [[x1, y1]]; const n = 12;
        for (let i = 1; i < n; i++) { const t = i / n; pts.push([x1 + (x2 - x1) * t + rnd(-40, 40), y1 + (y2 - y1) * t + rnd(-15, 15)]); }
        pts.push([x2, y2]);
        bolts.push({ pts, color, life: 0, max: 0.35 });
        burst(x2, y2, [color, "#fff"], 40, 500);
    }
    function pillar(x, color, dur, width) { pillars.push({ x, color, life: 0, max: dur || 1.2, w: width || 120 }); }
    // 包丁の一閃（画面を斜めに走る白い線）
    function slash(x1, y1, x2, y2, color) { slashes.push({ x1, y1, x2, y2, color: color || "#fff", life: 0, max: 0.45 }); }
    function flash(color, a) { flashColor = color || "#fff"; flashA = Math.max(flashA, a == null ? 0.9 : a); }
    function shake(amp, t) { if (reduceMotion()) return; shakeAmp = amp; shakeT = Math.max(shakeT, t); }

    function tick(now) {
        if (!running) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        step(dt); draw();
        raf = requestAnimationFrame(tick);
    }
    function step(dt) {
        for (const e of emitters) { e.t += dt; e.acc += e.perSec * dt; while (e.acc >= 1 && e.t < e.dur) { e.fn(); e.acc--; } }
        emitters = emitters.filter(e => e.t < e.dur);
        for (const p of parts) {
            p.life += dt; p.vx *= Math.pow(p.drag, dt * 60); p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.grav * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
        }
        parts = parts.filter(p => p.life < p.max);
        for (const arr of [waves, bolts, pillars, slashes]) for (const o of arr) o.life += dt;
        waves = waves.filter(o => o.life < o.max); bolts = bolts.filter(o => o.life < o.max);
        pillars = pillars.filter(o => o.life < o.max); slashes = slashes.filter(o => o.life < o.max);
        flashA = Math.max(0, flashA - dt * 2.2);
        shakeT = Math.max(0, shakeT - dt);
    }
    function draw() {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        cv.style.transform = shakeT > 0 ? `translate(${rnd(-shakeAmp, shakeAmp)}px,${rnd(-shakeAmp, shakeAmp)}px)` : "";
        g.globalCompositeOperation = "lighter";
        for (const o of pillars) {
            const k = o.life / o.max, a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
            const w = o.w * (0.4 + 0.6 * Math.min(1, k * 4));
            const grd = g.createLinearGradient(o.x - w, 0, o.x + w, 0);
            grd.addColorStop(0, "rgba(0,0,0,0)"); grd.addColorStop(0.5, o.color); grd.addColorStop(1, "rgba(0,0,0,0)");
            g.globalAlpha = a * 0.9; g.fillStyle = grd; g.fillRect(o.x - w, 0, w * 2, H);
            g.globalAlpha = a; g.fillStyle = "#fff"; g.fillRect(o.x - w * 0.08, 0, w * 0.16, H);
        }
        for (const p of parts) {
            const k = p.life / p.max, a = 1 - k;
            g.fillStyle = p.color;
            if (p.kind === "smoke") { // 湯気は重ねても白飛びしないよう普通に塗る
                g.globalCompositeOperation = "source-over";
                g.globalAlpha = a * 0.1; g.beginPath(); g.arc(p.x, p.y, p.size * (1 + k * 1.8), 0, 7); g.fill();
                g.globalCompositeOperation = "lighter";
            } else if (p.kind === "flake") {
                g.globalAlpha = Math.min(1, a * 1.5); g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.abs(Math.cos(p.rot * 1.3)) + 0.2);
                g.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66); g.restore();
            } else {
                g.globalAlpha = a; const s = p.size * (1 - k * 0.5);
                const sp = Math.hypot(p.vx, p.vy);
                if (sp > 120) { // 速い粒は尾を引く
                    g.strokeStyle = p.color; g.lineWidth = s; g.lineCap = "round"; g.beginPath();
                    g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke();
                } else { g.beginPath(); g.arc(p.x, p.y, s, 0, 7); g.fill(); }
            }
        }
        for (const o of waves) {
            const k = o.life / o.max, r = o.r + (o.maxR - o.r) * (1 - Math.pow(1 - k, 3));
            g.globalAlpha = 1 - k; g.strokeStyle = o.color; g.lineWidth = o.w * (1 - k) + 1;
            g.beginPath(); g.arc(o.x, o.y, r, 0, 7); g.stroke();
        }
        for (const o of bolts) {
            const a = 1 - o.life / o.max; if (Math.random() < 0.25) continue; // ちらつき
            for (const [lw, col, al] of [[14, o.color, 0.35], [5, o.color, 0.8], [2, "#fff", 1]]) {
                g.globalAlpha = a * al; g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = "round"; g.beginPath();
                o.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
            }
        }
        for (const o of slashes) {
            const k = o.life / o.max, grow = Math.min(1, k * 5), a = 1 - Math.max(0, (k - 0.2) / 0.8);
            const x2 = o.x1 + (o.x2 - o.x1) * grow, y2 = o.y1 + (o.y2 - o.y1) * grow;
            for (const [lw, al] of [[28, 0.25], [10, 0.6], [3, 1]]) {
                g.globalAlpha = a * al; g.strokeStyle = al === 1 ? "#fff" : o.color; g.lineWidth = lw * (1 - k * 0.6); g.lineCap = "round";
                g.beginPath(); g.moveTo(o.x1, o.y1); g.lineTo(x2, y2); g.stroke();
            }
        }
        g.globalCompositeOperation = "source-over";
        if (flashA > 0) { g.globalAlpha = flashA; g.fillStyle = flashColor; g.fillRect(0, 0, W, H); }
        g.globalAlpha = 1;
    }

    // ---------- 効果音 ----------
    let noiseBuf = null;
    function ctx() {
        try {
            const a = typeof audioContext !== "undefined" ? audioContext : null;
            if (!a || a.state === "closed") return null;
            if (a.state === "suspended") { const r = a.resume(); if (r && r.catch) r.catch(() => {}); }
            return a;
        } catch (e) { return null; }
    }
    function env(a, gnode, t, v, attack, dur) {
        gnode.gain.setValueAtTime(0.0001, t);
        gnode.gain.exponentialRampToValueAtTime(v, t + attack);
        gnode.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    function tone(freq, dur, o = {}) {
        try {
            const a = ctx(); if (!a) return;
            const t = a.currentTime + (o.at || 0);
            const osc = a.createOscillator(), gn = a.createGain();
            osc.type = o.type || "sine"; osc.frequency.setValueAtTime(freq, t);
            if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || dur));
            env(a, gn, t, o.vol || 0.15, o.attack || 0.01, dur);
            let out = gn;
            if (o.lp) { const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; gn.connect(f); out = f; }
            osc.connect(gn); out.connect(a.destination);
            osc.start(t); osc.stop(t + dur + 0.05);
        } catch (e) {}
    }
    function noise(dur, o = {}) {
        try {
            const a = ctx(); if (!a) return;
            if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
            const t = a.currentTime + (o.at || 0);
            const src = a.createBufferSource(), f = a.createBiquadFilter(), gn = a.createGain();
            src.buffer = noiseBuf; f.type = o.type || "bandpass"; f.frequency.setValueAtTime(o.f || 1000, t);
            if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t + dur);
            f.Q.value = o.q || 1;
            env(a, gn, t, o.vol || 0.2, o.attack || 0.005, dur);
            src.connect(f); f.connect(gn); gn.connect(a.destination);
            src.start(t); src.stop(t + dur + 0.05);
        } catch (e) {}
    }
    const sfx = {
        drone() { tone(55, 2.5, { type: "sawtooth", vol: 0.05, lp: 300, attack: 0.6 }); tone(82, 2.5, { type: "triangle", vol: 0.05, attack: 0.6 }); },
        taiko(at = 0, v = 0.5) { tone(110, 0.5, { at, to: 45, slide: 0.35, vol: v }); noise(0.12, { at, type: "lowpass", f: 900, vol: v * 0.5 }); },
        slash(at = 0) { noise(0.35, { at, type: "highpass", f: 2500, fTo: 9000, vol: 0.35, attack: 0.02 }); tone(2400, 0.4, { at, to: 1200, vol: 0.06 }); },
        boil(at = 0) { for (let i = 0; i < 10; i++) noise(0.08, { at: at + i * 0.07 + Math.random() * 0.04, f: rnd(300, 900), q: 6, vol: 0.12 }); },
        riser(at = 0, dur = 1.6) { tone(150, dur, { at, type: "sawtooth", to: 1400, vol: 0.06, attack: dur * 0.8, lp: 3000 }); noise(dur, { at, type: "bandpass", f: 400, fTo: 6000, q: 2, vol: 0.12, attack: dur * 0.8 }); },
        thunder(at = 0) { noise(1.4, { at, type: "lowpass", f: 2500, fTo: 120, vol: 0.6, attack: 0.005 }); tone(70, 0.8, { at, to: 35, vol: 0.4 }); },
        boom(at = 0) { tone(90, 1.0, { at, to: 30, vol: 0.6 }); noise(0.8, { at, type: "lowpass", f: 1200, fTo: 100, vol: 0.4 }); },
        shimmer(at = 0) { for (let i = 0; i < 14; i++) tone(rnd(2000, 5000), 0.5, { at: at + i * 0.04, vol: 0.03 }); },
        flip() { noise(0.12, { type: "highpass", f: 1500, fTo: 4000, vol: 0.2 }); tone(600, 0.1, { type: "triangle", to: 300, vol: 0.1 }); },
        reveal(r, at = 0) {
            if (r === "SSR") {
                sfx.boom(at);
                [261.6, 329.6, 392, 523.3, 659.3, 784].forEach((f, k) => { tone(f, 2.2, { at: at + 0.05 + k * 0.05, type: "sawtooth", vol: 0.05, lp: 2400, attack: 0.03 }); tone(f * 2, 1.6, { at: at + 0.05 + k * 0.05, vol: 0.05 }); });
                sfx.shimmer(at + 0.1);
            } else if (r === "SR") {
                sfx.taiko(at, 0.45);
                [440, 554, 659, 880].forEach((f, k) => tone(f, 1.2, { at: at + k * 0.06, type: "triangle", vol: 0.09 }));
                sfx.shimmer(at + 0.05);
            } else { tone(700, 0.3, { at, type: "triangle", vol: 0.1 }); tone(1050, 0.3, { at: at + 0.06, type: "triangle", vol: 0.08 }); }
        },
        whoosh(at = 0) { noise(0.4, { at, type: "bandpass", f: 300, fTo: 3000, q: 1.5, vol: 0.25, attack: 0.15 }); },
        fanfare(at = 0) {
            sfx.taiko(at, 0.5); sfx.taiko(at + 0.18, 0.4);
            [[523.3, 0], [659.3, 0.12], [784, 0.24], [1046.5, 0.4]].forEach(([f, d]) => { tone(f, 0.9, { at: at + 0.3 + d, type: "sawtooth", vol: 0.06, lp: 2600 }); tone(f, 0.9, { at: at + 0.3 + d, type: "triangle", vol: 0.08 }); });
            sfx.shimmer(at + 0.8);
        },
    };

    window.GachaFX = { attach, start, stop, clear, resize, burst, steam, embers, goldRain, shockwave, lightning, pillar, slash, flash, shake, sfx,
        size: () => ({ W, H }), reduceMotion, count: () => parts.length };
})();
