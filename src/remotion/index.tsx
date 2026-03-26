import { Composition, registerRoot } from "remotion";
import { ShortHandPromo } from "./ShortHandPromo";

function RemotionRoot() {
  return (
    <>
      <Composition
        id="ShortHandPromo"
        component={ShortHandPromo}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
}

registerRoot(RemotionRoot);
