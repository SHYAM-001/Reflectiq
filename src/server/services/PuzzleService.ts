/**
 * Puzzle Service for ReflectIQ
 * Handles puzzle retrieval, caching, and daily puzzle management
 */

import { redis } from '@devvit/web/server';
import { Puzzle, DailyPuzzleSet, Difficulty } from '../../shared/types/puzzle.js';
import { GetPuzzleResponse, ApiResponse } from '../../shared/types/api.js';
import { PuzzleGenerator } from '../../shared/puzzle/PuzzleGenerator.js';

export class PuzzleService {
  private static instance: PuzzleService;
  private puzzleGenerator: PuzzleGenerator;

  private constructor() {
    this.puzzleGenerator = PuzzleGenerator.getInstance();
  }

  public static getInstance(): PuzzleService {
    if (!PuzzleService.instance) {
      PuzzleService.instance = new PuzzleService();
    }
    return PuzzleService.instance;
  }

  /**
   * Get current day's puzzle by difficulty
   */
  public async getCurrentPuzzle(difficulty: Difficulty): Promise<GetPuzzleResponse> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const puzzleSet = await this.getDailyPuzzleSet(today);

      if (!puzzleSet) {
        // Generate puzzles if they don't exist
        const newPuzzleSet = await this.generateDailyPuzzles(today);
        const puzzle = this.getPuzzleFromSet(newPuzzleSet, difficulty);

        return {
          success: true,
          data: puzzle,
          timestamp: new Date(),
        };
      }

      const puzzle = this.getPuzzleFromSet(puzzleSet, difficulty);

      return {
        success: true,
        data: puzzle,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error getting current puzzle:', error);
      return {
        success: false,
        error: {
          type: 'PUZZLE_NOT_FOUND',
          message: 'Failed to retrieve current puzzle',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get daily puzzle set from Redis cache
   */
  private async getDailyPuzzleSet(date: string): Promise<DailyPuzzleSet | null> {
    try {
      const key = `reflectiq:puzzles:${date}`;
      const puzzleData = await redis.get(key);

      if (!puzzleData) {
        return null;
      }

      return JSON.parse(puzzleData) as DailyPuzzleSet;
    } catch (error) {
      console.error('Error retrieving puzzle set from Redis:', error);
      return null;
    }
  }

  /**
   * Store daily puzzle set in Redis cache
   */
  private async storeDailyPuzzleSet(puzzleSet: DailyPuzzleSet): Promise<void> {
    try {
      const key = `reflectiq:puzzles:${puzzleSet.date}`;
      const puzzleData = JSON.stringify(puzzleSet);

      // Store with 48-hour expiration (allows for timezone differences)
      await redis.setex(key, 48 * 60 * 60, puzzleData);

      console.log(`Stored daily puzzle set for ${puzzleSet.date}`);
    } catch (error) {
      console.error('Error storing puzzle set in Redis:', error);
      throw error;
    }
  }

  /**
   * Generate and cache daily puzzles
   */
  public async generateDailyPuzzles(date: string): Promise<DailyPuzzleSet> {
    try {
      console.log(`Generating daily puzzles for ${date}`);

      const puzzleSet = this.puzzleGenerator.generateDailyPuzzles(date);

      // Store in Redis cache
      await this.storeDailyPuzzleSet(puzzleSet);

      console.log(`Successfully generated and cached puzzles for ${date}`);
      return puzzleSet;
    } catch (error) {
      console.error('Error generating daily puzzles:', error);
      throw error;
    }
  }

  /**
   * Get specific puzzle from puzzle set by difficulty
   */
  private getPuzzleFromSet(puzzleSet: DailyPuzzleSet, difficulty: Difficulty): Puzzle {
    switch (difficulty) {
      case 'Easy':
        return puzzleSet.puzzles.easy;
      case 'Medium':
        return puzzleSet.puzzles.medium;
      case 'Hard':
        return puzzleSet.puzzles.hard;
      default:
        throw new Error(`Invalid difficulty: ${difficulty}`);
    }
  }

  /**
   * Check if puzzles exist for a given date
   */
  public async puzzlesExistForDate(date: string): Promise<boolean> {
    try {
      const puzzleSet = await this.getDailyPuzzleSet(date);
      return puzzleSet !== null;
    } catch (error) {
      console.error('Error checking puzzle existence:', error);
      return false;
    }
  }

  /**
   * Get puzzle statistics for monitoring
   */
  public async getPuzzleStats(date: string): Promise<{
    exists: boolean;
    difficulties: string[];
    generatedAt?: Date;
    status?: string;
  }> {
    try {
      const puzzleSet = await this.getDailyPuzzleSet(date);

      if (!puzzleSet) {
        return {
          exists: false,
          difficulties: [],
        };
      }

      const difficulties = [];
      if (puzzleSet.puzzles.easy) difficulties.push('Easy');
      if (puzzleSet.puzzles.medium) difficulties.push('Medium');
      if (puzzleSet.puzzles.hard) difficulties.push('Hard');

      return {
        exists: true,
        difficulties,
        generatedAt: puzzleSet.createdAt,
        status: puzzleSet.status,
      };
    } catch (error) {
      console.error('Error getting puzzle stats:', error);
      return {
        exists: false,
        difficulties: [],
      };
    }
  }

  /**
   * Cleanup old puzzles (for maintenance)
   */
  public async cleanupOldPuzzles(daysToKeep: number = 7): Promise<number> {
    try {
      let cleanedCount = 0;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Get all puzzle keys
      const keys = await redis.keys('reflectiq:puzzles:*');

      for (const key of keys) {
        const dateStr = key.split(':')[2];
        const puzzleDate = new Date(dateStr);

        if (puzzleDate < cutoffDate) {
          await redis.del(key);
          cleanedCount++;
          console.log(`Cleaned up old puzzle: ${key}`);
        }
      }

      console.log(`Cleaned up ${cleanedCount} old puzzle sets`);
      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up old puzzles:', error);
      return 0;
    }
  }
}
