/**
 * Validation utilities for Devvit post data
 */

export interface LeaderboardPostData {
  type: 'leaderboard';
  leaderboardType: 'daily' | 'weekly';
  date?: string;
  weekStart?: string;
  weekEnd?: string;
  difficulty?: 'all' | 'Easy' | 'Medium' | 'Hard';
  entries: Array<{
    rank: number;
    username: string;
    time: string;
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
    hintsUsed: number;
    score: number;
    puzzlesSolved?: number; // For weekly leaderboards
    averageScore?: number; // For weekly leaderboards
  }>;
  stats: {
    totalPlayers: number;
    totalSubmissions: number;
    fastestTime: string;
    topScore: number;
    daysWithData?: number; // For weekly leaderboards
    puzzleStats: {
      easy: number;
      medium: number;
      hard: number;
    };
  };
}

export interface PuzzlePostData {
  puzzleDate: string;
  gameType: 'daily' | 'special' | 'challenge';
  availableDifficulties: ('easy' | 'medium' | 'hard')[];
  status: 'active';
  splashVariant: number;
}

/**
 * Validates leaderboard post data structure and content
 */
export function validateLeaderboardPostData(data: any): data is LeaderboardPostData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check required fields
  if (data.type !== 'leaderboard') {
    return false;
  }

  if (!['daily', 'weekly'].includes(data.leaderboardType)) {
    return false;
  }

  if (!data.date || typeof data.date !== 'string') {
    return false;
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.date)) {
    return false;
  }

  // For weekly leaderboards, check week range
  if (data.leaderboardType === 'weekly') {
    if (!data.weekStart || !data.weekEnd) {
      return false;
    }
    if (!dateRegex.test(data.weekStart) || !dateRegex.test(data.weekEnd)) {
      return false;
    }
  }

  // Validate entries array
  if (!Array.isArray(data.entries)) {
    return false;
  }

  for (const entry of data.entries) {
    if (!validateLeaderboardEntry(entry)) {
      return false;
    }
  }

  // Validate stats object
  if (!validateLeaderboardStats(data.stats)) {
    return false;
  }

  return true;
}

/**
 * Validates individual leaderboard entry
 */
function validateLeaderboardEntry(entry: any): boolean {
  if (!entry || typeof entry !== 'object') {
    return false;
  }

  // Check required fields
  if (typeof entry.rank !== 'number' || entry.rank < 1) {
    return false;
  }

  if (!entry.username || typeof entry.username !== 'string') {
    return false;
  }

  if (!entry.time || typeof entry.time !== 'string') {
    return false;
  }

  // Validate time format (MM:SS)
  const timeRegex = /^\d{1,2}:\d{2}$/;
  if (!timeRegex.test(entry.time)) {
    return false;
  }

  if (!['easy', 'medium', 'hard', 'mixed'].includes(entry.difficulty)) {
    return false;
  }

  if (typeof entry.hintsUsed !== 'number' || entry.hintsUsed < 0 || entry.hintsUsed > 4) {
    return false;
  }

  if (typeof entry.score !== 'number' || entry.score < 0) {
    return false;
  }

  return true;
}

/**
 * Validates leaderboard stats object
 */
function validateLeaderboardStats(stats: any): boolean {
  if (!stats || typeof stats !== 'object') {
    return false;
  }

  if (typeof stats.totalPlayers !== 'number' || stats.totalPlayers < 0) {
    return false;
  }

  if (typeof stats.totalSubmissions !== 'number' || stats.totalSubmissions < 0) {
    return false;
  }

  if (!stats.fastestTime || typeof stats.fastestTime !== 'string') {
    return false;
  }

  if (typeof stats.topScore !== 'number' || stats.topScore < 0) {
    return false;
  }

  // Validate puzzleStats
  if (!stats.puzzleStats || typeof stats.puzzleStats !== 'object') {
    return false;
  }

  const { easy, medium, hard } = stats.puzzleStats;
  if (
    typeof easy !== 'number' ||
    easy < 0 ||
    typeof medium !== 'number' ||
    medium < 0 ||
    typeof hard !== 'number' ||
    hard < 0
  ) {
    return false;
  }

  return true;
}

/**
 * Validates puzzle post data structure and content
 */
export function validatePuzzlePostData(data: any): data is PuzzlePostData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check required fields
  if (!data.puzzleDate || typeof data.puzzleDate !== 'string') {
    return false;
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.puzzleDate)) {
    return false;
  }

  if (!['daily', 'special', 'challenge'].includes(data.gameType)) {
    return false;
  }

  if (!Array.isArray(data.availableDifficulties)) {
    return false;
  }

  // Validate difficulties array
  for (const difficulty of data.availableDifficulties) {
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return false;
    }
  }

  if (data.status !== 'active') {
    return false;
  }

  if (typeof data.splashVariant !== 'number' || data.splashVariant < 0) {
    return false;
  }

  return true;
}

/**
 * Creates a safe fallback leaderboard data object
 */
export function createFallbackLeaderboardData(
  type: 'daily' | 'weekly' = 'daily'
): LeaderboardPostData {
  const today = new Date().toISOString().split('T')[0];

  return {
    type: 'leaderboard',
    leaderboardType: type,
    date: today,
    ...(type === 'weekly' && {
      weekStart: today,
      weekEnd: today,
    }),
    entries: [
      {
        rank: 1,
        username: 'LaserMaster',
        time: '02:34',
        difficulty: 'hard',
        hintsUsed: 0,
        score: 9850,
      },
      {
        rank: 2,
        username: 'ReflectPro',
        time: '03:12',
        difficulty: 'hard',
        hintsUsed: 1,
        score: 9200,
      },
      {
        rank: 3,
        username: 'MirrorMage',
        time: '02:56',
        difficulty: 'medium',
        hintsUsed: 0,
        score: 8900,
      },
    ],
    stats: {
      totalPlayers: 1247,
      totalSubmissions: 1580,
      fastestTime: '02:34',
      topScore: 9850,
      puzzleStats: {
        easy: 420,
        medium: 680,
        hard: 480,
      },
    },
  };
}

/**
 * Creates a safe fallback puzzle data object
 */
export function createFallbackPuzzleData(): PuzzlePostData {
  const today = new Date().toISOString().split('T')[0];

  return {
    puzzleDate: today,
    gameType: 'daily',
    availableDifficulties: ['easy', 'medium', 'hard'],
    status: 'active',
    splashVariant: 0,
  };
}
