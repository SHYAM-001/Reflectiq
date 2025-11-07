import { Puzzle, HintPath, PathSegment, GridPosition } from '../../types/api';
import { GridCell } from './GridCell';
import { useMemo, useState, useEffect } from 'react';

/**
 * Props for the PuzzleGrid component
 * @property puzzle - The puzzle data containing grid size, materials, entry, and solution
 * @property hintPaths - Array of hint paths to progressively reveal the laser path
 * @property hintsUsed - Number of hints used so far (0-4)
 * @property selectedAnswer - The currently selected answer position, or null if none selected
 * @property onCellClick - Callback invoked when a grid cell is clicked
 */
interface PuzzleGridProps {
  puzzle: Puzzle;
  hintPaths: HintPath[];
  hintsUsed?: number;
  selectedAnswer: GridPosition | null;
  onCellClick: (row: number, col: number) => void;
}

/**
 * Helper function to determine if a cell is on the edge of the grid
 * @param row - The row index of the cell
 * @param col - The column index of the cell
 * @param gridSize - The size of the grid
 * @returns true if the cell is on the perimeter of the grid
 */
const isEdgeCell = (row: number, col: number, gridSize: number): boolean => {
  return row === 0 || row === gridSize - 1 || col === 0 || col === gridSize - 1;
};

export const PuzzleGrid = ({
  puzzle,
  hintPaths,
  hintsUsed = 0,
  selectedAnswer,
  onCellClick,
}: PuzzleGridProps) => {
  const gridSize = puzzle.gridSize;
  const [animatingSegments, setAnimatingSegments] = useState<PathSegment[]>([]);
  const [visibleSegments, setVisibleSegments] = useState<PathSegment[]>([]);
  const [lastHintLevel, setLastHintLevel] = useState(0);

  // Only show exit cell when solution is 100% exposed (all 4 hints used)
  const isSolutionFullyExposed = hintsUsed >= 4;

  const getMaterialAtPosition = (row: number, col: number) => {
    return puzzle.materials.find((m) => m.position[0] === row && m.position[1] === col);
  };

  // Handle progressive animation when new hints are revealed (showing mirror reflections step by step)
  useEffect(() => {
    if (hintsUsed > lastHintLevel && hintsUsed > 0) {
      // Get the current hint path for this specific hint level
      const currentHintPath = hintPaths.find((h) => h.hintLevel === hintsUsed);

      if (currentHintPath && currentHintPath.segments.length > 0) {
        // For progressive revelation, show segments based on hint level
        // Each hint reveals the laser path up to that point (cumulative)
        const segmentsToShow = currentHintPath.segments;

        // Get previously visible segments
        const previousHintPath = hintPaths.find((h) => h.hintLevel === hintsUsed - 1);
        const previousSegments = previousHintPath ? previousHintPath.segments : [];

        // Find new segments to animate (segments that weren't in the previous hint)
        const newSegments = segmentsToShow.slice(previousSegments.length);

        if (newSegments.length > 0) {
          // Start animation for the new segments only
          setAnimatingSegments(newSegments);

          // After animation completes, update visible segments to show all segments up to this level
          const timer = setTimeout(() => {
            setVisibleSegments(segmentsToShow);
            setAnimatingSegments([]);
            setLastHintLevel(hintsUsed);
          }, 800); // Animation duration

          return () => clearTimeout(timer);
        } else {
          // If no new segments, just update the visible segments
          setVisibleSegments(segmentsToShow);
          setLastHintLevel(hintsUsed);
        }
      }
    }
  }, [hintsUsed, lastHintLevel, hintPaths]);

  // Reset state when puzzle changes
  useEffect(() => {
    setVisibleSegments([]);
    setAnimatingSegments([]);
    setLastHintLevel(0);
  }, [puzzle.id]);

  // Combine visible and animating segments for rendering
  const revealedSegments = useMemo(() => {
    return [...visibleSegments, ...animatingSegments];
  }, [visibleSegments, animatingSegments]);

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
            const isExit =
              isSolutionFullyExposed && puzzle.solution[0] === row && puzzle.solution[1] === col;
            const isOnPath = isOnLaserPath(row, col);
            const isEdge = isEdgeCell(row, col, gridSize);
            const isSelected =
              selectedAnswer !== null && selectedAnswer[0] === row && selectedAnswer[1] === col;

            return (
              <GridCell
                key={`${row}-${col}`}
                row={row}
                col={col}
                material={material}
                isEntry={isEntry}
                isExit={isExit}
                isOnLaserPath={isOnPath}
                isEdgeCell={isEdge}
                isSelected={isSelected}
                onCellClick={onCellClick}
              />
            );
          })
        )}
      </div>

      {/* Laser path overlay */}
      {revealedSegments.length > 0 && (
        <div className="absolute inset-4 pointer-events-none">
          <svg
            className="w-full h-full"
            viewBox={`0 0 ${gridSize} ${gridSize}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Render visible segments (already revealed) */}
            {visibleSegments.map((segment, index) => {
              // Convert grid coordinates to SVG coordinates (centered in cells)
              const x1 = segment.start[1] + 0.5; // col + center offset
              const y1 = segment.start[0] + 0.5; // row + center offset
              const x2 = segment.end[1] + 0.5;
              const y2 = segment.end[0] + 0.5;

              return (
                <line
                  key={`visible-${index}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#ff2d55"
                  strokeWidth="0.08"
                  strokeDasharray="0.1,0.05"
                  className="animate-pulse drop-shadow-[0_0_10px_rgba(255,45,85,0.8)]"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Render animating segments (currently being revealed) */}
            {animatingSegments.map((segment, index) => {
              // Convert grid coordinates to SVG coordinates (centered in cells)
              const x1 = segment.start[1] + 0.5; // col + center offset
              const y1 = segment.start[0] + 0.5; // row + center offset
              const x2 = segment.end[1] + 0.5;
              const y2 = segment.end[0] + 0.5;

              return (
                <line
                  key={`animating-${index}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#ff2d55"
                  strokeWidth="0.12"
                  strokeDasharray="0.1,0.05"
                  className="opacity-0 animate-[fadeInGlow_0.8s_ease-out_forwards]"
                  strokeLinecap="round"
                  style={{
                    filter: 'drop-shadow(0 0 12px rgba(255,45,85,0.9))',
                  }}
                />
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
};
