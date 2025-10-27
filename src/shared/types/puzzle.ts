/**
 * Core puzzle and game state interfaces for ReflectIQ
 * Following Devvit Web patterns for shared type definitions
 */

// Difficulty levels with specific grid sizes optimized for Devvit viewport
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

// Grid coordinate system
export type GridPosition = [number, number]; // [x, y]

// Material types with their reflection behaviors
export type MaterialType = 'mirror' | 'water' | 'glass' | 'metal' | 'absorber';

// Material properties interface
export interface MaterialProperties {
  reflectivity: number; // 0-1, how much light is reflected
  transparency: number; // 0-1, how much light passes through
  diffusion: number; // 0-1, randomness factor for water
  absorption: boolean; // true for absorbers that stop the beam
}

// Individual material instance on the grid
export interface Material {
  type: MaterialType;
  position: GridPosition;
  angle?: number; // For mirrors, angle in degrees (0-360)
  properties: MaterialProperties;
}

// Laser path segment for physics calculations
export interface PathSegment {
  start: GridPosition;
  end: GridPosition;
  direction: number; // angle in degrees
  material?: Material; // material that caused this segment
}

// Complete laser path through the puzzle
export interface LaserPath {
  segments: PathSegment[];
  exit: GridPosition | null; // null if beam is absorbed
  terminated: boolean; // true if beam was absorbed
}

// Hint data for progressive revelation
export interface HintPath {
  hintLevel: 1 | 2 | 3 | 4; // which hint level (1-4)
  segments: PathSegment[]; // path segments revealed at this level
  revealedCells: GridPosition[]; // cells to highlight
  percentage: number; // percentage of total path revealed (25%, 50%, 75%, 100%)
}

// Core puzzle definition
export interface Puzzle {
  id: string; // format: puzzle_{difficulty}_{date}
  difficulty: Difficulty;
  gridSize: 6 | 8 | 10; // viewport-optimized sizes
  materials: Material[];
  entry: GridPosition; // laser entry point
  solution: GridPosition; // correct exit point
  solutionPath: LaserPath; // complete laser path from entry to exit
  hints: HintPath[]; // precomputed hint data (4 hints)
  createdAt: Date;
  materialDensity: number; // percentage of grid filled with materials
}

// Daily puzzle set containing all three difficulties
export interface DailyPuzzleSet {
  date: string; // YYYY-MM-DD format
  puzzles: {
    easy: Puzzle;
    medium: Puzzle;
    hard: Puzzle;
  };
  status: 'generating' | 'active' | 'completed' | 'archived';
  createdAt: Date;
}

// Difficulty-specific configuration
export interface DifficultyConfig {
  gridSize: 6 | 8 | 10;
  materialDensity: number; // target percentage (70%, 80%, 85%)
  allowedMaterials: MaterialType[];
  baseScore: number; // 150, 400, 800 points
  maxTime: number; // maximum time in seconds for scoring
}

// Game session tracking
export interface SessionData {
  sessionId: string;
  userId: string; // Reddit username
  puzzleId: string;
  difficulty: Difficulty;
  startTime: Date;
  hintsUsed: number;
  status: 'active' | 'submitted' | 'expired';
  currentHintLevel: number; // 0-4
}

// Player submission data
export interface Submission {
  userId: string; // Reddit username
  puzzleId: string;
  sessionId: string;
  answer: GridPosition;
  timeTaken: number; // seconds
  hintsUsed: number;
  score: number;
  correct: boolean;
  timestamp: Date;
  difficulty: Difficulty;
}

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number;
  username: string;
  difficulty: Difficulty;
  time: number; // seconds
  hints: number;
  score: number;
  timestamp: Date;
}

// Complete leaderboard for a puzzle or day
export interface Leaderboard {
  id: string; // puzzle ID or date
  type: 'puzzle' | 'daily';
  entries: LeaderboardEntry[];
  totalPlayers: number;
  generatedAt: Date;
}

// Redis data schema interfaces
export interface RedisSchema {
  // Daily puzzles: reflectiq:puzzles:{date}
  puzzles: DailyPuzzleSet;

  // User sessions: reflectiq:sessions:{sessionId}
  sessions: SessionData;

  // Submissions: reflectiq:submissions:{puzzleId}
  submissions: Record<string, Submission>; // keyed by userId

  // Leaderboards: reflectiq:leaderboard:{puzzleId} or reflectiq:leaderboard:daily:{date}
  leaderboards: LeaderboardEntry[]; // stored as Redis sorted sets
}
