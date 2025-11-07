import { useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Timer } from './Timer';
import { HintButton } from './HintButton';
import { PuzzleGrid } from './PuzzleGrid';
import { AnswerInput } from './AnswerInput';
import { PuzzleGenerationInfo } from '../PuzzleGenerationInfo';
import { Puzzle, SessionData, HintPath, GridPosition } from '../../types/api';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Props for the PuzzleScreen component
 * @property puzzle - The puzzle data to display
 * @property session - The current session data
 * @property hintsUsed - Number of hints used so far (0-4)
 * @property hintPaths - Array of hint paths for progressive revelation
 * @property isTimerRunning - Whether the puzzle timer is currently running
 * @property isRequestingHint - Whether a hint request is in progress
 * @property isSubmittingAnswer - Whether an answer submission is in progress
 * @property onRequestHint - Callback to request a hint
 * @property onSubmitAnswer - Callback to submit the answer with time taken
 * @property onBack - Callback to navigate back to the previous screen
 */
interface PuzzleScreenProps {
  puzzle: Puzzle;
  session: SessionData;
  hintsUsed: number;
  hintPaths: HintPath[];
  isTimerRunning: boolean;
  isRequestingHint?: boolean;
  isSubmittingAnswer?: boolean;
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
  isSubmittingAnswer = false,
  onRequestHint,
  onSubmitAnswer,
  onBack,
}: PuzzleScreenProps) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<GridPosition | null>(null);

  /**
   * Handles cell click events from the PuzzleGrid component
   * Validates that the clicked cell is within grid bounds before setting the answer
   * @param row - The row index of the clicked cell (0-based)
   * @param col - The column index of the clicked cell (0-based)
   * @returns void
   */
  const handleCellClick = useCallback(
    (row: number, col: number): void => {
      // Validate bounds
      if (row < 0 || row >= puzzle.gridSize || col < 0 || col >= puzzle.gridSize) {
        console.warn(
          `Invalid cell click: [${row}, ${col}] is out of bounds for grid size ${puzzle.gridSize}`
        );
        return;
      }

      const newAnswer: GridPosition = [row, col];
      setSelectedAnswer(newAnswer);
    },
    [puzzle.gridSize]
  );

  /**
   * Handles answer changes from the AnswerInput component
   * @param answer - The selected GridPosition tuple [row, col] or null if cleared
   * @returns void
   */
  const handleAnswerChange = useCallback((answer: GridPosition | null): void => {
    setSelectedAnswer(answer);
  }, []);

  /**
   * Handles answer submission
   * Validates that an answer is selected before submitting
   * @returns Promise<void>
   */
  const handleSubmit = async (): Promise<void> => {
    if (!selectedAnswer) {
      toast.error('Please select an exit cell first', {
        description: 'Click on a cell at the edge of the grid to select your answer',
        duration: 3000,
      });
      return;
    }

    if (isSubmittingAnswer) {
      return; // Prevent double submission
    }

    // Stop the timer first
    onSubmitAnswer(selectedAnswer, currentTime);
  };

  return (
    <div className="min-h-screen flex flex-col  bg-gradient-bg overflow-hidden">
      {/* Top Bar */}
      <div className="flex justify-between items-center gap-2 p-4 md:p-6">
        <div className="flex flex-col gap-2">
          <div className="text-sm text-foreground/80">
            {puzzle.difficulty} • {puzzle.gridSize}x{puzzle.gridSize}
          </div>
          {/* <PuzzleGenerationInfo puzzleId={puzzle.id} /> */}
        </div>

        <div className="flex items-center gap-4">
          <Timer isRunning={isTimerRunning} onTimeUpdate={setCurrentTime} />
          <HintButton
            hintsRemaining={4 - hintsUsed}
            onUseHint={onRequestHint}
            isLoading={isRequestingHint}
          />
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <PuzzleGrid
          puzzle={puzzle}
          hintPaths={hintPaths}
          hintsUsed={hintsUsed}
          selectedAnswer={selectedAnswer}
          onCellClick={handleCellClick}
        />
      </div>

      {/* Bottom Bar */}
      <div className="p-4 md:p-6 space-y-4">
        <AnswerInput
          gridSize={puzzle.gridSize}
          selectedAnswer={selectedAnswer}
          onAnswerChange={handleAnswerChange}
        />

        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={!isTimerRunning || !selectedAnswer || isSubmittingAnswer}
            className="bg-gradient-primary text-primary-foreground font-poppins font-semibold px-8 py-3 rounded-xl shadow-glow-primary hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isSubmittingAnswer ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Processing...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit Answer
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
