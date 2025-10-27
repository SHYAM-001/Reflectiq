import { Puzzle, HintPath, PathSegment } from '../../types/api';
import { GridCell } from './GridCell';
import { useMemo } from 'react';

interface PuzzleGridProps {
  puzzle: Puzzle;
  hintPaths: HintPath[];
}

export const PuzzleGrid = ({ puzzle, hintPaths }: PuzzleGridProps) => {
  const gridSize = puzzle.gridSize;

  const getMaterialAtPosition = (row: number, col: number) => {
    return puzzle.materials.find((m) => m.position[0] === row && m.position[1] === col);
  };

  // Get all revealed path segments based on hints used
  const revealedSegments = useMemo(() => {
    const segments: PathSegment[] = [];
    for (const hintPath of hintPaths) {
      segments.push(...hintPath.segments);
    }
    return segments;
  }, [hintPaths]);

  // Check if a cell is part of the revealed laser path
  const isOnLaserPath = (row: number, col: number): boolean => {
    return revealedSegments.some(
      (segment) =>
        (segment.start[0] === row && segment.start[1] === col) ||
        (segment.end[0] === row && segment.end[1] === col)
    );
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto p-4">
      <div
        className="grid gap-1 md:gap-2 w-full"
        style={{
          gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: gridSize }, (_, row) =>
          Array.from({ length: gridSize }, (_, col) => {
            const material = getMaterialAtPosition(row, col);
            const isEntry = puzzle.entry[0] === row && puzzle.entry[1] === col;
            const isExit = puzzle.solution[0] === row && puzzle.solution[1] === col;
            const isOnPath = isOnLaserPath(row, col);

            return (
              <GridCell
                key={`${row}-${col}`}
                row={row}
                col={col}
                material={material}
                isEntry={isEntry}
                isExit={isExit}
                isOnLaserPath={isOnPath}
              />
            );
          })
        )}
      </div>

      {/* Laser path overlay */}
      {revealedSegments.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full" viewBox={`0 0 ${gridSize} ${gridSize}`}>
            {revealedSegments.map((segment, index) => {
              const x1 = segment.start[1] + 0.5; // col + center offset
              const y1 = segment.start[0] + 0.5; // row + center offset
              const x2 = segment.end[1] + 0.5;
              const y2 = segment.end[0] + 0.5;

              return (
                <line
                  key={index}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#ff2d55"
                  strokeWidth="0.1"
                  strokeDasharray="0.1,0.05"
                  className="animate-pulse drop-shadow-[0_0_10px_rgba(255,45,85,0.8)]"
                />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};
