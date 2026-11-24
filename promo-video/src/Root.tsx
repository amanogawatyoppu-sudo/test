import { Composition, Folder } from "remotion";
import { PromoVideo } from "./PromoVideo";
import { OpeningScene } from "./OpeningScene";
import { GameplayScene } from "./GameplayScene";
import { CharactersScene } from "./CharactersScene";
import { EndingScene } from "./EndingScene";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Promo-Scenes">
        <Composition id="Opening" component={OpeningScene} width={1080} height={1920} fps={30} durationInFrames={105} />
        <Composition id="Gameplay" component={GameplayScene} width={1080} height={1920} fps={30} durationInFrames={180} />
        <Composition id="Characters" component={CharactersScene} width={1080} height={1920} fps={30} durationInFrames={150} />
        <Composition id="Ending" component={EndingScene} width={1080} height={1920} fps={30} durationInFrames={135} />
      </Folder>
      <Composition
        id="PromoVideo"
        component={PromoVideo}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={534}
      />
    </>
  );
};
