import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface TimerProps {
  isRunning: boolean;
  onTimeUpdate?: (seconds: number) => void;
}

export const Timer = ({ isRunning, onTimeUpdate }: TimerProps) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        const newTime = prev + 1;
        onTimeUpdate?.(newTime);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, onTimeUpdate]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 bg-card/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-border/50">
      <Clock className="h-4 w-4 text-laser" />
      <span className="font-orbitron font-bold text-xl text-laser drop-shadow-[0_0_10px_rgba(255,45,85,0.5)]">
        {formatTime(seconds)}
      </span>
    </div>
  );
};
