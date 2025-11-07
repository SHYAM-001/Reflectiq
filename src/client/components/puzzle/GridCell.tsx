import { Material } from '../../types/api';
import { cn } from '../../lib/utils';

/**
 * Props for the GridCell component
 * @property row - The row index of the cell (0-based)
 * @property col - The column index of the cell (0-based)
 * @property material - Optional material placed in this cell
 * @property isEntry - Whether this cell is the laser entry point
 * @property isExit - Whether this cell is the laser exit point
 * @property isOnLaserPath - Whether this cell is part of the revealed laser path
 * @property isEdgeCell - Whether this cell is on the perimeter of the grid (clickable)
 * @property isSelected - Whether this cell is currently selected as the answer
 * @property onCellClick - Callback invoked when the cell is clicked (only for edge cells)
 */
interface GridCellProps {
  row: number;
  col: number;
  material?: Material;
  isEntry?: boolean;
  isExit?: boolean;
  isOnLaserPath?: boolean;
  isEdgeCell: boolean;
  isSelected: boolean;
  onCellClick?: (row: number, col: number) => void;
}

const getMaterialColor = (type: Material['type']): string => {
  const colors = {
    mirror: 'bg-slate-300 border-slate-400',
    glass: 'bg-blue-200/50 border-blue-300',
    water: 'bg-cyan-200/50 border-cyan-300',
    metal: 'bg-gray-400 border-gray-500',
    absorber: 'bg-black border-gray-600',
  };
  return colors[type];
};

const getMaterialIcon = (material: Material) => {
  if (material.type === 'mirror' && material.angle !== undefined) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `rotate(${material.angle}deg)`,
        }}
      >
        <div className="w-full h-0.5 bg-foreground/80" />
      </div>
    );
  }
  return null;
};

export const GridCell = ({
  row,
  col,
  material,
  isEntry,
  isExit,
  isOnLaserPath,
  isEdgeCell,
  isSelected,
  onCellClick,
}: GridCellProps) => {
  const position = `${String.fromCharCode(65 + row)}${col + 1}`;

  /**
   * Handles cell click events
   * Only invokes the callback if the cell is an edge cell
   * @returns void
   */
  const handleClick = (): void => {
    if (isEdgeCell && onCellClick) {
      onCellClick(row, col);
    }
  };

  return (
    <div
      onClick={isEdgeCell ? handleClick : undefined}
      style={{ cursor: isEdgeCell ? 'pointer' : 'default' }}
      className={cn(
        'relative aspect-square border border-border/30 transition-all duration-300 group',
        material && getMaterialColor(material.type),
        isEntry && 'ring-2 ring-green-500 bg-green-100/20',
        isExit && 'ring-2 ring-red-500 bg-red-100/20 animate-pulse shadow-lg shadow-red-500/30',
        !material && 'bg-card/20 backdrop-blur-sm',
        isOnLaserPath && 'ring-1 ring-red-400 bg-red-100/20 animate-pulse',
        // Edge cell hover state
        isEdgeCell && 'hover:border-primary/50 hover:scale-105',
        // Selected state
        isSelected && 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/30 z-10'
      )}
    >
      {/* Position label */}
      <div className="absolute top-0.5 left-0.5 text-[8px] md:text-[10px] text-foreground/40 font-mono pointer-events-none">
        {position}
      </div>

      {/* Material indicator */}
      {material && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {getMaterialIcon(material)}
        </div>
      )}

      {/* Entry indicator */}
      {isEntry && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-2 h-2 bg-laser rounded-full animate-glow-pulse" />
        </div>
      )}

      {/* Exit indicator */}
      {isExit && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
          <div className="absolute w-6 h-6 border-2 border-red-500 rounded-full animate-ping" />
        </div>
      )}

      {/* Hover tooltip */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm pointer-events-none">
        <span className="text-xs font-poppins text-foreground">
          {material ? material.type : 'empty'}
        </span>
      </div>
    </div>
  );
};
