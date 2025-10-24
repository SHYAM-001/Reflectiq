// Reddit post automation service for Logic Reflections

import type { Context } from '@devvit/web/server';
import type { Post } from '@devvit/protos';
import type { PuzzleConfiguration, DifficultyLevel } from '../../shared/types/game.js';
import type { DailyPuzzleSet } from '../../shared/types/daily-puzzles.js';
import { DailyPuzzleGenerator } from './DailyPuzzleGenerator.js';
import { RedisManager } from './RedisManager.js';

export class RedditPostAutomation {
  private dailyPuzzleGenerator: DailyPuzzleGenerator;
  private redisManager: RedisManager;

  constructor(dailyPuzzleGenerator: DailyPuzzleGenerator, redisManager: RedisManager) {
    this.dailyPuzzleGenerator = dailyPuzzleGenerator;
    this.redisManager = redisManager;
  }

  /**
   * Create daily puzzle posts for all difficulties
   */
  async createDailyPuzzlePosts(context: Context, date?: Date): Promise<DailyPuzzleSet> {
    const targetDate = date || new Date();
    const dateString = this.formatDate(targetDate);

    console.log('Creating daily puzzle posts for:', dateString);

    try {
      // Generate or get daily puzzles
      let dailyPuzzles = await this.dailyPuzzleGenerator.getDailyPuzzles(targetDate);

      if (!dailyPuzzles) {
        console.log('Generating new daily puzzles...');
        dailyPuzzles = await this.dailyPuzzleGenerator.generateDailyPuzzles(targetDate);
      }

      // Create posts for each difficulty if not already created
      const difficulties: DifficultyLevel[] = ['easy', 'medium', 'hard'];

      for (const difficulty of difficulties) {
        if (!dailyPuzzles.postIds[difficulty]) {
          console.log(`Creating ${difficulty} puzzle post...`);

          const postId = await this.createPuzzlePost(
            dailyPuzzles.puzzles[difficulty],
            context,
            targetDate
          );

          dailyPuzzles.postIds[difficulty] = postId;
        } else {
          console.log(
            `${difficulty} puzzle post already exists:`,
            dailyPuzzles.postIds[difficulty]
          );
        }
      }

      // Update daily puzzles with post IDs
      await this.redisManager.storeDailyPuzzles(dateString, dailyPuzzles);

      console.log('Daily puzzle posts created successfully');
      return dailyPuzzles;
    } catch (error) {
      console.error('Error creating daily puzzle posts:', error);
      throw new Error(`Failed to create daily puzzle posts: ${error}`);
    }
  }

  /**
   * Create a single puzzle post
   */
  async createPuzzlePost(
    puzzle: PuzzleConfiguration,
    context: Context,
    date: Date
  ): Promise<string> {
    try {
      const postData = this.generatePostData(puzzle, date);

      console.log('Creating Reddit post:', {
        title: postData.title,
        difficulty: puzzle.difficulty,
        subreddit: context.subredditName,
      });

      // In a real Devvit implementation, create the post:
      // const post = await context.reddit.submitPost({
      //   title: postData.title,
      //   text: postData.content,
      //   subredditName: context.subredditName,
      //   flair: postData.flair,
      //   nsfw: false,
      //   spoiler: false,
      // });

      // For now, return a mock post ID
      const mockPostId = `post_${puzzle.difficulty}_${date.getTime()}`;

      console.log(`${puzzle.difficulty} puzzle post created with ID:`, mockPostId);
      return mockPostId;
    } catch (error) {
      console.error(`Error creating ${puzzle.difficulty} puzzle post:`, error);
      throw error;
    }
  }

  /**
   * Generate post data for a puzzle
   */
  private generatePostData(puzzle: PuzzleConfiguration, date: Date): PostData {
    const dateString = this.formatDate(date);
    const difficultyEmoji = this.getDifficultyEmoji(puzzle.difficulty);
    const difficultyCapitalized =
      puzzle.difficulty.charAt(0).toUpperCase() + puzzle.difficulty.slice(1);

    const title = `${difficultyEmoji} Logic Reflections - ${difficultyCapitalized} - ${dateString}`;
    const content = this.generatePostContent(puzzle, date);
    const flair = this.getDifficultyFlair(puzzle.difficulty);

    return {
      title,
      content,
      flair,
      difficulty: puzzle.difficulty,
    };
  }

  /**
   * Generate comprehensive post content
   */
  private generatePostContent(puzzle: PuzzleConfiguration, date: Date): string {
    const gridVisualization = this.generateGridVisualization(puzzle);
    const materialGuide = this.generateMaterialGuide();
    const difficultyCapitalized =
      puzzle.difficulty.charAt(0).toUpperCase() + puzzle.difficulty.slice(1);

    return `# 🔬 Logic Reflections Daily Puzzle

Welcome to today's ${difficultyCapitalized} puzzle! Test your logical reasoning skills by predicting where the laser beam will exit.

## 📊 Puzzle Information

- **Difficulty:** ${difficultyCapitalized}
- **Grid Size:** ${puzzle.grid.length}×${puzzle.grid.length}
- **Max Time:** ${Math.floor(puzzle.maxTime / 60)} minutes
- **Base Score:** ${puzzle.baseScore} points
- **Laser Entry:** ${puzzle.laserEntry.label}

## 🧩 Puzzle Grid

\`\`\`
${gridVisualization}
\`\`\`

## 📝 How to Submit Your Answer

Comment with your prediction in this exact format:

\`\`\`
Exit: [Coordinate]
\`\`\`

**Examples:**
- \`Exit: A1\`
- \`Exit: D5\`
- \`Exit: F3\`

⚠️ **Important:** Your comment will be automatically processed and then hidden to maintain fairness for other players.

## 🏆 Scoring System

Your final score is calculated as:
**Final Score = Base Score × Hint Multiplier × Time Bonus**

### Base Scores by Difficulty:
- 🟢 Easy: 100 points
- 🟡 Medium: 250 points  
- 🔴 Hard: 500 points

### Hint Penalties:
- 0 hints: ×1.0 (full score)
- 1 hint: ×0.8
- 2 hints: ×0.6
- 3 hints: ×0.4
- 4 hints: ×0.2

### Time Bonus:
Faster solutions earn higher time bonuses. The bonus decreases as you approach the time limit.

${materialGuide}

## 💡 Strategy Tips

1. **Trace the Path:** Follow the laser beam step by step through each reflection
2. **Know Your Materials:** Each material behaves differently - study the guide above
3. **Use Hints Wisely:** Hints reveal the laser path in each quadrant but reduce your score
4. **Work Fast:** Time bonuses reward quick thinking

## 🏅 Leaderboard

Compete against other players! Your rank is determined by:
1. **Score** (primary)
2. **Time** (tiebreaker - faster wins)
3. **Submission time** (secondary tiebreaker)

Good luck, and may your reflections be accurate! 🚀✨

---

*This is an automated daily puzzle. New puzzles are generated every day at midnight UTC.*`;
  }

  /**
   * Generate ASCII grid visualization
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
   * Generate material guide section
   */
  private generateMaterialGuide(): string {
    return `## 🧠 Material Guide

Each material affects the laser beam differently:

| Material | Symbol | Behavior |
|----------|--------|----------|
| **Mirror** | 🪞 | Reflects at 90° angles |
| **Water** | 💧 | Soft reflection with slight diffusion |
| **Glass** | 🔷 | 50% pass-through, 50% reflection |
| **Metal** | ⚫ | Completely reverses beam direction |
| **Absorber** | ⬛ | Stops the beam entirely |
| **Empty** | ⬜ | Beam passes through unaffected |

### 🔴 Laser Entry Point
The red circle (🔴) shows where the laser beam enters the grid.`;
  }

  /**
   * Get difficulty emoji
   */
  private getDifficultyEmoji(difficulty: DifficultyLevel): string {
    const emojis = {
      easy: '🟢',
      medium: '🟡',
      hard: '🔴',
    };
    return emojis[difficulty];
  }

  /**
   * Get difficulty flair
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
   * Update post with puzzle solution (after time expires)
   */
  async updatePostWithSolution(
    postId: string,
    puzzle: PuzzleConfiguration,
    context: Context
  ): Promise<void> {
    try {
      const solutionText = this.generateSolutionText(puzzle);

      console.log('Would update post with solution:', {
        postId,
        correctExit: puzzle.correctExit.label,
      });

      // In a real implementation:
      // await context.reddit.editPost({
      //   postId,
      //   text: originalContent + '\n\n' + solutionText
      // });
    } catch (error) {
      console.error('Error updating post with solution:', error);
    }
  }

  /**
   * Generate solution text for post update
   */
  private generateSolutionText(puzzle: PuzzleConfiguration): string {
    return `

---

## 🎯 **PUZZLE SOLVED!**

**Correct Answer:** ${puzzle.correctExit.label}

Thank you to everyone who participated! Check back tomorrow for a new puzzle.

### 📈 Statistics
- **Difficulty:** ${puzzle.difficulty.charAt(0).toUpperCase() + puzzle.difficulty.slice(1)}
- **Grid Size:** ${puzzle.grid.length}×${puzzle.grid.length}
- **Base Score:** ${puzzle.baseScore} points

See the leaderboard for final rankings! 🏆`;
  }

  /**
   * Create weekly summary post
   */
  async createWeeklySummaryPost(context: Context, weekStartDate: Date): Promise<string> {
    try {
      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekEndDate.getDate() + 6);

      const title = `📊 Logic Reflections - Weekly Summary (${this.formatDate(weekStartDate)} - ${this.formatDate(weekEndDate)})`;
      const content = await this.generateWeeklySummaryContent(weekStartDate, weekEndDate);

      console.log('Would create weekly summary post:', title);

      // In a real implementation:
      // const post = await context.reddit.submitPost({
      //   title,
      //   text: content,
      //   subredditName: context.subredditName,
      //   flair: 'Weekly Summary'
      // });
      // return post.id;

      return `weekly_summary_${weekStartDate.getTime()}`;
    } catch (error) {
      console.error('Error creating weekly summary post:', error);
      throw error;
    }
  }

  /**
   * Generate weekly summary content
   */
  private async generateWeeklySummaryContent(startDate: Date, endDate: Date): Promise<string> {
    // In a real implementation, gather statistics from the week
    return `# 📊 Weekly Logic Reflections Summary

## 🗓️ Week of ${this.formatDate(startDate)} - ${this.formatDate(endDate)}

### 🏆 Top Performers
*Leaderboard data would be inserted here*

### 📈 Weekly Statistics
- **Total Puzzles:** 21 (7 days × 3 difficulties)
- **Total Participants:** *Data from Redis*
- **Average Completion Rate:** *Calculated from submissions*
- **Most Popular Difficulty:** *Based on participation*

### 🎯 Puzzle Highlights
*Notable puzzles and solutions from the week*

### 📅 Coming Up
New puzzles continue daily! Don't miss tomorrow's challenges.

Thank you for playing Logic Reflections! 🚀✨`;
  }

  /**
   * Schedule post creation
   */
  async schedulePostCreation(context: Context): Promise<void> {
    try {
      // In a serverless environment, scheduling would be handled externally
      // This method documents the scheduling requirements

      console.log('Post creation scheduling requirements:');
      console.log('- Daily puzzles: Every day at 00:00 UTC');
      console.log('- Weekly summaries: Every Monday at 00:00 UTC');
      console.log('- Solution updates: When puzzle time expires');

      // In a real implementation, you might:
      // 1. Use external cron jobs to trigger post creation
      // 2. Use Reddit's scheduled posts feature
      // 3. Use cloud scheduling services (AWS EventBridge, etc.)
    } catch (error) {
      console.error('Error setting up post scheduling:', error);
    }
  }

  /**
   * Get post creation statistics
   */
  async getPostStats(): Promise<PostStats> {
    try {
      // In a real implementation, gather statistics from Redis
      return {
        totalPostsCreated: 0,
        dailyPostsThisWeek: 0,
        weeklyPostsThisMonth: 0,
        averageEngagement: 0,
        lastPostCreated: new Date(),
      };
    } catch (error) {
      console.error('Error getting post stats:', error);
      return {
        totalPostsCreated: 0,
        dailyPostsThisWeek: 0,
        weeklyPostsThisMonth: 0,
        averageEngagement: 0,
        lastPostCreated: new Date(),
      };
    }
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Validate post creation requirements
   */
  private validatePostRequirements(context: Context): boolean {
    if (!context.subredditName) {
      console.error('Subreddit name not available in context');
      return false;
    }

    // Add other validation as needed
    return true;
  }

  /**
   * Handle post creation errors
   */
  private handlePostError(error: any, difficulty: DifficultyLevel): void {
    console.error(`Failed to create ${difficulty} puzzle post:`, error);

    // In a real implementation, you might:
    // 1. Retry with exponential backoff
    // 2. Send alerts to administrators
    // 3. Create fallback posts
    // 4. Log to monitoring systems
  }
}

// Type definitions
interface PostData {
  title: string;
  content: string;
  flair: string;
  difficulty: DifficultyLevel;
}

interface PostStats {
  totalPostsCreated: number;
  dailyPostsThisWeek: number;
  weeklyPostsThisMonth: number;
  averageEngagement: number;
  lastPostCreated: Date;
}
