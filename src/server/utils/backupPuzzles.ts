/**
 * Backup Puzzle Templates for ReflectIQ
 * Provides fallback puzzles when generation fails
 */

import { Puzzle, Difficulty, Material, HintPath, LaserPath } from '../../shared/types/puzzle.js';

/**
 * Create a simple backup puzzle for the given difficulty
 */
export function createBackupPuzzle(difficulty: Difficulty, date: string): Puzzle {
  const templates = {
    Easy: createEasyBackupPuzzle,
    Medium: createMediumBackupPuzzle,
    Hard: createHardBackupPuzzle,
  };

  return templates[difficulty](date);
}

/**
 * Easy backup puzzle (6x6 grid)
 */
function createEasyBackupPuzzle(date: string): Puzzle {
  const materials: Material[] = [
    {
      type: 'mirror',
      position: [1, 2],
      angle: 45,
      properties: { reflectivity: 0.9, transparency: 0.0, diffusion: 0.0, absorption: false },
    },
    {
      type: 'mirror',
      position: [3, 4],
      angle: 135,
      properties: { reflectivity: 0.9, transparency: 0.0, diffusion: 0.0, absorption: false },
    },
    {
      type: 'absorber',
      position: [2, 3],
      properties: { reflectivity: 0.0, transparency: 0.0, diffusion: 0.0, absorption: true },
    },
  ];

  const entry: [number, number] = [0, 0];
  const solution: [number, number] = [5, 5];

  // Simple laser path for backup
  const solutionPath: LaserPath = {
    segments: [
      { start: [0, 0], end: [1, 2], direction: 45, material: materials[0] },
      { start: [1, 2], end: [3, 4], direction: 135, material: materials[1] },
      { start: [3, 4], end: [5, 5], direction: 45 },
    ],
    exit: solution,
    terminated: false,
  };

  const hints: HintPath[] = [
    {
      hintLevel: 1,
      segments: solutionPath.segments.slice(0, 1),
      revealedCells: [
        [0, 0],
        [1, 2],
      ],
      percentage: 25,
    },
    {
      hintLevel: 2,
      segments: solutionPath.segments.slice(0, 2),
      revealedCells: [
        [0, 0],
        [1, 2],
        [3, 4],
      ],
      percentage: 50,
    },
    {
      hintLevel: 3,
      segments: solutionPath.segments.slice(0, 3),
      revealedCells: [
        [0, 0],
        [1, 2],
        [3, 4],
        [5, 5],
      ],
      percentage: 75,
    },
    {
      hintLevel: 4,
      segments: solutionPath.segments,
      revealedCells: [
        [0, 0],
        [1, 2],
        [3, 4],
        [5, 5],
      ],
      percentage: 100,
    },
  ];

  return {
    id: `puzzle_easy_${date}_backup`,
    difficulty: 'Easy',
    gridSize: 6,
    materials,
    entry,
    solution,
    solutionPath,
    hints,
    createdAt: new Date(),
    materialDensity: materials.length / (6 * 6),
  };
}

/**
 * Medium backup puzzle (8x8 grid)
 */
function createMediumBackupPuzzle(date: string): Puzzle {
  const materials: Material[] = [
    {
      type: 'mirror',
      position: [1, 1],
      angle: 45,
      properties: { reflectivity: 0.9, transparency: 0.0, diffusion: 0.0, absorption: false },
    },
    {
      type: 'water',
      position: [3, 3],
      properties: { reflectivity: 0.7, transparency: 0.0, diffusion: 0.3, absorption: false },
    },
    {
      type: 'glass',
      position: [5, 2],
      properties: { reflectivity: 0.5, transparency: 0.5, diffusion: 0.0, absorption: false },
    },
    {
      type: 'mirror',
      position: [6, 6],
      angle: 135,
      properties: { reflectivity: 0.9, transparency: 0.0, diffusion: 0.0, absorption: false },
    },
    {
      type: 'absorber',
      position: [4, 4],
      properties: { reflectivity: 0.0, transparency: 0.0, diffusion: 0.0, absorption: true },
    },
  ];

  const entry: [number, number] = [0, 0];
  const solution: [number, number] = [7, 7];

  const solutionPath: LaserPath = {
    segments: [
      { start: [0, 0], end: [1, 1], direction: 45, material: materials[0] },
      { start: [1, 1], end: [3, 3], direction: 90, material: materials[1] },
      { start: [3, 3], end: [5, 2], direction: 135, material: materials[2] },
      { start: [5, 2], end: [6, 6], direction: 45, material: materials[3] },
      { start: [6, 6], end: [7, 7], direction: 45 },
    ],
    exit: solution,
    terminated: false,
  };

  const hints: HintPath[] = [
    {
      hintLevel: 1,
      segments: solutionPath.segments.slice(0, 1),
      revealedCells: [
        [0, 0],
        [1, 1],
      ],
      percentage: 25,
    },
    {
      hintLevel: 2,
      segments: solutionPath.segments.slice(0, 3),
      revealedCells: [
        [0, 0],
        [1, 1],
        [3, 3],
        [5, 2],
      ],
      percentage: 50,
    },
    {
      hintLevel: 3,
      segments: solutionPath.segments.slice(0, 4),
      revealedCells: [
        [0, 0],
        [1, 1],
        [3, 3],
        [5, 2],
        [6, 6],
      ],
      percentage: 75,
    },
    {
      hintLevel: 4,
      segments: solutionPath.segments,
      revealedCells: [
        [0, 0],
        [1, 1],
        [3, 3],
        [5, 2],
        [6, 6],
        [7, 7],
      ],
      percentage: 100,
    },
  ];

  return {
    id: `puzzle_medium_${date}_backup`,
    difficulty: 'Medium',
    gridSize: 8,
    materials,
    entry,
    solution,
    solutionPath,
    hints,
    createdAt: new Date(),
    materialDensity: materials.length / (8 * 8),
  };
}

/**
 * Hard backup puzzle (10x10 grid)
 */
function createHardBackupPuzzle(date: string): Puzzle {
  const materials: Material[] = [
    {
      type: 'mirror',
      position: [1, 2],
      angle: 45,
      properties: { reflectivity: 0.9, transparency: 0.0, diffusion: 0.0, absorption: false },
    },
    {
      type: 'metal',
      position: [3, 4],
      properties: { reflectivity: 1.0, transparency: 0.0, diffusion: 0.0, absorption: false },
    },
    {
      type: 'water',
      position: [5, 3],
      properties: { reflectivity: 0.7, transparency: 0.0, diffusion: 0.3, absorption: false },
    },
    {
      type: 'glass',
      position: [7, 6],
      properties: { reflectivity: 0.5, transparency: 0.5, diffusion: 0.0, absorption: false },
    },
    {
      type: 'mirror',
      position: [8, 8],
      angle: 135,
      properties: { reflectivity: 0.9, transparency: 0.0, diffusion: 0.0, absorption: false },
    },
    {
      type: 'absorber',
      position: [6, 5],
      properties: { reflectivity: 0.0, transparency: 0.0, diffusion: 0.0, absorption: true },
    },
    {
      type: 'mirror',
      position: [2, 7],
      angle: 90,
      properties: { reflectivity: 0.9, transparency: 0.0, diffusion: 0.0, absorption: false },
    },
  ];

  const entry: [number, number] = [0, 0];
  const solution: [number, number] = [9, 9];

  const solutionPath: LaserPath = {
    segments: [
      { start: [0, 0], end: [1, 2], direction: 45, material: materials[0] },
      { start: [1, 2], end: [3, 4], direction: 90, material: materials[1] },
      { start: [3, 4], end: [5, 3], direction: 180, material: materials[2] },
      { start: [5, 3], end: [7, 6], direction: 135, material: materials[3] },
      { start: [7, 6], end: [8, 8], direction: 45, material: materials[4] },
      { start: [8, 8], end: [9, 9], direction: 45 },
    ],
    exit: solution,
    terminated: false,
  };

  const hints: HintPath[] = [
    {
      hintLevel: 1,
      segments: solutionPath.segments.slice(0, 2),
      revealedCells: [
        [0, 0],
        [1, 2],
        [3, 4],
      ],
      percentage: 25,
    },
    {
      hintLevel: 2,
      segments: solutionPath.segments.slice(0, 3),
      revealedCells: [
        [0, 0],
        [1, 2],
        [3, 4],
        [5, 3],
      ],
      percentage: 50,
    },
    {
      hintLevel: 3,
      segments: solutionPath.segments.slice(0, 5),
      revealedCells: [
        [0, 0],
        [1, 2],
        [3, 4],
        [5, 3],
        [7, 6],
        [8, 8],
      ],
      percentage: 75,
    },
    {
      hintLevel: 4,
      segments: solutionPath.segments,
      revealedCells: [
        [0, 0],
        [1, 2],
        [3, 4],
        [5, 3],
        [7, 6],
        [8, 8],
        [9, 9],
      ],
      percentage: 100,
    },
  ];

  return {
    id: `puzzle_hard_${date}_backup`,
    difficulty: 'Hard',
    gridSize: 10,
    materials,
    entry,
    solution,
    solutionPath,
    hints,
    createdAt: new Date(),
    materialDensity: materials.length / (10 * 10),
  };
}
