import { Button } from "../components/ui/button";
import { ChevronDown, Play, Trophy } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

interface StartScreenProps {
  onStart: () => void;
}

export const StartScreen = ({ onStart }: StartScreenProps) => {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-bg relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/30 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="z-10 text-center space-y-8 px-4 max-w-2xl mx-auto">
        {/* Title */}
        <h1 className="font-montserrat font-black text-6xl md:text-8xl bg-gradient-primary bg-clip-text text-transparent animate-shimmer bg-[length:200%_100%] drop-shadow-[0_0_30px_rgba(0,122,255,0.5)]">
          ReflectiQ
        </h1>

        {/* Subtitle */}
        <p className="font-poppins text-lg md:text-2xl text-foreground/80 tracking-wide">
          Trace the light. Decode the reflections.
        </p>

        {/* Primary CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={onStart}
            size="lg"
            className="bg-gradient-primary text-primary-foreground font-poppins font-bold text-lg px-8 py-6 rounded-xl shadow-glow-primary hover:scale-105 transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,122,255,0.8)]"
          >
            <Play className="mr-2 h-5 w-5" />
            Start to Solve
          </Button>
          
          <Link to="/leaderboard">
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto border-primary/30 hover:border-primary hover:bg-primary/10 font-poppins font-bold text-lg px-8 py-6 rounded-xl transition-all duration-300 hover:scale-105"
            >
              <Trophy className="mr-2 h-5 w-5" />
              Leaderboard
            </Button>
          </Link>
        </div>

        {/* How to Play */}
        <div className="pt-8">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="font-poppins text-foreground/60 hover:text-foreground transition-colors flex items-center gap-2 mx-auto group"
          >
            How to Play
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${
                showGuide ? "rotate-180" : ""
              }`}
            />
          </button>

          {showGuide && (
            <div className="mt-6 space-y-4 text-left bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border/50">
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-poppins font-semibold text-foreground mb-1">
                    Watch the laser enter
                  </h3>
                  <p className="text-foreground/60 text-sm">
                    The red laser beam enters the maze at a marked entry point
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-poppins font-semibold text-foreground mb-1">
                    Use hints to visualize
                  </h3>
                  <p className="text-foreground/60 text-sm">
                    Click hints to reveal quarter sections and see how the laser reflects
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-poppins font-semibold text-foreground mb-1">
                    Guess the exit cell
                  </h3>
                  <p className="text-foreground/60 text-sm">
                    Submit your answer in the format: Exit: D5
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
