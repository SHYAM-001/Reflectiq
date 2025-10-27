import React, { useState, useEffect } from 'react';
import { Loader2, Clock, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { ConnectionStatus } from './ConnectionStatus';

interface LoadingScreenProps {
  message?: string;
  timeout?: number; // in milliseconds
  onTimeout?: () => void;
  onCancel?: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading puzzle...',
  timeout = 30000, // 30 seconds default
  onTimeout,
  onCancel,
}) => {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showTimeout, setShowTimeout] = useState(false);

  useEffect(() => {
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setTimeElapsed(elapsed);

      if (elapsed >= timeout) {
        setShowTimeout(true);
        if (onTimeout) {
          onTimeout();
        }
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeout, onTimeout]);

  const progressPercentage = Math.min((timeElapsed / timeout) * 100, 100);
  const remainingTime = Math.max(0, timeout - timeElapsed);

  if (showTimeout) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-bg p-4">
        <div className="text-center space-y-6 max-w-md mx-auto">
          {/* Connection status */}
          <div className="flex justify-center">
            <ConnectionStatus showDetails />
          </div>

          {/* Timeout icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </div>

          {/* Timeout message */}
          <div className="space-y-2">
            <h2 className="font-montserrat font-bold text-xl text-foreground">
              Taking longer than expected
            </h2>
            <p className="font-poppins text-foreground/70 text-sm">
              The request is taking longer than usual. This might be due to network issues or server
              load.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            {onCancel && (
              <Button
                onClick={onCancel}
                className="bg-gradient-primary text-primary-foreground font-poppins font-semibold px-6 py-3 rounded-xl"
              >
                Cancel and Go Back
              </Button>
            )}

            <p className="text-xs text-foreground/50">
              The request will continue in the background
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-bg">
      <div className="text-center space-y-6 max-w-md mx-auto">
        {/* Connection status */}
        <div className="flex justify-center">
          <ConnectionStatus />
        </div>

        {/* Animated logo */}
        <h1 className="font-montserrat font-black text-4xl md:text-6xl bg-gradient-primary bg-clip-text text-transparent animate-pulse">
          ReflectiQ
        </h1>

        {/* Loading spinner */}
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="font-poppins text-foreground/80">{message}</span>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs mx-auto">
          <div className="w-full bg-muted rounded-full h-1">
            <div
              className="bg-gradient-primary h-1 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {timeout > 10000 && ( // Only show timer for long timeouts
            <p className="text-xs text-foreground/50 mt-2">
              {Math.ceil(remainingTime / 1000)}s remaining
            </p>
          )}
        </div>

        {/* Loading dots animation */}
        <div className="flex justify-center space-x-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 bg-primary rounded-full animate-bounce"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1s',
              }}
            />
          ))}
        </div>

        {/* Cancel button for long operations */}
        {onCancel && timeElapsed > 5000 && (
          <Button
            onClick={onCancel}
            variant="ghost"
            size="sm"
            className="text-foreground/60 hover:text-foreground"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};
