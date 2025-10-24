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
      minParticipants: req.query.minParticipants ? parseInt(req.query.minParticipants as string) : undefined,
    };\n\n    const result = await puzzleFilterService.getFilteredPuzzles(query);\n    res.json(result);\n  } catch (error) {\n    console.error('Error in /api/puzzles/filter:', error);\n    res.status(500).json({ error: 'Failed to filter puzzles' });\n  }\n});\n\n/**\n * GET /api/puzzles/search\n * Search puzzles by text content\n */\nrouter.get('/search', async (req: Request, res: Response) => {\n  try {\n    const searchTerm = req.query.q as string;\n    if (!searchTerm || searchTerm.trim().length < 2) {\n      return res.status(400).json({ error: 'Search term must be at least 2 characters' });\n    }\n\n    const query: FilterQuery = {\n      difficulty: req.query.difficulty as DifficultyLevel | undefined,\n      sortBy: (req.query.sortBy as 'date' | 'difficulty' | 'participants') || 'date',\n      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',\n      page: parseInt(req.query.page as string) || 1,\n      limit: Math.min(parseInt(req.query.limit as string) || 20, 100),\n      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,\n      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,\n      isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,\n    };\n\n    const result = await puzzleFilterService.searchPuzzles(searchTerm.trim(), query);\n    res.json(result);\n  } catch (error) {\n    console.error('Error in /api/puzzles/search:', error);\n    res.status(500).json({ error: 'Failed to search puzzles' });\n  }\n});\n\n/**\n * GET /api/puzzles/difficulty/:difficulty\n * Get puzzles by difficulty level\n */\nrouter.get('/difficulty/:difficulty', async (req: Request, res: Response) => {\n  try {\n    const difficulty = req.params.difficulty as DifficultyLevel;\n    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);\n\n    if (!['easy', 'medium', 'hard'].includes(difficulty)) {\n      return res.status(400).json({ error: 'Invalid difficulty level' });\n    }\n\n    const puzzles = await puzzleFilterService.getPuzzlesByDifficulty(difficulty, limit);\n    res.json(puzzles);\n  } catch (error) {\n    console.error('Error in /api/puzzles/difficulty:', error);\n    res.status(500).json({ error: 'Failed to get puzzles by difficulty' });\n  }\n});\n\n/**\n * GET /api/puzzles/recent\n * Get recent puzzles\n */\nrouter.get('/recent', async (req: Request, res: Response) => {\n  try {\n    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);\n    const puzzles = await puzzleFilterService.getRecentPuzzles(limit);\n    res.json(puzzles);\n  } catch (error) {\n    console.error('Error in /api/puzzles/recent:', error);\n    res.status(500).json({ error: 'Failed to get recent puzzles' });\n  }\n});\n\n/**\n * GET /api/puzzles/popular\n * Get popular puzzles (by participant count)\n */\nrouter.get('/popular', async (req: Request, res: Response) => {\n  try {\n    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);\n    const puzzles = await puzzleFilterService.getPopularPuzzles(limit);\n    res.json(puzzles);\n  } catch (error) {\n    console.error('Error in /api/puzzles/popular:', error);\n    res.status(500).json({ error: 'Failed to get popular puzzles' });\n  }\n});\n\n/**\n * GET /api/puzzles/stats\n * Get puzzle statistics\n */\nrouter.get('/stats', async (req: Request, res: Response) => {\n  try {\n    const stats = await puzzleFilterService.getPuzzleStats();\n    res.json(stats);\n  } catch (error) {\n    console.error('Error in /api/puzzles/stats:', error);\n    res.status(500).json({ error: 'Failed to get puzzle statistics' });\n  }\n});\n\n/**\n * GET /api/puzzles/:id\n * Get puzzle by ID\n */\nrouter.get('/:id', async (req: Request, res: Response) => {\n  try {\n    const puzzleId = req.params.id;\n    const puzzle = await puzzleFilterService.getPuzzleById(puzzleId);\n    \n    if (!puzzle) {\n      return res.status(404).json({ error: 'Puzzle not found' });\n    }\n\n    res.json(puzzle);\n  } catch (error) {\n    console.error('Error in /api/puzzles/:id:', error);\n    res.status(500).json({ error: 'Failed to get puzzle' });\n  }\n});\n\n/**\n * PATCH /api/puzzles/:id/metadata\n * Update puzzle metadata\n */\nrouter.patch('/:id/metadata', async (req: Request, res: Response) => {\n  try {\n    const puzzleId = req.params.id;\n    const updates = req.body;\n\n    // Validate update fields\n    const allowedFields = ['participantCount', 'averageScore', 'isActive'];\n    const validUpdates: any = {};\n\n    for (const field of allowedFields) {\n      if (updates[field] !== undefined) {\n        validUpdates[field] = updates[field];\n      }\n    }\n\n    if (Object.keys(validUpdates).length === 0) {\n      return res.status(400).json({ error: 'No valid update fields provided' });\n    }\n\n    await puzzleFilterService.updatePuzzleMetadata(puzzleId, validUpdates);\n    res.json({ success: true });\n  } catch (error) {\n    console.error('Error in /api/puzzles/:id/metadata:', error);\n    res.status(500).json({ error: 'Failed to update puzzle metadata' });\n  }\n});\n\nexport { router as puzzleFilterRoutes };"
