// GameTimer component for precise timing with visual countdown

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { formatTime, calculateTimeBonus } from '../../../shared/utils.js';

interface GameTimerProps {
  isActive: boolean;
  onTimeUpdate: (elapsed: number) => void;
  maxTime: number;
  onTimeExpired?: () => void;
  showTimeBonus?: boolean;
  currentScore?: number;
}

export const GameTimer: React.FC<GameTimerProps> = ({
  isActive,
  onTimeUpdate,
  maxTime,
  onTimeExpired,
  showTimeBonus = true,
  currentScore = 0,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Start/stop timer based on isActive prop
  useEffect(() => {
    if (isActive && !isExpired) {
      startTimeRef.current = Date.now() - elapsedTime * 1000;

      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const now = Date.now();
          const elapsed = Math.floor((now - startTimeRef.current) / 1000);

          setElapsedTime(elapsed);
          onTimeUpdate(elapsed);

          // Check if time expired
          if (elapsed >= maxTime) {
            setIsExpired(true);
            onTimeExpired?.();
          }
        }
      }, 100); // Update every 100ms for smooth animation
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, isExpired, maxTime, onTimeUpdate, onTimeExpired, elapsedTime]);

  // Reset timer when maxTime changes (new puzzle)
  useEffect(() => {
    setElapsedTime(0);
    setIsExpired(false);
    startTimeRef.current = null;
  }, [maxTime]);

  const getRemainingTime = useCallback(() => {
    return Math.max(0, maxTime - elapsedTime);
  }, [maxTime, elapsedTime]);

  const getTimeProgress = useCallback(() => {
    return Math.min(1, elapsedTime / maxTime);
  }, [elapsedTime, maxTime]);

  const getTimerState = useCallback(() => {
    const remaining = getRemainingTime();
    const progress = getTimeProgress();

    if (isExpired) return 'expired';
    if (remaining <= 30) return 'critical';
    if (progress > 0.75) return 'warning';
    if (progress > 0.5) return 'caution';
    return 'normal';
  }, [getRemainingTime, getTimeProgress, isExpired]);

  const getTimeBonus = useCallback(() => {
    if (!showTimeBonus || currentScore === 0) return 0;
    const bonus = calculateTimeBonus(elapsedTime, maxTime);
    return Math.round(currentScore * bonus);
  }, [showTimeBonus, currentScore, elapsedTime, maxTime]);

  const getTimeBonusMultiplier = useCallback(() => {
    return calculateTimeBonus(elapsedTime, maxTime);
  }, [elapsedTime, maxTime]);

  return (
    <div className={`game-timer game-timer--${getTimerState()}`}>
      <div className="timer-header">
        <h3>Timer</h3>
        {!isActive && elapsedTime === 0 && <span className="timer-status">Ready</span>}
        {isActive && !isExpired && <span className="timer-status">Running</span>}
        {isExpired && <span className="timer-status">Expired</span>}
      </div>

      <div className="timer-display">
        <div className="time-circle">
          <svg className="timer-svg" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(0, 0, 0, 0.1)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - getTimeProgress())}`}
              transform="rotate(-90 50 50)"
              className="timer-progress"
            />
          </svg>

          <div className="time-text">
            <div className="elapsed-time">{formatTime(elapsedTime)}</div>
            <div className="remaining-time">-{formatTime(getRemainingTime())}</div>
          </div>
        </div>
      </div>

      <div className="timer-stats">
        <div className="stat-item">
          <span className="stat-label">Elapsed:</span>
          <span className="stat-value">{formatTime(elapsedTime)}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Remaining:</span>
          <span className="stat-value">{formatTime(getRemainingTime())}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">Max Time:</span>
          <span className="stat-value">{formatTime(maxTime)}</span>
        </div>
      </div>

      {showTimeBonus && currentScore > 0 && (
        <div className="time-bonus-section">
          <div className="bonus-header">
            <h4>Time Bonus</h4>
          </div>

          <div className="bonus-stats">
            <div className="bonus-item">
              <span className="bonus-label">Multiplier:</span>
              <span className={`bonus-value ${getTimeBonusMultiplier() > 0.5 ? 'good' : 'poor'}`}>
                ×{getTimeBonusMultiplier().toFixed(2)}
              </span>
            </div>

            <div className="bonus-item">
              <span className="bonus-label">Bonus Points:</span>
              <span className="bonus-value">{getTimeBonus()}</span>
            </div>
          </div>

          <div className="bonus-bar">
            <div className="bonus-fill" style={{ width: `${getTimeBonusMultiplier() * 100}%` }} />
          </div>
        </div>
      )}

      {isExpired && (
        <div className="timer-expired-message">
          <div className="expired-icon">⏰</div>
          <div className="expired-text">Time's Up!</div>
        </div>
      )}
    </div>
  );
};
