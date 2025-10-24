import express from 'express';
import { context } from '@devvit/web/server';
import {
  gameEngine,
  type DifficultyLevel,
  type Coordinate,
  type PuzzleConfiguration,
} from '../services/GameEngine.js';

const router = express.Router();

/**
 * Generate a new puzzle for the specified difficulty
 * POST /api/game/generate
 */
router.post('/api/game/generate', async (req, res) => {
  try {
    const { difficulty } = req.body as { difficulty: DifficultyLevel };

    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DIFFICULTY',
          message: 'Difficulty must be easy, medium, or hard',
          timestamp: new Date(),
        },
      });
    }

    const puzzle = await gameEngine.generatePuzzle(difficulty);

    // Return puzzle without the correct answer (client shouldn't know)
    const clientPuzzle = {
      id: puzzle.id,
      difficulty: puzzle.difficulty,
      grid: puzzle.grid,
      laserEntry: puzzle.laserEntry,
      maxTime: puzzle.maxTime,
      baseScore: puzzle.baseScore,
      createdAt: puzzle.createdAt,
    };

    res.json({
      puzzle: clientPuzzle,
      sessionId: `session_${puzzle.id}_${context.userId}`,
      startTime: new Date(),
    });
  } catch (error) {
    console.error('Error generating puzzle:', error);
    res.status(500).json({
      error: {
        code: 'GENERATION_FAILED',
        message: 'Failed to generate puzzle',
        timestamp: new Date(),
      },
    });
  }
});

/**
 * Get an existing puzzle by ID
 * GET /api/game/puzzle/:puzzleId
 */
router.get('/api/game/puzzle/:puzzleId', async (req, res) => {
  try {
    const { puzzleId } = req.params;

    const puzzle = await gameEngine.getPuzzle(puzzleId);

    if (!puzzle) {
      return res.status(404).json({
        error: {
          code: 'PUZZLE_NOT_FOUND',
          message: 'Puzzle not found or expired',
          timestamp: new Date(),
        },
      });
    }

    // Return puzzle without the correct answer
    const clientPuzzle = {
      id: puzzle.id,
      difficulty: puzzle.difficulty,
      grid: puzzle.grid,
      laserEntry: puzzle.laserEntry,
      maxTime: puzzle.maxTime,
      baseScore: puzzle.baseScore,
      createdAt: puzzle.createdAt,
    };

    res.json({
      puzzle: clientPuzzle,
    });
  } catch (error) {
    console.error('Error fetching puzzle:', error);
    res.status(500).json({
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch puzzle',
        timestamp: new Date(),
      },
    });
  }
});

/**
 * Simulate laser path for hint system
 * POST /api/game/simulate
 */
router.post('/api/game/simulate', async (req, res) => {
  try {
    const { puzzleId, quadrant } = req.body as { puzzleId: string; quadrant: number };

    if (!puzzleId || quadrant === undefined || quadrant < 0 || quadrant > 3) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Valid puzzleId and quadrant (0-3) required',
          timestamp: new Date(),
        },
      });
    }

    const puzzle = await gameEngine.getPuzzle(puzzleId);

    if (!puzzle) {
      return res.status(404).json({
        error: {
          code: 'PUZZLE_NOT_FOUND',
          message: 'Puzzle not found or expired',
          timestamp: new Date(),
        },
      });
    }

    // Simulate full laser path
    const laserPath = gameEngine.simulateLaserPath(puzzle.grid, puzzle.laserEntry);

    // Filter segments by quadrant
    const gridSize = puzzle.grid.length;
    const quadrantSegments = laserPath.segments.filter((segment) => {
      return (
        this.isInQuadrant(segment.start, quadrant, gridSize) ||
        this.isInQuadrant(segment.end, quadrant, gridSize)
      );
    });

    res.json({
      quadrant,
      revealedPath: quadrantSegments,
      totalSegments: laserPath.segments.length,
      isComplete: laserPath.isComplete,
    });
  } catch (error) {
    console.error('Error simulating laser path:', error);
    res.status(500).json({
      error: {
        code: 'SIMULATION_FAILED',
        message: 'Failed to simulate laser path',
        timestamp: new Date(),
      },
    });
  }
});

/**
 * Validate player answer
 * POST /api/game/validate
 */
router.post('/api/game/validate', async (req, res) => {
  try {
    const { puzzleId, answer, hintsUsed, timeElapsed } = req.body as {
      puzzleId: string;
      answer: Coordinate;
      hintsUsed: number;
      timeElapsed: number;
    };

    if (!puzzleId || !answer || hintsUsed === undefined || timeElapsed === undefined) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'puzzleId, answer, hintsUsed, and timeElapsed are required',
          timestamp: new Date(),
        },
      });
    }

    const puzzle = await gameEngine.getPuzzle(puzzleId);

    if (!puzzle) {
      return res.status(404).json({
        error: {
          code: 'PUZZLE_NOT_FOUND',
          message: 'Puzzle not found or expired',
          timestamp: new Date(),
        },
      });
    }

    // Validate answer
    const isCorrect = await gameEngine.validateAnswer(puzzleId, answer);

    // Calculate score
    const scoreCalculation = gameEngine.calculateScore(
      puzzle.baseScore,
      hintsUsed,
      timeElapsed,
      puzzle.maxTime,
      isCorrect
    );

    res.json({
      isCorrect,
      correctExit: puzzle.correctExit,
      playerAnswer: answer,
      score: scoreCalculation,
      puzzleId,
      userId: context.userId,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error validating answer:', error);
    res.status(500).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Failed to validate answer',
        timestamp: new Date(),
      },
    });
  }
});

/**
 * Get puzzle statistics
 * GET /api/game/stats/:puzzleId
 */
router.get('/api/game/stats/:puzzleId', async (req, res) => {
  try {
    const { puzzleId } = req.params;

    const puzzle = await gameEngine.getPuzzle(puzzleId);

    if (!puzzle) {
      return res.status(404).json({
        error: {
          code: 'PUZZLE_NOT_FOUND',
          message: 'Puzzle not found or expired',
          timestamp: new Date(),
        },
      });
    }

    // Simulate laser path for statistics
    const laserPath = gameEngine.simulateLaserPath(puzzle.grid, puzzle.laserEntry);

    res.json({
      puzzleId,
      difficulty: puzzle.difficulty,
      pathLength: laserPath.segments.length,
      hasValidExit: laserPath.exitPoint !== null,
      materialCount: this.countMaterials(puzzle.grid),
      createdAt: puzzle.createdAt,
    });
  } catch (error) {
    console.error('Error fetching puzzle stats:', error);
    res.status(500).json({
      error: {
        code: 'STATS_FAILED',
        message: 'Failed to fetch puzzle statistics',
        timestamp: new Date(),
      },
    });
  }
});

// Helper functions
function isInQuadrant(coordinate: Coordinate, quadrant: number, gridSize: number): boolean {
  const midRow = Math.floor(gridSize / 2);
  const midCol = Math.floor(gridSize / 2);

  switch (quadrant) {
    case 0: // Top-left
      return coordinate.row < midRow && coordinate.col < midCol;
    case 1: // Top-right
      return coordinate.row < midRow && coordinate.col >= midCol;
    case 2: // Bottom-left
      return coordinate.row >= midRow && coordinate.col < midCol;
    case 3: // Bottom-right
      return coordinate.row >= midRow && coordinate.col >= midCol;
    default:
      return false;
  }
}

function countMaterials(grid: any[][]): Record<string, number> {
  const counts: Record<string, number> = {};

  grid.forEach((row) => {
    row.forEach((cell) => {
      counts[cell.material] = (counts[cell.material] || 0) + 1;
    });
  });

  return counts;
}

export default router;
