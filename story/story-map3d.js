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
    // 地形は本物の標高データから作ったもの（story/map/。作り方は tools/build-map-terrain.py）。
    const LAT0 = 35.85, LON0 = 136.15, K = 64, COSL = Math.cos(LAT0 * Math.PI / 180);
    const toXY = (lat, lon) => [(lon - LON0) * K * COSL, (lat - LAT0) * K];
    const M_PER_UNIT = 111000 / K; // 1マス＝約1.7km
    const EXAG = 3.2;              // 山の高さを何倍に見せるか（そのままだと平らに見えるため）
    const PIN_S = 1.7; // ピンとコマの大きさ
    const PLACES = [ // 地名の小さな札（緯度, 経度, 日本語, 英語）
        [36.00, 135.75, "日本海", "Sea of Japan"], [35.62, 135.80, "若狭湾", "Wakasa Bay"], [36.155, 136.77, "白山", "Mt. Haku"],
        [35.33, 136.08, "琵琶湖", "Lake Biwa"], [35.645, 136.06, "敦賀", "Tsuruga"], [36.07, 136.215, "福井市", "Fukui"],
        [35.49, 135.75, "小浜", "Obama"], [36.24, 136.13, "東尋坊", "Tojinbo"],
    ];

    let THREE_ = null, loading = null;
    function loadScript(src, ok) {
        if (ok()) return Promise.resolve();
        return new Promise((res, rej) => {
            const s = document.createElement("script");
            s.src = src;
            s.onload = () => ok() ? res() : rej(new Error(src + " missing"));
            s.onerror = () => rej(new Error(src + " load failed"));
            document.head.appendChild(s);
        });
    }
    function loadThree() {
        if (loading) return loading;
        loading = Promise.all([
            loadScript("story/vendor/three-r128.min.js", () => !!window.THREE),
            loadScript("story/map/fukui-terrain.js", () => !!window.FUKUI_TERRAIN),
        ]).then(() => window.THREE, (e) => { loading = null; throw e; });
        return loading;
    }
    function webglOk() {
        try { const c = document.createElement("canvas"); return !!(c.getContext("webgl") || c.getContext("experimental-webgl")); }
        catch (e) { return false; }
    }

    const css = `
#story.st3d { padding:0; overflow:hidden; background:#9fb8c8; }
#story .m3Canvas { position:absolute; inset:0; width:100%; height:100%; touch-action:none; display:block; }
#story .m3Top { position:absolute; left:0; right:0; top:0; padding:12px 12px 0; pointer-events:none; text-align:center; }
#story .m3Top h1 { margin:0; font-family:'Zen Old Mincho'; color:#ffe9a8; font-size:24px; text-shadow:0 2px 6px #000; }
#story .m3Top .m3Sub { color:#dfe9f2; font-size:13px; margin-top:4px; text-shadow:0 1px 4px #000; }
#story .m3Prog { display:inline-block; margin-top:6px; padding:3px 12px; border-radius:12px; background:rgba(0,0,0,0.5); color:#ffcc44; font-size:13px; }
#story .m3Labels { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
#story .m3Place { position:absolute; transform:translate(-50%,-50%); pointer-events:none; white-space:nowrap; font-family:'Zen Old Mincho';
  font-size:12px; color:rgba(255,255,255,0.85); text-shadow:0 1px 3px rgba(0,0,0,0.8); letter-spacing:1px; }
#story .m3Place.sea { color:rgba(200,230,255,0.75); font-size:14px; letter-spacing:4px; }
#story .m3Credit { position:absolute; right:6px; bottom:calc(2px + env(safe-area-inset-bottom)); font-size:9px; color:rgba(255,255,255,0.6); pointer-events:none; text-shadow:0 1px 2px #000; }
#story .m3Label { position:absolute; transform:translate(-50%,-100%); pointer-events:auto; cursor:pointer; text-align:center; white-space:nowrap;
  font-family:'Zen Old Mincho'; font-size:13px; color:#fff; padding:3px 8px 3px 3px; border-radius:16px; background:rgba(40,22,5,0.85);
  border:2px solid #ffcc44; display:flex; align-items:center; gap:4px; box-shadow:0 2px 6px rgba(0,0,0,0.5); }
#story .m3Label img, #story .m3Label .m3Q { width:24px; height:24px; border-radius:50%; object-fit:cover; background:#f3e2c0; flex:none; }
#story .m3Label .m3Q { display:flex; align-items:center; justify-content:center; background:#555; color:#ccc; font-size:14px; }
#story .m3Label.locked { border-color:#666; background:rgba(30,30,30,0.8); color:#999; }
#story .m3Label.done { border-color:#8fdc7a; }
#story .m3Label.now { animation:m3pulse 1.2s ease-in-out infinite; }
@keyframes m3pulse { 50% { box-shadow:0 0 0 5px rgba(255,204,68,0.45); } }
#story .m3Bottom { position:absolute; left:0; right:0; bottom:0; padding:0 12px calc(18px + env(safe-area-inset-bottom)); display:flex; gap:8px; justify-content:center; flex-wrap:wrap; pointer-events:none; }
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

    // 画面の色の出し方（sRGB）に合わせて、色を直してから使う
    const SRGB = {};
    const rgb = (hex) => SRGB[hex] || (SRGB[hex] = new THREE_.Color(hex).convertSRGBToLinear());
    function lighten(THREE, mat, on) { mat.color.copy(rgb(on ? 0xffcc44 : 0x666666)); mat.emissive.copy(rgb(on ? 0x553300 : 0x000000)); }

    // 地形の高さ（ゲームの座標 x, z → 高さ）。データのない所は海の高さ
    function makeHeightField(T) {
        const bin = atob(T.data), n = T.w * T.h, hm = new Float32Array(n);
        for (let i = 0; i < n; i++) hm[i] = ((bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)) - T.offset) / M_PER_UNIT * EXAG;
        const [lonW, lonE, latS, latN] = T.bounds;
        const [x0, yN] = toXY(latN, lonW), [x1, yS] = toXY(latS, lonE);
        const at = (x, z) => {
            const u = (x - x0) / (x1 - x0) * (T.w - 1), v = (-z - yN) / (yS - yN) * (T.h - 1);
            if (!(u >= 0 && v >= 0 && u <= T.w - 1 && v <= T.h - 1)) return -0.05;
            const i = Math.min(T.w - 2, Math.floor(u)), j = Math.min(T.h - 2, Math.floor(v)), fu = u - i, fv = v - j;
            const a = hm[j * T.w + i], b = hm[j * T.w + i + 1], c = hm[(j + 1) * T.w + i], d = hm[(j + 1) * T.w + i + 1];
            return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv;
        };
        return { hm, at, x0, x1, yN, yS, w: T.w, h: T.h };
    }

    // 空のグラデーション（上は青、地平線は白っぽく）
    function skyTexture(THREE) {
        const c = document.createElement("canvas"); c.width = 2; c.height = 256;
        const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
        gr.addColorStop(0, "#4f86b8"); gr.addColorStop(0.55, "#9fc0d8"); gr.addColorStop(1, "#d9e4ea");
        g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
        const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
    }

    function buildScene(THREE, chapters) {
        THREE_ = THREE;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        const scene = new THREE.Scene();
        scene.background = skyTexture(THREE);
        scene.fog = new THREE.Fog(0xc9d8e2, 60, 150);
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);

        // 地表の画像に陰影が描いてあるので、光はやわらかめ
        scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x4a4030, 0.95));
        const sun = new THREE.DirectionalLight(0xfff0d8, 0.7); sun.position.set(-20, 30, -12); scene.add(sun);

        const world = new THREE.Group(); scene.add(world);
        const HF = makeHeightField(window.FUKUI_TERRAIN);

        // 地形：本物の標高で高さをつけた板に、地表の色の画像を貼る
        const geo = new THREE.PlaneGeometry(HF.x1 - HF.x0, HF.yN - HF.yS, HF.w - 1, HF.h - 1);
        geo.rotateX(-Math.PI / 2);
        const pa = geo.attributes.position;
        for (let i = 0; i < pa.count; i++) pa.setY(i, HF.hm[i]);
        geo.translate((HF.x0 + HF.x1) / 2, 0, -(HF.yN + HF.yS) / 2);
        geo.computeVertexNormals();
        const tex = new THREE.TextureLoader().load("story/map/fukui-terrain.jpg");
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const land = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
        world.add(land);

        // 海：遠くまで続く海と、日の光がきらっと映る水面
        const deep = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshBasicMaterial({ color: 0x123c62 }));
        deep.rotation.x = -Math.PI / 2; deep.position.y = -0.2; world.add(deep);
        const water = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshPhongMaterial({
            color: 0x1c4d74, specular: 0x9fb8cc, shininess: 60, transparent: true, opacity: 0.28, depthWrite: false }));
        water.rotation.x = -Math.PI / 2; water.position.y = -0.008; world.add(water);

        // 章のピンと、ピン同士をつなぐ道
        const pins = chapters.map((c, i) => {
            const p = AREA_POS[c.id] || [LAT0, LON0];
            const [x, y] = toXY(p[0], p[1]);
            const pos = new THREE.Vector3(x, HF.at(x, -y) + 0.06, -y);
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
        const pathPts = pins.map(p => p.pos.clone());
        const curve = new THREE.CatmullRomCurve3(pathPts, false, "catmullrom", 0.3);
        const dots = [];
        const dotGeo = new THREE.SphereGeometry(0.15, 8, 6);
        const N = 140;
        for (let k = 0; k <= N; k++) {
            const d = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
            d.position.copy(curve.getPoint(k / N)); d.position.y = HF.at(d.position.x, d.position.z) + 0.14;
            d.userData.t = k / N; world.add(d); dots.push(d);
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

        // 地形の画像以外の色（ピン・コマ・海）を sRGB に合わせる
        world.traverse(o => { if (o.material && o !== land && o.material.color) o.material.color.convertSRGBToLinear(); });

        return { THREE, renderer, scene, camera, world, pins, curve, dots, piece, ring, HF, water, raycaster: new THREE.Raycaster(),
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
        s.piece.position.set(p.x, s.HF.at(p.x, p.z) + 0.1 + hop * PIN_S, p.z);
        s.ring.material.opacity = 0.5 + 0.3 * Math.sin(now / 300);
        s.focus.lerp(p, 0.06);
        // 歩いた道は金色、まだの道は白
        s.dots.forEach(d => d.material.color.copy(rgb(d.userData.t * n <= s.pieceT + 0.001 ? 0xffcc44 : 0xdddddd)));
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
        const boxes = s.labels.map(lb => [lb.offsetLeft - lb.offsetWidth / 2, lb.offsetTop - lb.offsetHeight, lb.offsetWidth, lb.offsetHeight]);
        (s.places || []).forEach(pl => {
            const v = pl.pos.clone().project(s.camera);
            const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h;
            const pw = (pl.el.offsetWidth || 40) / 2 + 6, ph = 12;
            const hit = boxes.some(([bx, by, bw, bh]) => x + pw > bx && x - pw < bx + bw && y + ph > by && y - ph < by + bh);
            pl.el.style.display = v.z < 1 && !hit && x > 20 && x < w - 20 && y > 110 && y < h - 70 ? "" : "none";
            pl.el.style.left = x + "px"; pl.el.style.top = y + "px";
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
          <div class="m3Credit">${T("地形：Terrain Tiles（SRTM ほか）／県境：地球地図日本", "Terrain: Terrain Tiles (SRTM etc.) / Borders: Global Map Japan")}</div>
          <div class="m3Sheet"></div>`;
        const canvas = el.querySelector(".m3Canvas");
        // renderer の canvas を使い回す（WebGL の数を増やさない）
        canvas.replaceWith(st.renderer.domElement);
        st.canvas = st.renderer.domElement; st.canvas.className = "m3Canvas";
        if (!st.inputBound) { bindInput(st.canvas, (x, y) => st.pick && st.pick(x, y)); st.inputBound = true; }

        // ピンの見た目
        st.pins.forEach((pin, i) => {
            lighten(THREE, pin.mat, cs[i].open);
            if (cs[i].done) { pin.mat.color.copy(rgb(0x8fdc7a)); pin.mat.emissive.copy(rgb(0x123300)); }
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
        // 地名（日本海・若狭湾・白山など）。名札より奥に置く
        st.places = PLACES.map(([lat, lon, ja, en]) => {
            const [x, y] = toXY(lat, lon);
            const pe = document.createElement("div");
            pe.className = "m3Place" + (ja.endsWith("海") || ja.endsWith("湾") ? " sea" : "");
            pe.textContent = T(ja, en);
            labelsEl.insertBefore(pe, labelsEl.firstChild);
            return { el: pe, pos: new THREE.Vector3(x, Math.max(0, st.HF.at(x, -y)) + 0.3, -y) };
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
