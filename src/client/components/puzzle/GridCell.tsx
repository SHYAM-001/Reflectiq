import { Material } from '../../types/api';
import { cn } from '../../lib/utils';

interface GridCellProps {
  row: number;
  col: number;
  material?: Material;
  isEntry?: boolean;
  isExit?: boolean;
  isOnLaserPath?: boolean;
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

const getMaterialIcon = (material: Material): React.JSX.Element | null => {
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

export const GridCell = ({ row, col, material, isEntry, isExit, isOnLaserPath }: GridCellProps) => {
  const position = `${String.fromCharCode(65 + row)}${col + 1}`;

  return (
    <div
      className={cn(
        'relative aspect-square border border-border/30 transition-all duration-300 hover:border-primary/50 cursor-pointer group',
        material && getMaterialColor(material.type),
        isEntry && 'ring-2 ring-green-500 bg-green-100/20',
        isExit && 'ring-2 ring-red-500 bg-red-100/20',
        !material && 'bg-card/20 backdrop-blur-sm',
        isOnLaserPath && 'ring-1 ring-red-400 bg-red-100/20 animate-pulse'
      )}
    >
      {/* Position label */}
      <div className="absolute top-0.5 left-0.5 text-[8px] md:text-[10px] text-foreground/40 font-mono">
        {position}
      </div>

      {/* Material indicator */}
      {material && (
        <div className="absolute inset-0 flex items-center justify-center">
          {getMaterialIcon(material)}
        </div>
      )}

      {/* Entry indicator */}
      {isEntry && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-laser rounded-full animate-glow-pulse" />
        </div>
      )}

      {/* Hover tooltip */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-sm">
        <span className="text-xs font-poppins text-foreground">
          {material ? material.type : 'empty'}
        </span>
      </div>
    </div>
  );
};
