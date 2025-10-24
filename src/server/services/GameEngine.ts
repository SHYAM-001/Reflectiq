// GameEngine service for server-side game logic

import type {
  PuzzleConfiguration,
  DifficultyLevel,
  Coordinate,
  LaserPath,
  ScoreCalculation,
  GameSession,
} from '../../shared/types/game.js';
import type {
  StartPuzzleRequest,
  PuzzleResponse,
  HintRequest,
  HintResponse,
  SubmitAnswerRequest,
  SubmissionResponse,
} from '../../shared/types/api.js';
import { PuzzleGenerator, LaserEngine, PathValidator } from '../../shared/index.js';
import {
  generateSessionId,
  parseAnswerFromComment,
  isValidAnswerFormat,
  calculateTimeBonus,
  labelToCoordinate,
} from '../../shared/utils.js';
import { HINT_MULTIPLIERS, BASE_SCORES, MAX_TIME_LIMITS } from '../../shared/constants.js';

export class GameEngine {
  private activeSessions = new Map<string, GameSession>();
  private puzzleCache = new Map<string, PuzzleConfiguration>();

  /**
   * Generate a new puzzle for the specified difficulty
   */
  generatePuzzle(difficulty: DifficultyLevel): PuzzleConfiguration {
    const puzzle = PuzzleGenerator.generatePuzzle(difficulty);

    // Cache the puzzle for validation later
    this.puzzleCache.set(puzzle.id, puzzle);

    return puzzle;
  }

  /**
   * Start a new puzzle session
   */
  startPuzzle(request: StartPuzzleRequest, userId: string): PuzzleResponse {
    const puzzle = this.generatePuzzle(request.difficulty);
    const sessionId = generateSessionId();
    const startTime = new Date();

    // Create game session
    const session: GameSession = {
      sessionId,
      puzzleId: puzzle.id,
      userId,
      startTime,
      hintsUsed: [],
      isActive: true,
    };

    this.activeSessions.set(sessionId, session);

    return {
      puzzle,
      sessionId,
      startTime,
    };
  }

  /**
   * Process hint request and return laser path for quadrant
   */
  processHintRequest(request: HintRequest): HintResponse {
    const session = this.activeSessions.get(request.sessionId);
    if (!session || !session.isActive) {
      throw new Error('Invalid or inactive session');
    }

    const puzzle = this.puzzleCache.get(request.puzzleId);
    if (!puzzle) {
      throw new Error('Puzzle not found');
    }

    // Check if hint already used
    if (session.hintsUsed.includes(request.quadrant)) {
      throw new Error('Hint already used for this quadrant');
    }

    // Check if maximum hints exceeded
    if (session.hintsUsed.length >= 4) {
      throw new Error('Maximum hints already used');
    }

    // Simulate laser path
    const initialDirection = LaserEngine.getEntryDirection(puzzle.laserEntry, puzzle.difficulty);
    const laserPath = LaserEngine.simulateLaserPath(
      puzzle.grid,
      puzzle.laserEntry,
      initialDirection,
      puzzle.difficulty
    );

    // Get segments for the requested quadrant
    const quadrantSegments = LaserEngine.getQuadrantSegments(
      laserPath,
      request.quadrant,
      puzzle.difficulty
    );

    // Update session with used hint
    session.hintsUsed.push(request.quadrant);
    this.activeSessions.set(request.sessionId, session);

    // Calculate new score multiplier
    const scoreMultiplier = HINT_MULTIPLIERS[session.hintsUsed.length] || 0.2;

    return {
      quadrant: request.quadrant,
      revealedPath: quadrantSegments,
      remainingHints: 4 - session.hintsUsed.length,
      scoreMultiplier,
    };
  }

  /**
   * Validate player answer and calculate score
   */
  validateAnswer(request: SubmitAnswerRequest): SubmissionResponse {
    const session = this.activeSessions.get(request.sessionId);
    if (!session || !session.isActive) {
      throw new Error('Invalid or inactive session');
    }

    const puzzle = this.puzzleCache.get(request.puzzleId);
    if (!puzzle) {
      throw new Error('Puzzle not found');
    }

    // Parse and validate answer format
    const playerAnswer = parseAnswerFromComment(request.answer) || request.answer;
    if (!isValidAnswerFormat(playerAnswer)) {
      throw new Error('Invalid answer format. Use format like "Exit: D5"');
    }

    // Convert answer to coordinate
    const playerCoordinate = labelToCoordinate(playerAnswer);
    const correctExit = puzzle.correctExit;

    // Check if answer is correct
    const isCorrect =
      playerCoordinate.row === correctExit.row && playerCoordinate.col === correctExit.col;

    // Calculate score
    const scoreCalculation = this.calculateScore(
      puzzle.baseScore,
      session.hintsUsed.length,
      request.timeElapsed,
      puzzle.maxTime,
      isCorrect
    );

    // Deactivate session
    session.isActive = false;
    this.activeSessions.set(request.sessionId, session);

    return {
      isCorrect,
      correctExit,
      playerAnswer: {
        row: playerCoordinate.row,
        col: playerCoordinate.col,
        label: playerAnswer,
      },
      score: scoreCalculation,
      leaderboardPosition: 0, // Will be updated by leaderboard service
    };
  }

  /**
   * Calculate final score with all multipliers
   */
  calculateScore(
    baseScore: number,
    hintsUsed: number,
    timeElapsed: number,
    maxTime: number,
    isCorrect: boolean
  ): ScoreCalculation {
    // No score if answer is incorrect
    if (!isCorrect) {
      return {
        baseScore,
        hintMultiplier: 0,
        timeMultiplier: 0,
        finalScore: 0,
        isCorrect: false,
      };
    }

    // Calculate multipliers
    const hintMultiplier = HINT_MULTIPLIERS[hintsUsed] || 0.2;
    const timeMultiplier = calculateTimeBonus(timeElapsed, maxTime);

    // Calculate final score
    const finalScore = Math.round(baseScore * hintMultiplier * timeMultiplier);

    return {
      baseScore,
      hintMultiplier,
      timeMultiplier,
      finalScore,
      isCorrect: true,
    };
  }

  /**
   * Simulate laser path for a puzzle
   */
  simulateLaserPath(puzzleId: string): LaserPath {
    const puzzle = this.puzzleCache.get(puzzleId);
    if (!puzzle) {
      throw new Error('Puzzle not found');
    }

    const initialDirection = LaserEngine.getEntryDirection(puzzle.laserEntry, puzzle.difficulty);
    return LaserEngine.simulateLaserPath(
      puzzle.grid,
      puzzle.laserEntry,
      initialDirection,
      puzzle.difficulty
    );
  }

  /**
   * Get puzzle by ID
   */
  getPuzzle(puzzleId: string): PuzzleConfiguration | null {
    return this.puzzleCache.get(puzzleId) || null;
  }

  /**
   * Get active session
   */
  getSession(sessionId: string): GameSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [sessionId, session] of this.activeSessions.entries()) {
      const sessionAge = now - session.startTime.getTime();
      if (sessionAge > maxSessionAge) {
        this.activeSessions.delete(sessionId);
      }
    }

    // Also cleanup old puzzles
    for (const [puzzleId, puzzle] of this.puzzleCache.entries()) {
      const puzzleAge = now - puzzle.createdAt.getTime();
      if (puzzleAge > maxSessionAge) {
        this.puzzleCache.delete(puzzleId);
      }
    }
  }

  /**
   * Get game statistics
   */
  getGameStats(): {
    activeSessions: number;
    cachedPuzzles: number;
    totalSessions: number;
  } {
    return {
      activeSessions: Array.from(this.activeSessions.values()).filter((s) => s.isActive).length,
      cachedPuzzles: this.puzzleCache.size,
      totalSessions: this.activeSessions.size,
    };
  }

  /**
   * Validate puzzle solvability
   */
  validatePuzzleSolvability(puzzleId: string): boolean {
    const puzzle = this.puzzleCache.get(puzzleId);
    if (!puzzle) {
      return false;
    }

    const validation = PathValidator.validatePuzzleSolvability(
      puzzle.grid,
      puzzle.laserEntry,
      puzzle.difficulty
    );

    return validation.isValid;
  }

  /**
   * Generate daily puzzle set
   */
  generateDailyPuzzleSet(): {
    easy: PuzzleConfiguration;
    medium: PuzzleConfiguration;
    hard: PuzzleConfiguration;
  } {
    const puzzleSet = PuzzleGenerator.generateDailyPuzzleSet();

    // Cache all puzzles
    this.puzzleCache.set(puzzleSet.easy.id, puzzleSet.easy);
    this.puzzleCache.set(puzzleSet.medium.id, puzzleSet.medium);
    this.puzzleCache.set(puzzleSet.hard.id, puzzleSet.hard);

    return puzzleSet;
  }

  /**
   * Get hint usage for session
   */
  getHintUsage(sessionId: string): number[] {
    const session = this.activeSessions.get(sessionId);
    return session?.hintsUsed || [];
  }

  /**
   * Check if session is active
   */
  isSessionActive(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    return session?.isActive || false;
  }

  /**
   * End session (for timeout or manual termination)
   */
  endSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.activeSessions.set(sessionId, session);
    }
  }
}
