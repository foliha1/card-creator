import { useState } from "react";
import IntroScreen from "@/components/IntroScreen";
import GameScreen from "@/components/GameScreen";

const Index = () => {
  const [introDone, setIntroDone] = useState(false);

  return (
    <>
      {!introDone && <IntroScreen onComplete={() => setIntroDone(true)} />}
      <GameScreen tier="standard" />
    </>
  );
};

export default Index;
