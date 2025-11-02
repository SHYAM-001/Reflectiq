import { useState } from 'react';
import { Button } from '../ui/button';
import { Timer } from './Timer';
import { HintButton } from './HintButton';
import { PuzzleGrid } from './PuzzleGrid';
import { AnswerInput } from './AnswerInput';
import { Puzzle, SessionData, HintPath, GridPosition } from '../../types/api';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { navigateToCommentWithText } from '../../utils/navigation';

interface PuzzleScreenProps {
  puzzle: Puzzle;
  session: SessionData;
  hintsUsed: number;
  hintPaths: HintPath[];
  isTimerRunning: boolean;
  isRequestingHint?: boolean;
  onRequestHint: () => void;
  onSubmitAnswer: (answer: GridPosition, timeTaken: number) => void;
  onBack: () => void;
}

export const PuzzleScreen = ({
  puzzle,
  hintsUsed,
  hintPaths,
  isTimerRunning,
  isRequestingHint = false,
  onRequestHint,
  onSubmitAnswer,
  onBack,
}: PuzzleScreenProps) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<GridPosition | null>(null);

  const handleSubmit = async () => {
    if (!selectedAnswer) {
      toast.error('Please select an exit cell first');
      return;
    }

    // Format the answer for Reddit comment submission
    const letter = String.fromCharCode(65 + selectedAnswer[0]);
    const number = selectedAnswer[1] + 1;
    const formattedAnswer = `Exit: ${letter}${number}`;

    // Stop the timer first
    onSubmitAnswer(selectedAnswer, currentTime);
  };

  return (
    <div className="min-h-screen flex flex-col  bg-gradient-bg overflow-hidden">
      {/* Top Bar */}
      <div className="flex justify-between items-center gap-2 p-4 md:p-6">
        {/* <div className="flex items-center space-x-4">
          <div className="text-sm text-foreground/60">
            {puzzle.difficulty} • {puzzle.gridSize}x{puzzle.gridSize}
          </div>
        </div> */}
        {/* <div className="flex items-center"> */}
        {puzzle.difficulty} • {puzzle.gridSize}x{puzzle.gridSize}
        <Timer isRunning={isTimerRunning} onTimeUpdate={setCurrentTime} />
        <HintButton
          hintsRemaining={4 - hintsUsed}
          onUseHint={onRequestHint}
          isLoading={isRequestingHint}
        />
        {/* </div> */}
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <PuzzleGrid puzzle={puzzle} hintPaths={hintPaths} hintsUsed={hintsUsed} />
      </div>

      {/* Bottom Bar */}
      <div className="p-4 md:p-6 space-y-4">
        <AnswerInput
          gridSize={puzzle.gridSize}
          selectedAnswer={selectedAnswer}
          onAnswerChange={setSelectedAnswer}
        />

        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={!isTimerRunning || !selectedAnswer}
            className="bg-gradient-primary text-primary-foreground font-poppins font-semibold px-8 py-3 rounded-xl shadow-glow-primary hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
          >
            <Send className="mr-2 h-4 w-4" />
            Submit Answer
          </Button>
        </div>
      </div>
    </div>
  );
};
