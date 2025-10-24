import express from 'express';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post.js';
import {
  initializeServices,
  handleAppInstall,
  handleCommentCreate,
  createDailyPuzzlePosts,
  cleanupExpiredSessions,
  getGameStatistics,
} from './core/devvit-integration.js';
import {
  startPuzzle,
  getHint,
  submitAnswer,
  getLeaderboard,
  getPuzzle,
  getGameStats,
  initializeGameServices,
} from './routes/gameRoutes.js';
import { puzzleFilterRoutes } from './routes/puzzleFilterRoutes.js';
import gameRoutes from './routes/game.js';
import redisRoutes from './routes/redis.js';
import submissionRoutes from './routes/submission.js';
import leaderboardRoutes from './routes/leaderboard.js';
import dailyPuzzlesRoutes from './routes/daily-puzzles.js';
import schedulerRoutes from './routes/scheduler.js';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

// Initialize Logic Reflections game services
initializeServices();
initializeGameServices(redis);

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

// Logic Reflections Game API Routes (Legacy)
router.post('/api/puzzle/start', startPuzzle);
router.post('/api/puzzle/hint', getHint);
router.post('/api/puzzle/submit', submitAnswer);
router.get('/api/leaderboard', getLeaderboard);
router.get('/api/puzzle/:puzzleId', getPuzzle);
router.get('/api/stats', getGameStats);

// New GameEngine API Routes
router.use(gameRoutes);

// Redis Data Management Routes
router.use(redisRoutes);

// Game Submission Routes
router.use(submissionRoutes);

// Leaderboard Integration Routes
router.use(leaderboardRoutes);

// Daily Puzzle Generation Routes
router.use(dailyPuzzlesRoutes);

// Scheduler Routes (Internal)
router.use(schedulerRoutes);

// Puzzle Filter and Navigation Routes
router.use('/api/puzzles', puzzleFilterRoutes);

// Devvit Integration Routes
router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    // Handle Logic Reflections app installation
    await handleAppInstall({}, context);

    // Create original post for compatibility
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Logic Reflections installed and post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error during app install: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to install Logic Reflections app',
    });
  }
});

router.post('/internal/on-comment-create', async (req, res): Promise<void> => {
  try {
    await handleCommentCreate(req.body, context);
    res.json({ status: 'success' });
  } catch (error) {
    console.error(`Error handling comment create: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to process comment',
    });
  }
});

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.post('/internal/menu/generate-daily', async (_req, res): Promise<void> => {
  try {
    await createDailyPuzzlePosts(context);

    res.json({
      status: 'success',
      message: 'Daily puzzles generated successfully',
    });
  } catch (error) {
    console.error(`Error generating daily puzzles: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to generate daily puzzles',
    });
  }
});

// Cleanup endpoint for maintenance
router.post('/internal/cleanup', async (_req, res): Promise<void> => {
  try {
    await cleanupExpiredSessions();
    res.json({
      status: 'success',
      message: 'Cleanup completed successfully',
    });
  } catch (error) {
    console.error(`Error during cleanup: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Cleanup failed',
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
