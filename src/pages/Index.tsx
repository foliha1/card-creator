import { useState, useCallback } from "react";
import IntroScreen from "@/components/IntroScreen";
import TierScreen from "@/components/TierScreen";
import GameScreen from "@/components/GameScreen";
import GameOverScreen from "@/components/GameOverScreen";
import NavBar from "@/components/NavBar";

type Phase = "intro" | "tier" | "playing" | "gameover";

const Index = () => {
  const [phase, setPhase] = useState<Phase>("intro");
  const [tier, setTier] = useState<"easy" | "standard" | "cutthroat">("standard");
  const [finalScore, setFinalScore] = useState(0);
  const [gameKey, setGameKey] = useState(0);

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
    setPhase("gameover");
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f8f2e9" }}>
      <NavBar visible={phase !== "intro"} />

      {phase === "intro" && (
        <IntroScreen onComplete={() => setPhase("tier")} />
      )}
      {phase === "tier" && (
        <TierScreen
            onSelect={(id) => {
              setTier(id as "easy" | "standard" | "cutthroat");
              setPhase("playing");
            }}
          />
      )}
      {phase === "playing" && (
        <GameScreen key={gameKey} tier={tier} onGameOver={handleGameOver} />
      )}
      {phase === "gameover" && (
        <GameOverScreen
          score={finalScore}
          onRestart={() => {
            setGameKey((k) => k + 1);
            setPhase("tier");
          }}
        />
      )}
    </div>
  );
};

export default Index;
