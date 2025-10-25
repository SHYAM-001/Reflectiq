import { Material, MaterialType } from '../../types/puzzle';
import { cn } from '../../lib/utils';

interface GridCellProps {
  position: string;
  material?: Material;
  isEntry?: boolean;
  isExit?: boolean;
  isRevealed?: boolean;
}

const getMaterialColor = (type: MaterialType): string => {
  const colors = {
    mirror: 'bg-material-mirror',
    glass: 'bg-material-glass',
    water: 'bg-material-water',
    metal: 'bg-material-metal',
    absorber: 'bg-material-absorber',
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

export const GridCell = ({ position, material, isEntry, isExit, isRevealed }: GridCellProps) => {
  return (
    <div
      className={cn(
        'relative aspect-square border border-border/30 transition-all duration-300 hover:border-primary/50 hover:shadow-glow-primary cursor-pointer group',
        material && getMaterialColor(material.type),
        isEntry && 'ring-2 ring-primary shadow-glow-primary',
        isExit && 'ring-2 ring-laser shadow-glow-laser',
        !material && 'bg-card/20 backdrop-blur-sm',
        isRevealed && 'animate-pulse'
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
