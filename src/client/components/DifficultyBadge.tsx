import React from 'react';
import { Badge } from './ui/badge';

interface DifficultyBadgeProps {
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({
  difficulty,
  size = 'md',
  showIcon = true,
  className = '',
}) => {
  const configs = {
    easy: {
      color: 'bg-green-500/20 text-green-400 border-green-500/30',
      icon: '🟢',
      label: 'Easy',
    },
    medium: {
      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      icon: '🟡',
      label: 'Medium',
    },
    hard: {
      color: 'bg-red-500/20 text-red-400 border-red-500/30',
      icon: '🔴',
      label: 'Hard',
    },
    mixed: {
      color: 'bg-primary/20 text-primary border-primary/30',
      icon: '🎯',
      label: 'Mixed',
    },
  };

  const config = configs[difficulty];
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2',
  };

  return (
    <Badge variant="outline" className={`${config.color} ${sizeClasses[size]} ${className}`}>
      {showIcon && config.icon} {config.label}
    </Badge>
  );
};

export default DifficultyBadge;
