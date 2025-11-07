import { Button } from './ui/button';
import { Clock, Lightbulb, Trophy, Target, TrendingUp, CheckCircle } from 'lucide-react';
import { Puzzle } from '../types/api';

interface SubmissionScreenProps {
  puzzle: Puzzle;
  finalTime: number;
  hintsUsed: number;
  scoreResult?:
    | {
        correct: boolean;
        finalScore: number;
        baseScore: number;
        timeMultiplier: number;
        hintMultiplier: number;
        hintsUsed: number;
        timeTaken: number;
        maxPossibleScore: number;
      }
    | undefined;
  leaderboardPosition?: number | null;
  onPlayAgain: () => void;
  onViewLeaderboard?: () => void;
}

export const SubmissionScreen = ({
  puzzle,
  finalTime,
  hintsUsed,
  scoreResult,
  leaderboardPosition,
  onPlayAgain,
  onViewLeaderboard,
}: SubmissionScreenProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isCorrect = scoreResult?.correct !== false;
  const isWrongAnswer = scoreResult?.correct === false;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-bg p-4">
      <div className="w-full max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center border ${
                isWrongAnswer
                  ? 'bg-red-500/20 border-red-500/30'
                  : 'bg-green-500/20 border-green-500/30'
              }`}
            >
              {isWrongAnswer ? (
                <Target className="h-8 w-8 text-red-500" />
              ) : (
                <CheckCircle className="h-8 w-8 text-green-500" />
              )}
            </div>
          </div>

          <div>
            <h1
              className={`font-montserrat font-bold text-2xl md:text-3xl ${
                isWrongAnswer ? 'text-red-500' : 'text-green-500'
              }`}
            >
              {isWrongAnswer ? 'Wrong Answer!' : 'Time Stopped!'}
            </h1>
            <p className="font-poppins text-foreground/70 text-sm md:text-base mt-2">
              {isWrongAnswer
                ? 'Trace the laser path carefully and try again'
                : 'Now submit your answer as a Reddit comment'}
            </p>
          </div>
        </div>

        {/* Game Summary */}
        <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 border border-border/50 space-y-6">
          <div className="text-center">
            <div className="text-2xl font-orbitron font-bold text-primary">
              {puzzle.difficulty} Puzzle
            </div>
            <div className="text-sm text-foreground/60">
              {puzzle.gridSize}x{puzzle.gridSize} grid
            </div>
          </div>

          {/* Score Display */}
          {scoreResult && isCorrect && (
            <div className="text-center space-y-2">
              <div className="text-3xl font-orbitron font-bold text-green-500">
                {scoreResult.finalScore} points
              </div>
              {leaderboardPosition && (
                <div className="flex items-center justify-center space-x-2 text-sm">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span className="text-foreground/80">
                    Ranked #{leaderboardPosition} in {puzzle.difficulty}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Wrong Answer Display */}
          {isWrongAnswer && (
            <div className="text-center space-y-2">
              <div className="text-2xl font-orbitron font-bold text-red-500">Incorrect</div>
              <p className="text-sm text-foreground/70">
                Check mirror reflections and material interactions
              </p>
            </div>
          )}

          {/* Performance Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-foreground/80">Time:</span>
              <span className="font-orbitron font-semibold">{formatTime(finalTime)}</span>
            </div>

            <div className="flex items-center space-x-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <span className="text-foreground/80">Hints:</span>
              <span className="font-orbitron font-semibold">{hintsUsed}/4</span>
            </div>
          </div>

          {/* Score Breakdown - Only show for correct answers */}
          {scoreResult && isCorrect && (
            <div className="border-t border-border/30 pt-4 space-y-3">
              <div className="text-center text-sm font-semibold text-foreground/80">
                Score Breakdown
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground/70">Base Score:</span>
                  <span className="font-orbitron">{scoreResult.baseScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/70">Time Multiplier:</span>
                  <span className="font-orbitron">{scoreResult.timeMultiplier}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground/70">Hint Multiplier:</span>
                  <span className="font-orbitron">{scoreResult.hintMultiplier}x</span>
                </div>
                <div className="border-t border-border/20 pt-2 flex justify-between font-semibold">
                  <span>Final Score:</span>
                  <span className="font-orbitron text-primary">{scoreResult.finalScore}</span>
                </div>
              </div>
            </div>
          )}

          {/* Helpful Tips for Wrong Answers */}
          {isWrongAnswer && (
            <div className="border-t border-border/30 pt-4 space-y-3">
              <div className="text-center text-sm font-semibold text-foreground/80">
                💡 Helpful Tips
              </div>
              <div className="space-y-2 text-sm text-foreground/70">
                {hintsUsed === 0 && <p>• Use hints to reveal parts of the laser path</p>}
                {hintsUsed > 0 && hintsUsed < 3 && (
                  <p>• Use additional hints to see more of the laser path</p>
                )}
                {hintsUsed >= 3 && (
                  <p>• The laser path is mostly revealed - check the final exit carefully</p>
                )}
                <p>• Check how mirrors reflect the laser at 90° angles</p>
                <p>• Remember that different materials affect the laser differently</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {isCorrect && onViewLeaderboard && (
            <Button
              onClick={onViewLeaderboard}
              className="w-full bg-gradient-primary text-primary-foreground font-poppins font-semibold py-3 rounded-xl shadow-glow-primary hover:scale-105 transition-all duration-300"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              View Full Leaderboard
            </Button>
          )}

          <Button
            onClick={onPlayAgain}
            variant={isWrongAnswer ? 'default' : 'outline'}
            className={`w-full font-poppins font-semibold py-3 rounded-xl ${
              isWrongAnswer
                ? 'bg-gradient-primary text-primary-foreground shadow-glow-primary hover:scale-105 transition-all duration-300'
                : 'border-border/50 hover:border-primary/50'
            }`}
          >
            <Target className="mr-2 h-4 w-4" />
            {isWrongAnswer ? 'Try Again' : 'Play Another Puzzle'}
          </Button>
        </div>

        {/* Note */}
        {isCorrect && (
          <div className="text-center text-xs text-foreground/50">
            Your final score will appear in tomorrow's leaderboard post
          </div>
        )}
      </div>
    </div>
  );
};
