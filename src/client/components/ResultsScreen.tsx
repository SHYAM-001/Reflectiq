import { Button } from './ui/button';
import { Trophy, Clock, Lightbulb, Target, Play, BarChart3 } from 'lucide-react';
import { Puzzle, ScoreResult } from '../types/api';

interface ResultsScreenProps {
  puzzle: Puzzle;
  scoreResult: ScoreResult;
  leaderboardPosition?: number | null;
  finalTime: number;
  onPlayAgain: () => void;
  onViewLeaderboard: () => void;
}

export const ResultsScreen = ({
  puzzle,
  scoreResult,
  leaderboardPosition,
  finalTime,
  onPlayAgain,
  onViewLeaderboard,
}: ResultsScreenProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getResultMessage = () => {
    if (!scoreResult.correct) {
      return {
        title: 'Better luck next time!',
        subtitle: "The laser didn't reach the target exit point.",
        color: 'text-destructive',
        icon: Target,
      };
    }

    if (scoreResult.finalScore >= scoreResult.maxPossibleScore * 0.8) {
      return {
        title: 'Excellent work!',
        subtitle: 'You mastered the laser physics!',
        color: 'text-yellow-500',
        icon: Trophy,
      };
    }

    if (scoreResult.finalScore >= scoreResult.maxPossibleScore * 0.5) {
      return {
        title: 'Well done!',
        subtitle: 'Good understanding of the reflections.',
        color: 'text-green-500',
        icon: Trophy,
      };
    }

    return {
      title: 'Nice try!',
      subtitle: 'You found the solution!',
      color: 'text-blue-500',
      icon: Trophy,
    };
  };

  const result = getResultMessage();
  const ResultIcon = result.icon;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-bg p-4">
      <div className="w-full max-w-md mx-auto space-y-6">
        {/* Result header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div
              className={`w-16 h-16 rounded-full bg-card/50 backdrop-blur-sm flex items-center justify-center border border-border/50`}
            >
              <ResultIcon className={`h-8 w-8 ${result.color}`} />
            </div>
          </div>

          <div>
            <h1 className={`font-montserrat font-bold text-2xl md:text-3xl ${result.color}`}>
              {result.title}
            </h1>
            <p className="font-poppins text-foreground/70 text-sm md:text-base mt-2">
              {result.subtitle}
            </p>
          </div>
        </div>

        {/* Score display */}
        <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 border border-border/50 space-y-4">
          <div className="text-center">
            <div className="text-3xl font-orbitron font-bold text-laser drop-shadow-[0_0_10px_rgba(255,45,85,0.5)]">
              {scoreResult.finalScore}
            </div>
            <div className="text-sm text-foreground/60">
              out of {scoreResult.maxPossibleScore} points
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-foreground/80">Time:</span>
              <span className="font-orbitron font-semibold">{formatTime(finalTime)}</span>
            </div>

            <div className="flex items-center space-x-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <span className="text-foreground/80">Hints:</span>
              <span className="font-orbitron font-semibold">{scoreResult.hintsUsed}/4</span>
            </div>

            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-green-500" />
              <span className="text-foreground/80">Accuracy:</span>
              <span className="font-orbitron font-semibold">
                {scoreResult.correct ? '100%' : '0%'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="text-foreground/80">Difficulty:</span>
              <span className="font-orbitron font-semibold">{puzzle.difficulty}</span>
            </div>
          </div>

          {/* Leaderboard position */}
          {leaderboardPosition && (
            <div className="text-center pt-2 border-t border-border/30">
              <div className="text-sm text-foreground/60">Leaderboard Position</div>
              <div className="text-xl font-orbitron font-bold text-primary">
                #{leaderboardPosition}
              </div>
            </div>
          )}
        </div>

        {/* Score breakdown */}
        <div className="bg-card/30 backdrop-blur-sm rounded-xl p-4 border border-border/30 space-y-2 text-sm">
          <div className="font-semibold text-foreground/80 mb-2">Score Breakdown:</div>

          <div className="flex justify-between">
            <span className="text-foreground/60">Base Score:</span>
            <span className="font-orbitron">{scoreResult.baseScore}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-foreground/60">Hint Multiplier:</span>
            <span className="font-orbitron">{scoreResult.hintMultiplier.toFixed(1)}x</span>
          </div>

          <div className="flex justify-between">
            <span className="text-foreground/60">Time Bonus:</span>
            <span className="font-orbitron">{(scoreResult.timeMultiplier * 100).toFixed(0)}%</span>
          </div>

          <div className="border-t border-border/30 pt-2 flex justify-between font-semibold">
            <span>Final Score:</span>
            <span className="font-orbitron text-laser">{scoreResult.finalScore}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={onPlayAgain}
            className="w-full bg-gradient-primary text-primary-foreground font-poppins font-semibold py-3 rounded-xl shadow-glow-primary hover:scale-105 transition-all duration-300"
          >
            <Play className="mr-2 h-4 w-4" />
            Play Again
          </Button>

          <Button
            onClick={onViewLeaderboard}
            variant="outline"
            className="w-full border-border/50 hover:border-primary/50 font-poppins font-semibold py-3 rounded-xl"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            View Leaderboard
          </Button>
        </div>
      </div>
    </div>
  );
};
