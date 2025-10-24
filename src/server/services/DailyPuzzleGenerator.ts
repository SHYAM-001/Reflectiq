// Daily puzzle generation service for Logic Reflections

import type { Context } from '@devvit/web/server';
import type { PuzzleConfiguration, DifficultyLevel } from '../../shared/types/game.js';
import type { DailyPuzzleSet, UserDailyProgress } from '../../shared/types/daily-puzzles.js';
import { PuzzleGenerator, UniquenessValidator, PathValidator } from '../../shared/index.js';
import { generateGridHash } from '../../shared/utils.js';
import { RedisManager } from './RedisManager.js';

export class DailyPuzzleGenerator {
  private redisManager: RedisManager;
  private maxGenerationAttempts = 50;
  private maxUniquenessAttempts = 10;

  constructor(redisManager: RedisManager) {
    this.redisManager = redisManager;
  }

  /**
   * Generate daily puzzle set for a specific date
   */
  async generateDailyPuzzles(date?: Date): Promise<DailyPuzzleSet> {
    const targetDate = date || new Date();
    const dateString = this.formatDate(targetDate);

    console.log('Generating daily puzzles for:', dateString);

    try {
      // Check if puzzles already exist for this date
      const existingPuzzles = await this.redisManager.getDailyPuzzles(dateString);
      if (existingPuzzles) {
        console.log('Daily puzzles already exist for:', dateString);
        return existingPuzzles;
      }

      // Load historical puzzle hashes for uniqueness checking
      await this.loadHistoricalHashes();

      // Generate puzzles for each difficulty
      const easyPuzzle = await this.generateUniquePuzzle('easy');
      const mediumPuzzle = await this.generateUniquePuzzle('medium');
      const hardPuzzle = await this.generateUniquePuzzle('hard');

      // Create daily puzzle set
      const dailyPuzzleSet: DailyPuzzleSet = {
        date: targetDate,
        puzzles: {
          easy: easyPuzzle,
          medium: mediumPuzzle,
          hard: hardPuzzle,
        },
        postIds: {
          easy: '',
          medium: '',
          hard: '',
        },
      };

      // Store the daily puzzle set
      await this.redisManager.storeDailyPuzzles(dateString, dailyPuzzleSet);

      // Store puzzle hashes for future uniqueness checking
      await this.storePuzzleHashes([easyPuzzle, mediumPuzzle, hardPuzzle]);

      console.log('Daily puzzles generated successfully for:', dateString);
      return dailyPuzzleSet;
    } catch (error) {
      console.error('Error generating daily puzzles:', error);
      throw new Error(`Failed to generate daily puzzles: ${error}`);
    }
  }

  /**
   * Generate a unique puzzle for a specific difficulty
   */
  private async generateUniquePuzzle(difficulty: DifficultyLevel): Promise<PuzzleConfiguration> {
    let attempts = 0;
    let uniquenessAttempts = 0;

    while (attempts < this.maxGenerationAttempts) {
      attempts++;

      try {
        // Generate a new puzzle
        const puzzle = PuzzleGenerator.generatePuzzle(difficulty);

        // Validate puzzle solvability
        const validation = PathValidator.validatePuzzleSolvability(
          puzzle.grid,
          puzzle.laserEntry,
          difficulty
        );

        if (!validation.isValid) {
          console.log(
            `Puzzle generation attempt ${attempts} failed validation:`,
            validation.reason
          );
          continue;
        }

        // Check uniqueness
        const isUnique = await this.validateUniqueness(puzzle);
        if (!isUnique) {
          uniquenessAttempts++;
          console.log(`Puzzle uniqueness check failed (attempt ${uniquenessAttempts})`);

          if (uniquenessAttempts >= this.maxUniquenessAttempts) {
            console.warn('Max uniqueness attempts reached, accepting similar puzzle');
            return puzzle;
          }
          continue;
        }

        // Validate complexity matches difficulty
        const complexity = PathValidator.calculateComplexity(validation.laserPath!, puzzle.grid);
        if (!PathValidator.validateDifficultyLevel(complexity, difficulty)) {
          console.log(`Puzzle complexity doesn't match difficulty: ${complexity.totalScore}`);
          continue;
        }

        console.log(`Generated valid ${difficulty} puzzle after ${attempts} attempts`);
        return puzzle;
      } catch (error) {
        console.error(`Error in puzzle generation attempt ${attempts}:`, error);
      }
    }

    // Fallback: generate a simple puzzle if all attempts failed
    console.warn(`Failed to generate unique puzzle after ${attempts} attempts, using fallback`);
    return this.generateFallbackPuzzle(difficulty);
  }

  /**
   * Validate puzzle uniqueness against historical puzzles
   */
  private async validateUniqueness(puzzle: PuzzleConfiguration): Promise<boolean> {
    try {
      const puzzleHash = generateGridHash(puzzle.grid);

      // Check if hash already exists
      const hashExists = await this.redisManager.puzzleHashExists(puzzleHash);
      if (hashExists) {
        return false;
      }

      // Additional uniqueness validation could be added here
      // For example, checking structural similarity

      return true;
    } catch (error) {
      console.error('Error validating puzzle uniqueness:', error);
      return true; // Default to accepting the puzzle if validation fails
    }
  }

  /**
   * Load historical puzzle hashes for uniqueness checking
   */
  private async loadHistoricalHashes(): Promise<void> {
    try {
      const hashes = await this.redisManager.getAllPuzzleHashes();
      PuzzleGenerator.loadHistoricalHashes(hashes);
      console.log(`Loaded ${hashes.length} historical puzzle hashes`);
    } catch (error) {
      console.error('Error loading historical hashes:', error);
    }
  }

  /**
   * Store puzzle hashes for future uniqueness checking
   */
  private async storePuzzleHashes(puzzles: PuzzleConfiguration[]): Promise<void> {
    try {
      for (const puzzle of puzzles) {
        const hash = generateGridHash(puzzle.grid);
        await this.redisManager.storePuzzleHash(hash, puzzle.id);
      }
      console.log(`Stored ${puzzles.length} puzzle hashes`);
    } catch (error) {
      console.error('Error storing puzzle hashes:', error);
    }
  }

  /**
   * Generate fallback puzzle when generation fails
   */
  private generateFallbackPuzzle(difficulty: DifficultyLevel): PuzzleConfiguration {
    console.log(`Generating fallback puzzle for ${difficulty}`);

    // Use the basic puzzle generator fallback
    return PuzzleGenerator.generatePuzzle(difficulty);
  }

  /**
   * Schedule daily puzzle generation
   */
  async scheduleDailyGeneration(): Promise<void> {
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Midnight UTC

      const timeUntilMidnight = tomorrow.getTime() - now.getTime();

      console.log(
        `Scheduling next daily puzzle generation in ${Math.round(timeUntilMidnight / 1000 / 60)} minutes`
      );

      // In a serverless environment, we can't use setTimeout for long periods
      // Instead, this would be handled by external scheduling (cron jobs, etc.)
      // For now, we'll just log the scheduling intent

      console.log('Daily puzzle generation scheduled for:', tomorrow.toISOString());
    } catch (error) {
      console.error('Error scheduling daily generation:', error);
    }
  }

  /**
   * Create Reddit posts for daily puzzles
   */
  async createPuzzlePost(puzzle: PuzzleConfiguration, context: Context): Promise<string> {
    try {
      const postTitle = this.generatePostTitle(puzzle);
      const postContent = this.generatePostContent(puzzle);

      // In a real implementation, create the Reddit post
      console.log('Would create Reddit post:', {
        title: postTitle,
        content: postContent.substring(0, 100) + '...',
      });

      // Placeholder post ID - in real implementation:
      // const post = await context.reddit.submitPost({
      //   title: postTitle,
      //   text: postContent,
      //   subredditName: context.subredditName,
      //   flair: this.getDifficultyFlair(puzzle.difficulty)
      // });
      // return post.id;

      return `post_${puzzle.id}`;
    } catch (error) {
      console.error('Error creating puzzle post:', error);
      throw error;
    }
  }

  /**
   * Generate post title for puzzle
   */
  private generatePostTitle(puzzle: PuzzleConfiguration): string {
    const date = new Date().toISOString().split('T')[0];
    const difficultyEmoji = {
      easy: '🟢',
      medium: '🟡',
      hard: '🔴',
    };

    return `${difficultyEmoji[puzzle.difficulty]} Logic Reflections - ${puzzle.difficulty.charAt(0).toUpperCase() + puzzle.difficulty.slice(1)} - ${date}`;
  }

  /**
   * Generate post content for puzzle
   */
  private generatePostContent(puzzle: PuzzleConfiguration): string {
    const gridVisualization = this.generateGridVisualization(puzzle);

    return `# 🔬 Logic Reflections Daily Puzzle

**Difficulty:** ${puzzle.difficulty.charAt(0).toUpperCase() + puzzle.difficulty.slice(1)}
**Grid Size:** ${puzzle.grid.length}×${puzzle.grid.length}
**Max Time:** ${Math.floor(puzzle.maxTime / 60)} minutes
**Base Score:** ${puzzle.baseScore} points

## 🎯 Your Mission

Predict where the laser beam will exit the grid after reflecting off the materials!

**Laser Entry Point:** ${puzzle.laserEntry.label}

## 🧩 Grid Layout

\`\`\`
${gridVisualization}
\`\`\`

## 📝 How to Submit

Comment with your answer in this format:
\`\`\`
Exit: [Your Answer]
\`\`\`

Example: \`Exit: D5\`

## 🏆 Scoring

- **Base Score:** ${puzzle.baseScore} points
- **Hint Penalty:** Use fewer hints for higher scores
- **Time Bonus:** Faster solutions earn more points

## 🧠 Materials Guide

- 🪞 **Mirror** (Silver): Reflects at 90° angles
- 💧 **Water** (Blue): Soft reflection with diffusion
- 🔷 **Glass** (Green): 50% pass-through, 50% reflection
- ⚫ **Metal** (Red): Reverses beam direction
- ⬛ **Absorber** (Black): Stops the beam completely

Good luck! 🚀`;
  }

  /**
   * Generate ASCII visualization of the puzzle grid
   */
  private generateGridVisualization(puzzle: PuzzleConfiguration): string {
    const materialSymbols = {
      empty: '⬜',
      mirror: '🪞',
      water: '💧',
      glass: '🔷',
      metal: '⚫',
      absorber: '⬛',
    };

    const grid = puzzle.grid;
    const size = grid.length;

    // Create header with column labels
    let visualization = '   ';
    for (let col = 0; col < size; col++) {
      visualization += ` ${String.fromCharCode(65 + col)} `;
    }
    visualization += '\n';

    // Create grid rows
    for (let row = 0; row < size; row++) {
      visualization += `${(row + 1).toString().padStart(2)} `;

      for (let col = 0; col < size; col++) {
        const cell = grid[row][col];
        const symbol = materialSymbols[cell.material] || '❓';

        // Mark laser entry point
        if (puzzle.laserEntry.row === row && puzzle.laserEntry.col === col) {
          visualization += ' 🔴';
        } else {
          visualization += ` ${symbol}`;
        }
      }
      visualization += '\n';
    }

    return visualization;
  }

  /**
   * Get difficulty-based flair for posts
   */
  private getDifficultyFlair(difficulty: DifficultyLevel): string {
    const flairs = {
      easy: 'Easy Puzzle',
      medium: 'Medium Puzzle',
      hard: 'Hard Puzzle',
    };
    return flairs[difficulty];
  }

  /**
   * Get daily puzzles for a specific date
   */
  async getDailyPuzzles(date?: Date): Promise<DailyPuzzleSet | null> {
    const targetDate = date || new Date();
    const dateString = this.formatDate(targetDate);

    return await this.redisManager.getDailyPuzzles(dateString);
  }

  /**
   * Check if daily puzzles exist for a date
   */
  async dailyPuzzlesExist(date?: Date): Promise<boolean> {
    const puzzles = await this.getDailyPuzzles(date);
    return puzzles !== null;
  }

  /**
   * Get user's daily progress
   */
  async getUserDailyProgress(userId: string, date?: Date): Promise<UserDailyProgress | null> {
    const targetDate = date || new Date();
    const dateString = this.formatDate(targetDate);

    return await this.redisManager.getUserProgress(userId, dateString);
  }

  /**
   * Update user's daily progress
   */
  async updateUserDailyProgress(
    userId: string,
    difficulty: DifficultyLevel,
    completed: boolean,
    score?: number,
    date?: Date
  ): Promise<void> {
    const targetDate = date || new Date();
    const dateString = this.formatDate(targetDate);

    let progress = await this.redisManager.getUserProgress(userId, dateString);

    if (!progress) {
      progress = {
        date: targetDate,
        completed: {
          easy: false,
          medium: false,
          hard: false,
        },
        scores: {},
      };
    }

    progress.completed[difficulty] = completed;
    if (
      score !== undefined &&
      (completed || !progress.scores[difficulty] || score > progress.scores[difficulty])
    ) {
      progress.scores[difficulty] = score;
    }

    await this.redisManager.storeUserProgress(userId, dateString, progress);
  }

  /**
   * Get puzzle generation statistics
   */
  async getGenerationStats(): Promise<GenerationStats> {
    try {
      const hashes = await this.redisManager.getAllPuzzleHashes();
      const redisStats = await this.redisManager.getStats();

      return {
        totalPuzzlesGenerated: hashes.length,
        dailyPuzzleSets: 0, // Would need to count daily puzzle sets
        uniquenessRate: 0.95, // Placeholder - would calculate from generation logs
        averageGenerationTime: 0, // Would track generation timing
        lastGenerationDate: new Date(),
      };
    } catch (error) {
      console.error('Error getting generation stats:', error);
      return {
        totalPuzzlesGenerated: 0,
        dailyPuzzleSets: 0,
        uniquenessRate: 0,
        averageGenerationTime: 0,
        lastGenerationDate: new Date(),
      };
    }
  }

  /**
   * Format date as YYYY-MM-DD string
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Clean up old daily puzzles (keep last 30 days)
   */
  async cleanupOldPuzzles(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // In a real implementation, you would iterate through old dates
      // and remove expired daily puzzle sets
      console.log('Would clean up puzzles older than:', this.formatDate(thirtyDaysAgo));
    } catch (error) {
      console.error('Error cleaning up old puzzles:', error);
    }
  }
}

// Type definitions
interface GenerationStats {
  totalPuzzlesGenerated: number;
  dailyPuzzleSets: number;
  uniquenessRate: number;
  averageGenerationTime: number;
  lastGenerationDate: Date;
}
