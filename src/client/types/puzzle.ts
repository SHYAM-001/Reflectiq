export type MaterialType = 'mirror' | 'glass' | 'water' | 'metal' | 'absorber';

export interface Material {
  type: MaterialType;
  position: string;
  angle?: number; // For mirrors, in degrees (0-180)
}

export interface PuzzleData {
  gridSize: string;
  entry: string;
  exit: string;
  materials: Material[];
}

export interface GridPosition {
  row: number;
  col: number;
}

export const DIFFICULTY = {
  easy: '6x6',
  medium: '8x8',
  hard: '10x10',
} as const;
