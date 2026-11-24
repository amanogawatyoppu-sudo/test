import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { mincho } from "./fonts";

const LANE_TOP = [620, 900, 1180];
const LANE_HEIGHT = 158;
const RING_X = 92;
const NOTE_SIZE = 150;
const SPEED = 22; // px per frame
const NOTES = ["note_bowl.png", "note_oroshi.png", "note_kanji.png"];
const KEYS = ["A", "S", "L"];

// [lane, hit frame]
const HITS: [number, number][] = [
  [0, 40], [1, 52], [2, 64], [0, 76], [1, 82], [2, 94],
  [1, 106], [0, 112], [2, 118], [1, 130], [0, 136], [2, 142],
];

const NoteLayer: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      {HITS.map(([lane, hit], i) => {
        const x = RING_X + (hit - frame) * SPEED;
        if (frame > hit || x > 1200) return null;
        return (
          <Img
            key={i}
            src={staticFile(NOTES[lane])}
            style={{
              position: "absolute",
              width: NOTE_SIZE,
              height: NOTE_SIZE,
              left: x - NOTE_SIZE / 2,
              top: LANE_TOP[lane] + LANE_HEIGHT / 2 - NOTE_SIZE / 2,
            }}
          />
        );
      })}
      {HITS.map(([lane, hit], i) => {
        const t = frame - hit;
        if (t < 0 || t > 14) return null;
        return (
          <div
            key={`fx${i}`}
            style={{
              position: "absolute",
              left: RING_X - 110,
              top: LANE_TOP[lane] + LANE_HEIGHT / 2 - 110,
              width: 220,
              height: 220,
              borderRadius: 110,
              border: "8px solid #fff6a0",
              boxShadow: "0 0 40px #ffe14d",
              opacity: 1 - t / 14,
              scale: String(0.6 + t / 14),
            }}
          />
        );
      })}
      {HITS.map(([lane, hit], i) => {
        const t = frame - hit;
        if (t < 0 || t > 16) return null;
        return (
          <div
            key={`txt${i}`}
            style={{
              position: "absolute",
              left: RING_X + 110,
              top: LANE_TOP[lane] - 10 - t * 2,
              fontFamily: mincho,
              fontWeight: 900,
              fontSize: 64,
              color: i % 4 === 3 ? "#ff9cf0" : "#ffe14d",
              textShadow: "0 0 16px rgba(0,0,0,0.9), 0 0 8px #ff9a00",
              opacity: t < 10 ? 1 : 1 - (t - 10) / 6,
            }}
          >
            {i % 4 === 3 ? "虹極上！" : "極上！"}
          </div>
        );
      })}
    </>
  );
};

export const GameplayScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Gameplay"
      style={{
        background: "linear-gradient(180deg, #0b1a06 0%, #050a03 100%)",
        fontFamily: mincho,
      }}
    >
      <Interactive.Div
        name="Headline"
        style={{
          position: "absolute",
          top: 190,
          width: "100%",
          textAlign: "center",
          color: "white",
          fontSize: 92,
          fontWeight: 900,
          lineHeight: 1.25,
          textShadow: "0 0 24px rgba(125,220,58,0.7)",
          opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0, 0.5 * fps], ["0px -40px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        流れるそばを
        <br />
        <span style={{ color: "#7ddc3a" }}>A・S・L</span>で叩け！
      </Interactive.Div>
      {LANE_TOP.map((top, i) => (
        <Img
          key={i}
          src={staticFile("lane_a.png")}
          style={{
            position: "absolute",
            left: 0,
            top,
            width: 1080,
            height: LANE_HEIGHT,
            objectFit: "fill",
          }}
        />
      ))}
      {LANE_TOP.map((top, i) => (
        <div
          key={`k${i}`}
          style={{
            position: "absolute",
            left: RING_X - 40,
            top: top + LANE_HEIGHT / 2 - 40,
            width: 80,
            height: 80,
            textAlign: "center",
            lineHeight: "80px",
            fontSize: 56,
            fontWeight: 900,
            color: "rgba(255,255,255,0.35)",
          }}
        >
          {KEYS[i]}
        </div>
      ))}
      <NoteLayer />
      <Interactive.Div
        name="Combo"
        style={{
          position: "absolute",
          top: 1480,
          width: "100%",
          textAlign: "center",
          color: "gold",
          fontSize: 120,
          fontWeight: 900,
          textShadow: "0 0 30px rgba(255,215,0,0.6)",
          opacity: interpolate(frame, [40, 50], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {HITS.filter(([, h]) => h <= frame).length} COMBO
      </Interactive.Div>
      {HITS.map(([, hit], i) => (
        <Sequence key={i} from={hit} durationInFrames={20} layout="none">
          <Audio src={staticFile("perfect.mp3")} volume={0.35} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
