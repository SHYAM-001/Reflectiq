// PuzzleFilter component for filtering and searching puzzles

import React, { useState, useCallback, useEffect } from 'react';
import type {
  DifficultyLevel,
  FilterQuery,
  DateRange,
  PuzzlePost,
} from '../../../shared/types/index.js';

interface PuzzleFilterProps {
  availablePuzzles: PuzzlePost[];
  selectedDifficulty?: DifficultyLevel;
  onFilterChange: (query: FilterQuery) => void;
  onPuzzleSelect: (postId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export const PuzzleFilter: React.FC<PuzzleFilterProps> = ({
  availablePuzzles,
  selectedDifficulty,
  onFilterChange,
  onPuzzleSelect,
  isLoading = false,
  className = '',
}) => {
  const [filters, setFilters] = useState<FilterQuery>({
    difficulty: selectedDifficulty,
    sortBy: 'date',
    sortOrder: 'desc',
    limit: 20,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Update filters when props change
  useEffect(() => {
    if (selectedDifficulty !== filters.difficulty) {
      const newFilters = { ...filters, difficulty: selectedDifficulty };
      setFilters(newFilters);
      onFilterChange(newFilters);
    }
  }, [selectedDifficulty, filters, onFilterChange]);

  // Handle difficulty filter change
  const handleDifficultyChange = useCallback(
    (difficulty?: DifficultyLevel) => {
      const newFilters = { ...filters, difficulty };
      setFilters(newFilters);
      onFilterChange(newFilters);
    },
    [filters, onFilterChange]
  );

  // Handle sort change
  const handleSortChange = useCallback(
    (sortBy: FilterQuery['sortBy'], sortOrder: FilterQuery['sortOrder']) => {
      const newFilters = { ...filters, sortBy, sortOrder };
      setFilters(newFilters);
      onFilterChange(newFilters);
    },
    [filters, onFilterChange]
  );

  // Handle date range change
  const handleDateRangeChange = useCallback(
    (range: DateRange | null) => {
      setDateRange(range);
      const newFilters = {
        ...filters,
        dateFrom: range?.start,
        dateTo: range?.end,
      };
      setFilters(newFilters);
      onFilterChange(newFilters);
    },
    [filters, onFilterChange]
  );

  // Handle search term change
  const handleSearchChange = useCallback((term: string) => {
    setSearchTerm(term);
    // Implement client-side search or trigger server-side search
    // For now, we'll filter locally
  }, []);

  // Filter puzzles based on search term
  const filteredPuzzles = availablePuzzles.filter((puzzle) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      puzzle.title.toLowerCase().includes(searchLower) ||
      puzzle.difficulty.toLowerCase().includes(searchLower) ||
      puzzle.postId.toLowerCase().includes(searchLower)
    );
  });

  // Get difficulty statistics
  const getDifficultyStats = useCallback(() => {
    const stats = {
      easy: availablePuzzles.filter((p) => p.difficulty === 'easy').length,
      medium: availablePuzzles.filter((p) => p.difficulty === 'medium').length,
      hard: availablePuzzles.filter((p) => p.difficulty === 'hard').length,
      total: availablePuzzles.length,
    };
    return stats;
  }, [availablePuzzles]);

  const stats = getDifficultyStats();

  return (
    <div className={`puzzle-filter ${className}`}>
      {/* Header */}
      <div className="filter-header">
        <h2>Browse Puzzles</h2>
        <div className="puzzle-count">
          {filteredPuzzles.length} of {availablePuzzles.length} puzzles
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-section">
        <div className="search-input-container">
          <input
            type="text"
            placeholder="Search puzzles by title, difficulty, or ID..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="search-input"
          />
          <div className="search-icon">🔍</div>
        </div>
      </div>

      {/* Difficulty Filter Tabs */}
      <div className="difficulty-tabs">
        <button
          className={`difficulty-tab ${!filters.difficulty ? 'active' : ''}`}
          onClick={() => handleDifficultyChange(undefined)}
        >
          All ({stats.total})
        </button>
        <button
          className={`difficulty-tab easy ${filters.difficulty === 'easy' ? 'active' : ''}`}
          onClick={() => handleDifficultyChange('easy')}
        >
          🟢 Easy ({stats.easy})
        </button>
        <button
          className={`difficulty-tab medium ${filters.difficulty === 'medium' ? 'active' : ''}`}
          onClick={() => handleDifficultyChange('medium')}
        >
          🟡 Medium ({stats.medium})
        </button>
        <button
          className={`difficulty-tab hard ${filters.difficulty === 'hard' ? 'active' : ''}`}
          onClick={() => handleDifficultyChange('hard')}
        >
          🔴 Hard ({stats.hard})
        </button>
      </div>

      {/* Sort Controls */}
      <div className="sort-controls">
        <div className="sort-group">
          <label>Sort by:</label>
          <select
            value={filters.sortBy}
            onChange={(e) =>
              handleSortChange(e.target.value as FilterQuery['sortBy'], filters.sortOrder)
            }
          >
            <option value="date">Date</option>
            <option value="difficulty">Difficulty</option>
            <option value="participants">Participants</option>
          </select>
        </div>

        <div className="sort-group">
          <label>Order:</label>
          <select
            value={filters.sortOrder}
            onChange={(e) =>
              handleSortChange(filters.sortBy, e.target.value as FilterQuery['sortOrder'])
            }
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>

        <button
          className="advanced-toggle"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
        </button>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="advanced-filters">
          <div className="date-range-section">
            <h4>Date Range</h4>
            <div className="date-inputs">
              <input
                type="date"
                placeholder="From"
                value={dateRange?.start?.toISOString().split('T')[0] || ''}
                onChange={(e) => {
                  const start = e.target.value ? new Date(e.target.value) : undefined;
                  handleDateRangeChange(
                    start ? { start, end: dateRange?.end || new Date() } : null
                  );
                }}
              />
              <span>to</span>
              <input
                type="date"
                placeholder="To"
                value={dateRange?.end?.toISOString().split('T')[0] || ''}
                onChange={(e) => {
                  const end = e.target.value ? new Date(e.target.value) : undefined;
                  handleDateRangeChange(
                    end ? { start: dateRange?.start || new Date(), end } : null
                  );
                }}
              />
            </div>
            {dateRange && (
              <button className="clear-date-range" onClick={() => handleDateRangeChange(null)}>
                Clear Date Range
              </button>
            )}
          </div>

          <div className="limit-section">
            <label>
              Results per page:
              <select
                value={filters.limit}
                onChange={(e) => {
                  const newFilters = { ...filters, limit: parseInt(e.target.value) };
                  setFilters(newFilters);
                  onFilterChange(newFilters);
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Puzzle List */}
      <div className="puzzle-list">
        {isLoading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <span>Loading puzzles...</span>
          </div>
        ) : filteredPuzzles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧩</div>
            <h3>No puzzles found</h3>
            <p>Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="puzzle-grid">
            {filteredPuzzles.map((puzzle) => (
              <PuzzleCard
                key={puzzle.postId}
                puzzle={puzzle}
                onSelect={() => onPuzzleSelect(puzzle.postId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Load More Button */}
      {filteredPuzzles.length >= (filters.limit || 20) && (
        <div className="load-more-section">
          <button
            className="load-more-button"
            onClick={() => {
              const newFilters = { ...filters, limit: (filters.limit || 20) + 20 };
              setFilters(newFilters);
              onFilterChange(newFilters);
            }}
          >
            Load More Puzzles
          </button>
        </div>
      )}
    </div>
  );
};

// Individual puzzle card component
interface PuzzleCardProps {
  puzzle: PuzzlePost;
  onSelect: () => void;
}

const PuzzleCard: React.FC<PuzzleCardProps> = ({ puzzle, onSelect }) => {
  const getDifficultyEmoji = (difficulty: DifficultyLevel) => {
    const emojis = { easy: '🟢', medium: '🟡', hard: '🔴' };
    return emojis[difficulty];
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="puzzle-card" onClick={onSelect}>
      <div className="puzzle-card-header">
        <div className="difficulty-badge">
          {getDifficultyEmoji(puzzle.difficulty)}{' '}
          {puzzle.difficulty.charAt(0).toUpperCase() + puzzle.difficulty.slice(1)}
        </div>
        <div className="puzzle-date">{formatDate(puzzle.createdDate)}</div>
      </div>

      <div className="puzzle-card-content">
        <h3 className="puzzle-title">{puzzle.title}</h3>

        <div className="puzzle-stats">
          <div className="stat-item">
            <span className="stat-icon">👥</span>
            <span className="stat-value">{puzzle.participantCount}</span>
            <span className="stat-label">participants</span>
          </div>

          <div className="stat-item">
            <span className="stat-icon">🎯</span>
            <span className="stat-value">{puzzle.isActive ? 'Active' : 'Completed'}</span>
          </div>
        </div>
      </div>

      <div className="puzzle-card-footer">
        <button className="play-button">{puzzle.isActive ? 'Play Now' : 'View Results'}</button>
      </div>
    </div>
  );
};
