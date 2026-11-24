import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { mincho } from "../fonts";
import { CharIntroProps, RARITY_BG, RARITY_COLOR } from "./characters";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

// ふわふわ舞うそば粉の粒
const Flour: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  return (
    <>
      {new Array(28).fill(0).map((_, i) => {
        const x = random(`x${i}`) * 1080;
        const speed = 0.6 + random(`s${i}`) * 1.4;
        const size = 6 + random(`r${i}`) * 14;
        const y = height + 40 - ((frame * speed + random(`y${i}`) * height) % (height + 80));
        const sway = Math.sin(frame / 25 + i) * 20;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + sway,
              top: y,
              width: size,
              height: size,
              borderRadius: size,
              background: i % 3 === 0 ? color : "#f3e6c4",
              opacity: 0.25 + random(`o${i}`) * 0.35,
              filter: "blur(1px)",
            }}
          />
        );
      })}
    </>
  );
};

export const CharIntro: React.FC<CharIntroProps> = ({
  id,
  name,
  nameEn,
  rarity,
  effect,
  profile,
  line,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const color = RARITY_COLOR[rarity];
  const [bgIn, bgOut] = RARITY_BG[rarity];

  const t = (s: number) => s * fps;
  const fadeIn = (start: number, len = 0.5) =>
    interpolate(frame, [t(start), t(start + len)], [0, 1], clamp);
  const slideUp = (start: number, len = 0.6, dist = 50) =>
    `0px ${interpolate(frame, [t(start), t(start + len)], [dist, 0], { ...clamp, easing: easeOut })}px`;

  // 台詞のタイプライター
  const lineStart = 5.2;
  const chars = Math.floor(
    interpolate(frame, [t(lineStart + 0.3), t(lineStart + 0.3) + line.length * 2.2], [0, line.length], clamp),
  );

  const outro = interpolate(frame, [durationInFrames - t(0.5), durationInFrames], [1, 0], clamp);
  const bob = Math.sin(frame / 18) * 10;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 30%, ${bgIn} 0%, ${bgOut} 75%)`,
        fontFamily: mincho,
        color: "white",
      }}
    >
      <AbsoluteFill style={{ opacity: outro }}>
        <Flour color={color} />

        {/* 上部ラベル */}
        <div
          style={{
            position: "absolute",
            top: 110,
            width: "100%",
            textAlign: "center",
            fontSize: 44,
            letterSpacing: 14,
            color: "#f3e6c4",
            opacity: fadeIn(0, 0.4),
          }}
        >
          ― キャラクター紹介 ―
        </div>

        {/* 後光 */}
        <div
          style={{
            position: "absolute",
            left: 90,
            top: 190,
            width: 900,
            height: 900,
            borderRadius: 450,
            background: `radial-gradient(circle, ${color}66 0%, ${color}00 65%)`,
            opacity: fadeIn(0.2, 0.8),
            scale: interpolate(frame, [0, durationInFrames], [0.9, 1.15], clamp),
          }}
        />

        {/* キャラ絵 */}
        <Img
          src={staticFile(`chars/${id}.webp`)}
          style={{
            position: "absolute",
            left: 190,
            top: 240,
            width: 700,
            height: 700,
            translate: `0px ${bob}px`,
            filter: `drop-shadow(0 20px 40px rgba(0,0,0,0.6))`,
            opacity: fadeIn(0.2, 0.3),
            scale: interpolate(frame, [t(0.2), t(1.0)], [0.5, 1], {
              ...clamp,
              easing: Easing.spring({ damping: 11 }),
              output: "perceptual-scale",
            }),
          }}
        />

        {/* レア度バッジ */}
        <div
          style={{
            position: "absolute",
            left: 110,
            top: 220,
            width: 190,
            height: 190,
            borderRadius: 95,
            border: `8px solid ${color}`,
            background: "rgba(0,0,0,0.55)",
            color,
            fontSize: rarity.length > 2 ? 78 : rarity.length > 1 ? 92 : 110,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 40px ${color}aa`,
            rotate: "-12deg",
            opacity: fadeIn(0.9, 0.15),
            scale: interpolate(frame, [t(0.9), t(1.25)], [2.2, 1], {
              ...clamp,
              easing: Easing.bezier(0.3, 1.6, 0.5, 1),
            }),
          }}
        >
          {rarity}
        </div>

        {/* 名前 */}
        <div
          style={{
            position: "absolute",
            top: 960,
            width: "100%",
            textAlign: "center",
            opacity: fadeIn(1.3),
            translate: slideUp(1.3),
          }}
        >
          <div
            style={{
              fontSize: 120,
              fontWeight: 900,
              letterSpacing: 6,
              textShadow: `0 0 30px ${color}99, 0 6px 16px rgba(0,0,0,0.9)`,
            }}
          >
            {name}
          </div>
          <div style={{ fontSize: 40, color: "#d9cfb8", letterSpacing: 4, marginTop: 4 }}>
            {nameEn}
          </div>
        </div>

        {/* プロフィール */}
        <div
          style={{
            position: "absolute",
            left: 80,
            top: 1200,
            width: 920,
            padding: "36px 48px",
            boxSizing: "border-box",
            borderRadius: 28,
            background: "rgba(0,0,0,0.5)",
            border: `3px solid ${color}88`,
            fontSize: 42,
            lineHeight: 1.6,
            color: "#f3e6c4",
            opacity: fadeIn(2.3),
            translate: slideUp(2.3),
          }}
        >
          {profile}
          <div
            style={{
              marginTop: 20,
              width: "fit-content",
              padding: "6px 26px",
              borderRadius: 40,
              background: color,
              color: "#111",
              fontSize: 38,
              fontWeight: 900,
              opacity: fadeIn(3.6, 0.3),
            }}
          >
            効果：{effect}
          </div>
        </div>

        {/* ひとこと台詞 */}
        <div
          style={{
            position: "absolute",
            left: 60,
            top: 1590,
            width: 960,
            minHeight: 170,
            padding: "30px 44px",
            boxSizing: "border-box",
            borderRadius: 40,
            background: "#fffaf0",
            color: "#2a1a08",
            fontSize: line.length > 22 ? 50 : 58,
            fontWeight: 900,
            lineHeight: 1.4,
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            opacity: fadeIn(lineStart, 0.25),
            scale: interpolate(frame, [t(lineStart), t(lineStart + 0.35)], [0.7, 1], {
              ...clamp,
              easing: Easing.bezier(0.3, 1.5, 0.5, 1),
            }),
          }}
        >
          {/* 吹き出しのしっぽ */}
          <div
            style={{
              position: "absolute",
              left: 460,
              top: -34,
              width: 0,
              height: 0,
              borderLeft: "26px solid transparent",
              borderRight: "26px solid transparent",
              borderBottom: "36px solid #fffaf0",
            }}
          />
          <span>「{line.slice(0, chars)}</span>
          <span style={{ opacity: 0 }}>{line.slice(chars)}</span>
          <span style={{ opacity: chars >= line.length ? 1 : 0 }}>」</span>
        </div>

        {/* ロゴ */}
        <div
          style={{
            position: "absolute",
            right: 50,
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 34,
            color: "#f3e6c4",
            opacity: fadeIn(0.5) * 0.85,
          }}
        >
          <Img src={staticFile("favicon.png")} style={{ width: 60, height: 60, borderRadius: 12 }} />
          無限そば道
        </div>
      </AbsoluteFill>

      <Audio
        src={staticFile("main.mp3")}
        volume={(f) =>
          interpolate(f, [0, 15, durationInFrames - 20, durationInFrames], [0, 0.6, 0.6, 0], clamp)
        }
      />
    </AbsoluteFill>
  );
};
