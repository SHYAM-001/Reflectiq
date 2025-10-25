import { useState } from "react";
import { StartScreen } from "../components/StartScreen";
import { PuzzleScreen } from "../components/puzzle/PuzzleScreen";
import { samplePuzzle } from "../data/samplePuzzles";

const Index = () => {
  const [gameStarted, setGameStarted] = useState(false);

  return (
    <>
      {!gameStarted ? (
        <StartScreen onStart={() => setGameStarted(true)} />
      ) : (
        <PuzzleScreen
          puzzleData={samplePuzzle}
          onBack={() => setGameStarted(false)}
        />
      )}
    </>
  );
};

export default Index;
