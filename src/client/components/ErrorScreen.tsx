import { Button } from './ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorScreenProps {
  error: string;
  onRetry: () => void;
  onReset: () => void;
}

export const ErrorScreen = ({ error, onRetry, onReset }: ErrorScreenProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-bg p-4">
      <div className="text-center space-y-6 max-w-md mx-auto">
        {/* Error icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
        </div>

        {/* Error title */}
        <h1 className="font-montserrat font-bold text-2xl md:text-3xl text-foreground">
          Oops! Something went wrong
        </h1>

        {/* Error message */}
        <p className="font-poppins text-foreground/70 text-sm md:text-base leading-relaxed">
          {error}
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={onRetry}
            className="bg-gradient-primary text-primary-foreground font-poppins font-semibold px-6 py-3 rounded-xl shadow-glow-primary hover:scale-105 transition-all duration-300"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>

          <Button
            onClick={onReset}
            variant="outline"
            className="border-border/50 hover:border-primary/50 font-poppins font-semibold px-6 py-3 rounded-xl"
          >
            <Home className="mr-2 h-4 w-4" />
            Back to Menu
          </Button>
        </div>

        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-destructive/20 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
