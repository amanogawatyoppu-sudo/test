// 福井めぐりストーリーの3Dマップ。福井県の形の上に章（エリア）のピンを立て、クリアするとコマが次のエリアへ進む。
// three.js（story/vendor/three-r128.min.js）は、ストーリーを初めて開いたときにだけ読み込む。
// WebGL が使えない・読み込みに失敗したときは、呼び出し側が今までの一覧表示に切り替える。
(function () {
    // 各章のエリアの位置（緯度・経度。だいたいの位置）。章の並びは STORY_CHAPTERS と同じ。
    const AREA_POS = {
        c1: [35.903, 136.168],  // 越前市 武生
        c2: [35.957, 136.184],  // 鯖江市
        c3: [35.771, 136.199],  // 南越前町 今庄
        c4: [36.010, 136.300],  // 福井市 一乗谷
        c5: [36.030, 136.495],  // 勝山・大野
        c6: [35.850, 136.250],  // 越前府中（武生の城下。1章と重ならないよう、地図の上では少し南東にずらす）
    };
    // 福井県のだいたいの輪郭（経度, 緯度）。ゲーム用の簡略図。
    const OUTLINE = [
        [136.20, 36.26], [136.30, 36.30], [136.42, 36.27], [136.55, 36.21], [136.68, 36.16], [136.83, 36.08],
        [136.80, 35.97], [136.70, 35.86], [136.60, 35.76], [136.47, 35.69], [136.33, 35.66], [136.22, 35.63],
        [136.12, 35.56], [136.02, 35.50], [135.92, 35.46], [135.80, 35.40], [135.66, 35.35], [135.53, 35.40],
        [135.45, 35.48], [135.52, 35.52], [135.62, 35.50], [135.73, 35.49], [135.80, 35.53], [135.88, 35.56],
        [135.95, 35.62], [136.02, 35.68], [136.07, 35.66], [136.09, 35.73], [136.05, 35.82], [136.02, 35.92],
        [136.06, 36.03], [136.12, 36.15], [136.16, 36.22],
    ];
    const LAT0 = 35.85, LON0 = 136.15, K = 64, COSL = Math.cos(LAT0 * Math.PI / 180);
    const toXY = (lat, lon) => [(lon - LON0) * K * COSL, (lat - LAT0) * K];
    const LAND_H = 0.6;
    const PIN_S = 1.7; // ピンとコマの大きさ

    let THREE_ = null, loading = null;
    function loadThree() {
        if (window.THREE) return Promise.resolve(window.THREE);
        if (loading) return loading;
        loading = new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = "story/vendor/three-r128.min.js";
            s.onload = () => window.THREE ? res(window.THREE) : rej(new Error("three missing"));
            s.onerror = () => { loading = null; rej(new Error("three load failed")); };
            document.head.appendChild(s);
        });
        return loading;
    }
    function webglOk() {
        try { const c = document.createElement("canvas"); return !!(c.getContext("webgl") || c.getContext("experimental-webgl")); }
        catch (e) { return false; }
    }

    const css = `
#story.st3d { padding:0; overflow:hidden; background:#0b1a2a; }
#story .m3Canvas { position:absolute; inset:0; width:100%; height:100%; touch-action:none; display:block; }
#story .m3Top { position:absolute; left:0; right:0; top:0; padding:12px 12px 0; pointer-events:none; text-align:center; }
#story .m3Top h1 { margin:0; font-family:'Zen Old Mincho'; color:#ffe9a8; font-size:24px; text-shadow:0 2px 6px #000; }
#story .m3Top .m3Sub { color:#dfe9f2; font-size:13px; margin-top:4px; text-shadow:0 1px 4px #000; }
#story .m3Prog { display:inline-block; margin-top:6px; padding:3px 12px; border-radius:12px; background:rgba(0,0,0,0.5); color:#ffcc44; font-size:13px; }
#story .m3Labels { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
#story .m3Label { position:absolute; transform:translate(-50%,-100%); pointer-events:auto; cursor:pointer; text-align:center; white-space:nowrap;
  font-family:'Zen Old Mincho'; font-size:13px; color:#fff; padding:3px 8px 3px 3px; border-radius:16px; background:rgba(40,22,5,0.85);
  border:2px solid #ffcc44; display:flex; align-items:center; gap:4px; box-shadow:0 2px 6px rgba(0,0,0,0.5); }
#story .m3Label img, #story .m3Label .m3Q { width:24px; height:24px; border-radius:50%; object-fit:cover; background:#f3e2c0; flex:none; }
#story .m3Label .m3Q { display:flex; align-items:center; justify-content:center; background:#555; color:#ccc; font-size:14px; }
#story .m3Label.locked { border-color:#666; background:rgba(30,30,30,0.8); color:#999; }
#story .m3Label.done { border-color:#8fdc7a; }
#story .m3Label.now { animation:m3pulse 1.2s ease-in-out infinite; }
@keyframes m3pulse { 50% { box-shadow:0 0 0 5px rgba(255,204,68,0.45); } }
#story .m3Bottom { position:absolute; left:0; right:0; bottom:0; padding:0 12px calc(12px + env(safe-area-inset-bottom)); display:flex; gap:8px; justify-content:center; flex-wrap:wrap; pointer-events:none; }
#story .m3Bottom button { pointer-events:auto; }
#story .m3Btn { padding:10px 16px; border-radius:10px; border:2px solid #ffcc44; background:rgba(40,22,5,0.9); color:#fff; font-family:'Zen Old Mincho'; font-size:14px; cursor:pointer; }
#story .m3Sheet { position:absolute; left:50%; bottom:0; transform:translate(-50%,105%); transition:transform .25s ease; width:min(560px,100%);
  box-sizing:border-box; padding:14px 14px calc(16px + env(safe-area-inset-bottom)); border-radius:16px 16px 0 0; background:rgba(25,15,5,0.97);
  border:2px solid #ffcc44; border-bottom:none; text-align:left; z-index:5; }
#story .m3Sheet.open { transform:translate(-50%,0); }
#story .m3Sheet h3 { margin:0 0 4px; font-family:'Zen Old Mincho'; color:#ffe9a8; font-size:18px; }
#story .m3Sheet .m3Close { position:absolute; right:10px; top:8px; background:none; border:none; color:#ccc; font-size:22px; cursor:pointer; }
#story .m3Sheet .m3Guides { color:#ccc; font-size:13px; margin-bottom:10px; }
`;

    let st = null; // 作った three.js の部品をまとめて持っておく（開くたびに作り直さない）

    function lighten(THREE, mat, on) { mat.color.set(on ? 0xffcc44 : 0x666666); mat.emissive.set(on ? 0x553300 : 0x000000); }

    function buildScene(THREE, chapters) {
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x0b1a2a);
        const scene = new THREE.Scene();
        scene.fog = new THREE.Fog(0x0b1a2a, 70, 140);
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

        scene.add(new THREE.HemisphereLight(0xdfefff, 0x334422, 0.75));
        const sun = new THREE.DirectionalLight(0xfff2d6, 0.85); sun.position.set(-10, 25, 15); scene.add(sun);

        const world = new THREE.Group(); scene.add(world);

        // 海（日本海・若狭湾）
        const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x1d4f7a }));
        sea.rotation.x = -Math.PI / 2; sea.position.y = -0.05; world.add(sea);

        // 陸地：輪郭を押し出して板にする
        const shape = new THREE.Shape();
        OUTLINE.forEach(([lon, lat], i) => { const [x, y] = toXY(lat, lon); i ? shape.lineTo(x, y) : shape.moveTo(x, y); });
        const landGeo = new THREE.ExtrudeGeometry(shape, { depth: LAND_H, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.25, bevelSegments: 2 });
        landGeo.rotateX(-Math.PI / 2);
        const land = new THREE.Mesh(landGeo, [new THREE.MeshLambertMaterial({ color: 0x79ad55 }), new THREE.MeshLambertMaterial({ color: 0x8a6a3a })]);
        world.add(land);

        // 山（東側の奥越〜岐阜・石川との県境。見た目のための飾り）
        const mtMat = new THREE.MeshLambertMaterial({ color: 0x4f8a3c, flatShading: true });
        const snowMat = new THREE.MeshLambertMaterial({ color: 0xf4f4f4, flatShading: true });
        const MOUNTAINS = [[36.12, 136.70, 1.8], [36.02, 136.66, 1.5], [35.90, 136.60, 1.6], [35.80, 136.50, 1.3], [36.13, 136.40, 1.0],
            [35.72, 136.38, 1.1], [35.68, 136.25, 0.9], [35.55, 135.95, 0.8], [35.45, 135.75, 0.8], [35.98, 136.35, 0.7], [35.83, 136.35, 0.9]];
        MOUNTAINS.forEach(([lat, lon, h]) => {
            const [x, y] = toXY(lat, lon);
            h *= 1.5;
            const m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.9, h * 1.6, 6), mtMat);
            m.position.set(x, LAND_H + h * 0.8, -y); world.add(m);
            if (h >= 2.1) { const s = new THREE.Mesh(new THREE.ConeGeometry(h * 0.33, h * 0.6, 6), snowMat); s.position.set(x, LAND_H + h * 1.32, -y); world.add(s); }
        });

        // 章のピンと、ピン同士をつなぐ道
        const pins = chapters.map((c, i) => {
            const p = AREA_POS[c.id] || [LAT0, LON0];
            const [x, y] = toXY(p[0], p[1]);
            const pos = new THREE.Vector3(x, LAND_H + 0.15, -y);
            const mat = new THREE.MeshLambertMaterial({ color: 0x666666 });
            const g = new THREE.Group(); g.position.copy(pos); g.scale.setScalar(PIN_S);
            const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.2, 20), mat); g.add(base);
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), new THREE.MeshLambertMaterial({ color: 0x5a3a1a }));
            pole.position.y = 0.75; g.add(pole);
            const flagMat = new THREE.MeshLambertMaterial({ color: 0xd23b2a, side: THREE.DoubleSide });
            const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38), flagMat); flag.position.set(0.32, 1.2, 0); flag.visible = false; g.add(flag);
            base.userData.chapter = i;
            world.add(g);
            return { group: g, base, mat, flag, pos, chapter: c };
        });
        const pathPts = pins.map(p => p.pos.clone().setY(LAND_H + 0.12));
        const curve = new THREE.CatmullRomCurve3(pathPts, false, "catmullrom", 0.3);
        const dots = [];
        const dotGeo = new THREE.SphereGeometry(0.15, 8, 6);
        const N = 140;
        for (let k = 0; k <= N; k++) {
            const d = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
            d.position.copy(curve.getPoint(k / N)); d.userData.t = k / N; world.add(d); dots.push(d);
        }

        // プレイヤーのコマ（そばの器）
        const piece = new THREE.Group();
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.24, 0.32, 20), new THREE.MeshLambertMaterial({ color: 0x9b1c1c }));
        bowl.position.y = 0.16; piece.add(bowl);
        const soba = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 20), new THREE.MeshLambertMaterial({ color: 0xb59a6a }));
        soba.position.y = 0.31; piece.add(soba);
        const oroshi = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }));
        oroshi.position.y = 0.36; oroshi.scale.y = 0.6; piece.add(oroshi);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.75, 28), new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; piece.add(ring);
        piece.scale.setScalar(PIN_S);
        world.add(piece);

        return { THREE, renderer, scene, camera, world, pins, curve, dots, piece, ring, raycaster: new THREE.Raycaster(),
            yaw: 0, zoom: 1, anim: null, raf: 0, pieceT: 0, focus: pins[0].pos.clone(),
            center: pins.reduce((a, p) => a.add(p.pos), new THREE.Vector3()).multiplyScalar(1 / pins.length) };
    }

    // 何章目まで進めるか（開いている最後の章）と、各章の状態
    function chapterStates(state, chapters) {
        return chapters.map(c => {
            const open = c.stages.some(s => StoryCore.isUnlocked(state, chapters, s.id));
            const done = c.stages.every(s => !!state.cleared[s.id]);
            return { open, done };
        });
    }
    const MAP_POS_KEY = "sobamichi_story_mappos";
    const readPos = () => { try { const v = Number(localStorage.getItem(MAP_POS_KEY)); return Number.isFinite(v) ? v : 0; } catch (e) { return 0; } };
    const writePos = (v) => { try { localStorage.setItem(MAP_POS_KEY, String(v)); } catch (e) { /* 保存できなくても動く */ } };

    function frame() {
        const s = st;
        if (!s) return;
        const el = document.getElementById("story");
        if (!el || el.style.display === "none" || !el.classList.contains("st3d")) { s.raf = 0; return; }
        s.raf = requestAnimationFrame(frame);
        const now = performance.now();

        // コマの移動アニメ
        if (s.anim) {
            const k = Math.max(0, Math.min(1, (now - s.anim.start) / s.anim.dur));
            const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            s.pieceT = s.anim.from + (s.anim.to - s.anim.from) * e;
            if (k >= 1) { s.anim = null; s.pieceT = s.targetT; }
        }
        const n = s.pins.length - 1;
        const p = s.curve.getPoint(Math.max(0, Math.min(1, s.pieceT / n)));
        const hop = s.anim && now > s.anim.start ? Math.abs(Math.sin(((now - s.anim.start) / 260) * Math.PI)) * 0.5 : Math.sin(now / 400) * 0.05;
        s.piece.position.set(p.x, p.y + 0.1 + hop * PIN_S, p.z);
        s.ring.material.opacity = 0.5 + 0.3 * Math.sin(now / 300);
        s.focus.lerp(p, 0.06);
        // 歩いた道は金色、まだの道は白
        s.dots.forEach(d => d.material.color.set(d.userData.t * n <= s.pieceT + 0.001 ? 0xffcc44 : 0xdddddd));
        s.pins.forEach(pin => { if (pin.flag.visible) pin.flag.rotation.y = Math.sin(now / 500 + pin.pos.x) * 0.3; });

        // カメラ：今いる場所を斜め上から見る。左右ドラッグで回せる
        // 全部のエリアが入るよう、エリアのまん中と今いる場所の間を見る
        const dist = (s.camera.aspect < 0.8 ? 56 : 46) / s.zoom;
        const w0 = s.camera.aspect < 0.8 ? 0.85 : 0.6;
        const cx = s.center.x * w0 + s.focus.x * (1 - w0), cz = s.center.z * w0 + s.focus.z * (1 - w0);
        s.camera.position.set(cx + Math.sin(s.yaw) * dist * 0.62, dist * 0.78, cz + Math.cos(s.yaw) * dist * 0.62);
        s.camera.lookAt(cx, 0, cz - 3); // 少し北を見て、上の見出しとピンが重ならないようにする
        s.renderer.render(s.scene, s.camera);

        // HTML の名札をピンの上に置く
        const w = s.canvas.clientWidth, h = s.canvas.clientHeight;
        s.labels.forEach((lb, i) => {
            const v = s.pins[i].pos.clone(); v.y += 1.7 * PIN_S; v.project(s.camera);
            lb.style.display = v.z < 1 ? "" : "none";
            const half = (lb.offsetWidth || 120) / 2 + 4;
            lb.style.left = Math.max(half, Math.min(w - half, (v.x + 1) / 2 * w)) + "px"; lb.style.top = ((1 - v.y) / 2 * h) + "px";
        });
    }

    function resize() {
        if (!st || !st.canvas) return;
        const w = st.canvas.clientWidth || window.innerWidth, h = st.canvas.clientHeight || window.innerHeight;
        st.renderer.setSize(w, h, false);
        st.camera.aspect = w / h;
        st.camera.fov = w < h ? 52 : 40;
        st.camera.updateProjectionMatrix();
    }

    function bindInput(canvas, onPick) {
        let down = null, pinch = null;
        const pts = new Map();
        canvas.addEventListener("pointerdown", (e) => {
            pts.set(e.pointerId, [e.clientX, e.clientY]);
            if (pts.size === 1) down = { x: e.clientX, y: e.clientY, yaw: st.yaw, moved: false };
            if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), zoom: st.zoom }; down = null; }
            canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        });
        canvas.addEventListener("pointermove", (e) => {
            if (!pts.has(e.pointerId)) return;
            pts.set(e.pointerId, [e.clientX, e.clientY]);
            if (pinch && pts.size === 2) {
                const [a, b] = [...pts.values()];
                st.zoom = Math.max(0.7, Math.min(2.2, pinch.zoom * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d));
            } else if (down) {
                const dx = e.clientX - down.x;
                if (Math.abs(dx) > 6 || Math.abs(e.clientY - down.y) > 6) down.moved = true;
                st.yaw = Math.max(-0.8, Math.min(0.8, down.yaw - dx * 0.006));
            }
        });
        const up = (e) => {
            if (down && !down.moved && pts.size === 1) onPick(e.clientX, e.clientY);
            pts.delete(e.pointerId);
            if (pts.size < 2) pinch = null;
            if (pts.size === 0) down = null;
        };
        canvas.addEventListener("pointerup", up);
        canvas.addEventListener("pointercancel", (e) => { pts.delete(e.pointerId); down = null; pinch = null; });
        canvas.addEventListener("wheel", (e) => { e.preventDefault(); st.zoom = Math.max(0.7, Math.min(2.2, st.zoom * (e.deltaY > 0 ? 0.92 : 1.08))); }, { passive: false });
    }

    // 地図を描く。opts: { tr, esc, onStage(stageId), onBack(), onList(), onResult() | null }
    // 失敗したら Promise を reject する（呼び出し側で一覧表示に切り替える）
    async function render(el, state, chapters, opts) {
        if (!webglOk()) throw new Error("no webgl");
        const THREE = await loadThree();
        if (!document.getElementById("storyMap3dCss")) {
            const tag = document.createElement("style"); tag.id = "storyMap3dCss"; tag.textContent = css; document.head.appendChild(tag);
        }
        if (!st) {
            st = buildScene(THREE, chapters);
            st.pieceT = st.targetT = Math.max(0, Math.min(chapters.length - 1, readPos()));
            window.addEventListener("resize", resize);
        }
        const { tr, esc } = opts;
        const cs = chapterStates(state, chapters);
        let nowIdx = 0; cs.forEach((c, i) => { if (c.open) nowIdx = i; });
        const allDone = cs.every(c => c.done);
        const doneCount = chapters.flatMap(c => c.stages).filter(s => state.cleared[s.id]).length;
        const total = chapters.flatMap(c => c.stages).length;

        el.classList.add("st3d");
        el.innerHTML = `<canvas class="m3Canvas"></canvas><div class="m3Labels"></div>
          <div class="m3Top"><h1>${T("🗺️ 福井めぐり", "🗺️ Fukui Journey")}</h1>
            <div class="m3Sub">${T("ピンをタップしてステージへ。クリアすると次の土地へ進める", "Tap a pin to play. Clear stages to travel on")}</div>
            <div class="m3Prog">${T(`クリア ${doneCount} / ${total}`, `Cleared ${doneCount} / ${total}`)}</div></div>
          <div class="m3Bottom">
            ${opts.onResult ? `<button class="m3Btn" data-act="result">${T("🍜 そばタイプを見る", "🍜 Soba type")}</button>` : ""}
            <button class="m3Btn" data-act="list">${T("📜 一覧で見る", "📜 List view")}</button>
            <button class="m3Btn" data-act="back">${T("タイトルへ", "Title")}</button></div>
          <div class="m3Sheet"></div>`;
        const canvas = el.querySelector(".m3Canvas");
        // renderer の canvas を使い回す（WebGL の数を増やさない）
        canvas.replaceWith(st.renderer.domElement);
        st.canvas = st.renderer.domElement; st.canvas.className = "m3Canvas";
        if (!st.inputBound) { bindInput(st.canvas, (x, y) => st.pick && st.pick(x, y)); st.inputBound = true; }

        // ピンの見た目
        st.pins.forEach((pin, i) => {
            lighten(THREE, pin.mat, cs[i].open);
            if (cs[i].done) { pin.mat.color.set(0x8fdc7a); pin.mat.emissive.set(0x123300); }
            pin.flag.visible = cs[i].done;
        });

        // 名札
        const labelsEl = el.querySelector(".m3Labels");
        st.labels = chapters.map((c, i) => {
            const lb = document.createElement("div");
            const guide = CHARACTERS[c.guides[0]];
            const face = cs[i].open && guide && guide.img ? `<img src="${guide.img}" alt="">` : `<span class="m3Q">${cs[i].open ? "★" : "？"}</span>`;
            lb.className = "m3Label" + (cs[i].done ? " done" : cs[i].open ? "" : " locked") + (i === nowIdx && !allDone ? " now" : "");
            lb.innerHTML = `${face}<span>${T(`${i + 1}章`, `Ch.${i + 1}`)} ${cs[i].open ? esc(tr(c.area)) : "？？？"}${cs[i].done ? " ✔" : ""}</span>`;
            lb.onclick = () => openSheet(i);
            labelsEl.appendChild(lb);
            return lb;
        });

        const sheet = el.querySelector(".m3Sheet");
        function openSheet(i) {
            const c = chapters[i];
            if (!cs[i].open) {
                sheet.innerHTML = `<button class="m3Close">×</button><h3>${T(`第${i + 1}章`, `Chapter ${i + 1}`)}　？？？</h3>
                  <div class="m3Guides">${T("前の章をクリアすると行けるようになる", "Clear the previous chapter to travel here")}</div>`;
            } else {
                const names = c.guides.map(g => CHARACTERS[g] ? T(CHARACTERS[g].name, CHARACTERS[g].nameEn) : g).join(T("・", ", "));
                sheet.innerHTML = `<button class="m3Close">×</button><h3>${T(`第${i + 1}章`, `Chapter ${i + 1}`)}　${esc(tr(c.area))}</h3>
                  <div class="m3Guides">${T("案内役", "Guide")}：${esc(names)}</div>
                  <div class="stStages">${c.stages.map(s => {
                      const ok = StoryCore.isUnlocked(state, chapters, s.id);
                      const g = state.cleared[s.id];
                      return `<button class="stStage" data-stage="${s.id}" ${ok ? "" : "disabled"}>${s.id}　${ok ? esc(tr(s.title)) : "？？？"}
                        <span class="stGrade">${g ? T(`クリア（評価 ${g}）`, `Cleared (${g})`) : ""}</span></button>`;
                  }).join("")}</div>`;
                sheet.querySelectorAll(".stStage").forEach(b => b.onclick = () => opts.onStage(b.dataset.stage));
            }
            sheet.querySelector(".m3Close").onclick = () => sheet.classList.remove("open");
            sheet.classList.add("open");
        }
        st.pick = (x, y) => {
            const r = st.canvas.getBoundingClientRect();
            const v = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
            st.raycaster.setFromCamera(v, st.camera);
            const hit = st.raycaster.intersectObjects(st.pins.map(p => p.base), false)[0];
            if (hit) openSheet(hit.object.userData.chapter); else sheet.classList.remove("open");
        };
        el.querySelectorAll(".m3Bottom [data-act]").forEach(b => b.onclick = () => {
            const a = b.dataset.act;
            if (a === "back") opts.onBack(); else if (a === "list") opts.onList(); else if (a === "result" && opts.onResult) opts.onResult();
        });

        // 新しい章が開いていたら、コマを前の場所から歩かせる
        const prev = Math.max(0, Math.min(chapters.length - 1, readPos()));
        st.targetT = nowIdx;
        if (nowIdx !== prev) {
            st.pieceT = prev;
            st.anim = { from: prev, to: nowIdx, start: performance.now() + 600, dur: 1400 * Math.abs(nowIdx - prev) };
            writePos(nowIdx);
        } else { st.pieceT = nowIdx; }
        st.focus.copy(st.pins[prev].pos);

        resize();
        if (!st.raf) st.raf = requestAnimationFrame(frame);
    }

    // 3Dマップをやめて、ふつうの表示に戻す（一覧・結果画面へ切り替えるとき）
    function leave(el) { if (el) el.classList.remove("st3d"); }

    window.StoryMap3D = { render, leave, AREA_POS };
})();
