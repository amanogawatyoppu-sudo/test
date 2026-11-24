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

export const EndingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Ending"
      style={{
        background:
          "radial-gradient(circle at 50% 40%, #5a3a0a 0%, #1a0f04 50%, #050302 100%)",
        fontFamily: mincho,
        alignItems: "center",
      }}
    >
      <Interactive.Div
        name="Goal"
        style={{
          position: "absolute",
          top: 220,
          width: "100%",
          textAlign: "center",
          color: "white",
          fontSize: 84,
          fontWeight: 900,
          lineHeight: 1.3,
          opacity: interpolate(frame, [0, 0.5 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        目指せ、最高称号
        <br />
        <span style={{ color: "gold", fontSize: 130, textShadow: "0 0 30px rgba(255,215,0,0.7)" }}>
          『越前極』
        </span>
      </Interactive.Div>
      <Img
        name="Bowl"
        src={staticFile("note_bowl.png")}
        style={{
          position: "absolute",
          top: 640,
          width: 520,
          height: 520,
          scale: interpolate(frame, [0.4 * fps, 1.1 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 10 }),
            output: "perceptual-scale",
          }),
        }}
      />
      <Interactive.Div
        name="Call to action"
        style={{
          position: "absolute",
          top: 1260,
          width: "100%",
          textAlign: "center",
          color: "#f3e6c4",
          fontSize: 60,
          fontWeight: 700,
          lineHeight: 1.4,
          opacity: interpolate(frame, [1.1 * fps, 1.6 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        ブラウザで30秒から遊べる
      </Interactive.Div>
      <Interactive.Div
        name="Title"
        style={{
          position: "absolute",
          top: 1400,
          width: "100%",
          textAlign: "center",
          color: "gold",
          fontSize: 150,
          fontWeight: 900,
          textShadow: "0 0 30px rgba(255,215,0,0.7)",
          scale: interpolate(frame, [1.5 * fps, 2.1 * fps], [0.6, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 12 }),
            output: "perceptual-scale",
          }),
          opacity: interpolate(frame, [1.5 * fps, 1.8 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        無限そば道
      </Interactive.Div>
      <Interactive.Div
        name="Hashtag"
        style={{
          position: "absolute",
          top: 1620,
          width: "100%",
          textAlign: "center",
          color: "#c9a227",
          fontSize: 46,
          fontWeight: 700,
          opacity: interpolate(frame, [2.1 * fps, 2.5 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        #越前おろしそば
      </Interactive.Div>
    </AbsoluteFill>
  );
};
