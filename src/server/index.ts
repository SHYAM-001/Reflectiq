import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { PuzzleService } from './services/PuzzleService.js';
import { LeaderboardService } from './services/LeaderboardService.js';
import puzzleRoutes from './routes/puzzleRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      const [count, username] = await Promise.all([
        redis.get('count'),
        reddit.getCurrentUsername(),
      ]);

      res.json({
        type: 'init',
        postId: postId,
        count: count ? parseInt(count) : 0,
        username: username ?? 'anonymous',
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error during initialization';
      if (error instanceof Error) {
        errorMessage = `Initialization failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', 1),
      postId,
      type: 'increment',
    });
  }
);

router.post<{ postId: string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', -1),
      postId,
      type: 'decrement',
    });
  }
);

// API Routes
router.use('/api/puzzle', puzzleRoutes);
router.use('/api/leaderboard', leaderboardRoutes);

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName || 'unknown'} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName || 'unknown'}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.post('/internal/menu/leaderboard', async (_req, res): Promise<void> => {
  try {
    // TODO: Implement leaderboard view logic
    res.json({
      status: 'success',
      message: 'Leaderboard functionality coming soon',
    });
  } catch (error) {
    console.error(`Error accessing leaderboard: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to access leaderboard',
    });
  }
});

// Scheduler endpoints
router.post('/internal/scheduler/generate-puzzles', async (_req, res): Promise<void> => {
  try {
    const startTime = Date.now();
    console.log(`Daily puzzle generation triggered at ${new Date().toISOString()}`);

    const today = new Date().toISOString().split('T')[0] as string;
    const puzzleService = PuzzleService.getInstance();

    // Check if puzzles already exist for today
    const puzzlesExist = await puzzleService.puzzlesExistForDate(today);

    if (puzzlesExist) {
      console.log(`Puzzles already exist for ${today}, skipping generation`);
      res.json({
        status: 'success',
        message: 'Puzzles already exist for today',
        puzzlesGenerated: 0,
        date: today,
        executionTime: Date.now() - startTime,
      });
      return;
    }

    // Generate new puzzles with error handling and validation
    console.log(`Generating new puzzles for ${today}...`);
    const puzzleSet = await puzzleService.generateDailyPuzzles(today);

    // Validate that all puzzles were generated successfully
    const difficulties = ['Easy', 'Medium', 'Hard'] as const;
    const generatedPuzzles = [];

    for (const difficulty of difficulties) {
      const puzzle = puzzleSet.puzzles[difficulty.toLowerCase() as keyof typeof puzzleSet.puzzles];
      if (puzzle) {
        generatedPuzzles.push({
          difficulty,
          id: puzzle.id,
          gridSize: puzzle.gridSize,
          materialCount: puzzle.materials.length,
          hintsCount: puzzle.hints.length,
        });
        console.log(
          `✓ Generated ${difficulty} puzzle: ${puzzle.id} (${puzzle.gridSize}x${puzzle.gridSize}, ${puzzle.materials.length} materials)`
        );
      } else {
        throw new Error(`Failed to generate ${difficulty} puzzle`);
      }
    }

    // Cleanup old puzzles to prevent Redis memory bloat
    try {
      const cleanedCount = await puzzleService.cleanupOldPuzzles(7);
      console.log(`Cleaned up ${cleanedCount} old puzzle sets`);
    } catch (cleanupError) {
      console.warn('Failed to cleanup old puzzles:', cleanupError);
      // Don't fail the entire operation for cleanup errors
    }

    const executionTime = Date.now() - startTime;
    console.log(
      `Successfully generated ${generatedPuzzles.length} puzzles for ${today} in ${executionTime}ms`
    );

    res.json({
      status: 'success',
      message: 'Daily puzzles generated successfully',
      puzzlesGenerated: generatedPuzzles.length,
      date: today,
      puzzles: generatedPuzzles,
      executionTime,
    });
  } catch (error) {
    const executionTime = Date.now() - (Date.now() - 1000); // Approximate
    console.error(`Error generating daily puzzles: ${error}`);

    // Try to provide more specific error information
    let errorType = 'GENERATION_FAILED';
    let errorMessage = 'Failed to generate daily puzzles';

    if (error instanceof Error) {
      if (error.message.includes('Redis')) {
        errorType = 'REDIS_ERROR';
        errorMessage = 'Redis connection error during puzzle generation';
      } else if (error.message.includes('validation')) {
        errorType = 'VALIDATION_ERROR';
        errorMessage = 'Puzzle validation failed';
      }
    }

    res.status(500).json({
      status: 'error',
      message: errorMessage,
      errorType,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime,
      date: new Date().toISOString().split('T')[0],
    });
  }
});

router.post('/internal/scheduler/post-leaderboard', async (_req, res): Promise<void> => {
  try {
    const startTime = Date.now();
    console.log(`Daily leaderboard posting triggered at ${new Date().toISOString()}`);

    // Get yesterday's date (since this runs at 1 AM, we want previous day's results)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0] as string;

    const leaderboardService = LeaderboardService.getInstance();

    // Get leaderboard statistics
    const stats = await leaderboardService.getLeaderboardStats(dateStr);

    if (stats.totalSubmissions === 0) {
      console.log(`No submissions found for ${dateStr}, skipping leaderboard post`);
      res.json({
        status: 'success',
        message: 'No submissions found, skipping leaderboard post',
        date: dateStr,
        executionTime: Date.now() - startTime,
      });
      return;
    }

    // Get top 10 daily leaderboard
    const dailyLeaderboard = await leaderboardService.getDailyLeaderboard(dateStr, 10);

    // Format leaderboard for Reddit post
    let leaderboardText = `# 🏆 ReflectIQ Daily Leaderboard - ${dateStr}\n\n`;
    leaderboardText += `**Total Players:** ${stats.dailyPlayers}\n`;
    leaderboardText += `**Total Submissions:** ${stats.totalSubmissions}\n`;
    leaderboardText += `- Easy: ${stats.puzzleStats.easy} players\n`;
    leaderboardText += `- Medium: ${stats.puzzleStats.medium} players\n`;
    leaderboardText += `- Hard: ${stats.puzzleStats.hard} players\n\n`;

    if (dailyLeaderboard.entries.length > 0) {
      leaderboardText += `## 🥇 Top Performers\n\n`;
      leaderboardText += `| Rank | Player | Difficulty | Score | Time | Hints |\n`;
      leaderboardText += `|------|--------|------------|-------|------|-------|\n`;

      for (const entry of dailyLeaderboard.entries) {
        const timeFormatted = `${Math.floor(entry.time / 60)}:${(entry.time % 60).toString().padStart(2, '0')}`;
        leaderboardText += `| ${entry.rank} | u/${entry.username} | ${entry.difficulty} | ${entry.score} | ${timeFormatted} | ${entry.hints} |\n`;
      }

      leaderboardText += `\n---\n\n`;
      leaderboardText += `🎯 **How to Play:** Look for today's ReflectIQ puzzle post and trace the laser path through the reflective materials!\n\n`;
      leaderboardText += `💡 **Scoring:** Base score × hint penalty × time bonus. Faster solutions with fewer hints score higher!\n\n`;
      leaderboardText += `🔄 **New puzzles** are posted daily at midnight. Good luck!`;
    } else {
      leaderboardText += `No valid submissions found for this date.\n\n`;
      leaderboardText += `🎯 Don't forget to check out today's puzzle!`;
    }

    // Submit the leaderboard post
    if (!context.subredditName) {
      throw new Error('Subreddit name not available in context');
    }

    try {
      const post = await reddit.submitPost({
        subredditName: context.subredditName,
        title: `🏆 Daily Leaderboard Results - ${dateStr}`,
        text: leaderboardText,
      });

      console.log(`Successfully posted leaderboard for ${dateStr}: ${post.id}`);

      // Cleanup old leaderboards to prevent Redis memory bloat
      try {
        const cleanedCount = await leaderboardService.cleanupOldLeaderboards(7);
        console.log(`Cleaned up ${cleanedCount} old leaderboard entries`);
      } catch (cleanupError) {
        console.warn('Failed to cleanup old leaderboards:', cleanupError);
      }

      const executionTime = Date.now() - startTime;
      res.json({
        status: 'success',
        message: 'Daily leaderboard posted successfully',
        date: dateStr,
        postId: post.id,
        playersCount: stats.dailyPlayers,
        submissionsCount: stats.totalSubmissions,
        topPlayersCount: dailyLeaderboard.entries.length,
        executionTime,
      });
    } catch (postError) {
      console.error('Failed to submit leaderboard post:', postError);
      throw new Error(
        `Reddit post submission failed: ${postError instanceof Error ? postError.message : 'Unknown error'}`
      );
    }
  } catch (error) {
    const executionTime = Date.now() - (Date.now() - 1000); // Approximate
    console.error(`Error posting daily leaderboard: ${error}`);

    // Provide specific error information
    let errorType = 'LEADERBOARD_POST_FAILED';
    let errorMessage = 'Failed to post daily leaderboard';

    if (error instanceof Error) {
      if (error.message.includes('Reddit')) {
        errorType = 'REDDIT_API_ERROR';
        errorMessage = 'Reddit API error during leaderboard posting';
      } else if (error.message.includes('Redis')) {
        errorType = 'REDIS_ERROR';
        errorMessage = 'Redis connection error during leaderboard retrieval';
      }
    }

    res.status(500).json({
      status: 'error',
      message: errorMessage,
      errorType,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime,
      date: new Date().toISOString().split('T')[0],
    });
  }
});

router.post('/internal/scheduler/post-daily-puzzle', async (_req, res): Promise<void> => {
  try {
    const startTime = Date.now();
    console.log(`Daily puzzle posting triggered at ${new Date().toISOString()}`);

    const today = new Date().toISOString().split('T')[0] as string;
    const puzzleService = PuzzleService.getInstance();

    // Check if puzzles exist for today
    const puzzlesExist = await puzzleService.puzzlesExistForDate(today);

    if (!puzzlesExist) {
      console.log(`No puzzles found for ${today}, cannot create post`);
      res.json({
        status: 'error',
        message: 'No puzzles available for today',
        date: today,
        executionTime: Date.now() - startTime,
      });
      return;
    }

    // Get today's puzzle statistics
    const puzzleStats = await puzzleService.getPuzzleStats(today);

    if (!context.subredditName) {
      throw new Error('Subreddit name not available in context');
    }

    // Create the daily puzzle post
    const postText = `# 🎯 Daily ReflectIQ Puzzle - ${today}

Welcome to today's ReflectIQ challenge! Trace the laser path through reflective materials to find the exit point.

## 🎮 How to Play
1. **Choose your difficulty:**
   - 🟢 **Easy** (6x6 grid) - Mirrors and absorbers only
   - 🟡 **Medium** (8x8 grid) - Mirrors, water, glass, and absorbers  
   - 🔴 **Hard** (10x10 grid) - All materials including metal

2. **Trace the laser path** through the materials
3. **Submit your answer** as a comment with format: \`Exit: [x,y]\`

## 🏆 Scoring
- **Base Score:** Easy (150), Medium (400), Hard (800) points
- **Time Bonus:** Faster solutions score higher
- **Hint Penalty:** Each hint reduces your score multiplier

## 📊 Today's Stats
- **Puzzles Available:** ${puzzleStats.difficulties.length}
- **Generated:** ${puzzleStats.generatedAt ? new Date(puzzleStats.generatedAt).toLocaleTimeString() : 'Recently'}

---

**🚀 Ready to play?** Click this post to start the interactive puzzle!

*Good luck, and may your laser find its way! ⚡*`;

    try {
      const post = await reddit.submitPost({
        subredditName: context.subredditName,
        title: `🎯 Daily ReflectIQ Puzzle - ${today}`,
        text: postText,
      });

      console.log(`Successfully posted daily puzzle for ${today}: ${post.id}`);

      const executionTime = Date.now() - startTime;
      res.json({
        status: 'success',
        message: 'Daily puzzle posted successfully',
        date: today,
        postId: post.id,
        puzzleStats,
        executionTime,
      });
    } catch (postError) {
      console.error('Failed to submit daily puzzle post:', postError);
      throw new Error(
        `Reddit post submission failed: ${postError instanceof Error ? postError.message : 'Unknown error'}`
      );
    }
  } catch (error) {
    const executionTime = Date.now() - (Date.now() - 1000); // Approximate
    console.error(`Error posting daily puzzle: ${error}`);

    // Provide specific error information
    let errorType = 'PUZZLE_POST_FAILED';
    let errorMessage = 'Failed to post daily puzzle';

    if (error instanceof Error) {
      if (error.message.includes('Reddit')) {
        errorType = 'REDDIT_API_ERROR';
        errorMessage = 'Reddit API error during puzzle posting';
      } else if (error.message.includes('Redis')) {
        errorType = 'REDIS_ERROR';
        errorMessage = 'Redis connection error during puzzle retrieval';
      } else if (error.message.includes('Subreddit')) {
        errorType = 'CONTEXT_ERROR';
        errorMessage = 'Subreddit context not available';
      }
    }

    res.status(500).json({
      status: 'error',
      message: errorMessage,
      errorType,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime,
      date: new Date().toISOString().split('T')[0],
    });
  }
});

// Trigger endpoints
router.post('/internal/triggers/post-submit', async (_req, res): Promise<void> => {
  try {
    // TODO: Handle post submission events
    res.json({
      status: 'success',
      message: 'Post submission processed',
    });
  } catch (error) {
    console.error(`Error processing post submission: ${error}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process post submission',
    });
  }
});

router.post('/internal/triggers/comment-submit', async (_req, res): Promise<void> => {
  try {
    // TODO: Handle comment submission events (puzzle answers)
    res.json({
      status: 'success',
      message: 'Comment submission processed',
    });
  } catch (error) {
    console.error(`Error processing comment submission: ${error}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process comment submission',
    });
  }
});

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
