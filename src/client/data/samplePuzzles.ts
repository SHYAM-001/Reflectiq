import { PuzzleData } from "../types/puzzle";

export const samplePuzzle: PuzzleData = {
  gridSize: "8x8",
  entry: "A1",
  exit: "H8",
  materials: [
    { type: "mirror", position: "B3", angle: 45 },
    { type: "mirror", position: "C5", angle: 135 },
    { type: "mirror", position: "E2", angle: 90 },
    { type: "mirror", position: "F7", angle: 45 },
    { type: "glass", position: "D4" },
    { type: "water", position: "E5" },
    { type: "metal", position: "B6" },
    { type: "absorber", position: "G3" },
    { type: "mirror", position: "D7", angle: 120 },
    { type: "glass", position: "A5" },
  ],
};

export const easyPuzzle: PuzzleData = {
  gridSize: "6x6",
  entry: "A1",
  exit: "F6",
  materials: [
    { type: "mirror", position: "B2", angle: 45 },
    { type: "mirror", position: "D4", angle: 135 },
    { type: "glass", position: "C3" },
    { type: "water", position: "E2" },
  ],
};

export const hardPuzzle: PuzzleData = {
  gridSize: "10x10",
  entry: "A1",
  exit: "J10",
  materials: [
    { type: "mirror", position: "B3", angle: 45 },
    { type: "mirror", position: "D2", angle: 90 },
    { type: "mirror", position: "C6", angle: 135 },
    { type: "mirror", position: "F5", angle: 60 },
    { type: "mirror", position: "H8", angle: 120 },
    { type: "mirror", position: "G3", angle: 45 },
    { type: "glass", position: "E4" },
    { type: "glass", position: "D7" },
    { type: "water", position: "F6" },
    { type: "water", position: "B8" },
    { type: "metal", position: "I4" },
    { type: "absorber", position: "E9" },
    { type: "mirror", position: "A7", angle: 90 },
    { type: "mirror", position: "I2", angle: 135 },
  ],
};
