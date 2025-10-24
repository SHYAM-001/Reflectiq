// Game constants and configuration

import type { DifficultyLevel, MaterialType, ReflectionRule } from './types/game.js';

// Grid size configuration
export const GRID_SIZES: Record<DifficultyLevel, number> = {
  easy: 6,
  medium: 8,
  hard: 10,
};

// Base scores by difficulty
export const BASE_SCORES: Record<DifficultyLevel, number> = {
  easy: 100,
  medium: 250,
  hard: 500,
};

// Maximum time limits (in seconds)
export const MAX_TIME_LIMITS: Record<DifficultyLevel, number> = {
  easy: 300, // 5 minutes
  medium: 600, // 10 minutes
  hard: 900, // 15 minutes
};

// Hint multipliers
export const HINT_MULTIPLIERS: Record<number, number> = {
  0: 1.0,
  1: 0.8,
  2: 0.6,
  3: 0.4,
  4: 0.2,
};

// Material colors
export const MATERIAL_COLORS: Record<MaterialType, string> = {
  mirror: '#C0C0C0', // Silver
  water: '#4A90E2', // Blue
  glass: '#7ED321', // Green
  metal: '#D0021B', // Red
  absorber: '#000000', // Black
  empty: '#FFFFFF', // White
};

// Material reflection behaviors
export const REFLECTION_BEHAVIORS: Record<MaterialType, ReflectionRule> = {
  mirror: {
    type: 'mirror',
    behavior: 'reflect',
    angle: 90,
  },
  water: {
    type: 'water',
    behavior: 'diffuse',
    diffusionRange: 1,
  },
  glass: {
    type: 'glass',
    behavior: 'split',
    probability: 0.5,
  },
  metal: {
    type: 'metal',
    behavior: 'reverse',
  },
  absorber: {
    type: 'absorber',
    behavior: 'absorb',
  },
  empty: {
    type: 'empty',
    behavior: 'reflect', // Pass through
  },
};

// API endpoints
export const API_ENDPOINTS = {
  START_PUZZLE: '/api/puzzle/start',
  GET_HINT: '/api/puzzle/hint',
  SUBMIT_ANSWER: '/api/puzzle/submit',
  GET_LEADERBOARD: '/api/leaderboard',
  GET_DAILY_PUZZLES: '/api/daily-puzzles',
  GET_PUZZLE_LIST: '/api/puzzles',
  CREATE_DAILY_PUZZLES: '/api/admin/create-daily-puzzles',
} as const;

// Quadrant definitions for hints
export const QUADRANTS = {
  TOP_LEFT: 0,
  TOP_RIGHT: 1,
  BOTTOM_LEFT: 2,
  BOTTOM_RIGHT: 3,
} as const;

// Direction vectors for laser movement
export const DIRECTION_VECTORS: Record<string, { row: number; col: number }> = {
  north: { row: -1, col: 0 },
  south: { row: 1, col: 0 },
  east: { row: 0, col: 1 },
  west: { row: 0, col: -1 },
  northeast: { row: -1, col: 1 },
  northwest: { row: -1, col: -1 },
  southeast: { row: 1, col: 1 },
  southwest: { row: 1, col: -1 },
};

// Reddit post configuration
export const REDDIT_CONFIG = {
  POST_TITLE_FORMAT: 'Logic Reflections - {difficulty} - {date}',
  DAILY_POST_TIME: '00:00:00', // UTC midnight
  FLAIR_COLORS: {
    easy: '#7ED321',
    medium: '#F5A623',
    hard: '#D0021B',
  },
} as const;
