import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';
import { reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { UIResponse } from '@devvit/web/shared';
import { redisClient } from './utils/redisClient.js';
import { createPost } from './core/post';
import { PuzzleService } from './services/PuzzleService.js';
import { LeaderboardService } from './services/LeaderboardService.js';
import puzzleRoutes from './routes/puzzleRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

// Helper functions for data archival and cleanup
async function archiveCompletedPuzzleData(
  date: string,
  stats: any,
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
router.use('/api/leaderboard', leaderboardRoutes);
router.use('/api', healthRoutes);

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
  async (_req, res: express.Response<UIResponse>): Promise<void> => {
    try {
      const post = await createPost();

      res.json({
        showToast: {
          text: 'ReflectIQ puzzle post created successfully!',
          appearance: 'success',
        },
        navigateTo: `https://reddit.com/r/${context.subredditName || 'unknown'}/comments/${post.id}`,
      });
    } catch (error) {
      console.error(`Error creating post: ${error}`);
      res.json({
        showToast: {
          text: 'Failed to create puzzle post. Please try again.',
          appearance: 'neutral',
        },
      });
    }
  }
);

router.post(
  '/internal/menu/leaderboard',
  async (_req, res: express.Response<UIResponse>): Promise<void> => {
    try {
      console.log(`Leaderboard menu action triggered at ${new Date().toISOString()}`);

      if (!context.subredditName) {
        res.json({
          showToast: {
            text: 'Error: Subreddit context not available',
            appearance: 'neutral',
          },
        });
        return;
      }

      // Get today's date for the leaderboard
      const today = new Date().toISOString().split('T')[0];

      // Get leaderboard service
      const leaderboardService = LeaderboardService.getInstance();

      // Get daily leaderboard data
      const leaderboardResult = await leaderboardService.getDailyLeaderboard(today, 10);

      if (!leaderboardResult.entries || leaderboardResult.entries.length === 0) {
        console.log(`No leaderboard data available for ${today}`);

        // Create a post encouraging participation even if no data
        const emptyLeaderboardText = `# 🏆 ReflectIQ Daily Leaderboard - ${today}

**No submissions yet today!** 🎯

Be the first to solve today's ReflectIQ puzzle and claim the top spot on the leaderboard!

## 🎮 How to Get Started:
1. **Find today's puzzle post** in the subreddit
2. **Click the post** to open the interactive puzzle
3. **Trace the laser path** through mirrors and materials
4. **Submit your answer** as a comment with format: \`Exit: [Cell]\`

## 🏆 Scoring System:
- **Base Score:** Easy (150), Medium (400), Hard (800) points
- **Time Bonus:** Faster completion = higher score
- **Hint Penalty:** Each hint reduces your score multiplier

## 💡 Tips for Success:
- Start with Easy difficulty to learn the mechanics
- Think about laser physics - angles of reflection
- Use hints strategically if you get stuck
- Try to solve without hints for maximum points

---

**Ready to compete?** Find today's puzzle and start playing! 🔦✨`;

        const post = await reddit.submitPost({
          subredditName: context.subredditName,
          title: `🏆 Daily ReflectIQ Leaderboard - ${today} | Be the First!`,
          text: emptyLeaderboardText,
        });

        console.log(`Empty leaderboard post created: ${post.id}`);

        res.json({
          showToast: {
            text: 'Leaderboard post created! Be the first to play today!',
            appearance: 'success',
          },
          navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
        });
        return;
      }

      const entries = leaderboardResult.entries;

      // Get leaderboard statistics
      const stats = await leaderboardService.getLeaderboardStats(today);

      // Format leaderboard as Reddit post content
      let postContent = `# 🏆 ReflectIQ Daily Leaderboard - ${today}

**Today's Top Puzzle Solvers!** 🎯

## 📊 Daily Statistics:
- **Total Players:** ${stats.dailyPlayers}
- **Total Submissions:** ${stats.totalSubmissions}
- **Easy Puzzles:** ${stats.puzzleStats.easy} players
- **Medium Puzzles:** ${stats.puzzleStats.medium} players  
- **Hard Puzzles:** ${stats.puzzleStats.hard} players

## 🥇 Top 10 Performers:

| Rank | Player | Difficulty | Score | Time | Hints |
|------|--------|------------|-------|------|-------|`;

      entries.forEach((entry, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        const timeFormatted = `${Math.floor(entry.time / 60)}:${(entry.time % 60).toString().padStart(2, '0')}`;

        postContent += `\n| ${medal} | u/${entry.username} | ${entry.difficulty} | ${entry.score} | ${timeFormatted} | ${entry.hints} |`;
      });

      postContent += `

---

## 🎯 How to Play ReflectIQ:
1. **Find today's puzzle post** and click to start playing
2. **Guide the laser** from entry to exit using mirrors and materials
3. **Submit your answer** as a comment: \`Exit: [Cell]\`
4. **Climb the leaderboard** with faster times and fewer hints!

## 💡 Scoring Tips:
- **No hints used:** 100% score multiplier
- **1-2 hints:** 80-60% score multiplier  
- **3-4 hints:** 40-20% score multiplier
- **Speed bonus:** Faster completion = higher final score

## 🔄 Daily Challenge:
New puzzles are posted every day at midnight. Come back tomorrow for fresh challenges!

*Good luck, and may the laser be with you!* ⚡✨`;

      // Create the leaderboard post
      const post = await reddit.submitPost({
        subredditName: context.subredditName,
        title: `🏆 Daily ReflectIQ Leaderboard - ${today}`,
        text: postContent,
      });

      console.log(`Leaderboard post created successfully: ${post.id}`);

      // Return success response with navigation
      res.json({
        showToast: {
          text: `Leaderboard posted! ${entries.length} players featured.`,
          appearance: 'success',
        },
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      });
    } catch (error) {
      console.error(`Error creating leaderboard post: ${error}`);

      // Return error toast
      res.json({
        showToast: {
          text: 'Failed to create leaderboard post. Please try again.',
          appearance: 'neutral',
        },
      });
    }
  }
);

// Weekly leaderboard menu action
router.post(
  '/internal/menu/weekly-leaderboard',
  async (_req, res: express.Response<UIResponse>): Promise<void> => {
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

      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];

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

      // Collect data for each day of the week
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];

        try {
          const dailyLeaderboard = await leaderboardService.getDailyLeaderboard(dateStr, 50); // Get more entries for aggregation

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

      // Convert to sorted array
      const weeklyEntries = Object.entries(weeklyData)
        .map(([username, data]) => ({
          username,
          totalScore: data.totalScore,
          puzzlesSolved: data.puzzlesSolved,
          bestTime: data.bestTime,
          avgDifficulty: Array.from(data.difficulties).join(', '),
        }))
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 15); // Top 15 for weekly

      if (weeklyEntries.length === 0) {
        // Create a post encouraging participation
        const emptyWeeklyText = `# 🏆 ReflectIQ Weekly Leaderboard

**Week of ${weekStartStr} to ${weekEndStr}**

**No submissions this week yet!** 🎯

Be the first to solve this week's ReflectIQ puzzles and dominate the weekly leaderboard!

## 🎮 How to Compete:
1. **Play daily puzzles** throughout the week
2. **Solve multiple difficulties** for maximum points
3. **Aim for speed and accuracy** to boost your scores
4. **Use fewer hints** for better score multipliers

## 🏆 Weekly Competition:
- **Total Score:** Sum of all your daily puzzle scores
- **Puzzles Solved:** Number of puzzles completed this week
- **Best Time:** Your fastest puzzle completion
- **Variety Bonus:** Playing different difficulties

## 📅 This Week's Challenge:
New puzzles are posted daily at midnight. The more you play, the higher you climb!

---

**Ready to start your weekly climb?** Find today's puzzle and begin your journey to the top! 🚀✨`;

        const post = await reddit.submitPost({
          subredditName: context.subredditName,
          title: `🏆 Weekly ReflectIQ Leaderboard - Week ${weekStartStr}`,
          text: emptyWeeklyText,
        });

        console.log(`Empty weekly leaderboard post created: ${post.id}`);

        res.json({
          showToast: {
            text: 'Weekly leaderboard posted! Be the first to compete this week!',
            appearance: 'success',
          },
          navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
        });
        return;
      }

      // Format weekly leaderboard as Reddit post content
      let postContent = `# 🏆 ReflectIQ Weekly Leaderboard

**Week of ${weekStartStr} to ${weekEndStr}**

**This Week's Top Puzzle Masters!** 🎯

## 📊 Weekly Statistics:
- **Active Players:** ${weeklyEntries.length}
- **Total Puzzles Solved:** ${weeklyEntries.reduce((sum, entry) => sum + entry.puzzlesSolved, 0)}
- **Average Score:** ${weeklyEntries.length > 0 ? Math.round(weeklyEntries.reduce((sum, entry) => sum + entry.totalScore, 0) / weeklyEntries.length) : 0}

## 🥇 Top 15 Weekly Performers:

| Rank | Player | Total Score | Puzzles Solved | Best Time | Difficulties |
|------|--------|-------------|----------------|-----------|--------------|`;

      weeklyEntries.forEach((entry, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        const bestTimeFormatted = `${Math.floor(entry.bestTime / 60)}:${(entry.bestTime % 60).toString().padStart(2, '0')}`;

        postContent += `\n| ${medal} | u/${entry.username} | ${entry.totalScore} | ${entry.puzzlesSolved} | ${bestTimeFormatted} | ${entry.avgDifficulty} |`;
      });

      postContent += `

---

## 🎯 Weekly Competition Rules:
- **Play Daily:** Each day's puzzle contributes to your weekly total
- **Multiple Difficulties:** Try Easy, Medium, and Hard for variety
- **Consistency Wins:** Regular play beats occasional high scores
- **Speed Matters:** Faster completion times boost your ranking

## 💡 Weekly Strategy Tips:
- **Start Early:** More days = more opportunities to score
- **Mix Difficulties:** Don't stick to just one level
- **Learn from Mistakes:** Each puzzle teaches new techniques
- **Use Hints Wisely:** Sometimes a small penalty beats getting stuck

## 🔄 Weekly Reset:
The weekly leaderboard resets every Sunday. New week, new chances to climb to the top!

*Keep playing daily puzzles to maintain your weekly ranking!* ⚡🏆`;

      // Create the weekly leaderboard post
      const post = await reddit.submitPost({
        subredditName: context.subredditName,
        title: `🏆 Weekly ReflectIQ Leaderboard - Week ${weekStartStr}`,
        text: postContent,
      });

      console.log(`Weekly leaderboard post created successfully: ${post.id}`);

      // Return success response with navigation
      res.json({
        showToast: {
          text: `Weekly leaderboard posted! ${weeklyEntries.length} players featured.`,
          appearance: 'success',
        },
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      });
    } catch (error) {
      console.error(`Error creating weekly leaderboard post: ${error}`);

      // Return error toast
      res.json({
        showToast: {
          text: 'Failed to create weekly leaderboard post. Please try again.',
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
    console.log('Comment submission received:', commentData);

    // Extract comment information
    const { body: commentBody, author, postId } = commentData;

    if (!commentBody || !author || !postId) {
      console.log('Missing required comment data');
      res.json({
        status: 'success',
        message: 'Comment processed (missing data)',
      });
      return;
    }

    // Check if comment matches answer format: "Exit: [Cell]"
    const answerMatch = commentBody.match(/^Exit:\s*([A-Z]\d+)$/i);

    if (!answerMatch) {
      console.log('Comment does not match answer format:', commentBody);
      res.json({
        status: 'success',
        message: 'Comment processed (not an answer)',
      });
      return;
    }

    const answerCell = answerMatch[1].toUpperCase();
    console.log(`Processing answer submission: ${answerCell} from ${author}`);

    // Parse the answer cell (e.g., "A1" -> [0, 0])
    const letter = answerCell.charAt(0);
    const number = parseInt(answerCell.slice(1));

    if (!letter || isNaN(number)) {
      console.log('Invalid answer format:', answerCell);
      res.json({
        status: 'success',
        message: 'Comment processed (invalid format)',
      });
      return;
    }

    const row = letter.charCodeAt(0) - 65; // A=0, B=1, etc.
    const col = number - 1; // 1-based to 0-based
    const answer: [number, number] = [row, col];

    // TODO: Determine puzzle difficulty from post metadata or context
    // For now, we'll try to find an active session for this user
    const today = new Date().toISOString().split('T')[0];

    // Try to find the user's active session
    // This is a simplified approach - in production, we'd need better session management
    console.log(`Processing answer for user ${author}: ${answerCell} -> [${row}, ${col}]`);

    // TODO: Implement actual answer processing with session lookup and scoring
    // For now, just log the submission
    console.log('Answer submission logged successfully');

    res.json({
      status: 'success',
      message: 'Answer submission processed',
      data: {
        user: author,
        answer: answerCell,
        coordinates: answer,
      },
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
