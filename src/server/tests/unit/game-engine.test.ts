import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine, type DifficultyLevel, type Coordinate } from '../../services/GameEngine.js';

// Mock Redis for testing
vi.mock('@devvit/web/server', () => ({
  redis: {
    setEx: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
  },
}));

describe('GameEngine', () => {
  let gameEngine: GameEngine;

  beforeEach(() => {
    gameEngine = new GameEngine();
    vi.clearAllMocks();
  });

  describe('generatePuzzle', () => {
    it('should generate a valid easy puzzle', async () => {
      const puzzle = await gameEngine.generatePuzzle('easy');

      expect(puzzle).toBeDefined();
      expect(puzzle.difficulty).toBe('easy');
      expect(puzzle.grid).toHaveLength(6);
      expect(puzzle.grid[0]).toHaveLength(6);
      expect(puzzle.baseScore).toBe(100);
      expect(puzzle.maxTime).toBe(300);
      expect(puzzle.id).toMatch(/^puzzle_/);
      expect(puzzle.laserEntry).toBeDefined();
      expect(puzzle.correctExit).toBeDefined();
    });

    it('should generate a valid medium puzzle', async () => {
      const puzzle = await gameEngine.generatePuzzle('medium');

      expect(puzzle.difficulty).toBe('medium');
      expect(puzzle.grid).toHaveLength(8);
      expect(puzzle.baseScore).toBe(250);
      expect(puzzle.maxTime).toBe(600);
    });

    it('should generate a valid hard puzzle', async () => {
      const puzzle = await gameEngine.generatePuzzle('hard');

      expect(puzzle.difficulty).toBe('hard');
      expect(puzzle.grid).toHaveLength(10);
      expect(puzzle.baseScore).toBe(500);
      expect(puzzle.maxTime).toBe(900);
    });

    it('should place correct number of materials for each difficulty', async () => {
      const easyPuzzle = await gameEngine.generatePuzzle('easy');
      const materialCounts = countMaterials(easyPuzzle.grid);

      // Easy should have: 3 mirrors, 1 water, 1 glass, 1 metal, 1 absorber
      expect(materialCounts.mirror).toBe(3);
      expect(materialCounts.water).toBe(1);
      expect(materialCounts.glass).toBe(1);
      expect(materialCounts.metal).toBe(1);
      expect(materialCounts.absorber).toBe(1);
    });

    it('should generate laser entry on grid edge', async () => {
      const puzzle = await gameEngine.generatePuzzle('easy');
      const { laserEntry } = puzzle;
      const gridSize = 6;

      const isOnEdge =
        laserEntry.row === 0 ||
        laserEntry.row === gridSize - 1 ||
        laserEntry.col === 0 ||
        laserEntry.col === gridSize - 1;

      expect(isOnEdge).toBe(true);
    });
  });

  describe('simulateLaserPath', () => {
    it('should simulate laser path through empty grid', () => {
      const grid = createEmptyGrid(4);
      const entry: Coordinate = { row: 0, col: 1, label: 'B1' };

      const path = gameEngine.simulateLaserPath(grid, entry);

      expect(path.segments).toHaveLength(3); // Should travel straight down
      expect(path.exitPoint).toBeDefined();
      expect(path.isComplete).toBe(true);
    });

    it('should handle mirror reflection correctly', () => {
      const grid = createEmptyGrid(4);
      // Place mirror at position (1,1)
      grid[1][1].material = 'mirror';
      grid[1][1].reflectionBehavior = { type: 'mirror', behavior: 'reflect', angle: 90 };

      const entry: Coordinate = { row: 0, col: 1, label: 'B1' };
      const path = gameEngine.simulateLaserPath(grid, entry);

      expect(path.segments.length).toBeGreaterThan(1);
      expect(path.isComplete).toBe(true);
    });

    it('should handle absorber termination', () => {
      const grid = createEmptyGrid(4);
      // Place absorber at position (1,1)
      grid[1][1].material = 'absorber';
      grid[1][1].reflectionBehavior = { type: 'absorber', behavior: 'absorb' };

      const entry: Coordinate = { row: 0, col: 1, label: 'B1' };
      const path = gameEngine.simulateLaserPath(grid, entry);

      expect(path.exitPoint).toBeNull();
      expect(path.isComplete).toBe(true);
    });

    it('should prevent infinite loops', () => {
      const grid = createEmptyGrid(4);
      // Create a potential loop with mirrors
      grid[1][1].material = 'mirror';
      grid[1][2].material = 'mirror';
      grid[2][1].material = 'mirror';
      grid[2][2].material = 'mirror';

      const entry: Coordinate = { row: 0, col: 1, label: 'B1' };
      const path = gameEngine.simulateLaserPath(grid, entry);

      // Should terminate within reasonable number of segments
      expect(path.segments.length).toBeLessThan(100);
    });
  });

  describe('validateAnswer', () => {
    it('should validate correct answer', async () => {
      const mockPuzzle = {
        id: 'test-puzzle',
        correctExit: { row: 3, col: 2, label: 'C4' },
      };

      // Mock Redis to return the puzzle
      const { redis } = await import('@devvit/web/server');
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(mockPuzzle));

      const playerAnswer: Coordinate = { row: 3, col: 2, label: 'C4' };
      const isValid = await gameEngine.validateAnswer('test-puzzle', playerAnswer);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect answer', async () => {
      const mockPuzzle = {
        id: 'test-puzzle',
        correctExit: { row: 3, col: 2, label: 'C4' },
      };

      const { redis } = await import('@devvit/web/server');
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(mockPuzzle));

      const playerAnswer: Coordinate = { row: 2, col: 1, label: 'B3' };
      const isValid = await gameEngine.validateAnswer('test-puzzle', playerAnswer);

      expect(isValid).toBe(false);
    });

    it('should throw error for non-existent puzzle', async () => {
      const { redis } = await import('@devvit/web/server');
      vi.mocked(redis.get).mockResolvedValue(null);

      const playerAnswer: Coordinate = { row: 3, col: 2, label: 'C4' };

      await expect(gameEngine.validateAnswer('non-existent', playerAnswer)).rejects.toThrow(
        'Puzzle not found'
      );
    });
  });

  describe('calculateScore', () => {
    it('should return zero score for incorrect answer', () => {
      const score = gameEngine.calculateScore(100, 0, 60, 300, false);

      expect(score.finalScore).toBe(0);
      expect(score.isCorrect).toBe(false);
    });

    it('should calculate full score for perfect completion', () => {
      const score = gameEngine.calculateScore(100, 0, 60, 300, true);

      expect(score.baseScore).toBe(100);
      expect(score.hintMultiplier).toBe(1.0);
      expect(score.timeMultiplier).toBeGreaterThan(1.0); // Fast completion bonus
      expect(score.finalScore).toBeGreaterThan(100);
      expect(score.isCorrect).toBe(true);
    });

    it('should apply hint penalties correctly', () => {
      const score1 = gameEngine.calculateScore(100, 1, 150, 300, true);
      const score2 = gameEngine.calculateScore(100, 2, 150, 300, true);
      const score4 = gameEngine.calculateScore(100, 4, 150, 300, true);

      expect(score1.hintMultiplier).toBe(0.8);
      expect(score2.hintMultiplier).toBe(0.6);
      expect(score4.hintMultiplier).toBe(0.2);

      expect(score1.finalScore).toBeGreaterThan(score2.finalScore);
      expect(score2.finalScore).toBeGreaterThan(score4.finalScore);
    });

    it('should apply time penalties for slow completion', () => {
      const fastScore = gameEngine.calculateScore(100, 0, 60, 300, true);
      const slowScore = gameEngine.calculateScore(100, 0, 280, 300, true);

      expect(fastScore.timeMultiplier).toBeGreaterThan(slowScore.timeMultiplier);
      expect(fastScore.finalScore).toBeGreaterThan(slowScore.finalScore);
    });

    it('should have minimum time multiplier', () => {
      const score = gameEngine.calculateScore(100, 0, 400, 300, true); // Over time limit

      expect(score.timeMultiplier).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('getPuzzle', () => {
    it('should retrieve puzzle from Redis', async () => {
      const mockPuzzle = {
        id: 'test-puzzle',
        difficulty: 'easy',
        grid: [],
        laserEntry: { row: 0, col: 0, label: 'A1' },
        correctExit: { row: 3, col: 2, label: 'C4' },
        maxTime: 300,
        baseScore: 100,
        createdAt: '2025-10-24T14:34:45.904Z',
      };

      const { redis } = await import('@devvit/web/server');
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(mockPuzzle));

      const puzzle = await gameEngine.getPuzzle('test-puzzle');

      expect(puzzle).toEqual(mockPuzzle);
    });

    it('should return null for non-existent puzzle', async () => {
      const { redis } = await import('@devvit/web/server');
      vi.mocked(redis.get).mockResolvedValue(null);

      const puzzle = await gameEngine.getPuzzle('non-existent');

      expect(puzzle).toBeNull();
    });
  });
});

// Helper functions for tests
function createEmptyGrid(size: number) {
  const grid = [];
  for (let row = 0; row < size; row++) {
    grid[row] = [];
    for (let col = 0; col < size; col++) {
      grid[row][col] = {
        material: 'empty',
        coordinate: {
          row,
          col,
          label: `${String.fromCharCode(65 + col)}${row + 1}`,
        },
        color: '#FFFFFF',
        reflectionBehavior: { type: 'empty', behavior: 'reflect' },
      };
    }
  }
  return grid;
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
