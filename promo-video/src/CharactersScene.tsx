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

export const CharactersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Characters"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, #2a1a3a 0%, #0c0712 70%)",
        fontFamily: mincho,
      }}
    >
      <Interactive.Div
        name="Headline"
        style={{
          position: "absolute",
          top: 170,
          width: "100%",
          textAlign: "center",
          color: "white",
          fontSize: 92,
          fontWeight: 900,
          lineHeight: 1.25,
          opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        個性豊かな
        <br />
        <span style={{ color: "gold" }}>職人</span>を集めろ
      </Interactive.Div>

      <Interactive.Div
        name="Sennin card"
        style={{
          position: "absolute",
          left: 80,
          top: 520,
          width: 920,
          height: 400,
          display: "flex",
          alignItems: "center",
          gap: 30,
          translate: interpolate(frame, [0.3 * fps, 0.9 * fps], ["-1100px 0px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <Img src={staticFile("chars/sennin.webp")} style={{ width: 400, height: 400 }} />
        <div style={{ color: "white" }}>
          <div style={{ color: "gold", fontSize: 48, fontWeight: 900 }}>SSR</div>
          <div style={{ fontSize: 60, fontWeight: 900 }}>越前そば仙人</div>
          <div style={{ fontSize: 44, color: "#f3e6c4" }}>得点+25%</div>
        </div>
      </Interactive.Div>

      <Interactive.Div
        name="Dragon card"
        style={{
          position: "absolute",
          left: 80,
          top: 940,
          width: 920,
          height: 400,
          display: "flex",
          flexDirection: "row-reverse",
          alignItems: "center",
          gap: 30,
          textAlign: "right",
          translate: interpolate(frame, [0.9 * fps, 1.5 * fps], ["1100px 0px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <Img src={staticFile("chars/oroshi_ryu.webp")} style={{ width: 400, height: 400 }} />
        <div style={{ color: "white" }}>
          <div style={{ color: "gold", fontSize: 48, fontWeight: 900 }}>SSR</div>
          <div style={{ fontSize: 60, fontWeight: 900 }}>おろし龍</div>
          <div style={{ fontSize: 44, color: "#f3e6c4" }}>判定が広い</div>
        </div>
      </Interactive.Div>

      <Interactive.Div
        name="Princess card"
        style={{
          position: "absolute",
          left: 80,
          top: 1360,
          width: 920,
          height: 400,
          display: "flex",
          alignItems: "center",
          gap: 30,
          translate: interpolate(frame, [1.5 * fps, 2.1 * fps], ["-1100px 0px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <Img src={staticFile("chars/kuzuryu_hime.webp")} style={{ width: 400, height: 400 }} />
        <div style={{ color: "white" }}>
          <div style={{ color: "gold", fontSize: 48, fontWeight: 900 }}>SSR</div>
          <div style={{ fontSize: 60, fontWeight: 900 }}>九頭竜の姫</div>
          <div style={{ fontSize: 44, color: "#f3e6c4" }}>フィーバー2.5倍</div>
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
