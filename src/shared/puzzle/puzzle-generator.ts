// Puzzle generator optimized for Devvit Web serverless environment

import type {
  PuzzleConfiguration,
  DifficultyLevel,
  GridCell,
  Coordinate,
  MaterialType,
} from '../types/game.js';
import {
  GRID_SIZES,
  BASE_SCORES,
  MAX_TIME_LIMITS,
  MATERIAL_COLORS,
  REFLECTION_BEHAVIORS,
} from '../constants.js';
import { LaserEngine } from '../physics/laser-engine.js';
import { PathValidator } from '../physics/path-validator.js';

export interface GenerationConfig {
  difficulty: DifficultyLevel;
  maxAttempts: number;
  materialDensity: number;
  ensureUniqueness: boolean;
}

export class PuzzleGenerator {
  private laserEngine: LaserEngine;
  private pathValidator: PathValidator;
  private maxGenerationTime = 25000; // 25 seconds max for Devvit Web timeout

  constructor() {
    this.laserEngine = new LaserEngine();
    this.pathValidator = new PathValidator();
  }

  /**
   * Generate a new puzzle with specified difficulty
   * Optimized for Devvit Web's 30-second timeout constraint
   */
  async generatePuzzle(config: GenerationConfig): Promise<PuzzleConfiguration> {
    const startTime = Date.now();
    const { difficulty, maxAttempts = 100 } = config;

    let attempts = 0;
    let bestPuzzle: PuzzleConfiguration | null = null;
    let bestComplexity = 0;

    while (attempts < maxAttempts && Date.now() - startTime < this.maxGenerationTime) {
      attempts++;

      try {
        const puzzle = this.createBasePuzzle(difficulty);
        this.populateGrid(puzzle, config);

        // Validate the puzzle
        const validation = this.pathValidator.validatePuzzleIntegrity(puzzle);

        if (validation.isValid) {
          // Calculate puzzle complexity for quality assessment
          const path = this.laserEngine.simulateLaserPath(puzzle);
          const complexity = this.calculatePuzzleComplexity(path, puzzle);

          // Keep the best puzzle found so far
          if (complexity > bestComplexity) {
            bestPuzzle = puzzle;
            bestComplexity = complexity;
          }

          // If we found a good enough puzzle, return it
          if (complexity >= this.getMinComplexity(difficulty)) {
            return puzzle;
          }
        }
      } catch (error) {
        // Continue to next attempt on error
        console.warn(`Puzzle generation attempt ${attempts} failed:`, error);
      }
    }

    // Return the best puzzle found, or throw if none found
    if (bestPuzzle) {
      return bestPuzzle;
    }

    throw new Error(`Failed to generate valid puzzle after ${attempts} attempts`);
  }

  /**
   * Create base puzzle structure with empty grid
   */
  private createBasePuzzle(difficulty: DifficultyLevel): PuzzleConfiguration {
    const gridSize = GRID_SIZES[difficulty];
    const grid: GridCell[][] = [];

    // Initialize empty grid
    for (let row = 0; row < gridSize; row++) {
      grid[row] = [];
      for (let col = 0; col < gridSize; col++) {
        grid[row][col] = {
          material: 'empty',
          coordinate: {
            row,
            col,
            label: this.coordinateToLabel(row, col),
          },
          color: MATERIAL_COLORS.empty,
          reflectionBehavior: REFLECTION_BEHAVIORS.empty,
        };
      }
    }

    // Generate laser entry point (always on grid edge)
    const laserEntry = this.generateLaserEntry(gridSize);

    return {
      id: `puzzle_${difficulty}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      difficulty,
      grid,
      laserEntry,
      correctExit: { row: 0, col: 0, label: 'A1' }, // Will be calculated after population
      maxTime: MAX_TIME_LIMITS[difficulty],
      baseScore: BASE_SCORES[difficulty],
      createdAt: new Date(),
    };
  }

  /**
   * Populate grid with materials based on difficulty
   */
  private populateGrid(puzzle: PuzzleConfiguration, config: GenerationConfig): void {
    const { difficulty, materialDensity = 0.3 } = config;
    const gridSize = puzzle.grid.length;

    // Calculate number of materials to place
    const totalCells = gridSize * gridSize;
    const materialCount = Math.floor(totalCells * materialDensity);

    // Material distribution based on difficulty
    const materialDistribution = this.getMaterialDistribution(difficulty);

    // Place materials randomly
    const placedPositions = new Set<string>();
    let materialsPlaced = 0;

    while (materialsPlaced < materialCount) {
      const row = Math.floor(Math.random() * gridSize);
      const col = Math.floor(Math.random() * gridSize);
      const posKey = `${row},${col}`;

      // Skip if position already used or is laser entry
      if (placedPositions.has(posKey) || this.isLaserEntryPosition(row, col, puzzle.laserEntry)) {
        continue;
      }

      // Select material type based on distribution
      const materialType = this.selectMaterialType(materialDistribution);

      // Place the material
      this.placeMaterial(puzzle.grid, row, col, materialType);
      placedPositions.add(posKey);
      materialsPlaced++;
    }

    // Calculate correct exit after placing materials
    puzzle.correctExit = this.calculateCorrectExit(puzzle);
  }

  /**
   * Get material distribution for difficulty level
   */
  private getMaterialDistribution(difficulty: DifficultyLevel): Record<MaterialType, number> {
    const distributions = {
      easy: {
        mirror: 0.6,
        water: 0.2,
        glass: 0.1,
        metal: 0.05,
        absorber: 0.05,
        empty: 0,
      },
      medium: {
        mirror: 0.4,
        water: 0.25,
        glass: 0.2,
        metal: 0.1,
        absorber: 0.05,
        empty: 0,
      },
      hard: {
        mirror: 0.3,
        water: 0.25,
        glass: 0.25,
        metal: 0.15,
        absorber: 0.05,
        empty: 0,
      },
    };

    return distributions[difficulty];
  }

  /**
   * Select material type based on weighted distribution
   */
  private selectMaterialType(distribution: Record<MaterialType, number>): MaterialType {
    const random = Math.random();
    let cumulative = 0;

    for (const [material, weight] of Object.entries(distribution)) {
      cumulative += weight;
      if (random <= cumulative) {
        return material as MaterialType;
      }
    }

    return 'mirror'; // Fallback
  }

  /**
   * Place material at specific grid position
   */
  private placeMaterial(
    grid: GridCell[][],
    row: number,
    col: number,
    material: MaterialType
  ): void {
    grid[row][col] = {
      material,
      coordinate: {
        row,
        col,
        label: this.coordinateToLabel(row, col),
      },
      color: MATERIAL_COLORS[material],
      reflectionBehavior: REFLECTION_BEHAVIORS[material],
    };
  }

  /**
   * Generate laser entry point on grid edge
   */
  private generateLaserEntry(gridSize: number): Coordinate {
    const edges = [
      // Top edge
      ...Array.from({ length: gridSize }, (_, i) => ({ row: 0, col: i })),
      // Bottom edge
      ...Array.from({ length: gridSize }, (_, i) => ({ row: gridSize - 1, col: i })),
      // Left edge (excluding corners)
      ...Array.from({ length: gridSize - 2 }, (_, i) => ({ row: i + 1, col: 0 })),
      // Right edge (excluding corners)
      ...Array.from({ length: gridSize - 2 }, (_, i) => ({ row: i + 1, col: gridSize - 1 })),
    ];

    const randomEdge = edges[Math.floor(Math.random() * edges.length)];

    return {
      row: randomEdge.row,
      col: randomEdge.col,
      label: this.coordinateToLabel(randomEdge.row, randomEdge.col),
    };
  }

  /**
   * Check if position is the laser entry position
   */
  private isLaserEntryPosition(row: number, col: number, laserEntry: Coordinate): boolean {
    return row === laserEntry.row && col === laserEntry.col;
  }

  /**
   * Calculate correct exit point by simulating laser path
   */
  private calculateCorrectExit(puzzle: PuzzleConfiguration): Coordinate {
    const path = this.laserEngine.simulateLaserPath(puzzle);

    if (!path.exitPoint) {
      throw new Error('Generated puzzle has no valid exit point');
    }

    return path.exitPoint;
  }

  /**
   * Calculate puzzle complexity for quality assessment
   */
  private calculatePuzzleComplexity(path: any, puzzle: PuzzleConfiguration): number {
    let complexity = 0;

    // Base complexity from path length
    complexity += path.segments.length * 2;

    // Bonus for material interactions
    const materialInteractions = path.segments.filter((s: any) => s.material !== 'empty').length;
    complexity += materialInteractions * 3;

    // Bonus for direction changes
    let directionChanges = 0;
    for (let i = 1; i < path.segments.length; i++) {
      if (path.segments[i].direction !== path.segments[i - 1].direction) {
        directionChanges++;
      }
    }
    complexity += directionChanges * 4;

    // Penalty for too simple or too complex paths
    const idealLength = puzzle.grid.length * 1.5;
    const lengthDiff = Math.abs(path.segments.length - idealLength);
    complexity -= lengthDiff * 2;

    return Math.max(0, complexity);
  }

  /**
   * Get minimum complexity threshold for difficulty
   */
  private getMinComplexity(difficulty: DifficultyLevel): number {
    const thresholds = {
      easy: 15,
      medium: 25,
      hard: 40,
    };
    return thresholds[difficulty];
  }

  /**
   * Generate puzzle hash for uniqueness checking
   * Optimized for Redis storage in Devvit Web
   */
  generatePuzzleHash(puzzle: PuzzleConfiguration): string {
    // Create a simplified representation for hashing
    const gridHash = puzzle.grid
      .map((row) => row.map((cell) => cell.material.charAt(0)).join(''))
      .join('|');

    const entryHash = `${puzzle.laserEntry.row},${puzzle.laserEntry.col}`;
    const exitHash = `${puzzle.correctExit.row},${puzzle.correctExit.col}`;

    // Combine all elements and create hash
    const combined = `${gridHash}:${entryHash}:${exitHash}:${puzzle.difficulty}`;

    // Simple hash function (for Devvit Web compatibility)
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Validate puzzle uniqueness against existing puzzles
   * Optimized for Redis queries in Devvit Web
   */
  async validateUniqueness(
    puzzle: PuzzleConfiguration,
    existingHashes: Set<string>
  ): Promise<boolean> {
    const puzzleHash = this.generatePuzzleHash(puzzle);
    return !existingHashes.has(puzzleHash);
  }

  /**
   * Generate multiple puzzle variations
   * Useful for daily puzzle generation
   */
  async generatePuzzleSet(
    difficulties: DifficultyLevel[],
    existingHashes: Set<string> = new Set()
  ): Promise<PuzzleConfiguration[]> {
    const puzzles: PuzzleConfiguration[] = [];

    for (const difficulty of difficulties) {
      const config: GenerationConfig = {
        difficulty,
        maxAttempts: 50,
        materialDensity: this.getMaterialDensity(difficulty),
        ensureUniqueness: true,
      };

      let attempts = 0;
      let puzzle: PuzzleConfiguration | null = null;

      while (attempts < 10 && !puzzle) {
        attempts++;
        try {
          const candidate = await this.generatePuzzle(config);
          const isUnique = await this.validateUniqueness(candidate, existingHashes);

          if (isUnique) {
            puzzle = candidate;
            existingHashes.add(this.generatePuzzleHash(candidate));
          }
        } catch (error) {
          console.warn(`Failed to generate ${difficulty} puzzle, attempt ${attempts}:`, error);
        }
      }

      if (puzzle) {
        puzzles.push(puzzle);
      } else {
        throw new Error(`Failed to generate unique ${difficulty} puzzle`);
      }
    }

    return puzzles;
  }

  /**
   * Get material density based on difficulty
   */
  private getMaterialDensity(difficulty: DifficultyLevel): number {
    const densities = {
      easy: 0.25,
      medium: 0.35,
      hard: 0.45,
    };
    return densities[difficulty];
  }

  /**
   * Convert row/col to coordinate label
   */
  private coordinateToLabel(row: number, col: number): string {
    const colLetter = String.fromCharCode(65 + col);
    const rowNumber = row + 1;
    return `${colLetter}${rowNumber}`;
  }

  /**
   * Create puzzle preview data for client rendering
   * Optimized for Devvit Web's payload size limits
   */
  createPuzzlePreview(puzzle: PuzzleConfiguration): {
    id: string;
    difficulty: DifficultyLevel;
    gridSize: number;
    materialCount: number;
    estimatedComplexity: number;
    previewGrid: string[][];
  } {
    const gridSize = puzzle.grid.length;
    let materialCount = 0;

    // Create simplified preview grid
    const previewGrid = puzzle.grid.map((row) =>
      row.map((cell) => {
        if (cell.material !== 'empty') {
          materialCount++;
        }
        return cell.material.charAt(0).toUpperCase();
      })
    );

    // Estimate complexity without full simulation
    const estimatedComplexity = materialCount * 2 + gridSize;

    return {
      id: puzzle.id,
      difficulty: puzzle.difficulty,
      gridSize,
      materialCount,
      estimatedComplexity,
      previewGrid,
    };
  }
}
