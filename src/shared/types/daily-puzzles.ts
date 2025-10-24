// Daily puzzle and filtering types

import type { DifficultyLevel, PuzzleConfiguration } from './game.js';

export interface DailyPuzzleSet {
  date: Date;
  puzzles: {
    easy: PuzzleConfiguration;
    medium: PuzzleConfiguration;
    hard: PuzzleConfiguration;
  };
  postIds: {
    easy: string;
    medium: string;
    hard: string;
  };
}

export interface PuzzlePost {
  postId: string;
  puzzle: PuzzleConfiguration;
  createdDate: Date;
  difficulty: DifficultyLevel;
  title: string;
  isActive: boolean;
  participantCount: number;
  averageScore: number;
}

export interface FilterQuery {
  difficulty?: DifficultyLevel;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: 'date' | 'difficulty' | 'participants';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  page?: number;
  isActive?: boolean;
  minParticipants?: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface UserDailyProgress {
  date: Date;
  completed: {
    easy: boolean;
    medium: boolean;
    hard: boolean;
  };
  scores: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
}

export interface PuzzleFilterUI {
  difficultyTabs: DifficultyLevel[];
  dateRangePicker: DateRange;
  sortOptions: SortOption[];
  searchBar: string;
}

export interface SortOption {
  value: 'date' | 'difficulty' | 'participants';
  label: string;
  order: 'asc' | 'desc';
}
