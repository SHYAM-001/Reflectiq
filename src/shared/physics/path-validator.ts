// Path validation utilities for Devvit Web serverless environment

import type { Coordinate, LaserPath, PuzzleConfiguration } from '../types/game.js';
import { LaserEngine } from './laser-engine.js';

export class PathValidator {
  private laserEngine: LaserEngine;

  constructor() {
    this.laserEngine = new LaserEngine();
  }

  /**
   * Validate player's answer against the correct solution
   * Optimized for Devvit Web's fast response requirements
   */
  validateAnswer(
    puzzle: PuzzleConfiguration,
    playerAnswer: Coordinate
  ): {
    isCorrect: boolean;
    correctExit: Coordinate;
    playerExit: Coordinate;
    accuracy: number;
  } {
    // Get the correct laser path
    const correctPath = this.laserEngine.simulateLaserPath(puzzle);

    if (!correctPath.exitPoint) {
      throw new Error('Invalid puzzle: no exit point found');
    }

    const correctExit = correctPath.exitPoint;
    const isCorrect = this.coordinatesMatch(playerAnswer, correctExit);

    // Calculate accuracy based on distance from correct answer
    const accuracy = this.calculateAccuracy(playerAnswer, correctExit, puzzle.grid.length);

    return {
      isCorrect,
      correctExit,
      playerExit: playerAnswer,
      accuracy,
    };
  }

  /**
   * Check if two coordinates match exactly
   */
  private coordinatesMatch(coord1: Coordinate, coord2: Coordinate): boolean {
    return coord1.row === coord2.row && coord1.col === coord2.col;
  }

  /**
   * Calculate accuracy percentage based on distance from correct answer
   * Used for partial scoring in competitive scenarios
   */
  private calculateAccuracy(
    playerAnswer: Coordinate,
    correctAnswer: Coordinate,
    gridSize: number
  ): number {
    const distance = Math.sqrt(
      Math.pow(playerAnswer.row - correctAnswer.row, 2) +
        Math.pow(playerAnswer.col - correctAnswer.col, 2)
    );

    // Maximum possible distance is diagonal of grid
    const maxDistance = Math.sqrt(2 * Math.pow(gridSize - 1, 2));

    // Convert distance to accuracy percentage (closer = higher accuracy)
    const accuracy = Math.max(0, 1 - distance / maxDistance);
    return Math.round(accuracy * 100);
  }

  /**
   * Validate puzzle solvability and uniqueness
   * Critical for Devvit Web's deterministic requirements
   */
  validatePuzzleIntegrity(puzzle: PuzzleConfiguration): {
    isValid: boolean;
    hasSolution: boolean;
    hasUniqueSolution: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    let isValid = true;
    let hasSolution = false;
    let hasUniqueSolution = false;

    try {
      // Check basic puzzle structure
      if (!puzzle.grid || puzzle.grid.length === 0) {
        errors.push('Invalid grid structure');
        isValid = false;
      }

      if (!puzzle.laserEntry || !puzzle.correctExit) {
        errors.push('Missing laser entry or exit points');
        isValid = false;
      }

      if (!isValid) {
        return { isValid, hasSolution, hasUniqueSolution, errors };
      }

      // Validate laser simulation
      const path = this.laserEngine.simulateLaserPath(puzzle);

      if (path.isComplete && path.exitPoint) {
        hasSolution = true;

        // Check if the solution matches the expected exit
        if (this.coordinatesMatch(path.exitPoint, puzzle.correctExit)) {
          hasUniqueSolution = true;
        } else {
          errors.push('Puzzle solution does not match expected exit point');
        }
      } else {
        errors.push('Puzzle has no valid solution');
      }
    } catch (error) {
      errors.push(`Simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      isValid = false;
    }

    return {
      isValid: isValid && hasSolution && hasUniqueSolution,
      hasSolution,
      hasUniqueSolution,
      errors,
    };
  }

  /**
   * Get hint path for a specific quadrant
   * Optimized for Devvit Web's payload size limits
   */
  getHintPath(puzzle: PuzzleConfiguration, quadrant: number): LaserPath {
    const quadrantSegments = this.laserEngine.getQuadrantPath(puzzle, quadrant);

    return {
      segments: quadrantSegments,
      exitPoint: null, // Don't reveal the exit in hints
      isComplete: false, // Partial path only
    };
  }

  /**
   * Calculate hint effectiveness
   * Used to determine score penalties
   */
  calculateHintValue(
    puzzle: PuzzleConfiguration,
    quadrant: number
  ): {
    segmentCount: number;
    coveragePercentage: number;
    difficulty: number;
  } {
    const fullPath = this.laserEngine.simulateLaserPath(puzzle);
    const hintPath = this.getHintPath(puzzle, quadrant);

    const totalSegments = fullPath.segments.length;
    const hintSegments = hintPath.segments.length;

    const coveragePercentage = totalSegments > 0 ? (hintSegments / totalSegments) * 100 : 0;

    // Calculate difficulty based on path complexity
    const difficulty = this.calculatePathComplexity(fullPath);

    return {
      segmentCount: hintSegments,
      coveragePercentage: Math.round(coveragePercentage),
      difficulty,
    };
  }

  /**
   * Calculate path complexity for difficulty assessment
   */
  private calculatePathComplexity(path: LaserPath): number {
    if (!path.segments.length) return 0;

    let complexity = 0;
    let directionChanges = 0;
    let materialInteractions = 0;

    for (let i = 0; i < path.segments.length; i++) {
      const segment = path.segments[i];

      // Count material interactions
      if (segment.material !== 'empty') {
        materialInteractions++;
      }

      // Count direction changes
      if (i > 0) {
        const prevSegment = path.segments[i - 1];
        if (prevSegment.direction !== segment.direction) {
          directionChanges++;
        }
      }
    }

    // Complexity formula: base path length + weighted interactions
    complexity = path.segments.length + directionChanges * 2 + materialInteractions * 1.5;

    return Math.round(complexity);
  }

  /**
   * Validate coordinate format for user input
   * Ensures proper format for Devvit Web API responses
   */
  validateCoordinateInput(input: string, gridSize: number): Coordinate | null {
    // Expected format: "A1", "B5", etc.
    const match = input
      .trim()
      .toUpperCase()
      .match(/^([A-Z])(\d+)$/);

    if (!match) return null;

    const colLetter = match[1];
    const rowNumber = parseInt(match[2], 10);

    // Convert to 0-based indices
    const col = colLetter.charCodeAt(0) - 65; // A=0, B=1, etc.
    const row = rowNumber - 1; // 1-based to 0-based

    // Validate bounds
    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) {
      return null;
    }

    return {
      row,
      col,
      label: input.trim().toUpperCase(),
    };
  }

  /**
   * Generate coordinate label from row/col indices
   */
  coordinateToLabel(row: number, col: number): string {
    const colLetter = String.fromCharCode(65 + col);
    const rowNumber = row + 1;
    return `${colLetter}${rowNumber}`;
  }
}
