// HintSystem component for managing puzzle hints

import React, { useState, useCallback } from 'react';
import type { PathSegment } from '../../../shared/types/game.js';
import { HINT_MULTIPLIERS, QUADRANTS } from '../../../shared/constants.js';

interface HintSystemProps {
  availableHints: number;
  usedHints: number[];
  onHintRequest: (quadrant: number) => void;
  isGameActive: boolean;
  currentScore?: number;
  hintSegments?: PathSegment[];
  isAnimating?: boolean;
}

export const HintSystem: React.FC<HintSystemProps> = ({
  availableHints,
  usedHints,
  onHintRequest,
  isGameActive,
  currentScore = 0,
  hintSegments = [],
  isAnimating = false,
}) => {
  const [selectedQuadrant, setSelectedQuadrant] = useState<number | null>(null);

  const handleHintRequest = useCallback(
    (quadrant: number) => {
      if (!isGameActive || usedHints.includes(quadrant) || availableHints <= 0) {
        return;
      }

      setSelectedQuadrant(quadrant);
      onHintRequest(quadrant);
    },
    [isGameActive, usedHints, availableHints, onHintRequest]
  );

  const getHintButtonState = useCallback(
    (quadrant: number) => {
      if (usedHints.includes(quadrant)) {
        return 'used';
      }
      if (!isGameActive || availableHints <= 0) {
        return 'disabled';
      }
      if (selectedQuadrant === quadrant && isAnimating) {
        return 'animating';
      }
      return 'available';
    },
    [usedHints, isGameActive, availableHints, selectedQuadrant, isAnimating]
  );

  const getScoreMultiplier = useCallback(() => {
    const hintsUsedCount = usedHints.length;
    return HINT_MULTIPLIERS[hintsUsedCount] || 0.2;
  }, [usedHints]);

  const calculateScoreWithHints = useCallback(() => {
    const multiplier = getScoreMultiplier();
    return Math.round(currentScore * multiplier);
  }, [currentScore, getScoreMultiplier]);

  const getQuadrantName = (quadrant: number): string => {
    const names = ['Top-Left', 'Top-Right', 'Bottom-Left', 'Bottom-Right'];
    return names[quadrant] || 'Unknown';
  };

  const renderHintButton = (quadrant: number) => {
    const state = getHintButtonState(quadrant);
    const quadrantName = getQuadrantName(quadrant);

    return (
      <button
        key={quadrant}
        className={`hint-button hint-button--${state}`}
        onClick={() => handleHintRequest(quadrant)}
        disabled={state === 'disabled' || state === 'used'}
        title={`Reveal laser path in ${quadrantName} quadrant`}
      >
        <div className="hint-button-content">
          <div className="hint-quadrant-icon">{getQuadrantIcon(quadrant)}</div>
          <span className="hint-quadrant-label">{quadrantName}</span>
          {state === 'used' && <div className="hint-used-indicator">✓</div>}
          {state === 'animating' && (
            <div className="hint-animating-indicator">
              <div className="spinner" />
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="hint-system">
      <div className="hint-system-header">
        <h3>Hint System</h3>
        <div className="hint-stats">
          <span className="hints-remaining">
            Hints: {availableHints - usedHints.length}/{availableHints}
          </span>
        </div>
      </div>

      <div className="hint-buttons-grid">
        {[
          QUADRANTS.TOP_LEFT,
          QUADRANTS.TOP_RIGHT,
          QUADRANTS.BOTTOM_LEFT,
          QUADRANTS.BOTTOM_RIGHT,
        ].map((quadrant) => renderHintButton(quadrant))}
      </div>

      <div className="hint-score-impact">
        <div className="score-multiplier">
          <span className="label">Score Multiplier:</span>
          <span className={`value ${getScoreMultiplier() < 1 ? 'penalty' : 'normal'}`}>
            ×{getScoreMultiplier().toFixed(1)}
          </span>
        </div>

        {currentScore > 0 && (
          <div className="projected-score">
            <span className="label">Projected Score:</span>
            <span className="value">{calculateScoreWithHints()}</span>
          </div>
        )}
      </div>

      <div className="hint-penalties">
        <h4>Hint Penalties</h4>
        <div className="penalty-list">
          {Object.entries(HINT_MULTIPLIERS).map(([hintsUsed, multiplier]) => (
            <div
              key={hintsUsed}
              className={`penalty-item ${usedHints.length === parseInt(hintsUsed) ? 'current' : ''}`}
            >
              <span className="hints-count">{hintsUsed} hints:</span>
              <span className="multiplier">×{multiplier.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      {hintSegments.length > 0 && (
        <div className="hint-info">
          <div className="hint-segments-count">
            Showing {hintSegments.length} laser path segments
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to get quadrant icons
function getQuadrantIcon(quadrant: number): string {
  const icons = ['↖️', '↗️', '↙️', '↘️'];
  return icons[quadrant] || '📍';
}
