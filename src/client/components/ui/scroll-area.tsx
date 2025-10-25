import { useState } from 'react';
import { Button } from '../ui/button';
import { Timer } from '../puzzle/Timer';
import { HintButton } from '../puzzle/HintButton';
import { PuzzleGrid } from '../puzzle/PuzzleGrid';
import { PuzzleData } from '../../types/puzzle';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

interface PuzzleScreenProps {
  puzzleData: PuzzleData;
  onBack: () => void;
}

export const PuzzleScreen = ({ puzzleData, onBack }: PuzzleScreenProps) => {
  const [hintsUsed, setHintsUsed] = useState(0);
  const [revealedQuadrants, setRevealedQuadrants] = useState<number[]>([]);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [finalTime, setFinalTime] = useState<number | null>(null);

  const handleUseHint = () => {
    if (hintsUsed >= 4) return;

    const nextQuadrant = hintsUsed;
    setRevealedQuadrants((prev) => [...prev, nextQuadrant]);
    setHintsUsed((prev) => prev + 1);

    toast.success(`Hint ${hintsUsed + 1} revealed! Quarter section illuminated.`, {
      duration: 2000,
    });
  };

  const handleSubmit = () => {
    setIsTimerRunning(false);
    toast.success('Answer submitted! Time stopped.', {
      duration: 3000,
      description: `Your time: ${Math.floor((finalTime || 0) / 60)}:${((finalTime || 0) % 60).toString().padStart(2, '0')}`,
    });

    // In a real implementation, this would redirect to Reddit post
    // For now, just show a message
    setTimeout(() => {
      toast.info('In production, this would open the Reddit comment box', {
        duration: 3000,
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-bg overflow-hidden">
      {/* Top Bar */}
      <div className="flex justify-between items-center p-4 md:p-6">
        <Timer isRunning={isTimerRunning} onTimeUpdate={setFinalTime} />
        <HintButton hintsRemaining={4 - hintsUsed} onUseHint={handleUseHint} />
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <PuzzleGrid
          puzzleData={puzzleData}
          revealedQuadrants={revealedQuadrants}
          showLaser={hintsUsed === 4}
        />
      </div>

      {/* Bottom Bar */}
      <div className="flex justify-center items-center p-4 md:p-6 gap-4">
        <Button
          onClick={onBack}
          variant="outline"
          className="border-border/50 hover:border-primary/50"
        >
          Back to Start
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isTimerRunning}
          className="bg-gradient-primary text-primary-foreground font-poppins font-semibold px-6 py-3 rounded-xl shadow-glow-primary hover:scale-105 transition-all duration-300"
        >
          <Send className="mr-2 h-4 w-4" />
          Submit Exit Cell
        </Button>
      </div>
    </div>
  );
};
