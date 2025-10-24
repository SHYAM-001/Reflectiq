// Devvit integration for Logic Reflections game

import type { Context } from '@devvit/web/server';
import { redis } from '@devvit/web/server';
import type { Comment, Post } from '@devvit/protos';
import { GameEngine } from '../services/GameEngine.js';
import { RedisManager } from '../services/RedisManager.js';
import { CommentMonitor } from '../services/CommentMonitor.js';
import { AnswerSubmissionWorkflow } from '../services/AnswerSubmissionWorkflow.js';
import { DailyPuzzleGenerator } from '../services/DailyPuzzleGenerator.js';
import { RedditPostAutomation } from '../services/RedditPostAutomation.js';

// Initialize services
let gameEngine: GameEngine;
let redisManager: RedisManager;
let commentMonitor: CommentMonitor;
let answerSubmissionWorkflow: AnswerSubmissionWorkflow;
let dailyPuzzleGenerator: DailyPuzzleGenerator;
let redditPostAutomation: RedditPostAutomation;

/**
 * Initialize all game services
 */
export function initializeServices(): void {
  try {
    // Initialize Redis manager with Devvit Redis client
    redisManager = new RedisManager(redis as any);

    // Initialize game engine
    gameEngine = new GameEngine();

    // Initialize comment monitor
    commentMonitor = new CommentMonitor(gameEngine, redisManager);

    // Initialize answer submission workflow
    answerSubmissionWorkflow = new AnswerSubmissionWorkflow(
      gameEngine,
      redisManager,
      commentMonitor
    );

    // Initialize daily puzzle generator
    dailyPuzzleGenerator = new DailyPuzzleGenerator(redisManager);

    // Initialize Reddit post automation
    redditPostAutomation = new RedditPostAutomation(dailyPuzzleGenerator, redisManager);

    console.log('Logic Reflections services initialized successfully');
  } catch (error) {
    console.error('Error initializing services:', error);
    throw error;
  }
}

/**
 * Handle app installation
 */
export async function handleAppInstall(event: any, context: Context): Promise<void> {
  try {
    console.log('Logic Reflections app installed');

    // Initialize services if not already done
    if (!gameEngine) {
      initializeServices();
    }

    // Generate initial daily puzzles
    console.log('Generating initial daily puzzles...');
    await dailyPuzzleGenerator.generateDailyPuzzles();

    // Create welcome post
    await createWelcomePost(context);

    console.log('App installation completed successfully');
  } catch (error) {
    console.error('Error handling app install:', error);
  }
}

/**
 * Handle comment creation
 */
export async function handleCommentCreate(event: any, context: Context): Promise<void> {
  try {
    // Initialize services if not already done
    if (!gameEngine) {
      initializeServices();
    }

    const comment = event.comment as Comment;
    if (!comment) {
      console.log('No comment in event');
      return;
    }

    console.log('Processing comment:', {
      id: comment.id,
      authorId: comment.authorId,
      postId: comment.postId,
    });

    // Check if this is a game-related comment
    const isGamePost = await CommentMonitor.isGamePost(comment.postId || '', context);
    if (!isGamePost) {
      console.log('Comment not on game post, ignoring');
      return;
    }

    // Process the comment for potential answer submission
    const result = await answerSubmissionWorkflow.processAnswerSubmission(comment, context);

    if (result) {
      console.log('Answer submission processed:', {
        isCorrect: result.isCorrect,
        score: result.score.finalScore,
        leaderboardPosition: result.leaderboardPosition,
      });
    } else {
      console.log('Comment did not contain valid answer submission');
    }
  } catch (error) {
    console.error('Error handling comment create:', error);
  }
}

/**
 * Handle post creation (for creating puzzle posts)
 */
export async function handlePostCreate(event: any, context: Context): Promise<void> {
  try {
    // Initialize services if not already done
    if (!gameEngine) {
      initializeServices();
    }

    console.log('Post created, checking if it needs puzzle setup');

    // This would be called when moderators create new puzzle posts
    // Implementation depends on how posts are created
  } catch (error) {
    console.error('Error handling post create:', error);
  }
}

/**
 * Create welcome post on app installation
 */
async function createWelcomePost(context: Context): Promise<void> {
  try {
    const welcomeText = `# 🔬 Welcome to Logic Reflections! ✨

Logic Reflections is an exciting laser puzzle game where you predict where a laser beam will exit after bouncing off various reflective materials!

## 🎮 How to Play

1. **Study the Grid**: Each puzzle contains different materials that affect the laser beam
2. **Trace the Path**: Follow the laser from its entry point through reflections
3. **Submit Your Answer**: Comment with your prediction in the format \`Exit: D5\`
4. **Compete**: Climb the leaderboards across three difficulty levels!

## 🧩 Materials Guide

- 🪞 **Mirror** (Silver): Reflects at 90° angles
- 💧 **Water** (Blue): Soft reflection with slight diffusion
- 🔷 **Glass** (Green): 50% pass-through, 50% reflection
- ⚫ **Metal** (Red): Completely reverses beam direction
- ⬛ **Absorber** (Black): Stops the beam entirely

## 💡 Hint System

- Get up to 4 visual hints per puzzle
- Each hint reveals the laser path in one quadrant
- Hints reduce your final score (×0.8, ×0.6, ×0.4, ×0.2)

## 🏆 Scoring

Your score depends on:
- **Base Score**: Varies by difficulty (Easy: 100, Medium: 250, Hard: 500)
- **Hint Penalty**: Fewer hints = higher multiplier
- **Time Bonus**: Faster solutions earn more points

## 📅 Daily Puzzles

New puzzles are generated daily for each difficulty level. Come back every day for fresh challenges!

Ready to test your logical reasoning skills? Let's start reflecting! 🚀`;

    // In a real implementation, you would create the post:
    // await context.reddit.submitPost({
    //   title: '🔬 Logic Reflections - Laser Puzzle Game! ✨',
    //   text: welcomeText,
    //   subredditName: context.subredditName
    // });

    console.log(
      'Welcome post would be created with content:',
      welcomeText.substring(0, 100) + '...'
    );
  } catch (error) {
    console.error('Error creating welcome post:', error);
  }
}

/**
 * Create daily puzzle posts
 */
export async function createDailyPuzzlePosts(context: Context): Promise<void> {
  try {
    // Initialize services if not already done
    if (!gameEngine) {
      initializeServices();
    }

    console.log('Creating daily puzzle posts...');
    await redditPostAutomation.createDailyPuzzlePosts(context);

    console.log('Daily puzzle posts created successfully');
  } catch (error) {
    console.error('Error creating daily puzzle posts:', error);
  }
}

/**
 * Generate puzzle post content
 */
function generatePuzzlePostContent(puzzle: any): string {
  return `# 🔬 Logic Reflections Puzzle

**Difficulty:** ${puzzle.difficulty.charAt(0).toUpperCase() + puzzle.difficulty.slice(1)}
**Grid Size:** ${puzzle.grid.length}×${puzzle.grid.length}
**Max Time:** ${Math.floor(puzzle.maxTime / 60)} minutes
**Base Score:** ${puzzle.baseScore} points

## 🎯 Your Mission

Predict where the laser beam will exit the grid after reflecting off the materials!

**Laser Entry Point:** ${puzzle.laserEntry.label}

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

Good luck! 🚀`;
}

/**
 * Clean up expired sessions periodically
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    if (!gameEngine) {
      initializeServices();
    }

    gameEngine.cleanupExpiredSessions();
    await redisManager.cleanup();

    console.log('Expired sessions cleaned up');
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
}

/**
 * Get game statistics
 */
export async function getGameStatistics(): Promise<any> {
  try {
    if (!gameEngine) {
      initializeServices();
    }

    const gameStats = gameEngine.getGameStats();
    const redisStats = await redisManager.getStats();

    return {
      game: gameStats,
      redis: redisStats,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('Error getting game statistics:', error);
    return null;
  }
}

// Export services for use in other modules
export {
  gameEngine,
  redisManager,
  commentMonitor,
  answerSubmissionWorkflow,
  dailyPuzzleGenerator,
  redditPostAutomation,
};
