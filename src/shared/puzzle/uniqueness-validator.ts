// Uniqueness validation for puzzles in Devvit Web Redis environment

import type { PuzzleConfiguration, DifficultyLevel } from '../types/game.js';

export interface PuzzleMetadata {
  hash: string;
  difficulty: DifficultyLevel;
  createdAt: Date;
  gridSize: number;
  materialCount: number;
  complexity: number;
}

export interface UniquenessResult {
  isUnique: boolean;
  similarPuzzles: string[];
  confidence: number;
  reason?: string;
}

export class UniquenessValidator {
  private similarityThreshold = 0.85; // 85% similarity threshold

  /**
   * Generate comprehensive puzzle fingerprint for uniqueness checking
   * Optimized for Redis storage and fast comparison
   */
  generatePuzzleFingerprint(puzzle: PuzzleConfiguration): PuzzleMetadata {
    const gridSize = puzzle.grid.length;
    let materialCount = 0;
    let complexity = 0;

    // Create structural hash
    const structuralElements: string[] = [];

    // Add grid structure
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const cell = puzzle.grid[row][col];
        if (cell.material !== 'empty') {
          materialCount++;
          structuralElements.push(`${cell.material}@${row},${col}`);
        }
      }
    }

    // Add laser entry and exit
    structuralElements.push(`entry@${puzzle.laserEntry.row},${puzzle.laserEntry.col}`);
    structuralElements.push(`exit@${puzzle.correctExit.row},${puzzle.correctExit.col}`);

    // Sort for consistent hashing
    structuralElements.sort();

    // Calculate complexity score
    complexity = this.calculateComplexityScore(puzzle);

    // Generate hash
    const hash = this.generateHash(structuralElements.join('|') + `|${puzzle.difficulty}`);

    return {
      hash,
      difficulty: puzzle.difficulty,
      createdAt: puzzle.createdAt,
      gridSize,
      materialCount,
      complexity,
    };
  }

  /**
   * Check uniqueness against existing puzzle metadata
   * Optimized for Redis batch operations
   */
  async checkUniqueness(
    puzzle: PuzzleConfiguration,
    existingMetadata: PuzzleMetadata[]
  ): Promise<UniquenessResult> {
    const newFingerprint = this.generatePuzzleFingerprint(puzzle);

    // Filter by difficulty and similar characteristics
    const candidates = existingMetadata.filter(
      (meta) =>
        meta.difficulty === newFingerprint.difficulty &&
        Math.abs(meta.gridSize - newFingerprint.gridSize) <= 1 &&
        Math.abs(meta.materialCount - newFingerprint.materialCount) <= 2
    );

    if (candidates.length === 0) {
      return {
        isUnique: true,
        similarPuzzles: [],
        confidence: 1.0,
      };
    }

    // Check for exact hash match
    const exactMatch = candidates.find((meta) => meta.hash === newFingerprint.hash);
    if (exactMatch) {
      return {
        isUnique: false,
        similarPuzzles: [exactMatch.hash],
        confidence: 1.0,
        reason: 'Exact duplicate found',
      };
    }

    // Check for structural similarity
    const similarities = await Promise.all(
      candidates.map(async (meta) => ({
        hash: meta.hash,
        similarity: await this.calculateStructuralSimilarity(puzzle, meta),
      }))
    );

    const highSimilarity = similarities.filter((s) => s.similarity >= this.similarityThreshold);

    if (highSimilarity.length > 0) {
      const maxSimilarity = Math.max(...highSimilarity.map((s) => s.similarity));
      return {
        isUnique: false,
        similarPuzzles: highSimilarity.map((s) => s.hash),
        confidence: maxSimilarity,
        reason: `High structural similarity (${Math.round(maxSimilarity * 100)}%)`,
      };
    }

    // Calculate overall confidence
    const maxSimilarity =
      similarities.length > 0 ? Math.max(...similarities.map((s) => s.similarity)) : 0;
    const confidence = 1 - maxSimilarity;

    return {
      isUnique: true,
      similarPuzzles: [],
      confidence,
    };
  }

  /**
   * Calculate structural similarity between puzzles
   * Fast comparison for Devvit Web's performance requirements
   */
  private async calculateStructuralSimilarity(
    puzzle: PuzzleConfiguration,
    metadata: PuzzleMetadata
  ): Promise<number> {
    // For performance, we'll use a simplified similarity calculation
    // based on the metadata rather than full puzzle comparison

    let similarity = 0;
    let factors = 0;

    // Grid size similarity
    const gridSizeDiff = Math.abs(puzzle.grid.length - metadata.gridSize);
    similarity += Math.max(0, 1 - gridSizeDiff / puzzle.grid.length);
    factors++;

    // Material count similarity
    const newMaterialCount = this.countMaterials(puzzle);
    const materialCountDiff = Math.abs(newMaterialCount - metadata.materialCount);
    const maxMaterials = Math.max(newMaterialCount, metadata.materialCount);
    if (maxMaterials > 0) {
      similarity += Math.max(0, 1 - materialCountDiff / maxMaterials);
      factors++;
    }

    // Complexity similarity
    const newComplexity = this.calculateComplexityScore(puzzle);
    const complexityDiff = Math.abs(newComplexity - metadata.complexity);
    const maxComplexity = Math.max(newComplexity, metadata.complexity);
    if (maxComplexity > 0) {
      similarity += Math.max(0, 1 - complexityDiff / maxComplexity);
      factors++;
    }

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Count non-empty materials in puzzle
   */
  private countMaterials(puzzle: PuzzleConfiguration): number {
    let count = 0;
    for (const row of puzzle.grid) {
      for (const cell of row) {
        if (cell.material !== 'empty') {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Calculate complexity score for puzzle
   */
  private calculateComplexityScore(puzzle: PuzzleConfiguration): number {
    let score = 0;
    const gridSize = puzzle.grid.length;

    // Base score from grid size
    score += gridSize * 2;

    // Score from material diversity
    const materials = new Set<string>();
    for (const row of puzzle.grid) {
      for (const cell of row) {
        if (cell.material !== 'empty') {
          materials.add(cell.material);
          score += 3; // Points per material
        }
      }
    }

    // Bonus for material diversity
    score += materials.size * 5;

    // Distance-based scoring (entry to exit)
    const entryExitDistance =
      Math.abs(puzzle.laserEntry.row - puzzle.correctExit.row) +
      Math.abs(puzzle.laserEntry.col - puzzle.correctExit.col);
    score += entryExitDistance * 2;

    return score;
  }

  /**
   * Generate hash from string input
   * Simple but effective hash for Devvit Web compatibility
   */
  private generateHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Create batch validation for multiple puzzles
   * Optimized for daily puzzle generation
   */
  async validatePuzzleBatch(
    puzzles: PuzzleConfiguration[],
    existingMetadata: PuzzleMetadata[]
  ): Promise<Map<string, UniquenessResult>> {
    const results = new Map<string, UniquenessResult>();

    // Create fingerprints for all new puzzles
    const newFingerprints = puzzles.map((puzzle) => ({
      puzzle,
      fingerprint: this.generatePuzzleFingerprint(puzzle),
    }));

    // Check each puzzle against existing and other new puzzles
    for (let i = 0; i < newFingerprints.length; i++) {
      const { puzzle, fingerprint } = newFingerprints[i];

      // Check against existing puzzles
      const existingResult = await this.checkUniqueness(puzzle, existingMetadata);

      if (!existingResult.isUnique) {
        results.set(puzzle.id, existingResult);
        continue;
      }

      // Check against other new puzzles
      const otherNewPuzzles = newFingerprints.slice(0, i); // Only check against previous puzzles
      let isUniqueInBatch = true;

      for (const other of otherNewPuzzles) {
        if (fingerprint.hash === other.fingerprint.hash) {
          isUniqueInBatch = false;
          break;
        }
      }

      results.set(puzzle.id, {
        isUnique: isUniqueInBatch,
        similarPuzzles: isUniqueInBatch ? [] : ['batch_duplicate'],
        confidence: isUniqueInBatch ? 1.0 : 0.0,
        reason: isUniqueInBatch ? undefined : 'Duplicate within batch',
      });
    }

    return results;
  }

  /**
   * Generate Redis keys for storing puzzle metadata
   * Optimized for Devvit Web Redis operations
   */
  generateRedisKeys(
    difficulty: DifficultyLevel,
    date?: Date
  ): {
    metadataKey: string;
    hashSetKey: string;
    dailyKey?: string;
  } {
    const baseDate = date || new Date();
    const dateStr = baseDate.toISOString().split('T')[0]; // YYYY-MM-DD

    return {
      metadataKey: `puzzle:metadata:${difficulty}`,
      hashSetKey: `puzzle:hashes:${difficulty}`,
      dailyKey: `puzzle:daily:${dateStr}:${difficulty}`,
    };
  }

  /**
   * Create similarity report for debugging
   * Useful for puzzle generation optimization
   */
  createSimilarityReport(
    puzzle: PuzzleConfiguration,
    similarPuzzles: PuzzleMetadata[]
  ): {
    puzzleId: string;
    fingerprint: PuzzleMetadata;
    similarities: Array<{
      hash: string;
      similarity: number;
      factors: {
        gridSize: number;
        materialCount: number;
        complexity: number;
      };
    }>;
  } {
    const fingerprint = this.generatePuzzleFingerprint(puzzle);

    const similarities = similarPuzzles.map((meta) => {
      const gridSizeSim = 1 - Math.abs(fingerprint.gridSize - meta.gridSize) / fingerprint.gridSize;
      const materialSim =
        1 -
        Math.abs(fingerprint.materialCount - meta.materialCount) /
          Math.max(fingerprint.materialCount, meta.materialCount);
      const complexitySim =
        1 -
        Math.abs(fingerprint.complexity - meta.complexity) /
          Math.max(fingerprint.complexity, meta.complexity);

      return {
        hash: meta.hash,
        similarity: (gridSizeSim + materialSim + complexitySim) / 3,
        factors: {
          gridSize: gridSizeSim,
          materialCount: materialSim,
          complexity: complexitySim,
        },
      };
    });

    return {
      puzzleId: puzzle.id,
      fingerprint,
      similarities,
    };
  }
}
