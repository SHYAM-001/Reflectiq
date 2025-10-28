import React from 'react';
import DifficultyBadge from './DifficultyBadge';

interface DifficultyIndicatorProps {
  difficulties: ('easy' | 'medium' | 'hard')[];
  size?: 'sm' | 'md' | 'lg';
  showIcons?: boolean;
  className?: string;
}

export const DifficultyIndicator: React.FC<DifficultyIndicatorProps> = ({
  difficulties,
  size = 'md',
  showIcons = true,
  className = '',
}) => {
  if (!difficulties || difficulties.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {difficulties.map((difficulty) => (
        <DifficultyBadge
          key={difficulty}
          difficulty={difficulty}
          size={size}
          showIcon={showIcons}
        />
      ))}
    </div>
  );
};

export default DifficultyIndicator;
