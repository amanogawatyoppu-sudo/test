import { AbsoluteFill, Img, staticFile } from "remotion";
import { loadFont as loadBrush } from "@remotion/google-fonts/YujiBoku";
import { mincho } from "../fonts";
import { CHAR_INTROS, RARITY_COLOR } from "./characters";

const { fontFamily: brush } = loadBrush("normal", { weights: ["400"] });

// 締め投稿用：全員集合サムネ
export const ThumbAll: React.FC = () => {
  const gold =
    "linear-gradient(170deg, #fff6c8 0%, #f5d36b 30%, #c99a2e 55%, #f7dd84 72%, #9c6b12 100%)";
  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 50% 50%, #5a3a0a 0%, #0a0602 80%)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -460,
          top: -40,
          width: 2000,
          height: 2000,
          background: "repeating-conic-gradient(#ffcc0033 0deg 5deg, transparent 5deg 15deg)",
          maskImage: "radial-gradient(circle, black 5%, transparent 55%)",
          WebkitMaskImage: "radial-gradient(circle, black 5%, transparent 55%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 270,
          width: "100%",
          textAlign: "center",
          fontFamily: brush,
          fontSize: 190,
          lineHeight: 1,
          rotate: "-3deg",
        }}
      >
        <div style={{ position: "absolute", inset: 0, color: "#120b02", WebkitTextStroke: "26px #120b02" }}>
          全員集合！
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
          全員集合！
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 560,
          left: 60,
          width: 960,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 14,
        }}
      >
        {CHAR_INTROS.map((c) => (
          <div
            key={c.id}
            style={{
              height: 240,
              borderRadius: 24,
              background: "rgba(0,0,0,0.45)",
              border: `5px solid ${RARITY_COLOR[c.rarity]}`,
              boxShadow: c.rarity === "SSR" ? `0 0 26px ${RARITY_COLOR.SSR}` : undefined,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <Img src={staticFile(`chars/${c.id}.webp`)} style={{ width: 225, height: 225 }} />
            <div
              style={{
                position: "absolute",
                left: 8,
                top: 4,
                fontFamily: mincho,
                fontWeight: 900,
                fontSize: 30,
                color: RARITY_COLOR[c.rarity],
                textShadow: "0 2px 6px #000",
              }}
            >
              {c.rarity}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: 1610,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
          fontFamily: mincho,
          fontWeight: 900,
          fontSize: 64,
          color: "#f3e6c4",
          textShadow: "0 4px 12px rgba(0,0,0,0.9)",
        }}
      >
        <Img src={staticFile("favicon.png")} style={{ width: 96, height: 96, borderRadius: 18 }} />
        無限そば道 キャラ全16人
      </div>
    </AbsoluteFill>
  );
};
