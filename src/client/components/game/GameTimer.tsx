// GameTimer component optimized for Devvit Web with precise timing
// Uses React patterns since this runs in the client webview

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './GameTimer.css';

export type TimerState = 'idle' | 'running' | 'paused' | 'completed' | 'expired';

interface GameTimerProps {
  duration: number; // Duration in milliseconds
  onTick?: (remainingTime: number) => void;
  onComplete?: () => void;
  onExpire?: () => void;
  autoStart?: boolean;
  showMilliseconds?: boolean;
  warningThreshold?: number; // Show warning when time remaining is below this (in ms)
  criticalThreshold?: number; // Show critical warning when time remaining is below this (in ms)
  className?: string;
}

interface TimerData {
  remainingTime: number;
  elapsedTime: number;
  startTime: number | null;
  pausedTime: number;
  state: TimerState;
}

export const GameTimer: React.FC<GameTimerProps> = ({
  duration,
  onTick,
  onComplete,
  onExpire,
  autoStart = false,
  showMilliseconds = true,
  warningThreshold = 30000, // 30 seconds
  criticalThreshold = 10000, // 10 seconds
  className = '',
}) => {
  const [timerData, setTimerData] = useState<TimerData>({
    remainingTime: duration,
    elapsedTime: 0,
    startTime: null,
    pausedTime: 0,
    state: 'idle',
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Format time for display
  const formatTime = useCallback(
    (timeMs: number): string => {
      const totalSeconds = Math.max(0, Math.ceil(timeMs / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const milliseconds = Math.floor((timeMs % 1000) / 10); // Show centiseconds

      if (showMilliseconds && timeMs < 60000) {
        // Show milliseconds only under 1 minute
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
      }

      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },
    [showMilliseconds]
  );

  // Get timer display class based on remaining time
  const getTimerClass = useCallback((): string => {
    const { remainingTime, state } = timerData;

    if (state === 'expired') return 'expired';
    if (state === 'completed') return 'completed';
    if (state === 'paused') return 'paused';

    if (remainingTime <= criticalThreshold) return 'critical';
    if (remainingTime <= warningThreshold) return 'warning';

    return 'normal';
  }, [timerData, criticalThreshold, warningThreshold]);

  // Update timer using high-precision timing
  const updateTimer = useCallback(() => {
    setTimerData((prev) => {
      if (prev.state !== 'running' || prev.startTime === null) {
        return prev;
      }

      const now = Date.now();
      const elapsed = now - prev.startTime - prev.pausedTime;
      const remaining = Math.max(0, duration - elapsed);

      const newData = {
        ...prev,
        remainingTime: remaining,
        elapsedTime: elapsed,
      };

      // Check if timer expired
      if (remaining <= 0 && prev.state === 'running') {
        newData.state = 'expired';
        newData.remainingTime = 0;

        // Call callbacks
        if (onExpire) onExpire();
        if (onTick) onTick(0);

        return newData;
      }

      // Call tick callback
      if (onTick) onTick(remaining);

      return newData;
    });
  }, [duration, onTick, onExpire]);

  // Start the timer
  const startTimer = useCallback(() => {
    setTimerData((prev) => {
      if (prev.state === 'running') return prev;

      const now = Date.now();
      return {
        ...prev,
        startTime: prev.startTime || now,
        state: 'running',
      };
    });
  }, []);

  // Pause the timer
  const pauseTimer = useCallback(() => {
    setTimerData((prev) => {
      if (prev.state !== 'running') return prev;

      const now = Date.now();
      const additionalPausedTime = prev.startTime ? now - prev.startTime - prev.elapsedTime : 0;

      return {
        ...prev,
        pausedTime: prev.pausedTime + additionalPausedTime,
        state: 'paused',
      };
    });
  }, []);

  // Reset the timer
  const resetTimer = useCallback(() => {
    setTimerData({
      remainingTime: duration,
      elapsedTime: 0,
      startTime: null,
      pausedTime: 0,
      state: 'idle',
    });
  }, [duration]);

  // Complete the timer (for when game is solved before time expires)
  const completeTimer = useCallback(() => {
    setTimerData((prev) => ({
      ...prev,
      state: 'completed',
    }));

    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  // High-precision timer loop using requestAnimationFrame for smooth updates
  const startTimerLoop = useCallback(() => {
    const loop = () => {
      updateTimer();
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(loop);
  }, [updateTimer]);

  const stopTimerLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Effect to manage timer loop based on state
  useEffect(() => {
    if (timerData.state === 'running') {
      startTimerLoop();
    } else {
      stopTimerLoop();
    }

    return () => stopTimerLoop();
  }, [timerData.state, startTimerLoop, stopTimerLoop]);

  // Auto-start effect
  useEffect(() => {
    if (autoStart && timerData.state === 'idle') {
      startTimer();
    }
  }, [autoStart, timerData.state, startTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimerLoop();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [stopTimerLoop]);

  // Calculate progress percentage for visual indicator
  const progressPercentage = ((duration - timerData.remainingTime) / duration) * 100;

  return (
    <div className={`game-timer ${getTimerClass()} ${className}`}>
      {/* Timer Display */}
      <div className="timer-display">
        <div className="timer-text">{formatTime(timerData.remainingTime)}</div>

        {/* Timer State Indicator */}
        <div className="timer-state">
          {timerData.state === 'running' && <span className="state-icon running">⏱️</span>}
          {timerData.state === 'paused' && <span className="state-icon paused">⏸️</span>}
          {timerData.state === 'completed' && <span className="state-icon completed">✅</span>}
          {timerData.state === 'expired' && <span className="state-icon expired">⏰</span>}
          {timerData.state === 'idle' && <span className="state-icon idle">⏳</span>}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="timer-progress-container">
        <div className="timer-progress-bar" style={{ width: `${progressPercentage}%` }} />
      </div>

      {/* Timer Controls */}
      <div className="timer-controls">
        {timerData.state === 'idle' && (
          <button className="timer-btn start-btn" onClick={startTimer} title="Start Timer">
            ▶️ Start
          </button>
        )}

        {timerData.state === 'running' && (
          <button className="timer-btn pause-btn" onClick={pauseTimer} title="Pause Timer">
            ⏸️ Pause
          </button>
        )}

        {timerData.state === 'paused' && (
          <>
            <button className="timer-btn resume-btn" onClick={startTimer} title="Resume Timer">
              ▶️ Resume
            </button>
            <button className="timer-btn reset-btn" onClick={resetTimer} title="Reset Timer">
              🔄 Reset
            </button>
          </>
        )}

        {(timerData.state === 'completed' || timerData.state === 'expired') && (
          <button className="timer-btn reset-btn" onClick={resetTimer} title="Reset Timer">
            🔄 New Game
          </button>
        )}
      </div>

      {/* Timer Info */}
      <div className="timer-info">
        {timerData.state === 'running' && timerData.remainingTime <= warningThreshold && (
          <div className="timer-warning">
            {timerData.remainingTime <= criticalThreshold ? (
              <span className="critical-message">⚠️ Time almost up!</span>
            ) : (
              <span className="warning-message">⏰ Running low on time</span>
            )}
          </div>
        )}

        {timerData.state === 'expired' && (
          <div className="timer-message expired-message">⏰ Time's up! Game over.</div>
        )}

        {timerData.state === 'completed' && (
          <div className="timer-message completed-message">
            🎉 Puzzle solved! Time: {formatTime(timerData.elapsedTime)}
          </div>
        )}

        {timerData.state === 'paused' && (
          <div className="timer-message paused-message">⏸️ Game paused</div>
        )}
      </div>
    </div>
  );
};

// Export timer control functions for external use
export const useGameTimer = (duration: number) => {
  const timerRef = useRef<{
    start: () => void;
    pause: () => void;
    reset: () => void;
    complete: () => void;
  } | null>(null);

  const setTimerRef = useCallback((ref: any) => {
    timerRef.current = ref;
  }, []);

  return {
    timerRef: setTimerRef,
    start: () => timerRef.current?.start(),
    pause: () => timerRef.current?.pause(),
    reset: () => timerRef.current?.reset(),
    complete: () => timerRef.current?.complete(),
  };
};
