// Simplified DailyPuzzleHub component

import React from 'react';
import type {
  DailyPuzzleSet,
  UserDailyProgress,
  DifficultyLevel,
} from '../../../shared/types/index.js';

interface DailyPuzzleHubProps {
  todaysPuzzles: DailyPuzzleSet;
  userProgress: UserDailyProgress;
  onPuzzleStart: (difficulty: DifficultyLevel, postId?: string) => void;
  isLoading?: boolean;
}

export const DailyPuzzleHub: React.FC<DailyPuzzleHubProps> = ({
  todaysPuzzles,
  userProgress,
  onPuzzleStart,
  isLoading = false,
}) => {
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDifficultyIcon = (difficulty: DifficultyLevel): string => {
    const icons = {
      easy: '🟢',
      medium: '🟡',
      hard: '🔴',
    };
    return icons[difficulty];
  };

  const getCompletionStatus = (difficulty: DifficultyLevel): 'completed' | 'available' => {
    return userProgress.completed[difficulty] ? 'completed' : 'available';
  };

  const getProgressPercentage = (): number => {
    const completed = Object.values(userProgress.completed).filter(Boolean).length;
    return (completed / 3) * 100;
  };

  if (isLoading) {
    return (
      <div className="daily-puzzle-hub loading">
        <div className="loading-content">
          <div className="spinner" />
          <h3>Loading today's puzzles...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="daily-puzzle-hub">
      <div className="hub-header">
        <div className="date-info">
          <h2>📅 Daily Puzzles</h2>
          <p className="current-date">{formatDate(todaysPuzzles.date)}</p>
        </div>

        <div className="progress-summary">
          <div className="progress-circle">
            <div className="progress-text">{Math.round(getProgressPercentage())}%</div>
          </div>
          <div className="progress-info">
            <span className="progress-label">Daily Progress</span>
          </div>
        </div>
      </div>

      <div className="puzzle-cards">
        {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map((difficulty) => {
          const puzzle = todaysPuzzles.puzzles[difficulty];
          const status = getCompletionStatus(difficulty);
          const userScore = userProgress.scores[difficulty];

          return (
            <div key={difficulty} className={`puzzle-difficulty-card ${status}`}>
              <div className="card-header">
                <div className="difficulty-info">
                  <span className="difficulty-icon">{getDifficultyIcon(difficulty)}</span>
                  <span className="difficulty-name">
                    {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                  </span>
                </div>

                {status === 'completed' && <div className="completion-badge">✅ Completed</div>}
              </div>

              <div className="card-content">
                <div className="puzzle-info">
                  <div className="info-item">
                    <span className="info-label">Grid:</span>
                    <span className="info-value">
                      {puzzle.grid.length}×{puzzle.grid.length}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Base Score:</span>
                    <span className="info-value">{puzzle.baseScore} pts</span>
                  </div>
                </div>

                {status === 'completed' && userScore && (
                  <div className="user-score">
                    <span className="score-label">Your Score:</span>
                    <span className="score-value">{userScore} pts</span>
                  </div>
                )}
              </div>

              <div className="card-actions">
                <button
                  className={`start-button ${status}`}
                  onClick={() => onPuzzleStart(difficulty, todaysPuzzles.postIds[difficulty])}
                >
                  {status === 'completed' ? '🔄 Replay' : '▶️ Start'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
