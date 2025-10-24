// Puzzle generator for Logic Reflections game

import type {
  PuzzleConfiguration,
  GridCell,
  Coordinate,
  DifficultyLevel,
  MaterialType,
} from '../types/game.js';
import {
  GRID_SIZES,
  BASE_SCORES,
  MAX_TIME_LIMITS,
  MATERIAL_COLORS,
  REFLECTION_BEHAVIORS,
} from '../constants.js';
import { generatePuzzleId, createCoordinate, generateGridHash } from '../utils.js';
import { LaserEngine, PathValidator } from '../physics/index.js';

export class PuzzleGenerator {
  private static generatedHashes = new Set<string>();

  /**
   * Generate a new puzzle for the specified difficulty
   */
  static generatePuzzle(difficulty: DifficultyLevel): PuzzleConfiguration {
    const maxAttempts = 100;
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;

      const puzzle = this.createPuzzleAttempt(difficulty);
      const validation = PathValidator.validatePuzzleSolvability(
        puzzle.grid,
        puzzle.laserEntry,
        difficulty
      );

      if (validation.isValid && validation.exitPoint) {
        // Check complexity matches difficulty
        const complexity = PathValidator.calculateComplexity(validation.laserPath!, puzzle.grid);

        if (PathValidator.validateDifficultyLevel(complexity, difficulty)) {
          // Check uniqueness
          const gridHash = generateGridHash(puzzle.grid);

          if (!this.generatedHashes.has(gridHash)) {
            this.generatedHashes.add(gridHash);

            return {
              ...puzzle,
              correctExit: validation.exitPoint,
            };
          }
        }
      }
    }

    // Fallback: generate a simple valid puzzle
    return this.generateFallbackPuzzle(difficulty);
  }

  /**
   * Create a puzzle attempt with random material placement
   */
  private static createPuzzleAttempt(
    difficulty: DifficultyLevel
  ): Omit<PuzzleConfiguration, 'correctExit'> {
    const gridSize = GRID_SIZES[difficulty];
    const grid = this.initializeEmptyGrid(gridSize);

    // Place materials based on difficulty
    this.placeMaterials(grid, difficulty);

    // Generate entry point
    const laserEntry = this.generateEntryPoint(difficulty);

    return {
      id: generatePuzzleId(),
      difficulty,
      grid,
      laserEntry,
      maxTime: MAX_TIME_LIMITS[difficulty],
      baseScore: BASE_SCORES[difficulty],
      createdAt: new Date(),
    };
  }

  /**
   * Initialize empty grid with all cells as 'empty'
   */
  private static initializeEmptyGrid(gridSize: number): GridCell[][] {
    const grid: GridCell[][] = [];

    for (let row = 0; row < gridSize; row++) {
      grid[row] = [];
      for (let col = 0; col < gridSize; col++) {
        grid[row][col] = this.createGridCell('empty', row, col);
      }
    }

    return grid;
  }

  /**
   * Create a grid cell with specified material
   */
  private static createGridCell(material: MaterialType, row: number, col: number): GridCell {
    return {
      material,
      coordinate: createCoordinate(row, col),
      color: MATERIAL_COLORS[material],
      reflectionBehavior: REFLECTION_BEHAVIORS[material],
    };
  }

  /**
   * Place materials in the grid based on difficulty
   */
  private static placeMaterials(grid: GridCell[][], difficulty: DifficultyLevel): void {
    const gridSize = grid.length;
    const materialCounts = this.getMaterialCounts(difficulty);

    // Place mirrors
    this.placeMaterialType(grid, 'mirror', materialCounts.mirrors);

    // Place additional materials based on difficulty
    if (difficulty !== 'easy') {
      this.placeMaterialType(grid, 'water', materialCounts.water);
      this.placeMaterialType(grid, 'absorber', materialCounts.absorbers);
    }

    if (difficulty === 'hard') {
      this.placeMaterialType(grid, 'glass', materialCounts.glass);
      this.placeMaterialType(grid, 'metal', materialCounts.metal);
    }
  }

  /**
   * Get material counts for each difficulty level
   */
  private static getMaterialCounts(difficulty: DifficultyLevel): MaterialCounts {
    const gridSize = GRID_SIZES[difficulty];
    const totalCells = gridSize * gridSize;

    switch (difficulty) {
      case 'easy':
        return {
          mirrors: Math.floor(totalCells * 0.15), // 15% mirrors
          water: 0,
          glass: 0,
          metal: 0,
          absorbers: Math.floor(totalCells * 0.05), // 5% absorbers
        };

      case 'medium':
        return {
          mirrors: Math.floor(totalCells * 0.12),
          water: Math.floor(totalCells * 0.08),
          glass: 0,
          metal: 0,
          absorbers: Math.floor(totalCells * 0.08),
        };

      case 'hard':
        return {
          mirrors: Math.floor(totalCells * 0.1),
          water: Math.floor(totalCells * 0.08),
          glass: Math.floor(totalCells * 0.06),
          metal: Math.floor(totalCells * 0.04),
          absorbers: Math.floor(totalCells * 0.1),
        };

      default:
        return { mirrors: 0, water: 0, glass: 0, metal: 0, absorbers: 0 };
    }
  }

  /**
   * Place a specific material type randomly in the grid
   */
  private static placeMaterialType(
    grid: GridCell[][],
    material: MaterialType,
    count: number
  ): void {
    const gridSize = grid.length;
    let placed = 0;
    const maxAttempts = count * 10;
    let attempts = 0;

    while (placed < count && attempts < maxAttempts) {
      attempts++;

      const row = Math.floor(Math.random() * gridSize);
      const col = Math.floor(Math.random() * gridSize);

      // Only place on empty cells
      if (grid[row][col].material === 'empty') {
        grid[row][col] = this.createGridCell(material, row, col);
        placed++;
      }
    }
  }

  /**
   * Generate a random entry point on the grid boundary
   */
  private static generateEntryPoint(difficulty: DifficultyLevel): Coordinate {
    const gridSize = GRID_SIZES[difficulty];
    const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left

    switch (edge) {
      case 0: // Top edge
        return createCoordinate(0, Math.floor(Math.random() * gridSize));
      case 1: // Right edge
        return createCoordinate(Math.floor(Math.random() * gridSize), gridSize - 1);
      case 2: // Bottom edge
        return createCoordinate(gridSize - 1, Math.floor(Math.random() * gridSize));
      case 3: // Left edge
        return createCoordinate(Math.floor(Math.random() * gridSize), 0);
      default:
        return createCoordinate(0, 0);
    }
  }

  /**
   * Generate a fallback puzzle that's guaranteed to be solvable
   */
  private static generateFallbackPuzzle(difficulty: DifficultyLevel): PuzzleConfiguration {
    const gridSize = GRID_SIZES[difficulty];
    const grid = this.initializeEmptyGrid(gridSize);

    // Create a simple path with minimal materials
    const laserEntry = createCoordinate(0, 0);

    // Place a single mirror to create a simple reflection
    if (gridSize > 2) {
      grid[1][1] = this.createGridCell('mirror', 1, 1);
    }

    // Simulate to find exit
    const initialDirection = LaserEngine.getEntryDirection(laserEntry, difficulty);
    const laserPath = LaserEngine.simulateLaserPath(grid, laserEntry, initialDirection, difficulty);

    return {
      id: generatePuzzleId(),
      difficulty,
      grid,
      laserEntry,
      correctExit: laserPath.exitPoint || createCoordinate(-1, 0),
      maxTime: MAX_TIME_LIMITS[difficulty],
      baseScore: BASE_SCORES[difficulty],
      createdAt: new Date(),
    };
  }

  /**
   * Validate puzzle uniqueness against historical puzzles
   */
  static validateUniqueness(puzzle: PuzzleConfiguration): boolean {
    const gridHash = generateGridHash(puzzle.grid);
    return !this.generatedHashes.has(gridHash);
  }

  /**
   * Add puzzle hash to uniqueness tracking
   */
  static addToUniquenessList(puzzle: PuzzleConfiguration): void {
    const gridHash = generateGridHash(puzzle.grid);
    this.generatedHashes.add(gridHash);
  }

  /**
   * Load historical puzzle hashes for uniqueness checking
   */
  static loadHistoricalHashes(hashes: string[]): void {
    hashes.forEach((hash) => this.generatedHashes.add(hash));
  }

  /**
   * Generate multiple puzzles for daily set
   */
  static generateDailyPuzzleSet(): {
    easy: PuzzleConfiguration;
    medium: PuzzleConfiguration;
    hard: PuzzleConfiguration;
  } {
    return {
      easy: this.generatePuzzle('easy'),
      medium: this.generatePuzzle('medium'),
      hard: this.generatePuzzle('hard'),
    };
  }

  /**
   * Test puzzle solvability with multiple entry points
   */
  static testPuzzleRobustness(puzzle: PuzzleConfiguration): RobustnessResult {
    const testEntryPoints = PathValidator.generateTestEntryPoints(puzzle.difficulty);
    const results: boolean[] = [];

    for (const entryPoint of testEntryPoints) {
      const isUnique = PathValidator.validateUniqueSolution(
        puzzle.grid,
        entryPoint,
        puzzle.difficulty
      );
      results.push(isUnique);
    }

    const successRate = results.filter((r) => r).length / results.length;

    return {
      totalTests: results.length,
      successfulTests: results.filter((r) => r).length,
      successRate,
      isRobust: successRate >= 0.8, // 80% success rate threshold
    };
  }
}

interface MaterialCounts {
  mirrors: number;
  water: number;
  glass: number;
  metal: number;
  absorbers: number;
}

export interface RobustnessResult {
  totalTests: number;
  successfulTests: number;
  successRate: number;
  isRobust: boolean;
}
