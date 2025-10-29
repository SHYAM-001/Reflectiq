import { Puzzle, HintPath, PathSegment } from '../../types/api';
import { GridCell } from './GridCell';
import { useMemo, useState, useEffect } from 'react';

interface PuzzleGridProps {
  puzzle: Puzzle;
  hintPaths: HintPath[];
  hintsUsed?: number;
}

export const PuzzleGrid = ({ puzzle, hintPaths, hintsUsed = 0 }: PuzzleGridProps) => {
  const gridSize = puzzle.gridSize;
  const [animatingSegments, setAnimatingSegments] = useState<PathSegment[]>([]);
  const [visibleSegments, setVisibleSegments] = useState<PathSegment[]>([]);
  const [lastHintLevel, setLastHintLevel] = useState(0);

  // Only show exit cell when solution is 100% exposed (all 4 hints used)
  const isSolutionFullyExposed = hintsUsed >= 4;

  const getMaterialAtPosition = (row: number, col: number) => {
    return puzzle.materials.find((m) => m.position[0] === row && m.position[1] === col);
  };

  // Get segments for a specific hint level only
  const getSegmentsForHintLevel = (hintLevel: number): PathSegment[] => {
    const hintPath = hintPaths.find((h) => h.hintLevel === hintLevel);
    return hintPath ? hintPath.segments : [];
  };

  // Get all segments up to the current hint level (cumulative)
  const getAllSegmentsUpToLevel = (maxLevel: number): PathSegment[] => {
    const segments: PathSegment[] = [];
    for (let level = 1; level <= maxLevel; level++) {
      const hintPath = hintPaths.find((h) => h.hintLevel === level);
      if (hintPath) {
        segments.push(...hintPath.segments);
      }
    }
    return segments;
  };

  // Handle progressive animation when new hints are revealed
  useEffect(() => {
    if (hintsUsed > lastHintLevel && hintsUsed > 0) {
      // Get the latest hint segments to animate
      const latestHintSegments = getSegmentsForHintLevel(hintsUsed);

      if (latestHintSegments.length > 0) {
        // Start animation for the new hint segments
        setAnimatingSegments(latestHintSegments);

        // After animation completes, add all segments up to current level to visible
        const timer = setTimeout(() => {
          setVisibleSegments(getAllSegmentsUpToLevel(hintsUsed));
          setAnimatingSegments([]);
          setLastHintLevel(hintsUsed);
        }, 800); // Animation duration

        return () => clearTimeout(timer);
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
            {/* Render visible segments (already revealed) */}
            {visibleSegments.map((segment, index) => {
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
                  strokeWidth="0.1"
                  strokeDasharray="0.1,0.05"
                  className="animate-pulse drop-shadow-[0_0_10px_rgba(255,45,85,0.8)]"
                />
              );
            })}

            {/* Render animating segments (currently being revealed) */}
            {animatingSegments.map((segment, index) => {
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
                  strokeWidth="0.15"
                  strokeDasharray="0.1,0.05"
                  className="opacity-0 animate-[fadeInGlow_0.8s_ease-out_forwards]"
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
