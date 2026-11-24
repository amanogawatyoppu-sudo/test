#!/usr/bin/env python3
"""ストーリーの3Dマップ用に、福井県まわりの地形（高さ）と地表の色の画像を作る。

ゲームを動かすときには使わない。地図を作り直したいときだけ手で実行する。

使うデータ（どちらも実行時にダウンロードしておく）:
  - 標高: AWS Open Data の Terrain Tiles（terrarium 形式、ズーム11）
      https://s3.amazonaws.com/elevation-tiles-prod/terrarium/11/{x}/{y}.png
      x = 1793..1805, y = 799..810 を TILE_DIR に {x}_{y}.png で置く
  - 陸地と県境: dataofjapan/land の japan.geojson（出典：地球地図日本）

使い方:
  python3 tools/build-map-terrain.py TILE_DIR japan.geojson
出力:
  story/map/fukui-terrain.js   高さ（16bit を base64 で埋め込み）
  story/map/fukui-terrain.jpg  地表の色（2048x2048）
"""
import base64, heapq, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# 地図に入れる範囲（経度・緯度）。story-map3d.js の BOUNDS と同じにする
LON_W, LON_E, LAT_S, LAT_N = 135.25, 137.25, 35.15, 36.55
Z = 11
TX0, TX1, TY0, TY1 = 1793, 1805, 799, 810
HGRID_W = 320            # 高さの格子（横の点の数）
TEX = 2048               # 色の画像の大きさ
WORK_W = 2400            # 色を作るときの作業用の大きさ（横）

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
LAT0 = 35.85
COSL = math.cos(math.radians(LAT0))
ASPECT = (LON_E - LON_W) * COSL / (LAT_N - LAT_S)   # 横 / 縦（ゲームの座標で）


def load_mosaic(tile_dir):
    w, h = (TX1 - TX0 + 1) * 256, (TY1 - TY0 + 1) * 256
    m = np.zeros((h, w), np.float32)
    for x in range(TX0, TX1 + 1):
        for y in range(TY0, TY1 + 1):
            a = np.asarray(Image.open(os.path.join(tile_dir, f"{x}_{y}.png")).convert("RGB"), np.float32)
            e = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
            m[(y - TY0) * 256:(y - TY0 + 1) * 256, (x - TX0) * 256:(x - TX0 + 1) * 256] = e
    return m


def merc_px(lon, lat):
    n = 2 ** Z * 256
    x = (lon + 180) / 360 * n
    lr = np.radians(lat)
    y = (1 - np.log(np.tan(lr) + 1 / np.cos(lr)) / math.pi) / 2 * n
    return x - TX0 * 256, y - TY0 * 256


def sample(m, w, h):
    """経度・緯度が等間隔の格子（w x h、上が北）に標高を取り出す（双線形）"""
    lon = np.linspace(LON_W, LON_E, w)
    lat = np.linspace(LAT_N, LAT_S, h)
    LON, LAT = np.meshgrid(lon, lat)
    px, py = merc_px(LON, LAT)
    x0 = np.clip(np.floor(px).astype(int), 0, m.shape[1] - 2)
    y0 = np.clip(np.floor(py).astype(int), 0, m.shape[0] - 2)
    fx, fy = px - x0, py - y0
    return (m[y0, x0] * (1 - fx) * (1 - fy) + m[y0, x0 + 1] * fx * (1 - fy)
            + m[y0 + 1, x0] * (1 - fx) * fy + m[y0 + 1, x0 + 1] * fx * fy)


def rasterize(features, w, h, pref_ids=None, outline=False, width=1):
    img = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img)
    to = lambda p: ((p[0] - LON_W) / (LON_E - LON_W) * (w - 1), (LAT_N - p[1]) / (LAT_N - LAT_S) * (h - 1))
    for f in features:
        if pref_ids and f["properties"]["id"] not in pref_ids:
            continue
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poly in polys:
            xs = [p[0] for p in poly[0]]; ys = [p[1] for p in poly[0]]
            if max(xs) < LON_W - .5 or min(xs) > LON_E + .5 or max(ys) < LAT_S - .5 or min(ys) > LAT_N + .5:
                continue
            for k, ring in enumerate(poly):
                pts = [to(p) for p in ring]
                if outline:
                    d.line(pts + [pts[0]], fill=255, width=width)
                else:
                    d.polygon(pts, fill=0 if k else 255)
    return np.asarray(img, np.float32) / 255


def noise(w, h, scale, seed):
    """なめらかなでこぼこ（値ノイズを何段か重ねる）"""
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    s = scale
    for _ in range(4):
        gw, gh = max(2, int(w / s)), max(2, int(h / s))
        g = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += np.asarray(g, np.float32) / 255 * amp
        tot += amp; amp *= 0.5; s /= 2
    return out / tot


def flow_accumulation(elev, land):
    """川の流れを地形から計算する（くぼみを埋めてから、いちばん低い隣へ流す）"""
    h, w = elev.shape
    filled = elev.copy()
    done = np.zeros((h, w), bool)
    pq = []
    for y in range(h):
        for x in range(w):
            if not land[y, x] or x in (0, w - 1) or y in (0, h - 1):
                done[y, x] = True
                heapq.heappush(pq, (float(filled[y, x]), y, x))
    order = []
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    while pq:
        e, y, x = heapq.heappop(pq)
        order.append((y, x))
        for dy, dx in nb:
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and not done[yy, xx]:
                done[yy, xx] = True
                if filled[yy, xx] <= e:
                    filled[yy, xx] = e + 1e-3
                heapq.heappush(pq, (float(filled[yy, xx]), yy, xx))
    acc = np.ones((h, w), np.float32)
    for y, x in reversed(order):
        if not land[y, x]:
            continue
        best, by, bx = filled[y, x], -1, -1
        for dy, dx in nb:
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w:
                dz = (filled[y, x] - filled[yy, xx]) / (1.414 if dy and dx else 1)
                if dz > 0 and filled[yy, xx] < best + 1e9 and (by < 0 or dz > bestdz):
                    by, bx, bestdz = yy, xx, dz
        if by >= 0:
            acc[by, bx] += acc[y, x]
    return acc


def mix(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return a * (1 - t) + b * t


def main(tile_dir, geojson):
    feats = json.load(open(geojson, encoding="utf-8"))["features"]
    mosaic = load_mosaic(tile_dir)

    # ---- 高さの格子 ----
    hw, hh = HGRID_W, round(HGRID_W / ASPECT)
    hel = sample(mosaic, hw, hh)
    hland = rasterize(feats, hw * 4, hh * 4)
    hland = np.asarray(Image.fromarray((hland * 255).astype(np.uint8)).resize((hw, hh), Image.BILINEAR), np.float32) / 255
    # 海は平らにして少し下げる。陸は海岸でなめらかに 0 へ
    hel = np.where(hland > 0.5, np.maximum(hel, 0) * np.clip((hland - 0.5) * 4, 0, 1), -20.0)
    q = np.clip(np.round(hel + 100), 0, 65535).astype("<u2")   # 0.. = -100m..
    os.makedirs(os.path.join(ROOT, "story", "map"), exist_ok=True)
    with open(os.path.join(ROOT, "story", "map", "fukui-terrain.js"), "w", encoding="utf-8") as fp:
        fp.write("// tools/build-map-terrain.py で作った福井県まわりの高さ（メートル+100 を 16bit で）。手で直さない。\n")
        fp.write("// 標高: Terrain Tiles (AWS Open Data / Mapzen, SRTM ほか)。陸地と県境: 地球地図日本（国土地理院）\n")
        fp.write("window.FUKUI_TERRAIN = " + json.dumps({
            "bounds": [LON_W, LON_E, LAT_S, LAT_N], "w": hw, "h": hh, "offset": 100,
            "data": base64.b64encode(q.tobytes()).decode()}) + ";\n")

    # ---- 地表の色 ----
    W, H = WORK_W, round(WORK_W / ASPECT)
    el = sample(mosaic, W, H)
    land = rasterize(feats, W, H)
    fukui = rasterize(feats, W, H, pref_ids={18})
    fukui_s = np.asarray(Image.fromarray((fukui * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6)), np.float32) / 255
    border = rasterize(feats, W, H, pref_ids={18}, outline=True, width=3)
    border = np.asarray(Image.fromarray((border * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255
    elv = np.maximum(el, 0)
    # 琵琶湖・三方五湖など：標高データでは湖面がまっ平らなので、まわり一帯の高さがそろっている所を湖にする
    def blur(a, r):
        """箱型のぼかし（半径 r の平均）。端は端の値をのばす"""
        a = np.pad(a.astype(np.float64), r + 1, mode="edge")
        for ax in (0, 1):
            c = np.cumsum(a, axis=ax)
            hi = np.take(c, range(2 * r + 1, a.shape[ax]), axis=ax)
            lo = np.take(c, range(0, a.shape[ax] - 2 * r - 1), axis=ax)
            a = (hi - lo) / (2 * r + 1)
            pad = [(0, 0), (0, 0)]; pad[ax] = (r + 1, r)
            a = np.pad(a, pad, mode="edge")
        return a[r + 1:-r - 1 or None, r + 1:-r - 1 or None].astype(np.float32)
    m1 = blur(elv, 4)
    var = blur(elv * elv, 4) - m1 * m1
    lake = ((var < 0.05) & (elv > 0.5) & (land > 0.5)).astype(np.float32)
    lake = (blur(lake, 3) > 0.6).astype(np.float32)
    lake = np.asarray(Image.fromarray((lake * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1)), np.float32) / 255

    # 傾きと陰影（北西から光）
    px_m = (LON_E - LON_W) * COSL * 111000 / W
    gy, gx = np.gradient(elv, px_m)
    slope = np.hypot(gx, gy)
    lx, ly, lz = -0.6, -0.6, 0.55
    nz = 1 / np.sqrt(1 + gx * gx + gy * gy)
    shade = np.clip((-gx * lx * nz + gy * ly * nz + lz * nz) / math.sqrt(lx * lx + ly * ly + lz * lz), 0, 1)

    n1 = noise(W, H, 90, 1)
    n2 = noise(W, H, 18, 2)
    n3 = noise(W, H, 6, 3)
    C = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)

    # 平地：田んぼ（11月なので刈り取り後の黄土色と、緑の畑がまだら）
    paddy = mix(C("#8c8a55"), C("#a59a62"), n2 * 1.4 - 0.2)
    paddy = mix(paddy, C("#6f8a46"), (n1 - 0.45) * 3)
    paddy = mix(paddy, C("#b8ab78"), (n3 - 0.7) * 4)
    # 低い山：広葉樹と杉の森（秋の色を少し）
    forest = mix(C("#2f4a26"), C("#435c2c"), n2)
    forest = mix(forest, C("#6b5a2e"), (n1 - 0.55) * 2.2)   # 紅葉
    forest = mix(forest, C("#243d22"), (n3 - 0.5) * 2)      # 杉
    # 高い山：岩と枯れ草、てっぺんは雪
    alpine = mix(C("#5b5a44"), C("#7b7462"), n2)
    snow = C("#eef2f4")

    flat = np.clip(1 - (elv - 40) / 120, 0, 1) * np.clip(1 - (slope - 0.04) / 0.08, 0, 1)
    col = mix(forest, paddy, flat)
    col = mix(col, alpine, (elv - 1500) / 600)
    col = mix(col, snow, (elv - 2050 + (n2 - 0.5) * 500) / 250 + (slope < 0.6) * 0.0)

    # 町（実在の市街地のだいたいの位置と広さ。灰色の点々）
    towns = [(36.064, 136.219, 6.0), (35.957, 136.184, 3.0), (35.903, 136.168, 3.2), (35.646, 136.071, 3.6),
             (35.979, 136.488, 2.2), (36.059, 136.501, 1.8), (36.106, 136.236, 2.4), (35.495, 135.746, 2.4),
             (36.235, 136.150, 1.8), (36.217, 136.236, 2.0), (35.772, 136.199, 0.8), (36.093, 136.302, 1.0),
             (36.564, 136.656, 6), (35.383, 136.282, 2.5), (36.408, 136.445, 3), (35.450, 135.333, 1.5)]
    LON = np.linspace(LON_W, LON_E, W)[None, :]
    LAT = np.linspace(LAT_N, LAT_S, H)[:, None]
    urban = np.zeros((H, W), np.float32)
    for la, lo, km in towns:
        d = np.hypot((LON - lo) * COSL * 111, (LAT - la) * 111) / km
        urban = np.maximum(urban, np.clip(1.3 - d - (n2 - 0.5) * 0.9, 0, 1))
    urban *= flat
    city = mix(C("#8f8a82"), C("#b3ada2"), n3)
    col = mix(col, city, urban * np.clip((n3 + 0.35) * 1.2, 0, 1))

    # 川（地形から流れを計算して、大きい川だけ描く）
    rs = 3
    sw, sh = W // rs, H // rs
    sel = np.asarray(Image.fromarray(elv).resize((sw, sh), Image.BILINEAR))
    sland = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).resize((sw, sh), Image.BILINEAR)) > 127
    acc = flow_accumulation(sel, sland)
    riv = np.clip((np.log10(acc) - 3.0) / 1.0, 0, 1) * sland
    riv = np.asarray(Image.fromarray((riv * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR).filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255
    riv = np.clip((riv - 0.15) * 2.5, 0, 1)
    col = mix(col, C("#4f7f94"), riv * 0.9)

    # 湖
    col = mix(col, C("#3a7190") * (0.95 + 0.1 * n2[..., None]), lake)
    shade = shade * (1 - lake) + 0.75 * lake

    # 陰影をかける
    col = col * (0.55 + 0.6 * shade[..., None])

    # 海：浅いところは明るく、沖は深い青
    # 標高データに海の深さが入っていないので、岸からの近さで浅い・深いを決める
    near = sum(blur(land * 255, r) / 255 for r in (6, 18, 50, 120)) / 4
    sea = mix(C("#174a72"), C("#2a7590"), near * 2.2)
    sea = mix(sea, C("#3f8f97"), (near - 0.3) * 3)
    sea = mix(sea, C("#0f3558"), (0.04 - near) * 25)
    landsoft = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)), np.float32) / 255
    beach = np.clip(1 - np.abs(landsoft - 0.5) * 4, 0, 1)
    col = mix(sea, col, landsoft)
    col = mix(col, C("#c9b98f"), beach * 0.5 * (elv < 30))

    # 福井県の外は少しくすませて、県境に細い線
    gray = col.mean(axis=2, keepdims=True)
    outside = (1 - fukui_s) * landsoft
    col = mix(col, gray * np.array([0.92, 0.95, 1.0]) * 0.85 + 6, outside * 0.55)
    col = mix(col, C("#fff2c0"), border * landsoft * 0.85)

    img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).resize((TEX, TEX), Image.LANCZOS)
    img.save(os.path.join(ROOT, "story", "map", "fukui-terrain.jpg"), quality=84, optimize=True, progressive=True)
    print("ok", hw, hh, W, H)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
