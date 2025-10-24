// HintSystem component optimized for Devvit Web daily puzzle system

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  PuzzleConfiguration,
  LaserPath,
  PathSegment,
  DifficultyLevel,
} from '../../../shared/types/index.js';
import { HINT_MULTIPLIERS, QUADRANTS } from '../../../shared/constants.js';
import { BeamHandler } from '../../../shared/physics/beam-handler.js';
import './HintSystem.css';

interface HintSystemProps {
  puzzle: PuzzleConfiguration;
  maxHints: number;
  onHintUsed: (quadrant: number) => void;
  onHintPathReceived?: (path: LaserPath) => void;
  isGameActive: boolean;
  usedHints: number[];
  currentScore: number;
  showScorePenalty?: boolean;
}

interface HintButton {
  quadrant: number;
  label: string;
  position: string;
  isUsed: boolean;
  isAvailable: boolean;
}

export const HintSystem: React.FC<HintSystemProps> = ({
  puzzle,
  maxHints,
  onHintUsed,
  onHintPathReceived,
  isGameActive,
  usedHints,
  currentScore,
  showScorePenalty = true,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastHintQuadrant, setLastHintQuadrant] = useState<number | null>(null);
  const [hintCooldown, setHintCooldown] = useState(false);

  const beamHandler = useMemo(() => new BeamHandler(), []);

  // Calculate remaining hints
  const remainingHints = maxHints - usedHints.length;
  const canUseHints = isGameActive && remainingHints > 0 && !isAnimating;

  // Create hint buttons configuration
  const hintButtons: HintButton[] = useMemo(
    () => [
      {
        quadrant: QUADRANTS.TOP_LEFT,
        label: 'Top Left',
        position: 'top-left',
        isUsed: usedHints.includes(QUADRANTS.TOP_LEFT),
        isAvailable: !usedHints.includes(QUADRANTS.TOP_LEFT) && canUseHints,
      },
      {
        quadrant: QUADRANTS.TOP_RIGHT,
        label: 'Top Right',
        position: 'top-right',
        isUsed: usedHints.includes(QUADRANTS.TOP_RIGHT),
        isAvailable: !usedHints.includes(QUADRANTS.TOP_RIGHT) && canUseHints,
      },
      {
        quadrant: QUADRANTS.BOTTOM_LEFT,
        label: 'Bottom Left',
        position: 'bottom-left',
        isUsed: usedHints.includes(QUADRANTS.BOTTOM_LEFT),
        isAvailable: !usedHints.includes(QUADRANTS.BOTTOM_LEFT) && canUseHints,
      },
      {
        quadrant: QUADRANTS.BOTTOM_RIGHT,
        label: 'Bottom Right',
        position: 'bottom-right',
        isUsed: usedHints.includes(QUADRANTS.BOTTOM_RIGHT),
        isAvailable: !usedHints.includes(QUADRANTS.BOTTOM_RIGHT) && canUseHints,
      },
    ],
    [usedHints, canUseHints]
  );

  // Calculate current score multiplier
  const currentMultiplier = HINT_MULTIPLIERS[usedHints.length] || 0.2;
  const nextMultiplier = HINT_MULTIPLIERS[usedHints.length + 1] || 0.2;

  // Calculate score impact
  const currentPotentialScore = Math.round(currentScore * currentMultiplier);
  const nextPotentialScore = Math.round(currentScore * nextMultiplier);
  const scoreLoss = currentPotentialScore - nextPotentialScore;

  // Handle hint button click
  const handleHintClick = useCallback(
    async (quadrant: number) => {
      if (!canUseHints || hintCooldown) return;

      try {
        setIsAnimating(true);
        setHintCooldown(true);
        setLastHintQuadrant(quadrant);

        // Call the hint API
        const response = await fetch('/api/puzzle/hint', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            puzzleId: puzzle.id,
            quadrant,
            sessionId: 'current-session', // This should come from game state
          }),
        });

        if (response.ok) {
          const hintData = await response.json();

          // Notify parent component
          onHintUsed(quadrant);

          // If we have path data, pass it to parent for animation
          if (hintData.revealedPath && onHintPathReceived) {
            const hintPath: LaserPath = {
              segments: hintData.revealedPath,
              exitPoint: null,
              isComplete: false,
            };
            onHintPathReceived(hintPath);
          }

          // Animate hint reveal
          setTimeout(() => {
            setIsAnimating(false);
          }, 2000);
        } else {
          console.error('Failed to get hint:', response.statusText);
          setIsAnimating(false);
        }
      } catch (error) {
        console.error('Error requesting hint:', error);
        setIsAnimating(false);
      } finally {
        // Cooldown to prevent rapid clicking
        setTimeout(() => {
          setHintCooldown(false);
        }, 1000);
      }
    },
    [canUseHints, hintCooldown, puzzle.id, onHintUsed, onHintPathReceived]
  );

  // Get hint button icon
  const getHintIcon = useCallback(
    (button: HintButton): string => {
      if (button.isUsed) return '✅';
      if (!button.isAvailable) return '🔒';
      if (isAnimating && lastHintQuadrant === button.quadrant) return '⚡';
      return '💡';
    },
    [isAnimating, lastHintQuadrant]
  );

  // Get difficulty-based hint description
  const getHintDescription = useCallback((): string => {
    const descriptions = {
      easy: 'Hints reveal laser path in each quadrant',
      medium: 'Hints show beam direction through grid sections',
      hard: 'Hints display partial laser trajectory',
    };
    return descriptions[puzzle.difficulty];
  }, [puzzle.difficulty]);

  return (
    <div className="hint-system">
      {/* Header */}
      <div className="hint-header">
        <h3 className="hint-title">💡 Hint System</h3>
        <div className="hint-counter">
          <span className="remaining-hints">
            {remainingHints}/{maxHints}
          </span>
          <span className="hints-label">hints left</span>
        </div>
      </div>

      {/* Description */}
      <p className="hint-description">{getHintDescription()}</p>

      {/* Hint Buttons Grid */}
      <div className="hint-buttons-grid">
        {hintButtons.map((button) => (
          <button
            key={button.quadrant}
            className={`hint-button ${button.position} ${
              button.isUsed ? 'used' : ''
            } ${!button.isAvailable ? 'disabled' : ''} ${
              isAnimating && lastHintQuadrant === button.quadrant ? 'animating' : ''
            }`}
            onClick={() => handleHintClick(button.quadrant)}
            disabled={!button.isAvailable}
            title={
              button.isUsed
                ? `${button.label} - Already used`
                : button.isAvailable
                  ? `Reveal laser path in ${button.label}`
                  : `${button.label} - Not available`
            }
          >
            <span className="hint-icon">{getHintIcon(button)}</span>
            <span className="hint-label">{button.label}</span>
          </button>
        ))}
      </div>

      {/* Score Impact */}
      {showScorePenalty && remainingHints > 0 && (
        <div className="score-impact">
          <div className="current-multiplier">
            <span className="multiplier-label">Current multiplier:</span>
            <span className="multiplier-value">{(currentMultiplier * 100).toFixed(0)}%</span>
          </div>

          {remainingHints > 0 && (
            <div className="next-hint-impact">
              <span className="impact-label">Next hint penalty:</span>
              <span className="impact-value negative">-{scoreLoss} pts</span>
              <span className="new-multiplier">({(nextMultiplier * 100).toFixed(0)}%)</span>
            </div>
          )}
        </div>
      )}

      {/* Hint Strategy Tips */}
      <div className="hint-strategy">
        <h4>💭 Strategy Tips</h4>
        <ul className="strategy-list">
          <li>Use hints strategically - each reduces your final score</li>
          <li>Start with corners to understand beam entry/exit</li>
          <li>Save hints for complex material interactions</li>
          <li>Remember: {puzzle.difficulty} puzzles have unique solutions</li>
        </ul>
      </div>

      {/* Animation Status */}
      {isAnimating && (
        <div className="animation-status">
          <div className="animation-spinner" />
          <span>Revealing laser path...</span>
        </div>
      )}

      {/* No Hints Left Message */}
      {remainingHints === 0 && (
        <div className="no-hints-message">
          <span className="no-hints-icon">🎯</span>
          <span className="no-hints-text">All hints used! Trust your logic to find the exit.</span>
        </div>
      )}
    </div>
  );
};
