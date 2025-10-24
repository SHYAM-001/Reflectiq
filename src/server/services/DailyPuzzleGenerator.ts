// DailyPuzzleGenerator service - Automated daily puzzle creation following Devvit Web patterns
// Handles scheduled puzzle generation, uniqueness validation, and automated post creation

import { redis } from '@devvit/web/server';
import { gameEngine, type PuzzleConfiguration, type DifficultyLevel } from './GameEngine.js';
import { redisManager } from './RedisManager.js';

export interface DailyPuzzleSet {
  date: Date;
  puzzles: {
    easy: PuzzleConfiguration;
    medium: PuzzleConfiguration;
    hard: PuzzleConfiguration;
  };
  postIds: {
    easy: string;
    medium: string;
    hard: string;
  };
}

export interface DailyGenerationConfig {
  maxGenerationAttempts: number;
  uniquenessCheckDepth: number; // Days to check back for uniqueness
  generationTimeoutMs: number;
  scheduledGenerationTime: string; // Cron format
  retryDelayMs: number;
}

export interface GenerationResult {
  success: boolean;
  puzzleSet?: DailyPuzzleSet;
  errors: string[];
  warnings: string[];
  generationTime: number;
  uniquenessChecks: {
    easy: boolean;
    medium: boolean;
    hard: boolean;
  };
}

export interface PuzzleValidationResult {
  isValid: boolean;
  isUnique: boolean;
  errors: string[];
  warnings: string[];
  similarPuzzles: string[]; // Hashes of similar puzzles
}

/**
 * DailyPuzzleGenerator service for automated daily puzzle creation
 * Following Devvit Web patterns with Redis storage and serverless constraints
 */
export class DailyPuzzleGenerator {
  private config: DailyGenerationConfig;

  constructor(config?: Partial<DailyGenerationConfig>) {
    // Default configuration following Devvit best practices
    this.config = {
      maxGenerationAttempts: 50,
      uniquenessCheckDepth: 30, // Check last 30 days
      generationTimeoutMs: 25000, // 25 seconds (within Devvit's 30s limit)
      scheduledGenerationTime: '0 0 * * *', // Daily at midnight UTC
      retryDelayMs: 1000,
      ...config,
    };
  }

  /**
   * Generate daily puzzle set for a specific date
   * Creates three unique puzzles (easy, medium, hard)
   */
  async generateDailyPuzzles(date?: Date): Promise<GenerationResult> {
    const startTime = Date.now();
    const targetDate = date || new Date();
    const dateString = this.formatDateString(targetDate);

    console.log(`Starting daily puzzle generation for ${dateString}`);

    const result: GenerationResult = {
      success: false,
      errors: [],
      warnings: [],
      generationTime: 0,
      uniquenessChecks: {
        easy: false,
        medium: false,
        hard: false,
      },
    };

    try {
      // Check if puzzles already exist for this date
      const existingSetKey = `daily:puzzles:${dateString}`;
      const existingData = await redis.get(existingSetKey);

      if (existingData) {
        const existingSet = JSON.parse(existingData);
        result.warnings.push(`Puzzles already exist for ${dateString}`);
        result.puzzleSet = existingSet;
        result.success = true;
        result.generationTime = Date.now() - startTime;
        return result;
      }

      // Generate puzzles for each difficulty
      const difficulties: DifficultyLevel[] = ['easy', 'medium', 'hard'];
      const puzzles: Record<DifficultyLevel, PuzzleConfiguration> = {} as any;

      for (const difficulty of difficulties) {
        console.log(`Generating ${difficulty} puzzle...`);

        const puzzle = await this.generateUniquePuzzle(difficulty, dateString);
        if (!puzzle) {
          result.errors.push(`Failed to generate unique ${difficulty} puzzle`);
          continue;
        }

        // Validate puzzle
        const validation = await this.validatePuzzle(puzzle);
        if (!validation.isValid) {
          result.errors.push(
            `Generated ${difficulty} puzzle failed validation: ${validation.errors.join(', ')}`
          );
          continue;
        }

        if (!validation.isUnique) {
          result.warnings.push(`Generated ${difficulty} puzzle is similar to existing puzzles`);
        }

        puzzles[difficulty] = puzzle;
        result.uniquenessChecks[difficulty] = validation.isUnique;

        console.log(`Generated and stored ${difficulty} puzzle: ${puzzle.id}`);
      }

      // Check if we have all three puzzles
      if (Object.keys(puzzles).length !== 3) {
        result.errors.push('Failed to generate complete puzzle set');
        result.success = false;
        result.generationTime = Date.now() - startTime;
        return result;
      }

      // Create daily puzzle set
      const dailyPuzzleSet: DailyPuzzleSet = {
        date: targetDate,
        puzzles,
        postIds: {
          easy: `post_${puzzles.easy.id}`,
          medium: `post_${puzzles.medium.id}`,
          hard: `post_${puzzles.hard.id}`,
        },
      };

      // Store daily puzzle set with 7-day expiration
      await redis.setEx(existingSetKey, 604800, JSON.stringify(dailyPuzzleSet));

      result.puzzleSet = dailyPuzzleSet;
      result.success = true;
      result.generationTime = Date.now() - startTime;

      console.log(
        `Successfully generated daily puzzle set for ${dateString} in ${result.generationTime}ms`
      );

      return result;
    } catch (error) {
      console.error('Daily puzzle generation failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.success = false;
      result.generationTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Generate a unique puzzle for a specific difficulty
   */
  private async generateUniquePuzzle(
    difficulty: DifficultyLevel,
    dateString: string
  ): Promise<PuzzleConfiguration | null> {
    const maxAttempts = this.config.maxGenerationAttempts;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Check timeout
      if (Date.now() - startTime > this.config.generationTimeoutMs) {
        console.warn(`Puzzle generation timeout after ${attempt} attempts`);
        break;
      }

      try {
        // Generate puzzle
        const puzzle = await gameEngine.generatePuzzle(difficulty);

        // Create unique ID with date prefix
        puzzle.id = `${dateString}_${difficulty}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

        // Check uniqueness by generating a simple hash
        const puzzleHash = this.generatePuzzleHash(puzzle);
        const hashKey = `puzzle:hash:${puzzleHash}`;
        const exists = await redis.get(hashKey);

        if (!exists) {
          // Store hash to prevent duplicates
          await redis.setEx(hashKey, 2592000, puzzle.id); // 30 days
          console.log(`Generated unique ${difficulty} puzzle on attempt ${attempt}`);
          return puzzle;
        }

        console.log(`Puzzle attempt ${attempt} was not unique, retrying...`);

        // Small delay between attempts
        if (attempt < maxAttempts) {
          await this.delay(this.config.retryDelayMs);
        }
      } catch (error) {
        console.error(`Puzzle generation attempt ${attempt} failed:`, error);

        if (attempt < maxAttempts) {
          await this.delay(this.config.retryDelayMs);
        }
      }
    }

    console.error(`Failed to generate unique ${difficulty} puzzle after ${maxAttempts} attempts`);
    return null;
  }

  /**
   * Validate puzzle configuration and uniqueness
   */
  async validatePuzzle(puzzle: PuzzleConfiguration): Promise<PuzzleValidationResult> {
    const result: PuzzleValidationResult = {
      isValid: false,
      isUnique: false,
      errors: [],
      warnings: [],
      similarPuzzles: [],
    };

    try {
      // Basic validation
      if (
        !puzzle.id ||
        !puzzle.difficulty ||
        !puzzle.grid ||
        !puzzle.laserEntry ||
        !puzzle.correctExit
      ) {
        result.errors.push('Missing required puzzle properties');
        return result;
      }

      if (puzzle.grid.length === 0) {
        result.errors.push('Empty puzzle grid');
        return result;
      }

      // Check puzzle hash uniqueness
      const puzzleHash = this.generatePuzzleHash(puzzle);
      const hashKey = `puzzle:hash:${puzzleHash}`;
      const exists = await redis.get(hashKey);

      result.isValid = true;
      result.isUnique = !exists;

      if (exists) {
        result.similarPuzzles.push(puzzleHash);
        result.warnings.push('Puzzle hash matches existing puzzle');
      }

      return result;
    } catch (error) {
      console.error('Puzzle validation failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Validation error');
      return result;
    }
  }

  /**
   * Get daily puzzle set for a specific date
   */
  async getDailyPuzzles(dateString: string): Promise<DailyPuzzleSet | null> {
    try {
      const key = `daily:puzzles:${dateString}`;
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      const puzzleSet = JSON.parse(data);
      // Convert date string back to Date object
      puzzleSet.date = new Date(puzzleSet.date);

      return puzzleSet;
    } catch (error) {
      console.error('Failed to get daily puzzles:', error);
      return null;
    }
  }

  /**
   * Generate puzzles for the next N days
   * Useful for pre-generating content
   */
  async generateUpcomingPuzzles(days: number = 7): Promise<{
    successful: number;
    failed: number;
    results: GenerationResult[];
  }> {
    const results: GenerationResult[] = [];
    let successful = 0;
    let failed = 0;

    console.log(`Generating puzzles for the next ${days} days...`);

    for (let i = 0; i < days; i++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + i);

      try {
        const result = await this.generateDailyPuzzles(targetDate);
        results.push(result);

        if (result.success) {
          successful++;
        } else {
          failed++;
        }

        // Small delay between generations to avoid overwhelming the system
        if (i < days - 1) {
          await this.delay(500);
        }
      } catch (error) {
        console.error(`Failed to generate puzzles for day ${i + 1}:`, error);
        failed++;
        results.push({
          success: false,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: [],
          generationTime: 0,
          uniquenessChecks: {
            easy: false,
            medium: false,
            hard: false,
          },
        });
      }
    }

    console.log(`Upcoming puzzle generation complete: ${successful} successful, ${failed} failed`);

    return {
      successful,
      failed,
      results,
    };
  }

  /**
   * Get generation statistics
   */
  async getGenerationStats(): Promise<{
    totalPuzzlesGenerated: number;
    puzzlesByDifficulty: Record<DifficultyLevel, number>;
    averageGenerationTime: number;
    uniquenessRate: number;
    lastGenerationDate: string | null;
  }> {
    try {
      // This would typically query Redis for generation statistics
      // For now, return default values
      return {
        totalPuzzlesGenerated: 0,
        puzzlesByDifficulty: {
          easy: 0,
          medium: 0,
          hard: 0,
        },
        averageGenerationTime: 0,
        uniquenessRate: 100,
        lastGenerationDate: null,
      };
    } catch (error) {
      console.error('Failed to get generation stats:', error);
      return {
        totalPuzzlesGenerated: 0,
        puzzlesByDifficulty: {
          easy: 0,
          medium: 0,
          hard: 0,
        },
        averageGenerationTime: 0,
        uniquenessRate: 0,
        lastGenerationDate: null,
      };
    }
  }

  /**
   * Generate a simple hash for puzzle uniqueness checking
   */
  private generatePuzzleHash(puzzle: PuzzleConfiguration): string {
    // Create a simple hash based on grid layout and laser entry
    const gridString = puzzle.grid.map((row) => row.map((cell) => cell.material).join('')).join('');

    const hashInput = `${gridString}_${puzzle.laserEntry.row}_${puzzle.laserEntry.col}_${puzzle.difficulty}`;

    // Simple hash function (in production, use a proper hash library)
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Format date as YYYY-MM-DD string
   */
  private formatDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get configuration
   */
  getConfig(): DailyGenerationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DailyGenerationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Updated daily puzzle generator configuration');
  }
}

// Export singleton instance
export const dailyPuzzleGenerator = new DailyPuzzleGenerator();
