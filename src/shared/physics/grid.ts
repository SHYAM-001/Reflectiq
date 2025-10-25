/**
 * Grid coordinate system and validation utilities
 * Handles grid boundaries, coordinate validation, and spatial calculations
 */

import { GridPosition } from '../types/puzzle.js';

// Check if position is within grid bounds
export function isWithinBounds(position: GridPosition, gridSize: number): boolean {
  const [x, y] = position;
  return x >= 0 && x < gridSize && y >= 0 && y < gridSize;
}

// Check if position is on the grid boundary (potential exit point)
export function isBoundaryPosition(position: GridPosition, gridSize: number): boolean {
  const [x, y] = position;
  return x === 0 || x === gridSize - 1 || y === 0 || y === gridSize - 1;
}

// Check if position is a valid exit point (on boundary)
export function isExitPoint(position: GridPosition, gridSize: number): boolean {
  return isWithinBounds(position, gridSize) && isBoundaryPosition(position, gridSize);
}

// Get which side of the grid a boundary position is on
export function getExitSide(
  position: GridPosition,
  gridSize: number
): 'top' | 'right' | 'bottom' | 'left' | null {
  const [x, y] = position;

  if (!isWithinBounds(position, gridSize)) {
    return null;
  }

  if (y === 0) return 'top';
  if (y === gridSize - 1) return 'bottom';
  if (x === 0) return 'left';
  if (x === gridSize - 1) return 'right';

  return null;
}

// Get all possible exit positions for a grid
export function getAllExitPositions(gridSize: number): GridPosition[] {
  const exits: GridPosition[] = [];

  // Top and bottom edges
  for (let x = 0; x < gridSize; x++) {
    exits.push([x, 0]); // Top edge
    exits.push([x, gridSize - 1]); // Bottom edge
  }

  // Left and right edges (excluding corners already added)
  for (let y = 1; y < gridSize - 1; y++) {
    exits.push([0, y]); // Left edge
    exits.push([gridSize - 1, y]); // Right edge
  }

  return exits;
}

// Get entry positions (typically one side of the grid)
export function getEntryPositions(
  gridSize: number,
  side: 'top' | 'right' | 'bottom' | 'left'
): GridPosition[] {
  const entries: GridPosition[] = [];

  switch (side) {
    case 'top':
      for (let x = 0; x < gridSize; x++) {
        entries.push([x, 0]);
      }
      break;
    case 'bottom':
      for (let x = 0; x < gridSize; x++) {
        entries.push([x, gridSize - 1]);
      }
      break;
    case 'left':
      for (let y = 0; y < gridSize; y++) {
        entries.push([0, y]);
      }
      break;
    case 'right':
      for (let y = 0; y < gridSize; y++) {
        entries.push([gridSize - 1, y]);
      }
      break;
  }

  return entries;
}

// Calculate Manhattan distance between two positions
export function getManhattanDistance(pos1: GridPosition, pos2: GridPosition): number {
  const [x1, y1] = pos1;
  const [x2, y2] = pos2;
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

// Calculate Euclidean distance between two positions
export function getEuclideanDistance(pos1: GridPosition, pos2: GridPosition): number {
  const [x1, y1] = pos1;
  const [x2, y2] = pos2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// Get neighboring positions (4-directional)
export function getNeighbors(position: GridPosition, gridSize: number): GridPosition[] {
  const [x, y] = position;
  const neighbors: GridPosition[] = [];

  const directions = [
    [0, -1], // Up
    [1, 0], // Right
    [0, 1], // Down
    [-1, 0], // Left
  ];

  for (const [dx, dy] of directions) {
    const newPos: GridPosition = [x + dx, y + dy];
    if (isWithinBounds(newPos, gridSize)) {
      neighbors.push(newPos);
    }
  }

  return neighbors;
}

// Get neighboring positions (8-directional, including diagonals)
export function getAllNeighbors(position: GridPosition, gridSize: number): GridPosition[] {
  const [x, y] = position;
  const neighbors: GridPosition[] = [];

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue; // Skip the center position

      const newPos: GridPosition = [x + dx, y + dy];
      if (isWithinBounds(newPos, gridSize)) {
        neighbors.push(newPos);
      }
    }
  }

  return neighbors;
}

// Convert grid position to string key for maps/sets
export function positionToKey(position: GridPosition): string {
  return `${position[0]},${position[1]}`;
}

// Convert string key back to grid position
export function keyToPosition(key: string): GridPosition {
  const [x, y] = key.split(',').map(Number);
  return [x, y];
}

// Check if two positions are equal
export function positionsEqual(pos1: GridPosition, pos2: GridPosition): boolean {
  return pos1[0] === pos2[0] && pos1[1] === pos2[1];
}

// Get random position within grid bounds
export function getRandomPosition(gridSize: number): GridPosition {
  const x = Math.floor(Math.random() * gridSize);
  const y = Math.floor(Math.random() * gridSize);
  return [x, y];
}

// Get random boundary position
export function getRandomBoundaryPosition(gridSize: number): GridPosition {
  const boundaryPositions = getAllExitPositions(gridSize);
  const randomIndex = Math.floor(Math.random() * boundaryPositions.length);
  return boundaryPositions[randomIndex];
}

// Get quadrant for hint system (1-4, top-left to bottom-right)
export function getQuadrant(position: GridPosition, gridSize: number): 1 | 2 | 3 | 4 {
  const [x, y] = position;
  const midX = gridSize / 2;
  const midY = gridSize / 2;

  if (x < midX && y < midY) return 1; // Top-left
  if (x >= midX && y < midY) return 2; // Top-right
  if (x < midX && y >= midY) return 3; // Bottom-left
  return 4; // Bottom-right
}

// Get all positions in a specific quadrant
export function getQuadrantPositions(quadrant: 1 | 2 | 3 | 4, gridSize: number): GridPosition[] {
  const positions: GridPosition[] = [];
  const midX = Math.floor(gridSize / 2);
  const midY = Math.floor(gridSize / 2);

  let startX: number, endX: number, startY: number, endY: number;

  switch (quadrant) {
    case 1: // Top-left
      startX = 0;
      endX = midX;
      startY = 0;
      endY = midY;
      break;
    case 2: // Top-right
      startX = midX;
      endX = gridSize;
      startY = 0;
      endY = midY;
      break;
    case 3: // Bottom-left
      startX = 0;
      endX = midX;
      startY = midY;
      endY = gridSize;
      break;
    case 4: // Bottom-right
      startX = midX;
      endX = gridSize;
      startY = midY;
      endY = gridSize;
      break;
  }

  for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
      positions.push([x, y]);
    }
  }

  return positions;
}
