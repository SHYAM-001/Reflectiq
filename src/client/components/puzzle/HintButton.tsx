import { Button } from '../ui/button';
import { Lightbulb } from 'lucide-react';

interface HintButtonProps {
  hintsRemaining: number;
  onUseHint: () => void;
}

export const HintButton = ({ hintsRemaining, onUseHint }: HintButtonProps) => {
  const disabled = hintsRemaining === 0;
  const hintsUsed = 4 - hintsRemaining;

  const getHintText = () => {
    if (disabled) return 'No Hints Left';
    return `Hint (${hintsRemaining} left)`;
  };

  const getScoreMultiplier = () => {
    const multipliers = [1.0, 0.8, 0.6, 0.4, 0.2];
    return multipliers[hintsUsed + 1] || 0.2;
  };

  return (
    <div className="flex flex-col items-end space-y-1">
      <Button
        onClick={onUseHint}
        disabled={disabled}
        className="bg-gradient-primary text-primary-foreground font-poppins font-semibold px-4 py-2 rounded-lg shadow-glow-primary hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
      >
        <Lightbulb className="mr-2 h-4 w-4" />
        {getHintText()}
      </Button>

      {!disabled && (
        <div className="text-xs text-foreground/60">
          Next: {(getScoreMultiplier() * 100).toFixed(0)}% score
        </div>
      )}
    </div>
  );
};
