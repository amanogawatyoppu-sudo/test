import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { mincho } from "./fonts";

export const OpeningScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Opening"
      style={{
        background:
          "radial-gradient(circle at 50% 42%, #5a3a0a 0%, #1a0f04 45%, #050302 100%)",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: mincho,
      }}
    >
      <Interactive.Div
        name="Glow"
        style={{
          position: "absolute",
          width: 1000,
          height: 1000,
          borderRadius: 500,
          top: 260,
          background:
            "radial-gradient(circle, rgba(255,215,0,0.35) 0%, rgba(255,215,0,0) 65%)",
          opacity: interpolate(frame, [0, 1 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [0, 3 * fps], [0.8, 1.15], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            output: "perceptual-scale",
          }),
        }}
      />
      <Img
        name="Logo"
        src={staticFile("favicon.png")}
        style={{
          position: "absolute",
          top: 330,
          width: 760,
          height: 760,
          borderRadius: 120,
          boxShadow: "0 0 80px rgba(255,215,0,0.6)",
          scale: interpolate(frame, [0, 0.8 * fps], [0.4, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 12 }),
            output: "perceptual-scale",
          }),
          rotate: interpolate(frame, [0, 0.8 * fps], ["-12deg", "0deg"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 12 }),
          }),
          opacity: interpolate(frame, [0, 0.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
      <Interactive.Div
        name="Tagline"
        style={{
          position: "absolute",
          top: 1200,
          width: "100%",
          textAlign: "center",
          color: "#f3e6c4",
          fontSize: 62,
          fontWeight: 700,
          letterSpacing: 6,
          textShadow: "0 4px 18px rgba(0,0,0,0.9)",
          opacity: interpolate(frame, [0.9 * fps, 1.5 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(
            frame,
            [0.9 * fps, 1.5 * fps],
            ["0px 40px", "0px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
        }}
      >
        越前おろしそば
        <br />
        職人修業ゲーム
      </Interactive.Div>
      <Interactive.Div
        name="Genre"
        style={{
          position: "absolute",
          top: 1440,
          paddingLeft: 48,
          paddingRight: 48,
          paddingTop: 14,
          paddingBottom: 14,
          border: "3px solid #c9a227",
          borderRadius: 60,
          color: "gold",
          fontSize: 48,
          fontWeight: 900,
          letterSpacing: 8,
          opacity: interpolate(frame, [1.5 * fps, 2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        そば打ち音ゲー
      </Interactive.Div>
    </AbsoluteFill>
  );
};
