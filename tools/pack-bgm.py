# 曲ファイル（mp3）を、ゲームが読む .bgm に変換する。
# 素材サイトの規約（音声ファイルをそのまま取り出せる形で置かない）に合わせるため。元に戻す処理は index.html の unpackBgm。
# 使い方: python3 tools/pack-bgm.py 元の曲.mp3 bgm/出力.bgm
import sys

def stream(n, seed=0x50BA2026):
    s = seed
    out = bytearray(n)
    for i in range(n):
        s = (s * 1103515245 + 12345) & 0xFFFFFFFF
        out[i] = (s >> 16) & 0xFF
    return out

src = open(sys.argv[1], "rb").read()
key = stream(len(src))
open(sys.argv[2], "wb").write(b"SOBA" + bytes(a ^ b for a, b in zip(src, key)))
