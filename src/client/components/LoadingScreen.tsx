import { Loader2 } from 'lucide-react';

export const LoadingScreen = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-bg">
      <div className="text-center space-y-6">
        {/* Animated logo */}
        <h1 className="font-montserrat font-black text-4xl md:text-6xl bg-gradient-primary bg-clip-text text-transparent animate-pulse">
          ReflectiQ
        </h1>

        {/* Loading spinner */}
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="font-poppins text-foreground/80">Loading puzzle...</span>
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
      </div>
    </div>
  );
};
