import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, staticFile } from "remotion";
import { OpeningScene } from "./OpeningScene";
import { GameplayScene } from "./GameplayScene";
import { CharactersScene } from "./CharactersScene";
import { EndingScene } from "./EndingScene";

export const PromoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence name="Opening" durationInFrames={105}>
          <OpeningScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 12 })}
        />
        <TransitionSeries.Sequence name="Gameplay" durationInFrames={180}>
          <GameplayScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: 12 })}
        />
        <TransitionSeries.Sequence name="Characters" durationInFrames={150}>
          <CharactersScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 12 })}
        />
        <TransitionSeries.Sequence name="Ending" durationInFrames={135}>
          <EndingScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Audio
        name="BGM"
        src={staticFile("main.mp3")}
        volume={(f) =>
          interpolate(f, [0, 15, 500, 534], [0, 0.8, 0.8, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
    </AbsoluteFill>
  );
};
