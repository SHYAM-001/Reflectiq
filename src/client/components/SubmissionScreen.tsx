import { Button } from './ui/button';
import { MessageCircle, Clock, Lightbulb, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { Puzzle, GridPosition } from '../types/api';

interface SubmissionScreenProps {
  puzzle: Puzzle;
  selectedAnswer: GridPosition;
  finalTime: number;
  hintsUsed: number;
  onPlayAgain: () => void;
}

export const SubmissionScreen = ({
  puzzle,
  selectedAnswer,
  finalTime,
  hintsUsed,
  onPlayAgain,
}: SubmissionScreenProps) => {
  const [copied, setCopied] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatAnswer = (answer: GridPosition): string => {
    const letter = String.fromCharCode(65 + answer[0]);
    const number = answer[1] + 1;
    return `${letter}${number}`;
  };

  const commentText = `Exit: ${formatAnswer(selectedAnswer)}`;

  const handleCopyComment = async () => {
    try {
      await navigator.clipboard.writeText(commentText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-bg p-4">
      <div className="w-full max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div>
            <h1 className="font-montserrat font-bold text-2xl md:text-3xl text-green-500">
              Time Stopped!
            </h1>
            <p className="font-poppins text-foreground/70 text-sm md:text-base mt-2">
              Now submit your answer as a Reddit comment
            </p>
          </div>
        </div>

        {/* Game Summary */}
        <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 border border-border/50 space-y-4">
          <div className="text-center">
            <div className="text-2xl font-orbitron font-bold text-primary">
              {puzzle.difficulty} Puzzle
            </div>
            <div className="text-sm text-foreground/60">
              {puzzle.gridSize}x{puzzle.gridSize} grid
            </div>
          </div>

          {/* Stats */}
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
        </div>

        {/* Comment Submission */}
        <div className="bg-card/50 backdrop-blur-sm rounded-xl p-6 border border-border/50 space-y-4">
          <div className="flex items-center space-x-2 text-foreground/80">
            <MessageCircle className="h-5 w-5 text-primary" />
            <span className="font-semibold">Submit as Reddit Comment:</span>
          </div>

          {/* Comment Text */}
          <div className="bg-card/30 rounded-lg p-4 border border-border/30">
            <div className="flex items-center justify-between">
              <code className="text-lg font-orbitron text-primary font-bold">{commentText}</code>
              <Button onClick={handleCopyComment} variant="ghost" size="sm" className="ml-2">
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-2 text-sm text-foreground/70">
            <p>1. Copy the text above</p>
            <p>2. Go to the Reddit post</p>
            <p>3. Paste it as a comment</p>
            <p>4. Your score will be calculated automatically!</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => window.open('https://reddit.com', '_blank')}
            className="w-full bg-gradient-primary text-primary-foreground font-poppins font-semibold py-3 rounded-xl shadow-glow-primary hover:scale-105 transition-all duration-300"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Open Reddit to Comment
          </Button>

          <Button
            onClick={onPlayAgain}
            variant="outline"
            className="w-full border-border/50 hover:border-primary/50 font-poppins font-semibold py-3 rounded-xl"
          >
            Play Another Puzzle
          </Button>
        </div>

        {/* Note */}
        <div className="text-center text-xs text-foreground/50">
          Your final score will appear in tomorrow's leaderboard post
        </div>
      </div>
    </div>
  );
};
