// API routes for puzzle filtering and navigation

import { Router } from 'express';
import type { Request, Response } from 'express';
import type {
  FilterQuery,
  DifficultyLevel,
  PaginatedResponse,
  PuzzlePost,
} from '../../shared/types/index.js';
import { PuzzleFilterService } from '../services/PuzzleFilterService.js';
import { RedisManager } from '../services/RedisManager.js';

const router = Router();

// Initialize services
const redis = new RedisManager();
const puzzleFilterService = new PuzzleFilterService(redis);

/**
 * GET /api/puzzles/filter
 * Get filtered puzzles with pagination
 */
router.get('/filter', async (req: Request, res: Response) => {
  try {
    const query: FilterQuery = {
      difficulty: req.query.difficulty as DifficultyLevel | undefined,
      sortBy: (req.query.sortBy as 'date' | 'difficulty' | 'participants') || 'date',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 20, 100), // Max 100 per page
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
      minParticipants: req.query.minParticipants
        ? parseInt(req.query.minParticipants as string)
        : undefined,
    };

    const result = await puzzleFilterService.getFilteredPuzzles(query);
    res.json(result);
  } catch (error) {
    console.error('Error in /api/puzzles/filter:', error);
    res.status(500).json({ error: 'Failed to filter puzzles' });
  }
});

/**
 * GET /api/puzzles/search
 * Search puzzles by text content
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const searchTerm = req.query.q as string;
    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({ error: 'Search term must be at least 2 characters' });
    }

    const query: FilterQuery = {
      difficulty: req.query.difficulty as DifficultyLevel | undefined,
      sortBy: (req.query.sortBy as 'date' | 'difficulty' | 'participants') || 'date',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
    };

    const result = await puzzleFilterService.searchPuzzles(searchTerm.trim(), query);
    res.json(result);
  } catch (error) {
    console.error('Error in /api/puzzles/search:', error);
    res.status(500).json({ error: 'Failed to search puzzles' });
  }
});

/**
 * GET /api/puzzles/difficulty/:difficulty
 * Get puzzles by difficulty level
 */
router.get('/difficulty/:difficulty', async (req: Request, res: Response) => {
  try {
    const difficulty = req.params.difficulty as DifficultyLevel;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({ error: 'Invalid difficulty level' });
    }

    const puzzles = await puzzleFilterService.getPuzzlesByDifficulty(difficulty, limit);
    res.json(puzzles);
  } catch (error) {
    console.error('Error in /api/puzzles/difficulty:', error);
    res.status(500).json({ error: 'Failed to get puzzles by difficulty' });
  }
});

/**
 * GET /api/puzzles/recent
 * Get recent puzzles
 */
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const puzzles = await puzzleFilterService.getRecentPuzzles(limit);
    res.json(puzzles);
  } catch (error) {
    console.error('Error in /api/puzzles/recent:', error);
    res.status(500).json({ error: 'Failed to get recent puzzles' });
  }
});

/**
 * GET /api/puzzles/popular
 * Get popular puzzles (by participant count)
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const puzzles = await puzzleFilterService.getPopularPuzzles(limit);
    res.json(puzzles);
  } catch (error) {
    console.error('Error in /api/puzzles/popular:', error);
    res.status(500).json({ error: 'Failed to get popular puzzles' });
  }
});

/**
 * GET /api/puzzles/stats
 * Get puzzle statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await puzzleFilterService.getPuzzleStats();
    res.json(stats);
  } catch (error) {
    console.error('Error in /api/puzzles/stats:', error);
    res.status(500).json({ error: 'Failed to get puzzle statistics' });
  }
});

/**
 * GET /api/puzzles/:id
 * Get puzzle by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const puzzleId = req.params.id;
    const puzzle = await puzzleFilterService.getPuzzleById(puzzleId);

    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }

    res.json(puzzle);
  } catch (error) {
    console.error('Error in /api/puzzles/:id:', error);
    res.status(500).json({ error: 'Failed to get puzzle' });
  }
});

/**
 * PATCH /api/puzzles/:id/metadata
 * Update puzzle metadata
 */
router.patch('/:id/metadata', async (req: Request, res: Response) => {
  try {
    const puzzleId = req.params.id;
    const updates = req.body;

    // Validate update fields
    const allowedFields = ['participantCount', 'averageScore', 'isActive'];
    const validUpdates: any = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        validUpdates[field] = updates[field];
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid update fields provided' });
    }

    await puzzleFilterService.updatePuzzleMetadata(puzzleId, validUpdates);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in /api/puzzles/:id/metadata:', error);
    res.status(500).json({ error: 'Failed to update puzzle metadata' });
  }
});

export { router as puzzleFilterRoutes };
