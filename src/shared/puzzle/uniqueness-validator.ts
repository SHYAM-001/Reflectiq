// Puzzle uniqueness validation system

import type { PuzzleConfiguration, GridCell } from '../types/game.js';
import { generateGridHash } from '../utils.js';

export class UniquenessValidator {
  private static readonly SIMILARITY_THRESHOLD = 0.85;

  /**
   * Check if a puzzle is unique compared to historical puzzles
   */
  static validateUniqueness(
    newPuzzle: PuzzleConfiguration,
    historicalPuzzles: PuzzleConfiguration[]
  ): UniquenessResult {
    const newHash = generateGridHash(newPuzzle.grid);

    // Check for exact matches
    for (const historical of historicalPuzzles) {
      const historicalHash = generateGridHash(historical.grid);

      if (newHash === historicalHash) {
        return {
          isUnique: false,
          reason: 'Exact duplicate found',
          similarityScore: 1.0,
          conflictingPuzzleId: historical.id,
        };
      }
    }

    // Check for high similarity
    const similarityResults = this.calculateSimilarityScores(newPuzzle, historicalPuzzles);
    const highestSimilarity = Math.max(...similarityResults.map((r) => r.score));

    if (highestSimilarity > this.SIMILARITY_THRESHOLD) {
      const mostSimilar = similarityResults.find((r) => r.score === highestSimilarity);

      return {
        isUnique: false,
        reason: 'High similarity to existing puzzle',
        similarityScore: highestSimilarity,
        conflictingPuzzleId: mostSimilar?.puzzleId,
      };
    }

    return {
      isUnique: true,
      reason: 'Puzzle is sufficiently unique',
      similarityScore: highestSimilarity,
    };
  }

  /**
   * Calculate similarity scores between new puzzle and historical puzzles
   */
  private static calculateSimilarityScores(
    newPuzzle: PuzzleConfiguration,
    historicalPuzzles: PuzzleConfiguration[]
  ): SimilarityResult[] {
    return historicalPuzzles
      .filter((p) => p.difficulty === newPuzzle.difficulty) // Only compare same difficulty
      .map((historical) => ({
        puzzleId: historical.id,
        score: this.calculateGridSimilarity(newPuzzle.grid, historical.grid),
      }));
  }

  /**
   * Calculate similarity between two grids
   */
  private static calculateGridSimilarity(grid1: GridCell[][], grid2: GridCell[][]): number {
    if (grid1.length !== grid2.length || grid1[0].length !== grid2[0].length) {
      return 0; // Different sizes are not similar
    }

    let matchingCells = 0;
    let totalCells = 0;

    for (let row = 0; row < grid1.length; row++) {
      for (let col = 0; col < grid1[row].length; col++) {
        totalCells++;

        if (grid1[row][col].material === grid2[row][col].material) {
          matchingCells++;
        }
      }
    }

    return matchingCells / totalCells;
  }

  /**
   * Generate a structural fingerprint for faster comparison
   */
  static generateStructuralFingerprint(puzzle: PuzzleConfiguration): StructuralFingerprint {
    const materialCounts = this.countMaterials(puzzle.grid);
    const materialPositions = this.getMaterialPositions(puzzle.grid);
    const entryPosition = `${puzzle.laserEntry.row},${puzzle.laserEntry.col}`;

    return {
      difficulty: puzzle.difficulty,
      gridSize: puzzle.grid.length,
      materialCounts,
      materialPositions: this.hashPositions(materialPositions),
      entryPosition,
      structuralHash: this.generateStructuralHash(materialCounts, entryPosition),
    };
  }

  /**
   * Count materials in the grid
   */
  private static countMaterials(grid: GridCell[][]): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const row of grid) {
      for (const cell of row) {
        counts[cell.material] = (counts[cell.material] || 0) + 1;
      }
    }

    return counts;
  }

  /**
   * Get positions of all non-empty materials
   */
  private static getMaterialPositions(grid: GridCell[][]): Record<string, string[]> {
    const positions: Record<string, string[]> = {};

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const material = grid[row][col].material;

        if (material !== 'empty') {
          if (!positions[material]) {
            positions[material] = [];
          }
          positions[material].push(`${row},${col}`);
        }
      }
    }

    return positions;
  }

  /**
   * Hash material positions for comparison
   */
  private static hashPositions(positions: Record<string, string[]>): string {
    const sortedMaterials = Object.keys(positions).sort();
    const positionString = sortedMaterials
      .map((material) => `${material}:${positions[material].sort().join(';')}`)
      .join('|');

    return this.simpleHash(positionString);
  }

  /**
   * Generate structural hash for quick comparison
   */
  private static generateStructuralHash(
    materialCounts: Record<string, number>,
    entryPosition: string
  ): string {
    const countsString = Object.keys(materialCounts)
      .sort()
      .map((material) => `${material}:${materialCounts[material]}`)
      .join('|');

    return this.simpleHash(`${countsString}|${entryPosition}`);
  }

  /**
   * Simple hash function for strings
   */
  private static simpleHash(str: string): string {
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(36);
  }

  /**
   * Compare structural fingerprints for quick filtering
   */
  static compareFingerprints(
    fingerprint1: StructuralFingerprint,
    fingerprint2: StructuralFingerprint
  ): boolean {
    // Quick checks for obvious differences
    if (fingerprint1.difficulty !== fingerprint2.difficulty) return false;
    if (fingerprint1.gridSize !== fingerprint2.gridSize) return false;
    if (fingerprint1.structuralHash === fingerprint2.structuralHash) return true;

    // Compare material counts
    const materials1 = Object.keys(fingerprint1.materialCounts);
    const materials2 = Object.keys(fingerprint2.materialCounts);

    if (materials1.length !== materials2.length) return false;

    for (const material of materials1) {
      if (fingerprint1.materialCounts[material] !== fingerprint2.materialCounts[material]) {
        return false;
      }
    }

    return false; // Different if we reach here
  }

  /**
   * Batch validate uniqueness for multiple puzzles
   */
  static batchValidateUniqueness(
    newPuzzles: PuzzleConfiguration[],
    historicalPuzzles: PuzzleConfiguration[]
  ): BatchUniquenessResult {
    const results: UniquenessResult[] = [];
    const uniquePuzzles: PuzzleConfiguration[] = [];
    const duplicates: PuzzleConfiguration[] = [];

    for (const puzzle of newPuzzles) {
      const result = this.validateUniqueness(puzzle, [...historicalPuzzles, ...uniquePuzzles]);
      results.push(result);

      if (result.isUnique) {
        uniquePuzzles.push(puzzle);
      } else {
        duplicates.push(puzzle);
      }
    }

    return {
      totalPuzzles: newPuzzles.length,
      uniquePuzzles: uniquePuzzles.length,
      duplicates: duplicates.length,
      results,
      validPuzzles: uniquePuzzles,
    };
  }
}

export interface UniquenessResult {
  isUnique: boolean;
  reason: string;
  similarityScore: number;
  conflictingPuzzleId?: string;
}

interface SimilarityResult {
  puzzleId: string;
  score: number;
}

export interface StructuralFingerprint {
  difficulty: string;
  gridSize: number;
  materialCounts: Record<string, number>;
  materialPositions: string;
  entryPosition: string;
  structuralHash: string;
}

export interface BatchUniquenessResult {
  totalPuzzles: number;
  uniquePuzzles: number;
  duplicates: number;
  results: UniquenessResult[];
  validPuzzles: PuzzleConfiguration[];
}
