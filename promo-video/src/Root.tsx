import { Composition, Folder, Still } from "remotion";
import { PromoVideo } from "./PromoVideo";
import { OpeningScene } from "./OpeningScene";
import { GameplayScene } from "./GameplayScene";
import { CharactersScene } from "./CharactersScene";
import { EndingScene } from "./EndingScene";
import { CharIntro } from "./char-intro/CharIntro";
import { CHAR_INTROS } from "./char-intro/characters";
import { Thumbnail } from "./char-intro/Thumbnail";
import { ThumbAll } from "./char-intro/ThumbAll";

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
      <Folder name="Char-Thumbs">
        {CHAR_INTROS.map((c, i) => (
          <Still
            key={c.id}
            id={`Thumb-${String(i + 1).padStart(2, "0")}-${c.id.replace(/_/g, "-")}`}
            component={Thumbnail}
            width={1080}
            height={1920}
            defaultProps={{ ...c, no: i + 1 }}
          />
        ))}
        <Still id="Thumb-17-all" component={ThumbAll} width={1080} height={1920} />
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
