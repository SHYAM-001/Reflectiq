import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';
import { reddit, createServer, context, getServerPort, redis } from '@devvit/web/server';
import { UiResponse } from '@devvit/web/shared';
import { Difficulty } from '../shared/types/puzzle.js';
import { redisClient } from './utils/redisClient.js';
import {
  enhancedAsyncHandler,
  sendErrorResponseWithMonitoring,
  withRedisCircuitBreaker,
  errorMonitor,
} from './utils/errorHandler.js';
import { createPost, createLeaderboardPost } from './core/post';
import { PuzzleService } from './services/PuzzleService.js';
import { LeaderboardService } from './services/LeaderboardService.js';
import { FeatureFlagService } from './services/FeatureFlagService.js';
import puzzleRoutes from './routes/puzzleRoutes.js';
import enhancedPuzzleRoutes from './routes/enhancedPuzzleRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import completionCommentRoutes from './routes/completionCommentRoutes.js';
import performanceRoutes from './routes/performanceRoutes.js';

const app = express();

// Middleware for JSON body parsing with error handling
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf.toString());
      } catch (error) {
        throw new Error('Invalid JSON payload');
      }
    },
  })
);

// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware for plain text body parsing
app.use(express.text({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    console[logLevel](`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);

    // Track errors for monitoring
    if (res.statusCode >= 400) {
      errorMonitor.recordError(
        res.statusCode >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR',
        `HTTP ${res.statusCode} - ${req.method} ${req.path}`,
        `${req.method} ${req.path}`
      );
    }
  });

  next();
});

const router = express.Router();

// Helper functions for data archival and cleanup
async function archiveCompletedPuzzleData(
  date: string,
  stats: unknown,
  leaderboardEntries: unknown[]
): Promise<void> {
  try {
    // Create archived summary data
    const archiveData = {
      date,
      totalPlayers: stats.dailyPlayers,
      totalSubmissions: stats.totalSubmissions,
      puzzleStats: stats.puzzleStats,
      topPlayers: leaderboardEntries.slice(0, 5), // Keep top 5 for historical reference
      archivedAt: new Date().toISOString(),
    };

    // Store archive data with 90-day retention
    const archiveKey = `archive:${date}`;
    await redisClient.set(archiveKey, JSON.stringify(archiveData), { ttl: 90 * 24 * 60 * 60 });

    console.log(`Archived summary data for ${date} with 90-day retention`);
  } catch (error) {
    console.error('Error archiving puzzle data:', error);
    throw error;
  }
}

async function setDataRetentionPolicies(date: string): Promise<void> {
  try {
    const retentionDays = 30;
    const retentionSeconds = retentionDays * 24 * 60 * 60;

    // Set expiration on various data types for the date
    const keysToExpire = [
      `puzzles:${date}`,
      `leaderboard:daily:${date}`,
      `submissions:puzzle_easy_${date}`,
      `submissions:puzzle_medium_${date}`,
      `submissions:puzzle_hard_${date}`,
    ];

    for (const key of keysToExpire) {
      try {
        const exists = await redisClient.exists(key);
        if (exists) {
          await redisClient.expire(key, retentionSeconds);
          console.log(`Set ${retentionDays}-day expiration on ${key}`);
        }
      } catch (error) {
        console.warn(`Failed to set expiration on ${key}:`, error);
      }
    }
  } catch (error) {
    console.error('Error setting retention policies:', error);
    throw error;
  }
}

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId, subredditName } = context;

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
        redisClient.get('count'),
        reddit.getCurrentUsername(),
      ]);

      res.json({
        type: 'init',
        postId: postId,
        count: count ? parseInt(count) : 0,
        username: username ?? 'anonymous',
        subreddit: subredditName,
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
      count: await redisClient.incrBy('count', 1),
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
      count: await redisClient.incrBy('count', -1),
      postId,
      type: 'decrement',
    });
  }
);

// API Routes
router.use('/api/puzzle', puzzleRoutes);
router.use('/api/puzzle', enhancedPuzzleRoutes); // Enhanced generation endpoints
router.use('/api/leaderboard', leaderboardRoutes);
router.use('/api/completion-comment', completionCommentRoutes); // Dedicated completion comment handler
router.use('/api', healthRoutes);
router.use('/api', performanceRoutes); // Performance monitoring endpoints

// Debug endpoint to test comment processing manually
router.post('/api/debug/test-comment', async (req, res): Promise<void> => {
  try {
    console.log('🧪 DEBUG: Testing comment processing manually');

    // Simulate a comment submission
    const testComment = {
      body: req.body.comment || 'Exit: A1',
      author: req.body.author || 'testuser',
      postId: req.body.postId || 'test-post-123',
    };

    console.log('🧪 DEBUG: Simulating comment:', testComment);

    // Call the comment processing logic directly
    const commentResponse = await fetch('/internal/triggers/comment-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testComment),
    });

    const result = await commentResponse.json();

    res.json({
      status: 'success',
      message: 'Debug comment processing completed',
      testComment,
      result,
    });
  } catch (error) {
    console.error('🧪 DEBUG: Error in test comment processing:', error);
    res.status(500).json({
      status: 'error',
      message: 'Debug comment processing failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Post context endpoint for React client
// Requirement 7.1: Add detection for posts without puzzleId in postData
// Requirement 7.3: Add logging when legacy fallback is triggered
router.get('/api/post-context', async (_req, res): Promise<void> => {
  try {
    // In Devvit Web, post data should be available through context
    const postData = context.postData || null;

    // Requirement 7.1: Detect legacy posts without puzzleId
    if (postData && !postData.puzzleId) {
      console.log('⚠️ Legacy post detected in post-context endpoint (no puzzleId)');
      console.log(
        `📅 Post date: ${postData.puzzleDate || 'unknown'}, difficulty: ${postData.specificDifficulty || 'unknown'}`
      );

      // Requirement 7.3: Add logging when legacy fallback is triggered
      errorMonitor.recordError(
        'LEGACY_POST_DETECTED',
        `Legacy post accessed: ${context.postId || 'unknown'} - will use date-based puzzle retrieval`,
        'GET /api/post-context'
      );
    } else if (postData?.puzzleId) {
      console.log(`✓ Post-specific puzzle ID found: ${postData.puzzleId}`);
    }

    res.json({
      postData,
      postId: context.postId,
      subredditName: context.subredditName,
    });
  } catch (error) {
    console.error('Error getting post context:', error);

    // Requirement 7.3: Add logging when legacy fallback is triggered
    console.log('🔄 Post context error - client will use legacy fallback');

    res.json({
      postData: null,
      postId: null,
      subredditName: null,
    });
  }
});

// Puzzle retrieval by date endpoint for legacy posts
// Requirement 7.2: Implement fallback to date-based daily puzzle retrieval
// Requirement 7.3: Add logging when legacy fallback is triggered
// Requirement 7.4: Ensure full functionality for pre-migration posts
router.get('/api/puzzle/by-date', async (req, res): Promise<void> => {
  const startTime = Date.now();

  try {
    // Extract and validate parameters
    const date = req.query.date as string;
    const difficulty = req.query.difficulty as Difficulty;

    // Validate date parameter
    if (!date || typeof date !== 'string') {
      console.warn('Invalid date parameter:', date);
      res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Missing or invalid date parameter',
        },
      });
      return;
    }

    // Validate difficulty parameter
    if (!difficulty || !['Easy', 'Medium', 'Hard'].includes(difficulty)) {
      console.warn('Invalid difficulty parameter:', difficulty);
      res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Missing or invalid difficulty parameter. Must be Easy, Medium, or Hard.',
        },
      });
      return;
    }

    // Requirement 7.3: Add logging when legacy fallback is triggered
    console.log(`🔄 Legacy puzzle retrieval by date: ${date}, difficulty: ${difficulty}`);

    // Requirement 7.2: Implement fallback to date-based daily puzzle retrieval
    const puzzleService = PuzzleService.getInstance();
    const puzzleResponse = await puzzleService.getPuzzleByDate(date, difficulty);

    if (!puzzleResponse.success || !puzzleResponse.data) {
      console.error(`Failed to retrieve legacy puzzle for ${date}, ${difficulty}`);
      res.status(500).json({
        success: false,
        error: {
          type: 'PUZZLE_NOT_FOUND',
          message: 'Failed to retrieve puzzle for the specified date',
        },
      });
      return;
    }

    const retrievalTime = Date.now() - startTime;

    // Return puzzle data with metadata
    res.json({
      success: true,
      data: puzzleResponse.data,
      metadata: {
        source: 'legacy-date-based',
        retrievalTime,
        date,
        difficulty,
      },
    });

    // Requirement 7.3: Add logging when legacy fallback is triggered
    console.log(
      `✓ Legacy puzzle retrieved successfully for ${date}, difficulty: ${difficulty} (time: ${retrievalTime}ms)`
    );
  } catch (error) {
    const retrievalTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('Error in puzzle-by-date endpoint:', errorMessage);

    // Record error for monitoring
    errorMonitor.recordError(
      'PUZZLE_RETRIEVAL_ERROR',
      `Failed to retrieve legacy puzzle by date: ${errorMessage}`,
      'GET /api/puzzle/by-date'
    );

    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to retrieve puzzle',
      },
      metadata: {
        retrievalTime,
      },
    });
  }
});

// Puzzle retrieval by ID endpoint for post-specific puzzles
// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
router.get('/api/puzzle/by-id', async (req, res): Promise<void> => {
  const startTime = Date.now();

  try {
    // Extract and validate parameters
    const puzzleId = req.query.puzzleId as string;
    const difficulty = req.query.difficulty as Difficulty;

    // Requirement 5.2: Validate puzzle ID format
    if (!puzzleId || typeof puzzleId !== 'string') {
      console.warn('Invalid puzzle ID parameter:', puzzleId);
      res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Missing or invalid puzzleId parameter',
        },
      });
      return;
    }

    // Validate difficulty parameter
    if (!difficulty || !['Easy', 'Medium', 'Hard'].includes(difficulty)) {
      console.warn('Invalid difficulty parameter:', difficulty);
      res.status(400).json({
        success: false,
        error: {
          type: 'VALIDATION_ERROR',
          message: 'Missing or invalid difficulty parameter. Must be Easy, Medium, or Hard.',
        },
      });
      return;
    }

    console.log(`Retrieving puzzle by ID: ${puzzleId}, difficulty: ${difficulty}`);

    // Requirement 5.3: Call PuzzleService to retrieve puzzle from Redis
    const puzzleService = PuzzleService.getInstance();
    let puzzle = await puzzleService.getPuzzleById(puzzleId);
    let source: 'cache' | 'generated' = 'cache';

    // Requirement 5.5: Generate new puzzle if not found in Redis
    if (!puzzle) {
      console.log(`Puzzle not found in cache: ${puzzleId}, generating new puzzle...`);

      const generateResponse = await puzzleService.generatePuzzleWithId(puzzleId, difficulty);

      if (!generateResponse.success || !generateResponse.data) {
        console.error(`Failed to generate puzzle: ${puzzleId}`);
        res.status(500).json({
          success: false,
          error: {
            type: 'GENERATION_FAILED',
            message: 'Failed to generate puzzle',
          },
        });
        return;
      }

      puzzle = generateResponse.data;
      source = 'generated';
    }

    const retrievalTime = Date.now() - startTime;

    // Requirement 5.4: Return puzzle data with success status
    // Include metadata about puzzle source (cache/generated)
    res.json({
      success: true,
      data: puzzle,
      metadata: {
        source,
        retrievalTime,
        puzzleId,
        difficulty,
      },
    });

    console.log(
      `✓ Puzzle retrieved successfully: ${puzzleId} (source: ${source}, time: ${retrievalTime}ms)`
    );
  } catch (error) {
    const retrievalTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('Error in puzzle-by-id endpoint:', errorMessage);

    // Record error for monitoring
    errorMonitor.recordError(
      'PUZZLE_RETRIEVAL_ERROR',
      `Failed to retrieve puzzle by ID: ${errorMessage}`,
      'GET /api/puzzle/by-id'
    );

    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to retrieve puzzle',
      },
      metadata: {
        retrievalTime,
      },
    });
  }
});

// Leaderboard data endpoint for React client
router.get('/api/leaderboard-data/:type', async (req, res): Promise<void> => {
  try {
    const { type } = req.params;
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const leaderboardService = LeaderboardService.getInstance();

    if (type === 'daily') {
      const leaderboardResult = await leaderboardService.getDailyLeaderboard(date, 10);
      const stats = await leaderboardService.getLeaderboardStats(date);

      const responseData = {
        type: 'daily',
        date,
        entries: leaderboardResult.entries.map((entry, index) => ({
          rank: index + 1,
          username: entry.username,
          time: `${Math.floor(entry.time / 60)}:${(entry.time % 60).toString().padStart(2, '0')}`,
          difficulty: entry.difficulty.toLowerCase(),
          hintsUsed: entry.hints,
          score: entry.score,
        })),
        stats: {
          totalPlayers: stats.dailyPlayers,
          totalSubmissions: stats.totalSubmissions,
          fastestTime:
            leaderboardResult.entries.length > 0
              ? `${Math.floor(leaderboardResult.entries[0].time / 60)}:${(leaderboardResult.entries[0].time % 60).toString().padStart(2, '0')}`
              : 'N/A',
          topScore: leaderboardResult.entries.length > 0 ? leaderboardResult.entries[0].score : 0,
          puzzleStats: stats.puzzleStats,
        },
      };

      res.json(responseData);
    } else if (type === 'weekly') {
      // Get this week's date range
      const today = new Date(date);
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      // Aggregate weekly data
      const weeklyData: {
        [username: string]: {
          totalScore: number;
          puzzlesSolved: number;
          bestTime: number;
          difficulties: Set<string>;
        };
      } = {};

      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];

        try {
          const dailyLeaderboard = await leaderboardService.getDailyLeaderboard(dateStr, 50);

          for (const entry of dailyLeaderboard.entries) {
            if (!weeklyData[entry.username]) {
              weeklyData[entry.username] = {
                totalScore: 0,
                puzzlesSolved: 0,
                bestTime: entry.time,
                difficulties: new Set(),
              };
            }

            weeklyData[entry.username].totalScore += entry.score;
            weeklyData[entry.username].puzzlesSolved += 1;
            weeklyData[entry.username].bestTime = Math.min(
              weeklyData[entry.username].bestTime,
              entry.time
            );
            weeklyData[entry.username].difficulties.add(entry.difficulty);
          }
        } catch (error) {
          console.warn(`Failed to get daily leaderboard for ${dateStr}:`, error);
        }
      }

      const weeklyEntries = Object.entries(weeklyData)
        .map(([username, data]) => ({
          rank: 0, // Will be set after sorting
          username,
          totalScore: data.totalScore,
          puzzlesSolved: data.puzzlesSolved,
          bestTime: `${Math.floor(data.bestTime / 60)}:${(data.bestTime % 60).toString().padStart(2, '0')}`,
          avgDifficulty: Array.from(data.difficulties).join(', '),
        }))
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 15)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      const responseData = {
        type: 'weekly',
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        entries: weeklyEntries,
        stats: {
          activePlayersCount: weeklyEntries.length,
          totalPuzzlesSolved: weeklyEntries.reduce((sum, entry) => sum + entry.puzzlesSolved, 0),
          averageScore:
            weeklyEntries.length > 0
              ? Math.round(
                  weeklyEntries.reduce((sum, entry) => sum + entry.totalScore, 0) /
                    weeklyEntries.length
                )
              : 0,
        },
      };

      res.json(responseData);
    } else {
      res.status(400).json({ error: 'Invalid leaderboard type. Use "daily" or "weekly".' });
    }
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard data' });
  }
});

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

router.post(
  '/internal/menu/post-create',
  async (_req, res: express.Response<UiResponse>): Promise<void> => {
    try {
      console.log(`Manual daily puzzle creation triggered at ${new Date().toISOString()}`);

      if (!context.subredditName) {
        res.json({
          showToast: {
            text: 'Error: Subreddit context not available',
            appearance: 'neutral',
          },
        });
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const puzzleService = PuzzleService.getInstance();
      const leaderboardService = LeaderboardService.getInstance();

      // Step 1: Generate puzzles if they don't exist
      const puzzlesExist = await puzzleService.puzzlesExistForDate(today);
      if (!puzzlesExist) {
        console.log(`Generating puzzles for ${today}...`);
        await puzzleService.generateDailyPuzzles(today);
      }

      // Step 2: Create three puzzle posts (Easy, Medium, Hard)
      const createdPosts = [];
      const difficulties = ['easy', 'medium', 'hard'] as const;

      for (const difficulty of difficulties) {
        try {
          console.log(`[Mod Tool] Creating post for difficulty: ${difficulty}`);
          const post = await createPost('daily', [difficulty], difficulty);
          createdPosts.push({
            difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
            postId: post.id,
            url: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
          });
          console.log(`[Mod Tool] Created ${difficulty} puzzle post: ${post.id}`);
        } catch (error) {
          console.error(`Failed to create ${difficulty} puzzle post:`, error);
        }
      }

      // Step 3: Create yesterday's leaderboard post (if data exists)
      let leaderboardPost = null;
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const leaderboardResult = await leaderboardService.getDailyLeaderboard(yesterdayStr, 10);
        const stats = await leaderboardService.getLeaderboardStats(yesterdayStr);

        if (leaderboardResult.entries.length > 0) {
          const leaderboardData = {
            type: 'leaderboard' as const,
            leaderboardType: 'daily' as const,
            date: yesterdayStr,
            entries: leaderboardResult.entries.map((entry, index) => ({
              rank: index + 1,
              username: entry.username,
              time: `${Math.floor(entry.time / 60)}:${(entry.time % 60).toString().padStart(2, '0')}`,
              difficulty: entry.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard',
              hintsUsed: entry.hints,
              score: entry.score,
            })),
            stats: {
              totalPlayers: stats.dailyPlayers,
              totalSubmissions: stats.totalSubmissions,
              fastestTime:
                leaderboardResult.entries.length > 0
                  ? `${Math.floor(leaderboardResult.entries[0].time / 60)}:${(leaderboardResult.entries[0].time % 60).toString().padStart(2, '0')}`
                  : 'N/A',
              topScore:
                leaderboardResult.entries.length > 0 ? leaderboardResult.entries[0].score : 0,
              puzzleStats: stats.puzzleStats,
            },
          };

          leaderboardPost = await createLeaderboardPost(leaderboardData, 'daily');
          console.log(`Created yesterday's leaderboard post: ${leaderboardPost.id}`);
        }
      } catch (error) {
        console.warn("Failed to create yesterday's leaderboard post:", error);
      }

      // Step 4: Prepare success response
      const successMessage = `Daily puzzle setup complete! Created ${createdPosts.length} puzzle posts${leaderboardPost ? " + yesterday's leaderboard" : ''}`;

      // Navigate to the first created post (Easy difficulty)
      const navigationUrl =
        createdPosts.length > 0
          ? createdPosts[0].url
          : `https://reddit.com/r/${context.subredditName}`;

      res.json({
        showToast: {
          text: successMessage,
          appearance: 'success',
        },
        navigateTo: navigationUrl,
      });

      console.log(
        `Manual daily setup completed: ${createdPosts.length} puzzle posts, leaderboard: ${!!leaderboardPost}`
      );
    } catch (error) {
      console.error(`Error in manual daily puzzle creation: ${error}`);
      res.json({
        showToast: {
          text: 'Failed to create daily puzzle setup. Please try again.',
          appearance: 'neutral',
        },
      });
    }
  }
);

router.post(
  '/internal/menu/leaderboard',
  async (_req, res: express.Response<UiResponse>): Promise<void> => {
    try {
      console.log(`Daily leaderboard menu action triggered at ${new Date().toISOString()}`);

      if (!context.subredditName) {
        res.json({
          showToast: {
            text: 'Error: Subreddit context not available',
            appearance: 'neutral',
          },
        });
        return;
      }

      // Get today's date
      const today = new Date().toISOString().split('T')[0] as string;
      console.log(`Fetching daily leaderboard for date: ${today}`);

      // Get leaderboard service
      const leaderboardService = LeaderboardService.getInstance();

      // Get daily leaderboard data
      const leaderboardResult = await leaderboardService.getDailyLeaderboard(today, 50);
      console.log(`Leaderboard result:`, {
        totalPlayers: leaderboardResult.totalPlayers,
        entriesCount: leaderboardResult.entries.length,
        entries: leaderboardResult.entries.map((e) => ({
          username: e.username,
          score: e.score,
          difficulty: e.difficulty,
        })),
      });

      const stats = await leaderboardService.getLeaderboardStats(today);

      if (!leaderboardResult.entries || leaderboardResult.entries.length === 0) {
        console.log(`No leaderboard data available for ${today}`);

        res.json({
          showToast: {
            text: `No leaderboard data found for ${today}`,
            appearance: 'neutral',
          },
        });
        return;
      }

      // Create leaderboard data structure
      const leaderboardData = {
        type: 'leaderboard' as const,
        leaderboardType: 'daily' as const,
        date: today,
        difficulty: 'all',
        entries: leaderboardResult.entries.map((entry, index) => ({
          rank: index + 1,
          username: entry.username,
          time:
            typeof entry.time === 'number'
              ? `${Math.floor(entry.time / 60)}:${(entry.time % 60).toString().padStart(2, '0')}`
              : entry.time,
          difficulty: entry.difficulty.toLowerCase(),
          hintsUsed: entry.hints,
          score: entry.score,
        })),
        stats: {
          totalPlayers: leaderboardResult.totalPlayers,
          totalSubmissions: stats.totalSubmissions,
          fastestTime:
            leaderboardResult.entries.length > 0
              ? typeof leaderboardResult.entries[0].time === 'number'
                ? `${Math.floor(leaderboardResult.entries[0].time / 60)}:${(leaderboardResult.entries[0].time % 60).toString().padStart(2, '0')}`
                : leaderboardResult.entries[0].time
              : 'N/A',
          topScore: leaderboardResult.entries.length > 0 ? leaderboardResult.entries[0].score : 0,
          puzzleStats: stats.puzzleStats,
        },
      };

      // Create interactive leaderboard post using the proper createLeaderboardPost function
      try {
        const post = await createLeaderboardPost(leaderboardData, 'daily');

        console.log(`Created interactive daily leaderboard post: ${post.id}`);

        res.json({
          showToast: {
            text: `✅ Interactive daily leaderboard created! (${leaderboardResult.totalPlayers} players)`,
            appearance: 'success',
          },
          navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
        });
      } catch (postError) {
        console.error('Error creating interactive leaderboard post:', postError);
        res.json({
          showToast: {
            text: 'Failed to create interactive leaderboard post',
            appearance: 'neutral',
          },
        });
      }
    } catch (error) {
      console.error('Error in daily leaderboard menu action:', error);
      res.json({
        showToast: {
          text: 'Failed to create daily leaderboard',
          appearance: 'neutral',
        },
      });
    }
  }
);

// Weekly leaderboard menu action
// Weekly leaderboard menu action
router.post(
  '/internal/menu/weekly-leaderboard',
  async (_req, res: express.Response<UiResponse>): Promise<void> => {
    try {
      console.log(`Weekly leaderboard menu action triggered at ${new Date().toISOString()}`);

      if (!context.subredditName) {
        res.json({
          showToast: {
            text: 'Error: Subreddit context not available',
            appearance: 'neutral',
          },
        });
        return;
      }

      // Get this week's date range (Sunday to Saturday)
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // End of week (Saturday)

      const weekStartStr = weekStart.toISOString().split('T')[0] as string;
      const weekEndStr = weekEnd.toISOString().split('T')[0] as string;

      // Get leaderboard service
      const leaderboardService = LeaderboardService.getInstance();

      // Aggregate weekly data by collecting daily leaderboards
      const weeklyData: {
        [username: string]: {
          totalScore: number;
          puzzlesSolved: number;
          bestTime: number;
          difficulties: Set<string>;
        };
      } = {};

      let totalDaysWithData = 0;

      // Collect data for each day of the week
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];

        try {
          const dailyLeaderboard = await leaderboardService.getDailyLeaderboard(dateStr, 100);

          if (dailyLeaderboard.entries && dailyLeaderboard.entries.length > 0) {
            totalDaysWithData++;

            for (const entry of dailyLeaderboard.entries) {
              if (!weeklyData[entry.username]) {
                weeklyData[entry.username] = {
                  totalScore: 0,
                  puzzlesSolved: 0,
                  bestTime: Infinity,
                  difficulties: new Set(),
                };
              }

              weeklyData[entry.username].totalScore += entry.score;
              weeklyData[entry.username].puzzlesSolved += 1;

              const entryTime =
                typeof entry.time === 'number'
                  ? entry.time
                  : parseInt(entry.time.split(':')[0]) * 60 + parseInt(entry.time.split(':')[1]);

              weeklyData[entry.username].bestTime = Math.min(
                weeklyData[entry.username].bestTime,
                entryTime
              );
              weeklyData[entry.username].difficulties.add(entry.difficulty);
            }
          }
        } catch (error) {
          console.warn(`Failed to get leaderboard for ${dateStr}:`, error);
        }
      }

      // Convert to sorted array
      const weeklyEntries = Object.entries(weeklyData)
        .map(([username, data]) => ({
          username,
          totalScore: data.totalScore,
          puzzlesSolved: data.puzzlesSolved,
          bestTime: data.bestTime === Infinity ? 0 : data.bestTime,
          difficulties: Array.from(data.difficulties),
          averageScore: Math.round(data.totalScore / data.puzzlesSolved),
        }))
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 50)
        .map((entry, index) => ({
          rank: index + 1,
          username: entry.username,
          time: `${Math.floor(entry.bestTime / 60)}:${(entry.bestTime % 60).toString().padStart(2, '0')}`,
          difficulty: entry.difficulties.length > 1 ? 'mixed' : entry.difficulties[0] || 'mixed',
          hintsUsed: 0,
          score: entry.totalScore,
          puzzlesSolved: entry.puzzlesSolved,
          averageScore: entry.averageScore,
        }));

      if (weeklyEntries.length === 0) {
        console.log(`No weekly leaderboard data available for week ${weekStartStr}`);

        res.json({
          showToast: {
            text: `No weekly leaderboard data found for this week`,
            appearance: 'neutral',
          },
        });
        return;
      }

      // Create weekly leaderboard data structure
      const totalPuzzlesSolved = weeklyEntries.reduce(
        (sum, entry) => sum + (entry.puzzlesSolved || 0),
        0
      );
      const averageScore =
        weeklyEntries.length > 0
          ? Math.round(
              weeklyEntries.reduce((sum, entry) => sum + entry.score, 0) / weeklyEntries.length
            )
          : 0;

      const weeklyLeaderboardData = {
        type: 'leaderboard' as const,
        leaderboardType: 'weekly' as const,
        date: weekStartStr, // Required by LeaderboardPostData interface
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        difficulty: 'all',
        entries: weeklyEntries,
        stats: {
          totalPlayers: weeklyEntries.length,
          totalSubmissions: totalPuzzlesSolved,
          fastestTime: weeklyEntries.length > 0 ? weeklyEntries[0].time : 'N/A',
          topScore: weeklyEntries.length > 0 ? weeklyEntries[0].score : 0,
          daysWithData: totalDaysWithData,
          // Add fields expected by InteractiveLeaderboard component
          activePlayersCount: weeklyEntries.length,
          totalPuzzlesSolved: totalPuzzlesSolved,
          averageScore: averageScore,
          puzzleStats: {
            easy: 0,
            medium: 0,
            hard: 0,
          },
        },
      };

      // Create interactive weekly leaderboard post using the proper createLeaderboardPost function
      try {
        const post = await createLeaderboardPost(weeklyLeaderboardData, 'weekly');

        console.log(`Created interactive weekly leaderboard post: ${post.id}`);

        res.json({
          showToast: {
            text: `✅ Interactive weekly leaderboard created! (${weeklyEntries.length} players, ${totalDaysWithData} days of data)`,
            appearance: 'success',
          },
          navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
        });
      } catch (postError) {
        console.error('Error creating interactive weekly leaderboard post:', postError);
        res.json({
          showToast: {
            text: 'Failed to create interactive weekly leaderboard post',
            appearance: 'neutral',
          },
        });
      }
    } catch (error) {
      console.error('Error in weekly leaderboard menu action:', error);
      res.json({
        showToast: {
          text: 'Failed to create weekly leaderboard',
          appearance: 'neutral',
        },
      });
    }
  }
);

// Development reset endpoints
router.post(
  '/internal/menu/reset-leaderboard',
  async (_req, res: express.Response<UiResponse>): Promise<void> => {
    try {
      console.log(`[DEV] Reset leaderboard data triggered at ${new Date().toISOString()}`);

      if (!context.subredditName) {
        res.json({
          showToast: {
            text: 'Error: Subreddit context not available',
            appearance: 'neutral',
          },
        });
        return;
      }

      // Use Devvit Redis API for bulk operations
      // Since keys() is not available, we'll delete known key patterns

      let deletedCount = 0;
      const today = new Date().toISOString().split('T')[0];

      // Delete known leaderboard patterns for the past 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        // Delete daily leaderboard keys
        const dailyKey = `reflectiq:leaderboard:daily:${dateStr}`;
        try {
          const exists = await redis.exists(dailyKey);
          if (exists) {
            await redis.del(dailyKey);
            deletedCount++;
          }
        } catch (error) {
          console.warn(`Failed to delete ${dailyKey}:`, error);
        }

        // Delete puzzle-specific leaderboard keys
        const difficulties = ['easy', 'medium', 'hard'];
        for (const difficulty of difficulties) {
          const puzzleKey = `reflectiq:leaderboard:puzzle_${difficulty}_${dateStr}`;
          try {
            const exists = await redis.exists(puzzleKey);
            if (exists) {
              await redis.del(puzzleKey);
              deletedCount++;
            }
          } catch (error) {
            console.warn(`Failed to delete ${puzzleKey}:`, error);
          }
        }
      }

      // Delete submission tracking keys
      const difficulties = ['easy', 'medium', 'hard'];
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        for (const difficulty of difficulties) {
          const submissionKey = `reflectiq:submissions:puzzle_${difficulty}_${dateStr}`;
          try {
            const exists = await redis.exists(submissionKey);
            if (exists) {
              await redis.del(submissionKey);
              deletedCount++;
            }
          } catch (error) {
            console.warn(`Failed to delete ${submissionKey}:`, error);
          }
        }
      }

      console.log(`[DEV] Deleted ${deletedCount} leaderboard and submission keys`);

      res.json({
        showToast: {
          text: `[DEV] Successfully cleared ${deletedCount} leaderboard and submission records`,
          appearance: 'success',
        },
      });
    } catch (error) {
      console.error('[DEV] Error resetting leaderboard data:', error);

      res.json({
        showToast: {
          text: '[DEV] Failed to reset leaderboard data. Check logs for details.',
          appearance: 'neutral',
        },
      });
    }
  }
);

router.post(
  '/internal/menu/reset-puzzles',
  async (_req, res: express.Response<UiResponse>): Promise<void> => {
    try {
      console.log(`[DEV] Reset puzzle data triggered at ${new Date().toISOString()}`);

      if (!context.subredditName) {
        res.json({
          showToast: {
            text: 'Error: Subreddit context not available',
            appearance: 'neutral',
          },
        });
        return;
      }

      // Use Devvit Redis API for bulk operations
      // Since keys() is not available, we'll delete known key patterns

      let deletedCount = 0;

      // Delete known puzzle patterns for the past 30 days
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        // Delete puzzle set keys
        const puzzleSetKey = `reflectiq:puzzles:${dateStr}`;
        try {
          const exists = await redis.exists(puzzleSetKey);
          if (exists) {
            await redis.del(puzzleSetKey);
            deletedCount++;
          }
        } catch (error) {
          console.warn(`Failed to delete ${puzzleSetKey}:`, error);
        }

        // Delete individual puzzle keys
        const difficulties = ['easy', 'medium', 'hard'];
        for (const difficulty of difficulties) {
          const puzzleKey = `reflectiq:puzzle:${difficulty}:${dateStr}`;
          try {
            const exists = await redis.exists(puzzleKey);
            if (exists) {
              await redis.del(puzzleKey);
              deletedCount++;
            }
          } catch (error) {
            console.warn(`Failed to delete ${puzzleKey}:`, error);
          }
        }
      }

      // Delete session keys (these might have various patterns)
      // We'll try common session patterns
      const sessionPatterns = [
        'reflectiq:session:',
        'reflectiq:sessions:',
        'reflectiq:user_session:',
        'reflectiq:game_session:',
      ];

      for (const pattern of sessionPatterns) {
        // Try to delete session keys for the past 7 days
        for (let i = 0; i < 7; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];

          const sessionKey = `${pattern}${dateStr}`;
          try {
            const exists = await redis.exists(sessionKey);
            if (exists) {
              await redis.del(sessionKey);
              deletedCount++;
            }
          } catch (error) {
            console.warn(`Failed to delete ${sessionKey}:`, error);
          }
        }
      }

      console.log(`[DEV] Deleted ${deletedCount} puzzle and session keys`);

      res.json({
        showToast: {
          text: `[DEV] Successfully cleared ${deletedCount} puzzle and session records`,
          appearance: 'success',
        },
      });
    } catch (error) {
      console.error('[DEV] Error resetting puzzle data:', error);

      res.json({
        showToast: {
          text: '[DEV] Failed to reset puzzle data. Check logs for details.',
          appearance: 'neutral',
        },
      });
    }
  }
);

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
        algorithm: 'skipped',
      });
      return;
    }

    // Generate new puzzles with enhanced system integration
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
      algorithm: 'enhanced_integrated', // Indicates enhanced system is integrated
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
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
      } else if (error.message.includes('Enhanced generation failed')) {
        errorType = 'ENHANCED_GENERATION_FAILED';
        errorMessage = 'Enhanced puzzle generation system failed';
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
    // Get subreddit name from context or use fallback for scheduler
    const subredditName = context.subredditName || 'reflectiq_dev';

    if (!subredditName) {
      throw new Error('Subreddit name not available in context');
    }

    try {
      // Prepare leaderboard data for the custom post
      const leaderboardData = {
        type: 'leaderboard' as const,
        leaderboardType: 'daily' as const,
        date: dateStr,
        entries: dailyLeaderboard.entries.map((entry, index) => ({
          rank: index + 1,
          username: entry.username,
          time: `${Math.floor(entry.time / 60)}:${(entry.time % 60).toString().padStart(2, '0')}`,
          difficulty: entry.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard',
          hintsUsed: entry.hints,
          score: entry.score,
        })),
        stats: {
          totalPlayers: stats.dailyPlayers,
          totalSubmissions: stats.totalSubmissions,
          fastestTime:
            dailyLeaderboard.entries.length > 0
              ? `${Math.floor(dailyLeaderboard.entries[0].time / 60)}:${(dailyLeaderboard.entries[0].time % 60).toString().padStart(2, '0')}`
              : 'N/A',
          topScore: dailyLeaderboard.entries.length > 0 ? dailyLeaderboard.entries[0].score : 0,
          puzzleStats: stats.puzzleStats,
        },
      };

      // Create the custom leaderboard post using the enhanced function
      const post = await createLeaderboardPost(leaderboardData, 'daily');

      console.log(`Successfully posted leaderboard for ${dateStr}: ${post.id}`);

      // Enhanced cleanup and archival processes
      try {
        // Cleanup old leaderboards (7 days retention)
        const cleanedLeaderboards = await leaderboardService.cleanupOldLeaderboards(7);
        console.log(`Cleaned up ${cleanedLeaderboards} old leaderboard entries`);

        // Cleanup old puzzles (7 days retention)
        const puzzleService = PuzzleService.getInstance();
        const cleanedPuzzles = await puzzleService.cleanupOldPuzzles(7);
        console.log(`Cleaned up ${cleanedPuzzles} old puzzle sets`);

        // Archive completed puzzle data for long-term storage
        await archiveCompletedPuzzleData(dateStr, stats, dailyLeaderboard.entries);
        console.log(`Archived puzzle data for ${dateStr}`);

        // Set expiration on current day's data (30 days retention for historical data)
        await setDataRetentionPolicies(dateStr);
        console.log(`Set retention policies for ${dateStr} data`);
      } catch (cleanupError) {
        console.warn('Failed to complete cleanup and archival:', cleanupError);
        // Don't fail the entire operation for cleanup errors
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
    const leaderboardService = LeaderboardService.getInstance();

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

    // Get subreddit name from context or use fallback for scheduler
    const subredditName = context.subredditName || 'reflectiq_dev';

    if (!subredditName) {
      throw new Error('Subreddit name not available in context');
    }

    // STEP 1: Create yesterday's leaderboard post FIRST (if data exists)
    let leaderboardPost = null;
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      console.log(`Checking for yesterday's leaderboard data: ${yesterdayStr}`);
      const leaderboardResult = await leaderboardService.getDailyLeaderboard(yesterdayStr, 10);
      const stats = await leaderboardService.getLeaderboardStats(yesterdayStr);

      if (leaderboardResult.entries.length > 0) {
        console.log(
          `Creating yesterday's leaderboard post (${leaderboardResult.entries.length} entries)`
        );

        const leaderboardData = {
          type: 'leaderboard' as const,
          leaderboardType: 'daily' as const,
          date: yesterdayStr,
          entries: leaderboardResult.entries.map((entry, index) => ({
            rank: index + 1,
            username: entry.username,
            time: `${Math.floor(entry.time / 60)}:${(entry.time % 60).toString().padStart(2, '0')}`,
            difficulty: entry.difficulty.toLowerCase() as 'easy' | 'medium' | 'hard',
            hintsUsed: entry.hints,
            score: entry.score,
          })),
          stats: {
            totalPlayers: stats.dailyPlayers,
            totalSubmissions: stats.totalSubmissions,
            fastestTime:
              leaderboardResult.entries.length > 0
                ? `${Math.floor(leaderboardResult.entries[0].time / 60)}:${(leaderboardResult.entries[0].time % 60).toString().padStart(2, '0')}`
                : 'N/A',
            topScore: leaderboardResult.entries.length > 0 ? leaderboardResult.entries[0].score : 0,
            puzzleStats: stats.puzzleStats,
          },
        };

        leaderboardPost = await createLeaderboardPost(leaderboardData, 'daily');
        console.log(`✅ Created yesterday's leaderboard post: ${leaderboardPost.id}`);

        // Add delay after leaderboard post
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.log(`No leaderboard data found for ${yesterdayStr}, skipping leaderboard post`);
      }
    } catch (leaderboardError) {
      console.warn("Failed to create yesterday's leaderboard post:", leaderboardError);
      // Don't fail the entire operation if leaderboard posting fails
    }

    // STEP 2: Create today's puzzle posts (Easy, Medium, Hard)
    const availableDifficulties = puzzleStats.difficulties as ('easy' | 'medium' | 'hard')[];
    const createdPosts: Array<{ difficulty: string; postId: string }> = [];

    try {
      // Create separate posts for each difficulty
      for (const difficulty of availableDifficulties) {
        try {
          console.log(`Creating post for difficulty: ${difficulty}`);
          const post = await createPost('daily', [difficulty], difficulty);
          createdPosts.push({
            difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
            postId: post.id,
          });
          console.log(`✅ Successfully posted ${difficulty} puzzle for ${today}: ${post.id}`);

          // Add small delay between posts to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (difficultyPostError) {
          console.error(`Failed to create ${difficulty} post:`, difficultyPostError);
          // Continue with other difficulties even if one fails
        }
      }

      if (createdPosts.length === 0) {
        throw new Error('Failed to create any puzzle posts');
      }

      console.log(`✅ Successfully posted ${createdPosts.length} daily puzzle posts for ${today}`);

      const executionTime = Date.now() - startTime;
      res.json({
        status: 'success',
        message: `${createdPosts.length} daily puzzle posts created successfully${leaderboardPost ? " + yesterday's leaderboard" : ''}`,
        date: today,
        posts: createdPosts,
        leaderboardPost: leaderboardPost ? { postId: leaderboardPost.id } : null,
        puzzleStats,
        executionTime,
      });
    } catch (postError) {
      console.error('Failed to submit daily puzzle posts:', postError);
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

// Weekly leaderboard scheduler - runs every Sunday night
router.post('/internal/scheduler/post-weekly-leaderboard', async (_req, res): Promise<void> => {
  try {
    const startTime = Date.now();
    console.log(`Weekly leaderboard posting triggered at ${new Date().toISOString()}`);

    // Get last week's date range (Sunday to Saturday)
    const today = new Date();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - today.getDay() - 7); // Last Sunday
    const lastSaturday = new Date(lastSunday);
    lastSaturday.setDate(lastSunday.getDate() + 6); // Last Saturday

    const weekStartStr = lastSunday.toISOString().split('T')[0] as string;
    const weekEndStr = lastSaturday.toISOString().split('T')[0] as string;

    console.log(`Generating weekly leaderboard for ${weekStartStr} to ${weekEndStr}`);

    const leaderboardService = LeaderboardService.getInstance();

    // Aggregate weekly data by collecting daily leaderboards
    const weeklyData: {
      [username: string]: {
        totalScore: number;
        puzzlesSolved: number;
        bestTime: number;
        difficulties: Set<string>;
      };
    } = {};

    let totalDaysWithData = 0;

    // Collect data for each day of the week
    for (let d = new Date(lastSunday); d <= lastSaturday; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      try {
        const dailyLeaderboard = await leaderboardService.getDailyLeaderboard(dateStr, 100);

        if (dailyLeaderboard.entries && dailyLeaderboard.entries.length > 0) {
          totalDaysWithData++;

          for (const entry of dailyLeaderboard.entries) {
            if (!weeklyData[entry.username]) {
              weeklyData[entry.username] = {
                totalScore: 0,
                puzzlesSolved: 0,
                bestTime: Infinity,
                difficulties: new Set(),
              };
            }

            weeklyData[entry.username].totalScore += entry.score;
            weeklyData[entry.username].puzzlesSolved += 1;

            const entryTime =
              typeof entry.time === 'number'
                ? entry.time
                : parseInt(entry.time.split(':')[0]) * 60 + parseInt(entry.time.split(':')[1]);

            weeklyData[entry.username].bestTime = Math.min(
              weeklyData[entry.username].bestTime,
              entryTime
            );
            weeklyData[entry.username].difficulties.add(entry.difficulty);
          }
        }
      } catch (error) {
        console.warn(`Failed to get leaderboard for ${dateStr}:`, error);
      }
    }

    // Convert to sorted array
    const weeklyEntries = Object.entries(weeklyData)
      .map(([username, data]) => ({
        username,
        totalScore: data.totalScore,
        puzzlesSolved: data.puzzlesSolved,
        bestTime: data.bestTime === Infinity ? 0 : data.bestTime,
        difficulties: Array.from(data.difficulties),
        averageScore: Math.round(data.totalScore / data.puzzlesSolved),
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 50)
      .map((entry, index) => ({
        rank: index + 1,
        username: entry.username,
        time: `${Math.floor(entry.bestTime / 60)}:${(entry.bestTime % 60).toString().padStart(2, '0')}`,
        difficulty: entry.difficulties.length > 1 ? 'mixed' : entry.difficulties[0] || 'mixed',
        hintsUsed: 0,
        score: entry.totalScore,
        puzzlesSolved: entry.puzzlesSolved,
        averageScore: entry.averageScore,
      }));

    if (weeklyEntries.length === 0) {
      console.log(`No weekly leaderboard data available for week ${weekStartStr}`);
      res.json({
        status: 'success',
        message: 'No weekly data available, skipping post',
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        executionTime: Date.now() - startTime,
      });
      return;
    }

    // Create weekly leaderboard data structure
    const totalPuzzlesSolved = weeklyEntries.reduce(
      (sum, entry) => sum + (entry.puzzlesSolved || 0),
      0
    );
    const averageScore =
      weeklyEntries.length > 0
        ? Math.round(
            weeklyEntries.reduce((sum, entry) => sum + entry.score, 0) / weeklyEntries.length
          )
        : 0;

    const weeklyLeaderboardData = {
      type: 'leaderboard' as const,
      leaderboardType: 'weekly' as const,
      date: weekStartStr, // Required by LeaderboardPostData interface
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      entries: weeklyEntries,
      stats: {
        totalPlayers: weeklyEntries.length,
        totalSubmissions: totalPuzzlesSolved,
        fastestTime: weeklyEntries.length > 0 ? weeklyEntries[0].time : 'N/A',
        topScore: weeklyEntries.length > 0 ? weeklyEntries[0].score : 0,
        daysWithData: totalDaysWithData,
        // Add fields expected by InteractiveLeaderboard component
        activePlayersCount: weeklyEntries.length,
        totalPuzzlesSolved: totalPuzzlesSolved,
        averageScore: averageScore,
        puzzleStats: {
          easy: 0,
          medium: 0,
          hard: 0,
        },
      },
    };

    // Get subreddit name from context or use fallback for scheduler
    const subredditName = context.subredditName || 'reflectiq_dev';

    if (!subredditName) {
      throw new Error('Subreddit name not available in context');
    }

    // Create the weekly leaderboard post
    try {
      const post = await createLeaderboardPost(weeklyLeaderboardData, 'weekly');

      console.log(`Successfully posted weekly leaderboard: ${post.id}`);

      const executionTime = Date.now() - startTime;
      res.json({
        status: 'success',
        message: 'Weekly leaderboard posted successfully',
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        postId: post.id,
        playersCount: weeklyEntries.length,
        puzzlesSolved: totalPuzzlesSolved,
        daysWithData: totalDaysWithData,
        executionTime,
      });
    } catch (postError) {
      console.error('Failed to submit weekly leaderboard post:', postError);
      throw new Error(
        `Reddit post submission failed: ${postError instanceof Error ? postError.message : 'Unknown error'}`
      );
    }
  } catch (error) {
    const executionTime = Date.now() - (Date.now() - 1000); // Approximate
    console.error(`Error posting weekly leaderboard: ${error}`);

    res.status(500).json({
      status: 'error',
      message: 'Failed to post weekly leaderboard',
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime,
    });
  }
});

router.post('/internal/scheduler/weekly-maintenance', async (_req, res): Promise<void> => {
  try {
    const startTime = Date.now();
    console.log(`Weekly maintenance triggered at ${new Date().toISOString()}`);

    const puzzleService = PuzzleService.getInstance();
    const leaderboardService = LeaderboardService.getInstance();

    let totalCleaned = 0;
    let totalArchived = 0;

    // Comprehensive cleanup of old data (14 days retention for weekly cleanup)
    try {
      const cleanedPuzzles = await puzzleService.cleanupOldPuzzles(14);
      const cleanedLeaderboards = await leaderboardService.cleanupOldLeaderboards(14);
      totalCleaned = cleanedPuzzles + cleanedLeaderboards;

      console.log(`Weekly cleanup: ${cleanedPuzzles} puzzles, ${cleanedLeaderboards} leaderboards`);
    } catch (cleanupError) {
      console.warn('Error during weekly cleanup:', cleanupError);
    }

    // Archive historical data for the past week
    try {
      const today = new Date();
      for (let i = 7; i <= 14; i++) {
        const archiveDate = new Date(today);
        archiveDate.setDate(archiveDate.getDate() - i);
        const dateStr = archiveDate.toISOString().split('T')[0] as string;

        // Check if we have data for this date
        const stats = await leaderboardService.getLeaderboardStats(dateStr);
        if (stats.totalSubmissions > 0) {
          const leaderboard = await leaderboardService.getDailyLeaderboard(dateStr, 10);
          await archiveCompletedPuzzleData(dateStr, stats, leaderboard.entries);
          totalArchived++;
        }
      }
      console.log(`Archived data for ${totalArchived} historical dates`);
    } catch (archiveError) {
      console.warn('Error during weekly archival:', archiveError);
    }

    // Set retention policies on recent data
    try {
      const today = new Date();
      for (let i = 1; i <= 7; i++) {
        const retentionDate = new Date(today);
        retentionDate.setDate(retentionDate.getDate() - i);
        const dateStr = retentionDate.toISOString().split('T')[0] as string;

        await setDataRetentionPolicies(dateStr);
      }
      console.log('Updated retention policies for past week');
    } catch (retentionError) {
      console.warn('Error setting retention policies:', retentionError);
    }

    // Generate maintenance report
    const maintenanceReport = {
      executedAt: new Date().toISOString(),
      cleanedEntries: totalCleaned,
      archivedDates: totalArchived,
      retentionPoliciesUpdated: 7,
      executionTime: Date.now() - startTime,
    };

    // Store maintenance report for monitoring
    const reportKey = `maintenance:${new Date().toISOString().split('T')[0]}`;
    await redisClient.set(reportKey, JSON.stringify(maintenanceReport), { ttl: 30 * 24 * 60 * 60 });

    console.log(`Weekly maintenance completed in ${maintenanceReport.executionTime}ms`);

    res.json({
      status: 'success',
      message: 'Weekly maintenance completed successfully',
      report: maintenanceReport,
    });
  } catch (error) {
    const executionTime = Date.now() - (Date.now() - 1000);
    console.error(`Error during weekly maintenance: ${error}`);

    res.status(500).json({
      status: 'error',
      message: 'Weekly maintenance failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime,
    });
  }
});

// Feature flag management endpoints
router.get('/internal/feature-flags', async (_req, res): Promise<void> => {
  try {
    const featureFlagService = FeatureFlagService.getInstance();
    const flags = await featureFlagService.getFeatureFlags();
    const metrics = await featureFlagService.getPerformanceMetrics();

    res.json({
      status: 'success',
      flags,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting feature flags:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get feature flags',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/internal/feature-flags', async (req, res): Promise<void> => {
  try {
    const featureFlagService = FeatureFlagService.getInstance();
    const updates = req.body;

    // Validate the updates
    const validKeys = [
      'enableGuaranteedGeneration',
      'fallbackToLegacy',
      'enableAdvancedValidation',
      'enablePerformanceLogging',
      'maxGenerationAttempts',
      'confidenceThreshold',
      'enhancedGenerationRollout',
      'timeoutMs',
    ];

    const invalidKeys = Object.keys(updates).filter((key) => !validKeys.includes(key));
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid feature flag keys: ${invalidKeys.join(', ')}`,
        validKeys,
      });
    }

    await featureFlagService.updateFeatureFlags(updates);

    res.json({
      status: 'success',
      message: 'Feature flags updated successfully',
      updates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating feature flags:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update feature flags',
      error: error instanceof Error ? error.message : 'Unknown error',
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

router.post('/internal/triggers/comment-submit', async (req, res): Promise<void> => {
  try {
    const commentData = req.body;
    console.log('📝 Comment trigger received - using in-app submission system instead');

    // We now use the in-app submission system (/api/puzzle/submit) instead of comment parsing
    // This provides better UX and allows for proper celebration comments
    // Just acknowledge the comment without processing it as an answer

    res.json({
      status: 'success',
      message: 'Comment received - please use in-app submission for answers',
    });
  } catch (error) {
    console.error(`Error processing comment submission: ${error}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process comment submission',
    });
  }
});

// Manual trigger for comment processing (for testing)
router.post('/api/debug/manual-comment', async (req, res): Promise<void> => {
  try {
    console.log('🧪 MANUAL COMMENT TRIGGER: Processing comment manually');

    const { comment, author, postId } = req.body;

    if (!comment || !author) {
      res.status(400).json({
        status: 'error',
        message: 'Missing comment or author in request body',
      });
      return;
    }

    // Simulate the comment trigger by calling our handler directly
    const commentData = {
      body: comment,
      author: author,
      postId: postId || 'manual-test-post',
    };

    console.log('🧪 MANUAL: Simulating comment trigger with data:', commentData);

    // Process the comment using the same logic as the trigger
    const triggerReq = {
      body: commentData,
    } as unknown;

    const triggerRes = {
      json: (data: unknown) => {
        console.log('🧪 MANUAL: Comment processing result:', data);
        res.json({
          status: 'success',
          message: 'Manual comment processing completed',
          triggerResult: data,
        });
      },
      status: (code: number) => ({
        json: (data: unknown) => {
          console.log('🧪 MANUAL: Comment processing error:', data);
          res.status(code).json({
            status: 'error',
            message: 'Manual comment processing failed',
            triggerResult: data,
          });
        },
      }),
    } as unknown;

    // Call the comment trigger handler directly
    await router.stack
      .find((layer: unknown) => layer.route?.path === '/internal/triggers/comment-submit')
      ?.route?.stack?.[0]?.handle(triggerReq, triggerRes);
  } catch (error) {
    console.error('🧪 MANUAL: Error in manual comment processing:', error);
    res.status(500).json({
      status: 'error',
      message: 'Manual comment processing failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Debug endpoints for testing
router.get('/api/debug/system-state', async (req, res): Promise<void> => {
  try {
    console.log('🧪 DEBUG: Checking system state');

    const today = new Date().toISOString().split('T')[0];
    const puzzleService = PuzzleService.getInstance();
    const leaderboardService = LeaderboardService.getInstance();

    // Check if puzzles exist
    const puzzlesExist = await puzzleService.puzzlesExistForDate(today);
    const puzzleStats = await puzzleService.getPuzzleStats(today);

    // Check leaderboard stats
    const leaderboardStats = await leaderboardService.getLeaderboardStats(today);
    const dailyLeaderboard = await leaderboardService.getDailyLeaderboard(today, 10);

    // Try to get current puzzles
    const puzzleResponses = {
      easy: await puzzleService.getCurrentPuzzle('Easy'),
      medium: await puzzleService.getCurrentPuzzle('Medium'),
      hard: await puzzleService.getCurrentPuzzle('Hard'),
    };

    res.json({
      status: 'success',
      date: today,
      puzzles: {
        exist: puzzlesExist,
        stats: puzzleStats,
        responses: {
          easy: { success: puzzleResponses.easy.success, hasData: !!puzzleResponses.easy.data },
          medium: {
            success: puzzleResponses.medium.success,
            hasData: !!puzzleResponses.medium.data,
          },
          hard: { success: puzzleResponses.hard.success, hasData: !!puzzleResponses.hard.data },
        },
        solutions: puzzlesExist
          ? {
              easy: puzzleResponses.easy.data?.solution,
              medium: puzzleResponses.medium.data?.solution,
              hard: puzzleResponses.hard.data?.solution,
            }
          : null,
      },
      leaderboard: {
        stats: leaderboardStats,
        entries: dailyLeaderboard.entries,
        totalPlayers: dailyLeaderboard.totalPlayers,
      },
    });
  } catch (error) {
    console.error('🧪 DEBUG: Error checking system state:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check system state',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/api/debug/test-comment', async (req, res): Promise<void> => {
  try {
    console.log('🧪 DEBUG: Testing comment processing manually');

    const today = new Date().toISOString().split('T')[0];
    const puzzleService = PuzzleService.getInstance();
    const leaderboardService = LeaderboardService.getInstance();

    // First, ensure puzzles exist
    const puzzlesExist = await puzzleService.puzzlesExistForDate(today);
    if (!puzzlesExist) {
      console.log('🧪 DEBUG: No puzzles exist, generating them...');
      await puzzleService.generateDailyPuzzles(today);
    }

    // Get the test parameters
    const testComment = {
      body: req.body.comment || 'Exit: A1',
      author: req.body.author || 'testuser',
      postId: req.body.postId || 'test-post-123',
    };

    console.log('🧪 DEBUG: Processing test comment:', testComment);

    // Process the comment directly (simulate the trigger)
    const { body: commentBody, author, postId } = testComment;

    if (!commentBody || !author || !postId) {
      res.json({
        status: 'error',
        message: 'Missing required comment data',
      });
      return;
    }

    // Check if comment matches answer format
    const cellMatch = commentBody.match(/^Exit:\s*([A-Z]\d+)$/i);
    const coordMatch = commentBody.match(/^Exit:\s*\[(\d+),\s*(\d+)\]$/i);

    if (!cellMatch && !coordMatch) {
      res.json({
        status: 'success',
        message: 'Comment does not match answer format',
        comment: commentBody,
      });
      return;
    }

    let answer: [number, number];
    let answerDisplay: string;

    if (cellMatch) {
      const answerCell = cellMatch[1].toUpperCase();
      const letter = answerCell.charAt(0);
      const number = parseInt(answerCell.slice(1));

      const row = letter.charCodeAt(0) - 65;
      const col = number - 1;
      answer = [row, col];
      answerDisplay = answerCell;
    } else if (coordMatch) {
      const row = parseInt(coordMatch[1]);
      const col = parseInt(coordMatch[2]);
      answer = [row, col];
      answerDisplay = `[${row},${col}]`;
    } else {
      res.json({
        status: 'error',
        message: 'Invalid answer format',
      });
      return;
    }

    console.log(`🧪 DEBUG: Parsed answer: ${answerDisplay} -> [${answer[0]}, ${answer[1]}]`);

    // Try all difficulties to find which puzzle this answer is for
    const difficulties = ['Easy', 'Medium', 'Hard'] as const;
    let processedSubmission = false;
    const debugInfo: unknown = {};

    for (const difficulty of difficulties) {
      try {
        const puzzleResponse = await puzzleService.getCurrentPuzzle(difficulty);

        if (puzzleResponse.success && puzzleResponse.data) {
          const puzzle = puzzleResponse.data;
          const [solutionRow, solutionCol] = puzzle.solution;
          const [answerRow, answerCol] = answer;

          debugInfo[difficulty] = {
            puzzleId: puzzle.id,
            solution: puzzle.solution,
            answer: answer,
            matches: solutionRow === answerRow && solutionCol === answerCol,
          };

          if (solutionRow === answerRow && solutionCol === answerCol) {
            console.log(`🧪 DEBUG: Correct answer found for ${difficulty} puzzle!`);

            // Calculate score
            const defaultTime = 300;
            const hintsUsed = 0;
            const baseScores = { Easy: 150, Medium: 400, Hard: 800 };
            const baseScore = baseScores[difficulty];
            const maxTime = 600;
            const timeMultiplier = Math.max(0.1, (maxTime - defaultTime) / maxTime);
            const finalScore = Math.round(baseScore * timeMultiplier);

            // Create submission
            const submission = {
              userId: author,
              puzzleId: puzzle.id,
              sessionId: `debug-${author}-${Date.now()}`,
              answer: answer,
              timeTaken: defaultTime,
              hintsUsed: hintsUsed,
              score: finalScore,
              correct: true,
              timestamp: new Date(),
              difficulty: difficulty,
            };

            // Update leaderboards
            const updateResult = await leaderboardService.atomicScoreUpdate(
              puzzle.id,
              author,
              finalScore,
              submission
            );

            console.log(`🧪 DEBUG: Leaderboard update result:`, updateResult);
            processedSubmission = true;

            res.json({
              status: 'success',
              message: 'Answer processed and scored',
              data: {
                user: author,
                answer: answerDisplay,
                difficulty: difficulty,
                correct: true,
                score: finalScore,
                puzzleId: puzzle.id,
                updateResult,
                debugInfo,
              },
            });
            return;
          }
        }
      } catch (error) {
        console.warn(`🧪 DEBUG: Error checking ${difficulty} puzzle:`, error);
        debugInfo[difficulty] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    if (!processedSubmission) {
      res.json({
        status: 'success',
        message: 'Answer does not match any puzzle solution',
        data: {
          user: author,
          answer: answerDisplay,
          correct: false,
          debugInfo,
        },
      });
    }
  } catch (error) {
    console.error('🧪 DEBUG: Error in test comment processing:', error);
    res.status(500).json({
      status: 'error',
      message: 'Debug comment processing failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Manual comment processing endpoint for testing
router.post('/api/debug/process-comment', async (req, res): Promise<void> => {
  try {
    console.log('🧪 MANUAL: Processing comment manually');

    const { comment, author } = req.body;

    if (!comment || !author) {
      res.status(400).json({
        status: 'error',
        message: 'Missing comment or author. Send: {"comment": "Exit: A1", "author": "username"}',
      });
      return;
    }

    console.log(`🧪 MANUAL: Processing comment "${comment}" from ${author}`);

    const today = new Date().toISOString().split('T')[0];
    const puzzleService = PuzzleService.getInstance();
    const leaderboardService = LeaderboardService.getInstance();

    // First, ensure puzzles exist
    let puzzlesExist = await puzzleService.puzzlesExistForDate(today);
    if (!puzzlesExist) {
      console.log('🧪 MANUAL: No puzzles exist, generating them...');
      await puzzleService.generateDailyPuzzles(today);
      puzzlesExist = true;
    }

    // Parse the comment
    const cellMatch = comment.match(/^Exit:\s*([A-Z]\d+)$/i);
    const coordMatch = comment.match(/^Exit:\s*\[(\d+),\s*(\d+)\]$/i);

    if (!cellMatch && !coordMatch) {
      res.json({
        status: 'error',
        message: 'Comment does not match answer format. Use "Exit: A1" or "Exit: [0,0]"',
        comment,
      });
      return;
    }

    let answer: [number, number];
    let answerDisplay: string;

    if (cellMatch) {
      const answerCell = cellMatch[1].toUpperCase();
      const letter = answerCell.charAt(0);
      const number = parseInt(answerCell.slice(1));

      const row = letter.charCodeAt(0) - 65;
      const col = number - 1;
      answer = [row, col];
      answerDisplay = answerCell;
    } else if (coordMatch) {
      const row = parseInt(coordMatch[1]);
      const col = parseInt(coordMatch[2]);
      answer = [row, col];
      answerDisplay = `[${row},${col}]`;
    } else {
      res.json({
        status: 'error',
        message: 'Invalid answer format',
      });
      return;
    }

    console.log(`🧪 MANUAL: Parsed answer: ${answerDisplay} -> [${answer[0]}, ${answer[1]}]`);

    // Check all difficulties
    const difficulties = ['Easy', 'Medium', 'Hard'] as const;
    const debugInfo: unknown = {};
    let processedSubmission = false;

    for (const difficulty of difficulties) {
      try {
        const puzzleResponse = await puzzleService.getCurrentPuzzle(difficulty);

        if (puzzleResponse.success && puzzleResponse.data) {
          const puzzle = puzzleResponse.data;
          const [solutionRow, solutionCol] = puzzle.solution;
          const [answerRow, answerCol] = answer;

          debugInfo[difficulty] = {
            puzzleId: puzzle.id,
            solution: puzzle.solution,
            answer: answer,
            matches: solutionRow === answerRow && solutionCol === answerCol,
          };

          console.log(
            `🧪 MANUAL: ${difficulty} puzzle - Solution: [${solutionRow}, ${solutionCol}], Answer: [${answerRow}, ${answerCol}], Matches: ${solutionRow === answerRow && solutionCol === answerCol}`
          );

          if (solutionRow === answerRow && solutionCol === answerCol) {
            console.log(`🧪 MANUAL: ✅ Correct answer for ${difficulty} puzzle!`);

            // Calculate score
            const defaultTime = 300;
            const hintsUsed = 0;
            const baseScores = { Easy: 150, Medium: 400, Hard: 800 };
            const baseScore = baseScores[difficulty];
            const maxTime = 600;
            const timeMultiplier = Math.max(0.1, (maxTime - defaultTime) / maxTime);
            const finalScore = Math.round(baseScore * timeMultiplier);

            // Create submission
            const submission = {
              userId: author,
              puzzleId: puzzle.id,
              sessionId: `manual-${author}-${Date.now()}`,
              answer: answer,
              timeTaken: defaultTime,
              hintsUsed: hintsUsed,
              score: finalScore,
              correct: true,
              timestamp: new Date(),
              difficulty: difficulty,
            };

            console.log(`🧪 MANUAL: Creating submission:`, submission);

            // Update leaderboards
            const updateResult = await leaderboardService.atomicScoreUpdate(
              puzzle.id,
              author,
              finalScore,
              submission
            );

            console.log(`🧪 MANUAL: Leaderboard update result:`, updateResult);

            // Verify the update worked
            const updatedStats = await leaderboardService.getLeaderboardStats(today);
            const updatedLeaderboard = await leaderboardService.getDailyLeaderboard(today, 10);

            console.log(`🧪 MANUAL: Updated stats:`, updatedStats);
            console.log(`🧪 MANUAL: Updated leaderboard:`, updatedLeaderboard);

            processedSubmission = true;

            res.json({
              status: 'success',
              message: 'Answer processed and scored successfully!',
              data: {
                user: author,
                answer: answerDisplay,
                difficulty: difficulty,
                correct: true,
                score: finalScore,
                puzzleId: puzzle.id,
                updateResult,
                debugInfo,
                verification: {
                  stats: updatedStats,
                  leaderboard: updatedLeaderboard,
                },
              },
            });
            return;
          }
        } else {
          debugInfo[difficulty] = { error: 'Puzzle not found or failed to load' };
        }
      } catch (error) {
        console.warn(`🧪 MANUAL: Error checking ${difficulty} puzzle:`, error);
        debugInfo[difficulty] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    if (!processedSubmission) {
      console.log(`🧪 MANUAL: ❌ Answer doesn't match any puzzle solution`);
      res.json({
        status: 'success',
        message: 'Answer does not match any puzzle solution',
        data: {
          user: author,
          answer: answerDisplay,
          correct: false,
          debugInfo,
        },
      });
    }
  } catch (error) {
    console.error('🧪 MANUAL: Error in manual comment processing:', error);
    res.status(500).json({
      status: 'error',
      message: 'Manual comment processing failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Use router middleware
app.use(router);

// Global error handling middleware (must be last)
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const endpoint = `${req.method} ${req.path}`;
  console.error(`Global error handler caught error at ${endpoint}:`, error);

  // Record error for monitoring
  errorMonitor.recordError('INTERNAL_ERROR', error.message, endpoint);

  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(error);
  }

  sendErrorResponseWithMonitoring(
    res,
    'INTERNAL_ERROR',
    error.message,
    'An unexpected error occurred',
    endpoint
  );
});

// 404 handler for unmatched routes
app.use((req: express.Request, res: express.Response) => {
  const endpoint = `${req.method} ${req.path}`;
  console.warn(`404 - Route not found: ${endpoint}`);

  sendErrorResponseWithMonitoring(
    res,
    'PUZZLE_NOT_FOUND',
    `Route not found: ${endpoint}`,
    'The requested endpoint does not exist',
    endpoint
  );
});

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);

// Enhanced server error handling
server.on('error', (err: Error) => {
  console.error(`Server error:`, err);
  errorMonitor.recordError('INTERNAL_ERROR', err.message, 'server');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  errorMonitor.recordError('INTERNAL_ERROR', error.message, 'uncaughtException');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  errorMonitor.recordError('INTERNAL_ERROR', String(reason), 'unhandledRejection');
});

console.log(`🚀 ReflectIQ server starting on port ${port}`);
console.log(`📊 Error monitoring and circuit breakers enabled`);
console.log(`🔧 Enhanced Redis retry logic with fallbacks active`);

server.listen(port);
