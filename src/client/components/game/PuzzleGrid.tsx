// PuzzleGrid component optimized for Devvit Web and daily puzzle system

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  PuzzleConfiguration,
  GridCell,
  Coordinate,
  DifficultyLevel,
  LaserPath,
} from '../../../shared/types/index.js';
import { MATERIAL_COLORS, GRID_SIZES } from '../../../shared/constants.js';
import { BeamHandler } from '../../../shared/physics/beam-handler.js';
import './PuzzleGrid.css';

interface PuzzleGridProps {
  puzzle: PuzzleConfiguration;
  onAnswerSubmit: (answer: Coordinate) => void;
  showLaserPath?: boolean;
  laserPath?: LaserPath;
  isInteractive?: boolean;
  cellSize?: number;
  showDifficulty?: boolean;
}

export const PuzzleGrid: React.FC<PuzzleGridProps> = ({
  puzzle,
  onAnswerSubmit,
  showLaserPath = false,
  laserPath,
  isInteractive = true,
  cellSize,
  showDifficulty = true,
}) => {
  const [selectedCell, setSelectedCell] = useState<Coordinate | null>(null);
  const [hoveredCell, setHoveredCell] = useState<Coordinate | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const beamHandler = useMemo(() => new BeamHandler(), []);

  // Detect mobile device for optimized rendering
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate optimal cell size for current viewport
  const calculatedCellSize = useMemo(() => {
    if (cellSize) return cellSize;

    const container = document.querySelector('.puzzle-grid-container');
    const containerWidth = container?.clientWidth || window.innerWidth - 40;
    const containerHeight = container?.clientHeight || window.innerHeight - 200;

    return beamHandler.calculateOptimalCellSize(
      puzzle.grid.length,
      containerWidth,
      containerHeight,
      isMobile
    );
  }, [cellSize, puzzle.grid.length, isMobile, beamHandler]);

  // Handle cell click for answer submission
  const handleCellClick = useCallback(
    (cell: GridCell) => {
      if (!isInteractive || isAnimating) return;

      const coordinate = cell.coordinate;
      setSelectedCell(coordinate);

      // Submit answer after brief delay for visual feedback
      setTimeout(() => {
        onAnswerSubmit(coordinate);
      }, 150);
    },
    [isInteractive, isAnimating, onAnswerSubmit]
  );

  // Handle cell hover for material inspection
  const handleCellHover = useCallback(
    (cell: GridCell | null) => {
      if (!isInteractive || isAnimating) return;
      setHoveredCell(cell?.coordinate || null);
    },
    [isInteractive, isAnimating]
  );

  // Get cell CSS classes based on state
  const getCellClasses = useCallback(
    (cell: GridCell): string => {
      const classes = ['puzzle-cell'];

      classes.push(`material-${cell.material}`);

      if (
        selectedCell &&
        selectedCell.row === cell.coordinate.row &&
        selectedCell.col === cell.coordinate.col
      ) {
        classes.push('selected');
      }

      if (
        hoveredCell &&
        hoveredCell.row === cell.coordinate.row &&
        hoveredCell.col === cell.coordinate.col
      ) {
        classes.push('hovered');
      }

      if (
        puzzle.laserEntry.row === cell.coordinate.row &&
        puzzle.laserEntry.col === cell.coordinate.col
      ) {
        classes.push('laser-entry');
      }

      if (isInteractive) {
        classes.push('interactive');
      }

      return classes.join(' ');
    },
    [selectedCell, hoveredCell, puzzle.laserEntry, isInteractive]
  );

  // Get material icon for display
  const getMaterialIcon = useCallback((material: string): string => {
    const icons = {
      mirror: '🪞',
      water: '💧',
      glass: '🔍',
      metal: '⚙️',
      absorber: '⚫',
      empty: '',
    };
    return icons[material as keyof typeof icons] || '';
  }, []);

  // Get difficulty badge
  const getDifficultyBadge = useCallback(() => {
    if (!showDifficulty) return null;

    const difficultyIcons = {
      easy: '🟢',
      medium: '🟡',
      hard: '🔴',
    };

    return (
      <div className="difficulty-badge">
        <span className="difficulty-icon">{difficultyIcons[puzzle.difficulty]}</span>
        <span className="difficulty-text">{puzzle.difficulty.toUpperCase()}</span>
      </div>
    );
  }, [puzzle.difficulty, showDifficulty]);

  // Render laser beam animation
  const renderLaserBeam = useCallback(() => {
    if (!showLaserPath || !laserPath || laserPath.segments.length === 0) {
      return null;
    }

    const beamTrail = beamHandler.createBeamTrail(laserPath.segments, calculatedCellSize);

    return (
      <svg
        className="laser-beam-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <path
          d={beamTrail.path}
          stroke="#FF0000"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="laser-path"
          style={{
            filter: beamHandler.createGlowEffect(0.8),
            animation: `laser-draw ${beamTrail.duration}s ease-in-out`,
          }}
        />
      </svg>
    );
  }, [showLaserPath, laserPath, beamHandler, calculatedCellSize]);

  // Grid style
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${puzzle.grid.length}, ${calculatedCellSize}px)`,
    gridTemplateRows: `repeat(${puzzle.grid.length}, ${calculatedCellSize}px)`,
    gap: '1px',
    backgroundColor: '#333',
    padding: '2px',
    borderRadius: '8px',
    position: 'relative',
  };

  return (
    <div className="puzzle-grid-container">
      {getDifficultyBadge()}

      <div className="puzzle-grid-wrapper">
        <div className="puzzle-grid" style={gridStyle}>
          {puzzle.grid.flat().map((cell, index) => (
            <div
              key={`${cell.coordinate.row}-${cell.coordinate.col}`}
              className={getCellClasses(cell)}
              style={{
                backgroundColor: cell.color,
                width: `${calculatedCellSize}px`,
                height: `${calculatedCellSize}px`,
                cursor: isInteractive ? 'pointer' : 'default',
              }}
              onClick={() => handleCellClick(cell)}
              onMouseEnter={() => handleCellHover(cell)}
              onMouseLeave={() => handleCellHover(null)}
              title={`${cell.coordinate.label} - ${cell.material}`}
            >
              <span className="material-icon">{getMaterialIcon(cell.material)}</span>

              {/* Laser entry indicator */}
              {puzzle.laserEntry.row === cell.coordinate.row &&
                puzzle.laserEntry.col === cell.coordinate.col && (
                  <div className="laser-entry-indicator">
                    <span className="laser-icon">🔴</span>
                  </div>
                )}

              {/* Cell coordinate label */}
              <span className="cell-label">{cell.coordinate.label}</span>
            </div>
          ))}

          {renderLaserBeam()}
        </div>

        {/* Material legend */}
        <div className="material-legend">
          <h4>Materials</h4>
          <div className="legend-items">
            {Object.entries({
              mirror: '🪞 Mirror - Reflects laser',
              water: '💧 Water - Diffuses beam',
              glass: '🔍 Glass - Splits beam',
              metal: '⚙️ Metal - Reverses direction',
              absorber: '⚫ Absorber - Stops laser',
            }).map(([material, description]) => (
              <div key={material} className="legend-item">
                <div
                  className="legend-color"
                  style={{
                    backgroundColor: MATERIAL_COLORS[material as keyof typeof MATERIAL_COLORS],
                  }}
                />
                <span className="legend-text">{description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hover info panel */}
      {hoveredCell && (
        <div className="hover-info">
          <strong>Cell {hoveredCell.label}</strong>
          <br />
          Material: {puzzle.grid[hoveredCell.row][hoveredCell.col].material}
          <br />
          Click to select as exit point
        </div>
      )}
    </div>
  );
};
