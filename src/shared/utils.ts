// Shared utility functions

import type { Coordinate, DifficultyLevel } from './types/game.js';
import { GRID_SIZES } from './constants.js';

/**
 * Convert row/col coordinates to grid label (e.g., row 3, col 4 -> "D5")
 */
export function coordinateToLabel(row: number, col: number): string {
  const letter = String.fromCharCode(65 + col); // A, B, C, etc.
  const number = row + 1; // 1-based indexing
  return `${letter}${number}`;
}

/**
 * Convert grid label to row/col coordinates (e.g., "D5" -> {row: 3, col: 4})
 */
export function labelToCoordinate(label: string): { row: number; col: number } {
  const letter = label.charAt(0).toUpperCase();
  const number = parseInt(label.slice(1), 10);

  const col = letter.charCodeAt(0) - 65; // A=0, B=1, etc.
  const row = number - 1; // Convert to 0-based indexing

  return { row, col };
}

/**
 * Create a coordinate object with label
 */
export function createCoordinate(row: number, col: number): Coordinate {
  return {
    row,
    col,
    label: coordinateToLabel(row, col),
  };
}

/**
 * Check if coordinates are within grid bounds
 */
export function isValidCoordinate(row: number, col: number, difficulty: DifficultyLevel): boolean {
  const gridSize = GRID_SIZES[difficulty];
  return row >= 0 && row < gridSize && col >= 0 && col < gridSize;
}

/**
 * Calculate distance between two coordinates
 */
export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const deltaRow = coord1.row - coord2.row;
  const deltaCol = coord1.col - coord2.col;
  return Math.sqrt(deltaRow * deltaRow + deltaCol * deltaCol);
}

/**
 * Get quadrant for a coordinate (0-3, starting from top-left)
 */
export function getQuadrant(coordinate: Coordinate, difficulty: DifficultyLevel): number {
  const gridSize = GRID_SIZES[difficulty];
  const midRow = Math.floor(gridSize / 2);
  const midCol = Math.floor(gridSize / 2);

  if (coordinate.row < midRow && coordinate.col < midCol) return 0; // Top-left
  if (coordinate.row < midRow && coordinate.col >= midCol) return 1; // Top-right
  if (coordinate.row >= midRow && coordinate.col < midCol) return 2; // Bottom-left
  return 3; // Bottom-right
}

/**
 * Generate a unique puzzle ID
 */
export function generatePuzzleId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `puzzle_${timestamp}_${random}`;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 12);
  return `session_${timestamp}_${random}`;
}

/**
 * Format time in MM:SS format
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Parse answer format from comment (e.g., "Exit: D5" -> "D5")
 */
export function parseAnswerFromComment(comment: string): string | null {
  const match = comment.match(/Exit:\s*([A-Z]\d+)/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Validate answer format
 */
export function isValidAnswerFormat(answer: string): boolean {
  return /^[A-Z]\d+$/.test(answer.toUpperCase());
}

/**
 * Calculate time bonus multiplier
 */
export function calculateTimeBonus(timeElapsed: number, maxTime: number): number {
  if (timeElapsed >= maxTime) return 0;
  return (maxTime - timeElapsed) / maxTime;
}

/**
 * Generate grid hash for uniqueness checking
 */
export function generateGridHash(grid: any[][]): string {
  const gridString = grid.map((row) => row.map((cell) => cell.material).join('')).join('');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < gridString.length; i++) {
    const char = gridString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(36);
}
