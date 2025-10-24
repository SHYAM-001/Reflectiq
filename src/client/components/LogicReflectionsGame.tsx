// Simplified Logic Reflections Game Component

import React, { useState, useCallback } from 'react';
import { HintSystem, GameTimer } from './game';
import { PuzzleGrid } from './game/PuzzleGrid';
import type {
  PuzzleConfiguration,
  DifficultyLevel,
  GameSession,
  GridCell,
  MaterialType,
} from '../../shared/types/index.js';

type GameState = 'splash' | 'playing';

interface LogicReflectionsGameProps {
  username?: string;
}

export const LogicReflectionsGame: React.FC<LogicReflectionsGameProps> = ({ username }) => {
  const [gameState, setGameState] = useState<GameState>('splash');
  const [currentPuzzle, setCurrentPuzzle] = useState<PuzzleConfiguration | null>(null);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('easy');

  const createMockPuzzle = (difficulty: DifficultyLevel): PuzzleConfiguration => {
    const gridSize = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6;

    // Create proper GridCell objects with all required properties
    const grid: GridCell[][] = Array(gridSize)
      .fill(null)
      .map((_, row) =>
        Array(gridSize)
          .fill(null)
          .map((_, col) => ({
            material: 'empty' as MaterialType,
            coordinate: { row, col, label: `${String.fromCharCode(65 + col)}${row + 1}` },
            color: '#f0f0f0',
            reflectionBehavior: {
              type: 'empty' as MaterialType,
              behavior: 'absorb' as const,
            },
          }))
      );

    // Add some mirrors for demonstration
    if (gridSize >= 4 && grid[1] && grid[2]) {
      grid[1][1] = {
        material: 'mirror',
        coordinate: { row: 1, col: 1, label: 'B2' },
        color: '#silver',
        reflectionBehavior: {
          type: 'mirror',
          behavior: 'reflect',
          angle: 45,
        },
      };
      grid[2][2] = {
        material: 'mirror',
        coordinate: { row: 2, col: 2, label: 'C3' },
        color: '#silver',
        reflectionBehavior: {
          type: 'mirror',
          behavior: 'reflect',
          angle: -45,
        },
      };
      if (gridSize >= 5 && grid[3] && grid[1]) {
        grid[3][1] = {
          material: 'water',
          coordinate: { row: 3, col: 1, label: 'B4' },
          color: '#blue',
          reflectionBehavior: {
            type: 'water',
            behavior: 'diffuse',
            diffusionRange: 2,
          },
        };
        grid[1][3] = {
          material: 'glass',
          coordinate: { row: 1, col: 3, label: 'D2' },
          color: '#lightblue',
          reflectionBehavior: {
            type: 'glass',
            behavior: 'split',
            probability: 0.7,
          },
        };
      }
    }

    return {
      id: `mock_${difficulty}_${Date.now()}`,
      grid,
      laserEntry: { row: 0, col: 0, label: 'A1' },
      correctExit: {
        row: gridSize - 1,
        col: gridSize - 1,
        label: `${String.fromCharCode(65 + gridSize - 1)}${gridSize}`,
      },
      difficulty,
      baseScore: difficulty === 'easy' ? 100 : difficulty === 'medium' ? 200 : 300,
      maxTime: difficulty === 'easy' ? 300000 : difficulty === 'medium' ? 600000 : 900000, // milliseconds
      createdAt: new Date(),
    };
  };

  const handleStartPuzzle = useCallback(
    (difficulty: DifficultyLevel) => {
      const puzzle = createMockPuzzle(difficulty);
      const session: GameSession = {
        sessionId: `session_${Date.now()}`,
        puzzleId: puzzle.id,
        userId: username || 'anonymous',
        startTime: new Date(),
        hintsUsed: [],
        isActive: true,
      };

      setCurrentPuzzle(puzzle);
      setGameSession(session);
      setGameState('playing');
    },
    [username]
  );

  const handlePuzzleComplete = useCallback((score: number) => {
    // Show completion message and return to splash
    alert(`Puzzle completed! Score: ${score}`);
    setGameState('splash');
    setCurrentPuzzle(null);
    setGameSession(null);
  }, []);

  const handleBackToSplash = useCallback(() => {
    setGameState('splash');
    setCurrentPuzzle(null);
    setGameSession(null);
  }, []);

  const getDifficultyIcon = (difficulty: DifficultyLevel): string => {
    const icons = {
      easy: '🟢',
      medium: '🟡',
      hard: '🔴',
    };
    return icons[difficulty];
  };

  const renderGameContent = () => {
    switch (gameState) {
      case 'splash':
        return (
          <div className="splash-screen">
            <div className="splash-header">
              <h1 className="game-title">🔄 Logic Reflections</h1>
              <p className="game-subtitle">Master the art of laser reflection</p>
              {username && <p className="welcome-text">Welcome, {username}! 👋</p>}
            </div>

            <div className="difficulty-selection">
              <h3>Choose Difficulty Level</h3>
              <div className="difficulty-buttons">
                {(['easy', 'medium', 'hard'] as DifficultyLevel[]).map((difficulty) => (
                  <button
                    key={difficulty}
                    className={`difficulty-button ${selectedDifficulty === difficulty ? 'selected' : ''}`}
                    onClick={() => setSelectedDifficulty(difficulty)}
                  >
                    {getDifficultyIcon(difficulty)}{' '}
                    {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                  </button>
                ))}
              </div>

              <button className="play-button" onClick={() => handleStartPuzzle(selectedDifficulty)}>
                ▶️ Play {selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1)}
              </button>
            </div>

            <div className="how-to-play">
              <h3>How to Play</h3>
              <div className="instructions">
                <div className="instruction-item">
                  <span className="instruction-icon">🔍</span>
                  <span>Analyze the grid and laser entry point</span>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">🪞</span>
                  <span>Predict how the laser will reflect off mirrors</span>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">🎯</span>
                  <span>Click where you think the laser will exit</span>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">💡</span>
                  <span>Use hints if you get stuck (affects your score)</span>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">⏱️</span>
                  <span>Solve quickly for bonus points</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'playing':
        if (!currentPuzzle || !gameSession) {
          return <div className="loading">Loading puzzle...</div>;
        }
        return (
          <div className="game-container">
            <div className="game-header">
              <button className="back-button" onClick={handleBackToSplash}>
                ← Back
              </button>
              <div className="puzzle-info">
                <span className="difficulty-badge">
                  {getDifficultyIcon(currentPuzzle.difficulty)} {currentPuzzle.difficulty}
                </span>
                <span className="base-score">Base Score: {currentPuzzle.baseScore}</span>
              </div>
            </div>

            <div className="game-content">
              <div className="game-main">
                <PuzzleGrid
                  puzzle={currentPuzzle}
                  onAnswerSubmit={(answer) => {
                    // Mock score calculation
                    const isCorrect =
                      answer.row === currentPuzzle.correctExit.row &&
                      answer.col === currentPuzzle.correctExit.col;
                    const score = isCorrect ? currentPuzzle.baseScore : 0;
                    handlePuzzleComplete(score);
                  }}
                />
              </div>

              <div className="game-sidebar">
                <GameTimer
                  duration={currentPuzzle.maxTime}
                  onExpire={() => handlePuzzleComplete(0)}
                  autoStart={true}
                />

                <HintSystem
                  puzzle={currentPuzzle}
                  maxHints={4}
                  onHintUsed={(quadrant) => {
                    console.log('Hint used for quadrant:', quadrant);
                  }}
                  isGameActive={true}
                  usedHints={[]}
                  currentScore={currentPuzzle.baseScore}
                />
              </div>
            </div>
          </div>
        );

      default:
        return <div>Unknown game state</div>;
    }
  };

  return <div className="logic-reflections-game">{renderGameContent()}</div>;
};
