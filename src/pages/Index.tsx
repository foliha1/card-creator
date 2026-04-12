import { useState } from "react";
import IntroScreen from "@/components/IntroScreen";
import TierScreen from "@/components/TierScreen";
import GameScreen from "@/components/GameScreen";

type Screen = "intro" | "tier" | "game";

const Index = () => {
  const [screen, setScreen] = useState<Screen>("intro");
  const [tier, setTier] = useState<"easy" | "standard" | "cutthroat">("standard");

  return (
    <>
      {screen === "intro" && <IntroScreen onComplete={() => setScreen("tier")} />}
      {screen === "tier" && (
        <TierScreen
          onSelect={(id) => {
            setTier(id as "easy" | "standard" | "cutthroat");
            setScreen("game");
          }}
        />
      )}
      {screen === "game" && <GameScreen tier={tier} />}
    </>
  );
};

export default Index;
