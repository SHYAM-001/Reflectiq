import { Button } from '../ui/button';
import { Lightbulb } from 'lucide-react';

interface HintButtonProps {
  hintsRemaining: number;
  onUseHint: () => void;
}

export const HintButton = ({ hintsRemaining, onUseHint }: HintButtonProps) => {
  const disabled = hintsRemaining === 0;

  return (
    <Button
      onClick={onUseHint}
      disabled={disabled}
      className="bg-gradient-primary text-primary-foreground font-poppins font-semibold px-4 py-2 rounded-lg shadow-glow-primary hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
    >
      <Lightbulb className="mr-2 h-4 w-4" />
      Hint {hintsRemaining}/4
    </Button>
  );
};
