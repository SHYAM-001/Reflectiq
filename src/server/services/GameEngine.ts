import { redis } from '@devvit/web/server';

// Types for the game engine
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type MaterialType = 'mirror' | 'water' | 'glass' | 'metal' | 'absorber' | 'empty';
export type Direction = 'north' | 'south' | 'east' | 'west';

export interface Coordinate {
  row: number;
  col: number;
  label: string; // e.g., "D5"
}

export interface GridCell {
  material: MaterialType;
  coordinate: Coordinate;
  color: string;
  reflectionBehavior: ReflectionRule;
}

export interface ReflectionRule {
  type: MaterialType;
  behavior: 'reflect' | 'absorb' | 'split' | 'reverse' | 'diffuse';
  angle?: number;
  probability?: number;
}

export interface PuzzleConfiguration {
  id: string;
  difficulty: DifficultyLevel;
  grid: GridCell[][];
  laserEntry: Coordinate;
  correctExit: Coordinate;
  maxTime: number;
  baseScore: number;
  createdAt: Date;
}

export interface PathSegment {
  start: Coordinate;
  end: Coordinate;
  direction: Direction;
  material: MaterialType;
}

export interface LaserPath {
  segments: PathSegment[];
  exitPoint: Coordinate | null;
  isComplete: boolean;
}

export interface ScoreCalculation {
  baseScore: number;
  hintMultiplier: number;
  timeMultiplier: number;
  finalScore: number;
  isCorrect: boolean;
}

/**
 * GameEngine service implementing core puzzle generation and laser physics
 * Following Devvit Web patterns with Redis storage and serverless constraints
 */
export class GameEngine {
  private static readonly GRID_SIZES = {
    easy: 6,
    medium: 8,
    hard: 10,
  };

  private static readonly BASE_SCORES = {
    easy: 100,
    medium: 250,
    hard: 500,
  };

  private static readonly MAX_TIMES = {
    easy: 300, // 5 minutes
    medium: 600, // 10 minutes
    hard: 900, // 15 minutes
  };

  private static readonly MATERIAL_COLORS = {
    mirror: '#C0C0C0',
    water: '#4A90E2',
    glass: '#7ED321',
    metal: '#D0021B',
    absorber: '#000000',
    empty: '#FFFFFF',
  };

  /**
   * Generate a new puzzle configuration for the specified difficulty
   * Ensures puzzle is solvable and stores in Redis
   */
  async generatePuzzle(difficulty: DifficultyLevel): Promise<PuzzleConfiguration> {
    const gridSize = GameEngine.GRID_SIZES[difficulty];
    const puzzleId = `puzzle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate grid with materials
    const grid = this.createGrid(gridSize, difficulty);

    // Determine laser entry point (always from edge)
    const laserEntry = this.generateLaserEntry(gridSize);

    // Simulate laser path to find correct exit
    const laserPath = this.simulateLaserPath(grid, laserEntry);

    if (!laserPath.exitPoint) {
      // Regenerate if no valid exit (recursive with limit)
      return this.generatePuzzle(difficulty);
    }

    const puzzle: PuzzleConfiguration = {
      id: puzzleId,
      difficulty,
      grid,
      laserEntry,
      correctExit: laserPath.exitPoint,
      maxTime: GameEngine.MAX_TIMES[difficulty],
      baseScore: GameEngine.BASE_SCORES[difficulty],
      createdAt: new Date(),
    };

    // Store puzzle in Redis with expiration (24 hours)
    await redis.setEx(`puzzle:${puzzleId}`, 86400, JSON.stringify(puzzle));

    return puzzle;
  }

  /**
   * Simulate laser beam path through the grid
   * Implements physics for all material types
   */
  simulateLaserPath(grid: GridCell[][], entry: Coordinate): LaserPath {
    const segments: PathSegment[] = [];
    let currentPos = { ...entry };
    let currentDirection = this.getInitialDirection(entry, grid.length);
    let isComplete = false;
    let exitPoint: Coordinate | null = null;

    // Prevent infinite loops
    const maxIterations = grid.length * grid[0].length * 4;
    let iterations = 0;

    while (!isComplete && iterations < maxIterations) {
      iterations++;

      const nextPos = this.getNextPosition(currentPos, currentDirection);

      // Check if beam exits grid
      if (this.isOutOfBounds(nextPos, grid.length)) {
        exitPoint = this.getExitCoordinate(currentPos, currentDirection, grid.length);
        isComplete = true;
        break;
      }

      const currentCell = grid[nextPos.row][nextPos.col];
      const segment: PathSegment = {
        start: { ...currentPos },
        end: { ...nextPos },
        direction: currentDirection,
        material: currentCell.material,
      };

      segments.push(segment);

      // Apply material interaction
      const interaction = this.applyMaterialInteraction(
        currentCell.material,
        currentDirection,
        nextPos
      );

      if (interaction.absorbed) {
        isComplete = true;
        break;
      }

      if (interaction.newDirection) {
        currentDirection = interaction.newDirection;
      }

      currentPos = nextPos;
    }

    return {
      segments,
      exitPoint,
      isComplete,
    };
  }

  /**
   * Validate player's answer against correct solution
   */
  async validateAnswer(puzzleId: string, playerAnswer: Coordinate): Promise<boolean> {
    const puzzleData = await redis.get(`puzzle:${puzzleId}`);
    if (!puzzleData) {
      throw new Error('Puzzle not found');
    }

    const puzzle: PuzzleConfiguration = JSON.parse(puzzleData);

    return (
      puzzle.correctExit.row === playerAnswer.row && puzzle.correctExit.col === playerAnswer.col
    );
  }

  /**
   * Calculate final score with hint and time multipliers
   */
  calculateScore(
    baseScore: number,
    hintsUsed: number,
    timeElapsed: number,
    maxTime: number,
    isCorrect: boolean
  ): ScoreCalculation {
    if (!isCorrect) {
      return {
        baseScore,
        hintMultiplier: 0,
        timeMultiplier: 0,
        finalScore: 0,
        isCorrect: false,
      };
    }

    // Hint multiplier: 1.0, 0.8, 0.6, 0.4, 0.2 for 0-4 hints
    const hintMultiplier = Math.max(0.2, 1.0 - hintsUsed * 0.2);

    // Time multiplier: bonus for faster completion
    const timeRatio = Math.min(timeElapsed / maxTime, 1.0);
    const timeMultiplier = Math.max(0.5, 1.5 - timeRatio);

    const finalScore = Math.round(baseScore * hintMultiplier * timeMultiplier);

    return {
      baseScore,
      hintMultiplier,
      timeMultiplier,
      finalScore,
      isCorrect: true,
    };
  }

  /**
   * Get puzzle by ID from Redis
   */
  async getPuzzle(puzzleId: string): Promise<PuzzleConfiguration | null> {
    const puzzleData = await redis.get(`puzzle:${puzzleId}`);
    if (!puzzleData) {
      return null;
    }
    return JSON.parse(puzzleData);
  }

  // Private helper methods

  private createGrid(size: number, difficulty: DifficultyLevel): GridCell[][] {
    const grid: GridCell[][] = [];

    // Initialize empty grid
    for (let row = 0; row < size; row++) {
      grid[row] = [];
      for (let col = 0; col < size; col++) {
        const coordinate: Coordinate = {
          row,
          col,
          label: `${String.fromCharCode(65 + col)}${row + 1}`,
        };

        grid[row][col] = {
          material: 'empty',
          coordinate,
          color: GameEngine.MATERIAL_COLORS.empty,
          reflectionBehavior: { type: 'empty', behavior: 'reflect' },
        };
      }
    }

    // Add materials based on difficulty
    const materialCount = this.getMaterialCount(difficulty);
    this.placeMaterials(grid, materialCount);

    return grid;
  }

  private getMaterialCount(difficulty: DifficultyLevel): Record<MaterialType, number> {
    switch (difficulty) {
      case 'easy':
        return { mirror: 3, water: 1, glass: 1, metal: 1, absorber: 1, empty: 0 };
      case 'medium':
        return { mirror: 5, water: 2, glass: 2, metal: 2, absorber: 1, empty: 0 };
      case 'hard':
        return { mirror: 8, water: 3, glass: 3, metal: 3, absorber: 2, empty: 0 };
    }
  }

  private placeMaterials(grid: GridCell[][], materialCount: Record<MaterialType, number>): void {
    const availablePositions: Coordinate[] = [];

    // Collect all positions except edges (laser entry/exit)
    for (let row = 1; row < grid.length - 1; row++) {
      for (let col = 1; col < grid[0].length - 1; col++) {
        availablePositions.push(grid[row][col].coordinate);
      }
    }

    // Shuffle positions
    for (let i = availablePositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availablePositions[i], availablePositions[j]] = [
        availablePositions[j],
        availablePositions[i],
      ];
    }

    let positionIndex = 0;

    // Place each material type
    Object.entries(materialCount).forEach(([material, count]) => {
      if (material === 'empty') return;

      for (let i = 0; i < count && positionIndex < availablePositions.length; i++) {
        const pos = availablePositions[positionIndex++];
        const cell = grid[pos.row][pos.col];

        cell.material = material as MaterialType;
        cell.color = GameEngine.MATERIAL_COLORS[material as MaterialType];
        cell.reflectionBehavior = this.getReflectionRule(material as MaterialType);
      }
    });
  }

  private getReflectionRule(material: MaterialType): ReflectionRule {
    switch (material) {
      case 'mirror':
        return { type: 'mirror', behavior: 'reflect', angle: 90 };
      case 'water':
        return { type: 'water', behavior: 'diffuse', probability: 0.8 };
      case 'glass':
        return { type: 'glass', behavior: 'split', probability: 0.5 };
      case 'metal':
        return { type: 'metal', behavior: 'reverse' };
      case 'absorber':
        return { type: 'absorber', behavior: 'absorb' };
      default:
        return { type: 'empty', behavior: 'reflect' };
    }
  }

  private generateLaserEntry(gridSize: number): Coordinate {
    const side = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left

    switch (side) {
      case 0: // Top edge
        return {
          row: 0,
          col: Math.floor(Math.random() * gridSize),
          label: `${String.fromCharCode(65 + Math.floor(Math.random() * gridSize))}1`,
        };
      case 1: // Right edge
        return {
          row: Math.floor(Math.random() * gridSize),
          col: gridSize - 1,
          label: `${String.fromCharCode(65 + gridSize - 1)}${Math.floor(Math.random() * gridSize) + 1}`,
        };
      case 2: // Bottom edge
        return {
          row: gridSize - 1,
          col: Math.floor(Math.random() * gridSize),
          label: `${String.fromCharCode(65 + Math.floor(Math.random() * gridSize))}${gridSize}`,
        };
      case 3: // Left edge
        return {
          row: Math.floor(Math.random() * gridSize),
          col: 0,
          label: `A${Math.floor(Math.random() * gridSize) + 1}`,
        };
      default:
        return { row: 0, col: 0, label: 'A1' };
    }
  }

  private getInitialDirection(entry: Coordinate, gridSize: number): Direction {
    if (entry.row === 0) return 'south';
    if (entry.row === gridSize - 1) return 'north';
    if (entry.col === 0) return 'east';
    if (entry.col === gridSize - 1) return 'west';
    return 'south'; // fallback
  }

  private getNextPosition(pos: Coordinate, direction: Direction): Coordinate {
    switch (direction) {
      case 'north':
        return { ...pos, row: pos.row - 1 };
      case 'south':
        return { ...pos, row: pos.row + 1 };
      case 'east':
        return { ...pos, col: pos.col + 1 };
      case 'west':
        return { ...pos, col: pos.col - 1 };
    }
  }

  private isOutOfBounds(pos: Coordinate, gridSize: number): boolean {
    return pos.row < 0 || pos.row >= gridSize || pos.col < 0 || pos.col >= gridSize;
  }

  private getExitCoordinate(pos: Coordinate, direction: Direction, gridSize: number): Coordinate {
    const exitPos = this.getNextPosition(pos, direction);
    return {
      ...exitPos,
      label: `${String.fromCharCode(65 + Math.max(0, Math.min(gridSize - 1, exitPos.col)))}${Math.max(1, Math.min(gridSize, exitPos.row + 1))}`,
    };
  }

  private applyMaterialInteraction(
    material: MaterialType,
    direction: Direction,
    position: Coordinate
  ): { absorbed: boolean; newDirection?: Direction } {
    switch (material) {
      case 'mirror':
        return { absorbed: false, newDirection: this.reflectDirection(direction) };
      case 'water':
        // Water has diffusion - random chance of slight direction change
        if (Math.random() < 0.2) {
          return { absorbed: false, newDirection: this.getRandomDirection(direction) };
        }
        return { absorbed: false, newDirection: this.reflectDirection(direction) };
      case 'glass':
        // Glass splits - 50% pass through, 50% reflect
        if (Math.random() < 0.5) {
          return { absorbed: false }; // Pass through
        }
        return { absorbed: false, newDirection: this.reflectDirection(direction) };
      case 'metal':
        return { absorbed: false, newDirection: this.reverseDirection(direction) };
      case 'absorber':
        return { absorbed: true };
      default:
        return { absorbed: false };
    }
  }

  private reflectDirection(direction: Direction): Direction {
    // Simple 90-degree reflection
    switch (direction) {
      case 'north':
        return 'east';
      case 'east':
        return 'south';
      case 'south':
        return 'west';
      case 'west':
        return 'north';
    }
  }

  private reverseDirection(direction: Direction): Direction {
    switch (direction) {
      case 'north':
        return 'south';
      case 'south':
        return 'north';
      case 'east':
        return 'west';
      case 'west':
        return 'east';
    }
  }

  private getRandomDirection(currentDirection: Direction): Direction {
    const directions: Direction[] = ['north', 'south', 'east', 'west'];
    const filtered = directions.filter((d) => d !== currentDirection);
    return filtered[Math.floor(Math.random() * filtered.length)];
  }
}

// Export singleton instance
export const gameEngine = new GameEngine();
