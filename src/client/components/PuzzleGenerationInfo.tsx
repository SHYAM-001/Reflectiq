/**
 * Puzzle Generation Info Component
 * Shows information about the puzzle generation system being used
 */

import { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { Sparkles, Zap, Info } from 'lucide-react';
import { cn } from '../lib/utils';

interface PuzzleGenerationInfoProps {
  puzzleId?: string;
  className?: string;
}

export const PuzzleGenerationInfo = ({ puzzleId, className }: PuzzleGenerationInfoProps) => {
  const [generationType, setGenerationType] = useState<'enhanced' | 'legacy' | 'unknown'>(
    'unknown'
  );
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (puzzleId) {
      if (puzzleId.includes('enhanced_')) {
        setGenerationType('enhanced');
      } else if (puzzleId.includes('puzzle_')) {
        setGenerationType('legacy');
      } else {
        setGenerationType('unknown');
      }
    }
  }, [puzzleId]);

  if (generationType === 'unknown') {
    return null;
  }

  const isEnhanced = generationType === 'enhanced';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isEnhanced ? 'default' : 'secondary'}
            className={cn(
              'cursor-help transition-all duration-200',
              isEnhanced
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600'
                : 'bg-gray-500 hover:bg-gray-600'
            )}
            onClick={() => setShowDetails(!showDetails)}
          >
            {isEnhanced ? (
              <>
                <Sparkles className="w-3 h-3 mr-1" />
                Enhanced Generation
              </>
            ) : (
              <>
                <Zap className="w-3 h-3 mr-1" />
                Classic Generation
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold flex items-center gap-1">
              <Info className="w-4 h-4" />
              {isEnhanced ? 'Enhanced Generation' : 'Classic Generation'}
            </div>
            <div className="text-sm">
              {isEnhanced ? (
                <>
                  This puzzle uses our advanced generation system that guarantees:
                  <ul className="mt-1 ml-2 space-y-1">
                    <li>• Exactly one unique solution</li>
                    <li>• Optimal difficulty balance</li>
                    <li>• Strategic material placement</li>
                    <li>• Physics-compliant laser paths</li>
                  </ul>
                </>
              ) : (
                <>
                  This puzzle uses our classic generation system. While still challenging and fun,
                  it may occasionally have multiple solutions or suboptimal difficulty balance.
                </>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>

      {showDetails && (
        <div className="text-xs text-muted-foreground">ID: {puzzleId?.substring(0, 20)}...</div>
      )}
    </div>
  );
};

export default PuzzleGenerationInfo;
