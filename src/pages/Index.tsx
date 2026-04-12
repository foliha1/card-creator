import { useState } from "react";
import IntroScreen from "@/components/IntroScreen";
import TierScreen from "@/components/TierScreen";
import GameScreen from "@/components/GameScreen";
import GameOverScreen from "@/components/GameOverScreen";

type Screen = "intro" | "tier" | "game" | "gameover";

const Index = () => {
  const [screen, setScreen] = useState<Screen>("intro");
  const [tier, setTier] = useState<"easy" | "standard" | "cutthroat">("standard");
  const [finalScore, setFinalScore] = useState(0);

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
      {screen === "game" && (
        <GameScreen
          tier={tier}
          onGameOver={(score: number) => {
            setFinalScore(score);
            setScreen("gameover");
          }}
        />
      )}
      {screen === "gameover" && (
        <GameOverScreen
          score={finalScore}
          onRestart={() => setScreen("tier")}
        />
      )}
    </>
  );
};

export default Index;
