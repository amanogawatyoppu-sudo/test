import { Composition, Folder } from "remotion";
import { PromoVideo } from "./PromoVideo";
import { OpeningScene } from "./OpeningScene";
import { GameplayScene } from "./GameplayScene";
import { CharactersScene } from "./CharactersScene";
import { EndingScene } from "./EndingScene";
import { CharIntro } from "./char-intro/CharIntro";
import { CHAR_INTROS } from "./char-intro/characters";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Promo-Scenes">
        <Composition id="Opening" component={OpeningScene} width={1080} height={1920} fps={30} durationInFrames={105} />
        <Composition id="Gameplay" component={GameplayScene} width={1080} height={1920} fps={30} durationInFrames={180} />
        <Composition id="Characters" component={CharactersScene} width={1080} height={1920} fps={30} durationInFrames={150} />
        <Composition id="Ending" component={EndingScene} width={1080} height={1920} fps={30} durationInFrames={135} />
      </Folder>
      <Folder name="Char-Intros">
        {CHAR_INTROS.map((c) => (
          <Composition
            key={c.id}
            id={`Char-${c.rarity}-${c.id.replace(/_/g, "-")}`}
            component={CharIntro}
            width={1080}
            height={1920}
            fps={30}
            durationInFrames={360}
            defaultProps={c}
          />
        ))}
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
