/**
 * Strategic Point Placement Service for Guaranteed Puzzle Generation
 * Handles intelligent entry/exit point selection with spacing constraints
 */

import { GridPosition, Difficulty } from '../types/puzzle.js';
import { EntryExitPair, SpacingConfig } from '../types/guaranteed-generation.js';
import { SPACING_CONSTRAINTS, POSITION_SCORING } from '../constants/guaranteed-generation.js';
import {
  getAllExitPositions,
  getManhattanDistance,
  getEuclideanDistance,
  isWithinBounds,
  positionsEqual,
} from '../physics/grid.js';

// Import performance optimization for server-side caching
let performanceOptimization: any = null;
try {
  // Dynamic import for server-side only
  if (typeof window === 'undefined') {
    performanceOptimization =
      require('../../server/services/PerformanceOptimizationService.js').performanceOptimization;
  }
} catch (error) {
  // Client-side or import not available - continue without caching
}

/**
 * Service for strategic placement of entry and exit points
 * Implements spacing constraints and ranking algorithms for optimal puzzle generation
 */
export class PointPlacementService {
  private static instance: PointPlacementService;

  public static getInstance(): PointPlacementService {
    if (!PointPlacementService.instance) {
      PointPlacementService.instance = new PointPlacementService();
    }
    return PointPlacementService.instance;
  }

  /**
   * Get all valid boundary positions for entry/exit points
   * Returns array of [x, y] coordinates on the grid boundary
   */
  public getBoundaryPositions(gridSize: number): GridPosition[] {
    return getAllExitPositions(gridSize);
  }

  /**
   * Calculate distance between two grid positions
   * Uses Manhattan distance as primary metric for grid-based puzzles
   */
  public calculateDistance(pos1: GridPosition, pos2: GridPosition): number {
    return getManhattanDistance(pos1, pos2);
  }

  /**
   * Validate spacing constraints between entry and exit points
   * Checks minimum distance requirements based on difficulty level
   */
  public validateSpacing(entry: GridPosition, exit: GridPosition, minDistance: number): boolean {
    // Ensure positions are different
    if (positionsEqual(entry, exit)) {
      return false;
    }

    // Check minimum distance requirement
    const distance = this.calculateDistance(entry, exit);
    return distance >= minDistance;
  }

  /**
   * Generate and rank multiple entry/exit pair candidates
   * Returns sorted array with best candidates first
   * Uses intelligent caching for performance optimization
   */
  public async selectEntryExitPairs(
    difficulty: Difficulty,
    gridSize: number
  ): Promise<EntryExitPair[]> {
    // Use performance optimization caching if available (server-side)
    if (performanceOptimization) {
      return await performanceOptimization.getOptimizedEntryExitPairs(difficulty, gridSize, () =>
        this.generateEntryExitPairs(difficulty, gridSize)
      );
    }

    // Fallback to direct generation (client-side or when caching unavailable)
    return this.generateEntryExitPairs(difficulty, gridSize);
  }

  /**
   * Generate entry/exit pairs without caching (internal method)
   */
  private async generateEntryExitPairs(
    difficulty: Difficulty,
    gridSize: number
  ): Promise<EntryExitPair[]> {
    const constraints = SPACING_CONSTRAINTS[difficulty];
    const boundaryPositions = this.getBoundaryPositions(gridSize);
    const candidates: EntryExitPair[] = [];

    // Generate all valid entry/exit combinations
    for (const entry of boundaryPositions) {
      for (const exit of boundaryPositions) {
        // Skip if same position
        if (positionsEqual(entry, exit)) {
          continue;
        }

        const distance = this.calculateDistance(entry, exit);

        // Check minimum spacing constraint
        if (distance >= constraints.minDistance) {
          const validationScore = this.calculateValidationScore(
            entry,
            exit,
            distance,
            difficulty,
            gridSize,
            constraints
          );

          const pair: EntryExitPair = {
            entry,
            exit,
            distance,
            difficulty,
            validationScore,
            placementType: this.getPlacementType(entry, exit, gridSize),
          };

          candidates.push(pair);
        }
      }
    }

    // Sort by validation score (highest first)
    candidates.sort((a, b) => b.validationScore - a.validationScore);

    // Limit to reasonable number of candidates to prevent excessive processing
    const maxCandidates = Math.min(candidates.length, constraints.maxSearchAttempts);
    return candidates.slice(0, maxCandidates);
  }

  /**
   * Calculate validation score for an entry/exit pair
   * Higher scores indicate better strategic placement
   */
  private calculateValidationScore(
    entry: GridPosition,
    exit: GridPosition,
    distance: number,
    difficulty: Difficulty,
    gridSize: number,
    constraints: SpacingConfig
  ): number {
    let score = 0;

    // Base score from distance (prefer distances closer to preferred)
    const distanceFromPreferred = Math.abs(distance - constraints.preferredDistance);
    const maxDistanceDeviation = Math.max(
      constraints.preferredDistance - constraints.minDistance,
      gridSize * 2 - constraints.preferredDistance
    );
    const distanceScore = 1 - distanceFromPreferred / maxDistanceDeviation;
    score += distanceScore * 40; // 40% weight for distance

    // Position type bonuses
    const entryPositionScore = this.getPositionScore(entry, gridSize, difficulty);
    const exitPositionScore = this.getPositionScore(exit, gridSize, difficulty);
    score += (entryPositionScore + exitPositionScore) * 20; // 40% weight for position types

    // Diagonal preference (creates more interesting paths)
    const euclideanDistance = getEuclideanDistance(entry, exit);
    const diagonalRatio = euclideanDistance / distance; // Higher for more diagonal paths
    score += diagonalRatio * 10; // 10% weight for diagonal preference

    // Opposite side preference (entry and exit on different sides)
    const oppositeSideBonus = this.getOppositeSideBonus(entry, exit, gridSize);
    score += oppositeSideBonus * 10; // 10% weight for opposite sides

    return Math.round(score * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get position score based on strategic value (corner > edge > center)
   */
  private getPositionScore(
    position: GridPosition,
    gridSize: number,
    difficulty: Difficulty
  ): number {
    const [x, y] = position;
    const isCorner = this.isCornerPosition(position, gridSize);
    const isEdge = this.isEdgePosition(position, gridSize);

    if (isCorner) {
      const baseScore = POSITION_SCORING.corner.baseScore;
      const multiplier = POSITION_SCORING.corner.difficultyMultiplier[difficulty];
      return baseScore * multiplier;
    } else if (isEdge) {
      const baseScore = POSITION_SCORING.edge.baseScore;
      const multiplier = POSITION_SCORING.edge.difficultyMultiplier[difficulty];
      return baseScore * multiplier;
    } else {
      // Center positions (shouldn't occur for boundary positions, but included for completeness)
      const baseScore = POSITION_SCORING.center.baseScore;
      const multiplier = POSITION_SCORING.center.difficultyMultiplier[difficulty];
      return baseScore * multiplier;
    }
  }

  /**
   * Check if position is a corner of the grid
   */
  private isCornerPosition(position: GridPosition, gridSize: number): boolean {
    const [x, y] = position;
    return (
      (x === 0 && y === 0) || // Top-left
      (x === gridSize - 1 && y === 0) || // Top-right
      (x === 0 && y === gridSize - 1) || // Bottom-left
      (x === gridSize - 1 && y === gridSize - 1) // Bottom-right
    );
  }

  /**
   * Check if position is on an edge (but not corner)
   */
  private isEdgePosition(position: GridPosition, gridSize: number): boolean {
    const [x, y] = position;
    const isOnBoundary = x === 0 || x === gridSize - 1 || y === 0 || y === gridSize - 1;
    const isCorner = this.isCornerPosition(position, gridSize);
    return isOnBoundary && !isCorner;
  }

  /**
   * Get placement type classification for the pair
   */
  private getPlacementType(
    entry: GridPosition,
    exit: GridPosition,
    gridSize: number
  ): 'corner' | 'edge' | 'optimal' {
    const entryIsCorner = this.isCornerPosition(entry, gridSize);
    const exitIsCorner = this.isCornerPosition(exit, gridSize);

    if (entryIsCorner && exitIsCorner) {
      return 'corner';
    } else if (entryIsCorner || exitIsCorner) {
      return 'optimal';
    } else {
      return 'edge';
    }
  }

  /**
   * Calculate bonus for entry/exit pairs on opposite sides of the grid
   */
  private getOppositeSideBonus(entry: GridPosition, exit: GridPosition, gridSize: number): number {
    const entrySide = this.getGridSide(entry, gridSize);
    const exitSide = this.getGridSide(exit, gridSize);

    // Define opposite side pairs
    const oppositePairs = [
      ['top', 'bottom'],
      ['left', 'right'],
    ];

    for (const [side1, side2] of oppositePairs) {
      if (
        (entrySide === side1 && exitSide === side2) ||
        (entrySide === side2 && exitSide === side1)
      ) {
        return 1.0; // Full bonus for opposite sides
      }
    }

    // Adjacent sides get partial bonus
    const adjacentPairs = [
      ['top', 'left'],
      ['top', 'right'],
      ['bottom', 'left'],
      ['bottom', 'right'],
    ];

    for (const [side1, side2] of adjacentPairs) {
      if (
        (entrySide === side1 && exitSide === side2) ||
        (entrySide === side2 && exitSide === side1)
      ) {
        return 0.5; // Partial bonus for adjacent sides
      }
    }

    return 0; // No bonus for same side
  }

  /**
   * Determine which side of the grid a position is on
   */
  private getGridSide(
    position: GridPosition,
    gridSize: number
  ): 'top' | 'right' | 'bottom' | 'left' {
    const [x, y] = position;

    if (y === 0) return 'top';
    if (y === gridSize - 1) return 'bottom';
    if (x === 0) return 'left';
    if (x === gridSize - 1) return 'right';

    // Fallback (shouldn't happen for boundary positions)
    return 'top';
  }

  /**
   * Validate that a position is within grid bounds and on boundary
   */
  public validatePosition(position: GridPosition, gridSize: number): boolean {
    if (!isWithinBounds(position, gridSize)) {
      return false;
    }

    const [x, y] = position;
    return x === 0 || x === gridSize - 1 || y === 0 || y === gridSize - 1;
  }

  /**
   * Get spacing constraints for a specific difficulty
   */
  public getSpacingConstraints(difficulty: Difficulty): SpacingConfig {
    return SPACING_CONSTRAINTS[difficulty];
  }
}
