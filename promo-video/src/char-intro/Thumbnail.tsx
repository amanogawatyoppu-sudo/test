import { AbsoluteFill, Img, random, staticFile } from "remotion";
import { loadFont as loadBrush } from "@remotion/google-fonts/YujiBoku";
import { mincho } from "../fonts";
import { CharIntroProps, RARITY_BG, RARITY_COLOR } from "./characters";

const { fontFamily: brush } = loadBrush("normal", { weights: ["400"] });

export type ThumbProps = CharIntroProps & { no: number };

// 墨しぶき
const Splatter: React.FC<{ seed: string; color: string }> = ({ seed, color }) => (
  <>
    {new Array(70).fill(0).map((_, i) => {
      const r = (k: string) => random(`${seed}-${k}-${i}`);
      const size = 4 + Math.pow(r("s"), 3) * 46;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: r("x") * 1080,
            top: r("y") * 1920,
            width: size,
            height: size * (0.7 + r("h") * 0.6),
            borderRadius: "50%",
            background: color,
            opacity: 0.25 + r("o") * 0.5,
          }}
        />
      );
    })}
  </>
);

export const Thumbnail: React.FC<ThumbProps> = ({ id, name, rarity, no }) => {
  const color = RARITY_COLOR[rarity];
  const [bgIn, bgOut] = RARITY_BG[rarity];
  const nameSize = name.length >= 7 ? 150 : name.length >= 5 ? 175 : 210;
  const gold =
    "linear-gradient(170deg, #fff6c8 0%, #f5d36b 28%, #c99a2e 52%, #f7dd84 70%, #9c6b12 100%)";

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 45%, ${bgIn} 0%, ${bgOut} 80%)`,
        overflow: "hidden",
      }}
    >
      {/* 集中線 */}
      <div
        style={{
          position: "absolute",
          left: -460,
          top: -40,
          width: 2000,
          height: 2000,
          background: `repeating-conic-gradient(${color}40 0deg 5deg, transparent 5deg 15deg)`,
          maskImage: "radial-gradient(circle, black 5%, transparent 55%)",
          WebkitMaskImage: "radial-gradient(circle, black 5%, transparent 55%)",
        }}
      />
      <Splatter seed={id} color={color} />

      {/* 上の筆の帯 */}
      <div
        style={{
          position: "absolute",
          top: 300,
          left: -40,
          width: 1160,
          height: 150,
          background: "#f6f1e6",
          rotate: "-3deg",
          clipPath:
            "polygon(0 18%, 6% 6%, 30% 12%, 55% 0, 80% 8%, 100% 4%, 98% 90%, 70% 100%, 40% 88%, 12% 100%, 2% 86%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 300,
          width: "100%",
          height: 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 30,
          rotate: "-3deg",
          fontFamily: brush,
          color: "#141008",
          fontSize: 96,
        }}
      >
        キャラ紹介
        <span style={{ fontFamily: mincho, fontWeight: 900, fontSize: 92, color: "#b3261e" }}>
          #{String(no).padStart(2, "0")}
        </span>
      </div>

      {/* キャラ絵 */}
      <Img
        src={staticFile(`chars/${id}.webp`)}
        style={{
          position: "absolute",
          left: 90,
          top: 430,
          width: 900,
          height: 900,
          filter: `drop-shadow(0 0 40px ${color}aa) drop-shadow(0 24px 30px rgba(0,0,0,0.7))`,
        }}
      />

      {/* レア度 */}
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 480,
          padding: "0 34px",
          height: 150,
          minWidth: 150,
          boxSizing: "border-box",
          borderRadius: 80,
          border: `8px solid ${color}`,
          background: "rgba(0,0,0,0.65)",
          color,
          fontFamily: mincho,
          fontWeight: 900,
          fontSize: rarity.length > 2 ? 84 : 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 40px ${color}`,
          rotate: "8deg",
        }}
      >
        {rarity}
      </div>

      {/* 名前(金の筆文字) */}
      <div
        style={{
          position: "absolute",
          top: 1300,
          width: "100%",
          textAlign: "center",
          rotate: "-4deg",
          fontFamily: brush,
          fontSize: nameSize,
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {/* 黒いふち */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            color: "#120b02",
            WebkitTextStroke: "26px #120b02",
            filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.8))",
          }}
        >
          {name}
        </div>
        <div
          style={{
            position: "relative",
            background: gold,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {name}
        </div>
      </div>

      {/* ロゴ */}
      <div
        style={{
          position: "absolute",
          top: 1530,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 18,
          fontFamily: mincho,
          fontWeight: 900,
          fontSize: 56,
          color: "#f3e6c4",
          textShadow: "0 4px 12px rgba(0,0,0,0.9)",
        }}
      >
        <Img src={staticFile("favicon.png")} style={{ width: 84, height: 84, borderRadius: 16 }} />
        無限そば道
      </div>
    </AbsoluteFill>
  );
};
