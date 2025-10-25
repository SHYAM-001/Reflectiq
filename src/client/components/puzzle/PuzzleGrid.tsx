import { PuzzleData } from "../../types/puzzle";
import { GridCell } from "./GridCell";
import { useMemo } from "react";

interface PuzzleGridProps {
  puzzleData: PuzzleData;
  revealedQuadrants: number[];
  showLaser?: boolean;
}

export const PuzzleGrid = ({
  puzzleData,
  revealedQuadrants,
  showLaser = false,
}: PuzzleGridProps) => {
  const [rows, cols] = useMemo(() => {
    const [r, c] = puzzleData.gridSize.split("x").map(Number);
    return [r, c];
  }, [puzzleData.gridSize]);

  const getCellPosition = (row: number, col: number): string => {
    const letter = String.fromCharCode(65 + row); // A, B, C...
    return `${letter}${col + 1}`;
  };

  const getMaterialAtPosition = (position: string) => {
    return puzzleData.materials.find((m) => m.position === position);
  };

  const isRevealed = (row: number, col: number): boolean => {
    const midRow = Math.floor(rows / 2);
    const midCol = Math.floor(cols / 2);

    // Quadrant 1: top-left (0), top-right (1), bottom-left (2), bottom-right (3)
    if (row < midRow && col < midCol) return revealedQuadrants.includes(0);
    if (row < midRow && col >= midCol) return revealedQuadrants.includes(1);
    if (row >= midRow && col < midCol) return revealedQuadrants.includes(2);
    if (row >= midRow && col >= midCol) return revealedQuadrants.includes(3);
    return false;
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto p-4">
      <div
        className="grid gap-1 md:gap-2 w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: rows }, (_, row) =>
          Array.from({ length: cols }, (_, col) => {
            const position = getCellPosition(row, col);
            const material = getMaterialAtPosition(position);
            const isEntry = position === puzzleData.entry;
            const isExit = position === puzzleData.exit;
            const revealed = isRevealed(row, col);

            return (
              <GridCell
                key={position}
                position={position}
                material={material}
                isEntry={isEntry}
                isExit={isExit}
                isRevealed={revealed}
              />
            );
          })
        )}
      </div>

      {/* Laser beam overlay - simplified visual representation */}
      {showLaser && (
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full">
            <line
              x1="10%"
              y1="10%"
              x2="90%"
              y2="90%"
              stroke="hsl(var(--laser))"
              strokeWidth="2"
              strokeDasharray="5,5"
              className="animate-laser-flow drop-shadow-[0_0_10px_rgba(255,45,85,0.8)]"
            />
          </svg>
        </div>
      )}
    </div>
  );
};
