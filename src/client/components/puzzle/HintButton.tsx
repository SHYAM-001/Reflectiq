import { Button } from '../ui/button';
import { Lightbulb } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HintButtonProps {
  hintsRemaining: number;
  onUseHint: () => void;
}

export const HintButton = ({ hintsRemaining, onUseHint }: HintButtonProps) => {
  const disabled = hintsRemaining === 0;
  const hintsUsed = 4 - hintsRemaining;

  const getHintText = () => {
    if (disabled) return 'Exit Revealed!';
    return `Hint (${hintsRemaining} left)`;
  };

  const getScoreMultiplier = () => {
    const multipliers = [1.0, 0.8, 0.6, 0.4, 0.2];
    return multipliers[hintsUsed + 1] || 0.2;
  };

  const getProgressText = () => {
    if (hintsUsed === 4) return 'Exit cell is now visible!';
    if (hintsUsed === 3) return 'One more hint to reveal exit';
    if (hintsUsed >= 1) return `${4 - hintsUsed} more hints to reveal exit`;
    // return 'Use 4 hints to reveal the exit cell';
  };

  return (
    <div className="flex flex-col items-end space-y-1">
      <Button
        onClick={onUseHint}
        disabled={disabled}
        className={cn(
          'font-poppins font-semibold px-4 py-2 rounded-lg transition-all duration-300 disabled:hover:scale-100',
          disabled
            ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 animate-pulse'
            : 'bg-gradient-primary text-primary-foreground shadow-glow-primary hover:scale-105 disabled:opacity-50 disabled:shadow-none'
        )}
      >
        <Lightbulb className="mr-2 h-4 w-4" />
        {getHintText()}
      </Button>

      {/* Progress bar for exit reveal */}
      {/* <div className="flex flex-col items-end space-y-1">
        <div className="flex space-x-1">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                i < hintsUsed
                  ? 'bg-yellow-500 shadow-sm shadow-yellow-500/50'
                  : 'bg-gray-300 dark:bg-gray-600'
              )}
            />
          ))}
        </div>

        <div className="text-xs text-foreground/60 text-right max-w-32">
          {disabled ? (
            <span className="text-green-500 font-medium">{getProgressText()}</span>
          ) : (
            <>
              <div>{getProgressText()}</div>
              <div>Next: {(getScoreMultiplier() * 100).toFixed(0)}% score</div>
            </>
          )}
        </div>
      </div> */}
    </div>
  );
};
