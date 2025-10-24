// Core game types for Logic Reflections

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export type MaterialType = 'mirror' | 'water' | 'glass' | 'metal' | 'absorber' | 'empty';

export type Direction =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'northeast'
  | 'northwest'
  | 'southeast'
  | 'southwest';

export interface Coordinate {
  row: number;
  col: number;
  label: string; // e.g., "D5"
}

export interface ReflectionRule {
  type: MaterialType;
  behavior: 'reflect' | 'absorb' | 'split' | 'reverse' | 'diffuse';
  angle?: number; // For mirrors
  probability?: number; // For glass split behavior
  diffusionRange?: number; // For water diffusion
}

export interface GridCell {
  material: MaterialType;
  coordinate: Coordinate;
  color: string;
  reflectionBehavior: ReflectionRule;
}

export interface PathSegment {
  start: Coordinate;
  end: Coordinate;
  direction: Direction;
  material: MaterialType;
}

export interface LaserPath {
  segments: PathSegment[];
  exitPoint: Coordinate | null;
  isComplete: boolean;
}

export interface PuzzleConfiguration {
  id: string;
  difficulty: DifficultyLevel;
  grid: GridCell[][];
  laserEntry: Coordinate;
  correctExit: Coordinate;
  maxTime: number;
  baseScore: number;
  createdAt: Date;
}

export interface HintUsage {
  quadrant: number;
  timestamp: Date;
  pathRevealed: PathSegment[];
}

export interface ScoreCalculation {
  baseScore: number;
  hintMultiplier: number;
  timeMultiplier: number;
  finalScore: number;
  isCorrect: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  difficulty: DifficultyLevel;
  timeElapsed: number;
  hintsUsed: number;
  finalScore: number;
  timestamp: Date;
}
