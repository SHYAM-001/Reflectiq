// PuzzleGrid component for rendering the game board

import React, { useState, useCallback } from 'react';
import type {
  GridCell,
  Coordinate,
  DifficultyLevel,
  PathSegment,
} from '../../../shared/types/game.js';
import { MATERIAL_COLORS, GRID_SIZES } from '../../../shared/constants.js';
import { coordinateToLabel } from '../../../shared/utils.js';

interface PuzzleGridProps {
  grid: GridCell[][];
  laserEntry: Coordinate;
  difficulty: DifficultyLevel;
  hintSegments?: PathSegment[];
  onCellHover?: (cell: GridCell | null) => void;
  onCellClick?: (cell: GridCell) => void;
  showCoordinates?: boolean;
  animatingHint?: boolean;
}

export const PuzzleGrid: React.FC<PuzzleGridProps> = ({
  grid,
  laserEntry,
  difficulty,
  hintSegments = [],
  onCellHover,
  onCellClick,
  showCoordinates = true,
  animatingHint = false,
}) => {
  const [hoveredCell, setHoveredCell] = useState<GridCell | null>(null);
  const gridSize = GRID_SIZES[difficulty];

  const handleCellHover = useCallback(
    (cell: GridCell | null) => {
      setHoveredCell(cell);
      onCellHover?.(cell);
    },
    [onCellHover]
  );

  const handleCellClick = useCallback(
    (cell: GridCell) => {
      onCellClick?.(cell);
    },
    [onCellClick]
  );

  const isLaserEntry = useCallback(
    (row: number, col: number) => {
      return laserEntry.row === row && laserEntry.col === col;
    },
    [laserEntry]
  );

  const isInHintPath = useCallback(
    (row: number, col: number) => {
      return hintSegments.some(
        (segment) =>
          (segment.start.row === row && segment.start.col === col) ||
          (segment.end.row === row && segment.end.col === col)
      );
    },
    [hintSegments]
  );

  const getCellClassName = useCallback(
    (cell: GridCell) => {
      const baseClasses = 'puzzle-cell';
      const classes = [baseClasses];

      // Material-specific styling
      classes.push(`material-${cell.material}`);

      // Hover state
      if (
        hoveredCell?.coordinate.row === cell.coordinate.row &&
        hoveredCell?.coordinate.col === cell.coordinate.col
      ) {
        classes.push('hovered');
      }

      // Laser entry point
      if (isLaserEntry(cell.coordinate.row, cell.coordinate.col)) {
        classes.push('laser-entry');
      }

      // Hint path highlighting
      if (isInHintPath(cell.coordinate.row, cell.coordinate.col)) {
        classes.push('hint-path');
      }

      return classes.join(' ');
    },
    [hoveredCell, isLaserEntry, isInHintPath]
  );

  const renderCell = useCallback(
    (cell: GridCell, rowIndex: number, colIndex: number) => {
      const isEntry = isLaserEntry(rowIndex, colIndex);

      return (
        <div
          key={`${rowIndex}-${colIndex}`}
          className={getCellClassName(cell)}
          style={{
            backgroundColor: cell.color,
            opacity: cell.material === 'empty' ? 0.1 : 1,
          }}
          onMouseEnter={() => handleCellHover(cell)}
          onMouseLeave={() => handleCellHover(null)}
          onClick={() => handleCellClick(cell)}
          title={`${cell.coordinate.label} - ${cell.material}`}
        >
          {/* Laser entry indicator */}
          {isEntry && (
            <div className="laser-entry-indicator">
              <div className="laser-beam-start" />
            </div>
          )}

          {/* Material icon/symbol */}
          <div className="material-symbol">{getMaterialSymbol(cell.material)}</div>

          {/* Coordinate label */}
          {showCoordinates && <div className="coordinate-label">{cell.coordinate.label}</div>}

          {/* Hint path animation */}
          {isInHintPath(cell.coordinate.row, cell.coordinate.col) && animatingHint && (
            <div className="hint-animation">
              <div className="laser-beam-hint" />
            </div>
          )}
        </div>
      );
    },
    [
      getCellClassName,
      handleCellHover,
      handleCellClick,
      isLaserEntry,
      isInHintPath,
      showCoordinates,
      animatingHint,
    ]
  );

  const renderColumnHeaders = () => {
    return (
      <div className="grid-headers column-headers">
        <div className="header-spacer" />
        {Array.from({ length: gridSize }, (_, index) => (
          <div key={index} className="column-header">
            {String.fromCharCode(65 + index)}
          </div>
        ))}
      </div>
    );
  };

  const renderRowHeader = (rowIndex: number) => {
    return <div className="row-header">{rowIndex + 1}</div>;
  };

  return (
    <div className="puzzle-grid-container">
      {/* Column headers (A, B, C, etc.) */}
      {showCoordinates && renderColumnHeaders()}

      <div className="puzzle-grid-content">
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} className="puzzle-row">
            {/* Row header (1, 2, 3, etc.) */}
            {showCoordinates && renderRowHeader(rowIndex)}

            {/* Grid cells */}
            <div className="puzzle-cells">
              {row.map((cell, colIndex) => renderCell(cell, rowIndex, colIndex))}
            </div>
          </div>
        ))}
      </div>

      {/* Material legend */}
      <MaterialLegend />
    </div>
  );
};

// Helper function to get material symbols
function getMaterialSymbol(material: string): string {
  const symbols = {
    mirror: '🪞',
    water: '💧',
    glass: '🔷',
    metal: '⚫',
    absorber: '⬛',
    empty: '',
  };
  return symbols[material as keyof typeof symbols] || '';
}

// Material legend component
const MaterialLegend: React.FC = () => {
  const materials = [
    { type: 'mirror', symbol: '🪞', name: 'Mirror', description: 'Reflects at 90°' },
    { type: 'water', symbol: '💧', name: 'Water', description: 'Soft reflection with diffusion' },
    { type: 'glass', symbol: '🔷', name: 'Glass', description: '50% pass-through, 50% reflect' },
    { type: 'metal', symbol: '⚫', name: 'Metal', description: 'Reverses beam direction' },
    { type: 'absorber', symbol: '⬛', name: 'Absorber', description: 'Stops the beam completely' },
  ];

  return (
    <div className="material-legend">
      <h3>Materials</h3>
      <div className="legend-items">
        {materials.map((material) => (
          <div key={material.type} className="legend-item">
            <span
              className="legend-symbol"
              style={{
                backgroundColor: MATERIAL_COLORS[material.type as keyof typeof MATERIAL_COLORS],
              }}
            >
              {material.symbol}
            </span>
            <div className="legend-text">
              <span className="legend-name">{material.name}</span>
              <span className="legend-description">{material.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
