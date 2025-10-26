import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { PuzzleService } from './services/PuzzleService.js';
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
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
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
      });
      return;
    }

    // Generate new puzzles
    await puzzleService.generateDailyPuzzles(today);

    console.log(`Successfully generated puzzles for ${today}`);
    res.json({
      status: 'success',
      message: 'Daily puzzles generated successfully',
      puzzlesGenerated: 3,
      date: today,
    });
  } catch (error) {
    console.error(`Error generating daily puzzles: ${error}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate daily puzzles',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/internal/scheduler/post-leaderboard', async (_req, res): Promise<void> => {
  try {
    console.log(`Daily leaderboard posting triggered at ${new Date().toISOString()}`);
    // TODO: Implement leaderboard posting logic
    res.json({
      status: 'success',
      message: 'Daily leaderboard posted successfully',
    });
  } catch (error) {
    console.error(`Error posting daily leaderboard: ${error}`);
    res.status(500).json({
      status: 'error',
      message: 'Failed to post daily leaderboard',
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
