// Laser path validation utilities

import type { Coordinate, GridCell, LaserPath, DifficultyLevel, Direction } from '../types/game.js';
import { LaserEngine } from './laser-engine.js';
import { GRID_SIZES } from '../constants.js';
import { createCoordinate, isValidCoordinate } from '../utils.js';

export class PathValidator {
  /**
   * Validate that a puzzle has exactly one solution
   */
  static validatePuzzleSolvability(
    grid: GridCell[][],
    entryPoint: Coordinate,
    difficulty: DifficultyLevel
  ): ValidationResult {
    const initialDirection = LaserEngine.getEntryDirection(entryPoint, difficulty);
    const laserPath = LaserEngine.simulateLaserPath(grid, entryPoint, initialDirection, difficulty);

    if (!LaserEngine.isPathSolvable(laserPath)) {
      return {
        isValid: false,
        reason: 'Laser path does not reach a valid exit point',
        exitPoint: null,
      };
    }

    if (!laserPath.exitPoint) {
      return {
        isValid: false,
        reason: 'No exit point found',
        exitPoint: null,
      };
    }

    // Validate exit point is on grid boundary
    if (!this.isValidExitPoint(laserPath.exitPoint, difficulty)) {
      return {
        isValid: false,
        reason: 'Exit point is not on grid boundary',
        exitPoint: laserPath.exitPoint,
      };
    }

    return {
      isValid: true,
      reason: 'Puzzle is solvable',
      exitPoint: laserPath.exitPoint,
      laserPath,
    };
  }

  /**
   * Check if a coordinate is a valid exit point (on grid boundary)
   */
  private static isValidExitPoint(exitPoint: Coordinate, difficulty: DifficultyLevel): boolean {
    const gridSize = GRID_SIZES[difficulty];

    // Exit point should be just outside the grid boundary
    return (
      (exitPoint.row === -1 && exitPoint.col >= 0 && exitPoint.col < gridSize) || // Top edge
      (exitPoint.row === gridSize && exitPoint.col >= 0 && exitPoint.col < gridSize) || // Bottom edge
      (exitPoint.col === -1 && exitPoint.row >= 0 && exitPoint.row < gridSize) || // Left edge
      (exitPoint.col === gridSize && exitPoint.row >= 0 && exitPoint.row < gridSize) // Right edge
    );
  }

  /**
   * Calculate puzzle complexity score
   */
  static calculateComplexity(laserPath: LaserPath, grid: GridCell[][]): ComplexityScore {
    const reflectionCount = this.countReflections(laserPath);
    const pathLength = laserPath.segments.length;
    const materialVariety = this.countMaterialTypes(grid);
    const quadrantsCovered = this.countQuadrantsCovered(laserPath, grid.length);

    const complexityScore =
      reflectionCount * 2 + pathLength * 1 + materialVariety * 3 + quadrantsCovered * 2;

    return {
      reflectionCount,
      pathLength,
      materialVariety,
      quadrantsCovered,
      totalScore: complexityScore,
    };
  }

  /**
   * Count the number of reflections in the laser path
   */
  private static countReflections(laserPath: LaserPath): number {
    let reflections = 0;
    let previousDirection: Direction | null = null;

    for (const segment of laserPath.segments) {
      if (previousDirection && segment.direction !== previousDirection) {
        reflections++;
      }
      previousDirection = segment.direction;
    }

    return reflections;
  }

  /**
   * Count unique material types in the grid
   */
  private static countMaterialTypes(grid: GridCell[][]): number {
    const materials = new Set<string>();

    for (const row of grid) {
      for (const cell of row) {
        if (cell.material !== 'empty') {
          materials.add(cell.material);
        }
      }
    }

    return materials.size;
  }

  /**
   * Count how many quadrants the laser path covers
   */
  private static countQuadrantsCovered(laserPath: LaserPath, gridSize: number): number {
    const quadrants = new Set<number>();
    const midRow = Math.floor(gridSize / 2);
    const midCol = Math.floor(gridSize / 2);

    for (const segment of laserPath.segments) {
      const startQuadrant = this.getCoordinateQuadrant(segment.start, midRow, midCol);
      const endQuadrant = this.getCoordinateQuadrant(segment.end, midRow, midCol);

      quadrants.add(startQuadrant);
      quadrants.add(endQuadrant);
    }

    return quadrants.size;
  }

  /**
   * Get quadrant for a coordinate
   */
  private static getCoordinateQuadrant(coord: Coordinate, midRow: number, midCol: number): number {
    if (coord.row < midRow && coord.col < midCol) return 0; // Top-left
    if (coord.row < midRow && coord.col >= midCol) return 1; // Top-right
    if (coord.row >= midRow && coord.col < midCol) return 2; // Bottom-left
    return 3; // Bottom-right
  }

  /**
   * Validate that puzzle difficulty matches expected complexity
   */
  static validateDifficultyLevel(
    complexity: ComplexityScore,
    expectedDifficulty: DifficultyLevel
  ): boolean {
    const difficultyThresholds = {
      easy: { min: 0, max: 15 },
      medium: { min: 10, max: 30 },
      hard: { min: 25, max: 50 },
    };

    const threshold = difficultyThresholds[expectedDifficulty];
    return complexity.totalScore >= threshold.min && complexity.totalScore <= threshold.max;
  }

  /**
   * Generate multiple entry points for testing puzzle uniqueness
   */
  static generateTestEntryPoints(difficulty: DifficultyLevel): Coordinate[] {
    const gridSize = GRID_SIZES[difficulty];
    const entryPoints: Coordinate[] = [];

    // Top edge
    for (let col = 0; col < gridSize; col++) {
      entryPoints.push(createCoordinate(0, col));
    }

    // Bottom edge
    for (let col = 0; col < gridSize; col++) {
      entryPoints.push(createCoordinate(gridSize - 1, col));
    }

    // Left edge
    for (let row = 1; row < gridSize - 1; row++) {
      entryPoints.push(createCoordinate(row, 0));
    }

    // Right edge
    for (let row = 1; row < gridSize - 1; row++) {
      entryPoints.push(createCoordinate(row, gridSize - 1));
    }

    return entryPoints;
  }

  /**
   * Validate that puzzle has unique solution from given entry point
   */
  static validateUniqueSolution(
    grid: GridCell[][],
    entryPoint: Coordinate,
    difficulty: DifficultyLevel
  ): boolean {
    const validation = this.validatePuzzleSolvability(grid, entryPoint, difficulty);
    return validation.isValid && validation.exitPoint !== null;
  }
}

export interface ValidationResult {
  isValid: boolean;
  reason: string;
  exitPoint: Coordinate | null;
  laserPath?: LaserPath;
}

export interface ComplexityScore {
  reflectionCount: number;
  pathLength: number;
  materialVariety: number;
  quadrantsCovered: number;
  totalScore: number;
}
