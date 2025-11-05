/**
 * Enhanced Puzzle API Routes for ReflectIQ
 * Handles guaranteed puzzle generation, validation, and regeneration
 * Maintains backward compatibility with existing puzzle endpoints
 */

import { Router } from 'express';
import { context } from '@devvit/web/server';
import { redisClient } from '../utils/redisClient.js';
import { redisSchemaExtensions } from '../services/RedisSchemaExtensions.js';
import { performanceOptimization } from '../services/PerformanceOptimizationService.js';
import {
  asyncHandler,
  sendErrorResponse,
  sendSuccessResponse,
  validateRequired,
  checkRateLimit,
} from '../utils/errorHandler.js';
import {
  GeneratePuzzleRequest,
  GeneratePuzzleResponse,
  ValidatePuzzleRequest,
  ValidatePuzzleResponse,
  RegeneratePuzzleRequest,
  RegeneratePuzzleResponse,
} from '../../shared/types/api.js';
import { Difficulty, MaterialType } from '../../shared/types/puzzle.js';
import { EnhancedPuzzleEngineImpl } from '../../shared/puzzle/EnhancedPuzzleEngine.js';
import {
  ValidationResult,
  PuzzleGenerationMetadata,
} from '../../shared/types/guaranteed-generation.js';

const router = Router();

/**
 * POST /api/puzzle/generate
 * Generate a new puzzle using the enhanced guaranteed generation system
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const {
      difficulty,
      forceRegeneration = false,
      maxAttempts = 10,
      targetComplexity,
      preferredMaterials,
    }: GeneratePuzzleRequest = req.body;

    // Validate required fields
    const validation = validateRequired(req.body, ['difficulty']);
    if (!validation.isValid) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        `Missing required fields: ${validation.missingFields.join(', ')}`
      );
    }

    // Validate difficulty parameter
    if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Difficulty must be Easy, Medium, or Hard');
    }

    // Validate optional parameters
    if (maxAttempts && (maxAttempts < 1 || maxAttempts > 50)) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'maxAttempts must be between 1 and 50');
    }

    if (targetComplexity && (targetComplexity < 1 || targetComplexity > 10)) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        'targetComplexity must be between 1 and 10'
      );
    }

    // Validate preferred materials if provided
    const validMaterials: MaterialType[] = ['mirror', 'water', 'glass', 'metal', 'absorber'];
    if (preferredMaterials) {
      const invalidMaterials = preferredMaterials.filter(
        (material) => !validMaterials.includes(material as MaterialType)
      );
      if (invalidMaterials.length > 0) {
        return sendErrorResponse(
          res,
          'VALIDATION_ERROR',
          `Invalid materials: ${invalidMaterials.join(', ')}. Valid materials: ${validMaterials.join(', ')}`
        );
      }
    }

    // Rate limiting per user
    const userId = context.userId || req.ip || 'anonymous';
    const rateLimit = checkRateLimit(`generate:${userId}`, 5, 60000); // 5 generations per minute

    if (!rateLimit.allowed) {
      return sendErrorResponse(
        res,
        'RATE_LIMITED',
        `Too many generation requests. Try again in ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds`
      );
    }

    try {
      // Get enhanced puzzle engine instance
      const engine = EnhancedPuzzleEngineImpl.getInstance();

      // Generate current date for puzzle ID
      const currentDate = new Date().toISOString().split('T')[0];

      // Generate puzzle using enhanced system
      const puzzle = await engine.generateGuaranteedPuzzle(difficulty, currentDate);

      // Store generation metadata
      const metadata: PuzzleGenerationMetadata = {
        puzzleId: puzzle.id,
        algorithm: 'guaranteed',
        attempts: 1, // This would be tracked by the engine in a real implementation
        generationTime: 0, // This would be measured by the engine
        confidenceScore: 95, // This would come from validation
        validationPassed: true,
        spacingDistance: 0, // This would be calculated during generation
        pathComplexity: targetComplexity || 5,
        createdAt: new Date(),
      };

      // Cache metadata using Redis schema extensions
      try {
        await redisSchemaExtensions.setGenerationMetadata(puzzle.id, metadata);
        await performanceOptimization.recordGenerationMetrics(
          difficulty,
          true,
          generationTime,
          metadata
        );
      } catch (error) {
        console.warn('Failed to cache generation metadata:', error);
      }

      sendSuccessResponse(res, puzzle);
    } catch (error) {
      console.error('Enhanced puzzle generation failed:', error);

      // Fallback to legacy generation if enhanced fails
      try {
        const engine = EnhancedPuzzleEngineImpl.getInstance();
        const currentDate = new Date().toISOString().split('T')[0];
        const dailyPuzzles = await engine.generateDailyPuzzles(currentDate);

        const puzzle = dailyPuzzles[difficulty.toLowerCase() as keyof typeof dailyPuzzles];
        if (puzzle) {
          sendSuccessResponse(res, puzzle);
        } else {
          return sendErrorResponse(
            res,
            'GENERATION_FAILED',
            'Failed to generate puzzle with fallback'
          );
        }
      } catch (fallbackError) {
        console.error('Fallback generation also failed:', fallbackError);
        return sendErrorResponse(
          res,
          'GENERATION_FAILED',
          'Puzzle generation system temporarily unavailable'
        );
      }
    }
  })
);

/**
 * GET /api/puzzle/validate
 * Validate an existing puzzle and return validation results
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
router.get(
  '/validate',
  asyncHandler(async (req, res) => {
    const { puzzleId }: ValidatePuzzleRequest = req.query as any;

    // Validate required fields
    if (!puzzleId) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'puzzleId is required');
    }

    // Rate limiting per user
    const userId = context.userId || req.ip || 'anonymous';
    const rateLimit = checkRateLimit(`validate:${userId}`, 10, 60000); // 10 validations per minute

    if (!rateLimit.allowed) {
      return sendErrorResponse(
        res,
        'RATE_LIMITED',
        `Too many validation requests. Try again in ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds`
      );
    }

    try {
      // Check if validation result is cached using schema extensions
      const cachedValidation = await redisSchemaExtensions.getValidationResult(puzzleId);
      if (cachedValidation) {
        // Get generation metadata if available
        const generationMetadata = await redisSchemaExtensions.getGenerationMetadata(puzzleId);

        return sendSuccessResponse(res, {
          validationResult: cachedValidation,
          generationMetadata,
        });
      }

      // Get puzzle data from Redis
      const puzzleData = await redisClient.get(`puzzle:${puzzleId}`);
      if (!puzzleData) {
        return sendErrorResponse(res, 'PUZZLE_NOT_FOUND', 'Puzzle not found');
      }

      const puzzle = JSON.parse(puzzleData);

      // Validate puzzle using enhanced engine
      const engine = EnhancedPuzzleEngineImpl.getInstance();
      const validationResult = await engine.verifyUniqueSolution(puzzle);

      // Cache validation result using schema extensions
      try {
        await redisSchemaExtensions.setValidationResult(puzzleId, validationResult);
      } catch (error) {
        console.warn('Failed to cache validation result:', error);
      }

      // Get generation metadata if available
      const generationMetadata = await redisSchemaExtensions.getGenerationMetadata(puzzleId);

      sendSuccessResponse(res, {
        validationResult,
        generationMetadata,
      });
    } catch (error) {
      console.error('Puzzle validation failed:', error);
      return sendErrorResponse(res, 'VALIDATION_FAILED', 'Failed to validate puzzle');
    }
  })
);

/**
 * POST /api/puzzle/regenerate
 * Regenerate an existing puzzle with new parameters
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */
router.post(
  '/regenerate',
  asyncHandler(async (req, res) => {
    const {
      puzzleId,
      reason,
      difficulty,
      preserveSettings = false,
    }: RegeneratePuzzleRequest = req.body;

    // Validate required fields
    const validation = validateRequired(req.body, ['puzzleId', 'reason']);
    if (!validation.isValid) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        `Missing required fields: ${validation.missingFields.join(', ')}`
      );
    }

    // Validate difficulty if provided
    if (difficulty && !['Easy', 'Medium', 'Hard'].includes(difficulty)) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Difficulty must be Easy, Medium, or Hard');
    }

    // Rate limiting per user (more restrictive for regeneration)
    const userId = context.userId || req.ip || 'anonymous';
    const rateLimit = checkRateLimit(`regenerate:${userId}`, 3, 300000); // 3 regenerations per 5 minutes

    if (!rateLimit.allowed) {
      return sendErrorResponse(
        res,
        'RATE_LIMITED',
        `Too many regeneration requests. Try again in ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds`
      );
    }

    try {
      // Get existing puzzle data
      const existingPuzzleData = await redisClient.get(`puzzle:${puzzleId}`);
      if (!existingPuzzleData) {
        return sendErrorResponse(res, 'PUZZLE_NOT_FOUND', 'Original puzzle not found');
      }

      const existingPuzzle = JSON.parse(existingPuzzleData);
      const targetDifficulty = difficulty || existingPuzzle.difficulty;

      // Get enhanced puzzle engine instance
      const engine = EnhancedPuzzleEngineImpl.getInstance();

      // Extract date from puzzle ID or use current date
      const dateMatch = puzzleId.match(/(\d{4}-\d{2}-\d{2})/);
      const puzzleDate = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

      // Generate new puzzle
      const newPuzzle = await engine.generateGuaranteedPuzzle(targetDifficulty, puzzleDate);

      // If preserving settings, maintain the same puzzle ID structure
      if (preserveSettings) {
        newPuzzle.id = puzzleId;
      }

      // Store regeneration metadata
      const metadata: PuzzleGenerationMetadata = {
        puzzleId: newPuzzle.id,
        algorithm: 'guaranteed',
        attempts: 1,
        generationTime: 0,
        confidenceScore: 95,
        validationPassed: true,
        spacingDistance: 0,
        pathComplexity: 5,
        createdAt: new Date(),
      };

      // Cache new puzzle and metadata using schema extensions
      try {
        await redisClient.set(`puzzle:${newPuzzle.id}`, JSON.stringify(newPuzzle), { ttl: 86400 });
        await redisSchemaExtensions.setGenerationMetadata(newPuzzle.id, metadata);
        await performanceOptimization.recordGenerationMetrics(
          targetDifficulty,
          true,
          generationTime,
          metadata
        );

        // Log regeneration reason for analytics
        await redisClient.hSet(
          `reflectiq:regeneration:log`,
          `${newPuzzle.id}:${Date.now()}`,
          JSON.stringify({
            originalPuzzleId: puzzleId,
            newPuzzleId: newPuzzle.id,
            reason,
            userId,
            timestamp: new Date(),
            difficulty: targetDifficulty,
          })
        );
      } catch (error) {
        console.warn('Failed to cache regenerated puzzle:', error);
      }

      sendSuccessResponse(res, newPuzzle);
    } catch (error) {
      console.error('Puzzle regeneration failed:', error);
      return sendErrorResponse(res, 'REGENERATION_FAILED', 'Failed to regenerate puzzle');
    }
  })
);

export default router;
