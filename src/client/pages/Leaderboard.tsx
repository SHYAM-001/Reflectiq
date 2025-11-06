import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Trophy, Medal, Award, ArrowLeft, Timer, Target, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ApiService from '../services/api';
import DifficultyBadge from '../components/DifficultyBadge';
import {
  validateLeaderboardPostData,
  createFallbackLeaderboardData,
} from '../../shared/utils/postDataValidation';

interface LeaderboardEntry {
  rank: number;
  username: string;
  time: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  hintsUsed: number;
  score: number;
}

interface LeaderboardStats {
  fastestTime: string;
  topScore: number;
  totalPlayers: number;
}

// Remove local interface since we're importing it from validation utils

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="w-6 h-6 text-[#FFD700]" />;
    case 2:
      return <Medal className="w-6 h-6 text-[#C0C0C0]" />;
    case 3:
      return <Award className="w-6 h-6 text-[#CD7F32]" />;
    default:
      return <span className="text-muted-foreground font-orbitron">{rank}</span>;
  }
};

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';

export default function Leaderboard() {
  const [allLeaderboardData, setAllLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [filteredData, setFilteredData] = useState<LeaderboardEntry[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyFilter>('easy');
  const [stats, setStats] = useState<LeaderboardStats>({
    fastestTime: '00:00',
    topScore: 0,
    totalPlayers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      try {
        setLoading(true);

        // First try to get postData from Devvit context
        const contextResponse = await fetch('/api/post-context');
        const contextData = await contextResponse.json();

        if (contextData.postData && validateLeaderboardPostData(contextData.postData)) {
          // Use validated postData from custom post
          const postData = contextData.postData;
          setAllLeaderboardData(postData.entries);
          setStats(postData.stats);
        } else if (contextData.postData && contextData.postData.type === 'leaderboard') {
          // Invalid postData, use fallback
          console.warn('Invalid leaderboard postData, using fallback');
          const fallbackData = createFallbackLeaderboardData();
          setAllLeaderboardData(fallbackData.entries);
          setStats(fallbackData.stats);
          setError('Invalid leaderboard data format');
        } else {
          // Fallback to API call for standalone usage - get all difficulties for filtering
          const apiService = ApiService.getInstance();
          const today = new Date().toISOString().split('T')[0];

          // Fetch data for all difficulties to enable client-side filtering
          const [easyResponse, mediumResponse, hardResponse] = await Promise.all([
            apiService.getDailyLeaderboard(today, 100, 'easy').catch(() => ({ success: false })),
            apiService.getDailyLeaderboard(today, 100, 'medium').catch(() => ({ success: false })),
            apiService.getDailyLeaderboard(today, 100, 'hard').catch(() => ({ success: false })),
          ]);

          const allEntries: LeaderboardEntry[] = [];

          // Process each difficulty response
          [
            { response: easyResponse, difficulty: 'easy' },
            { response: mediumResponse, difficulty: 'medium' },
            { response: hardResponse, difficulty: 'hard' },
          ].forEach(({ response, difficulty }) => {
            if (response.success && response.data) {
              const transformedData: LeaderboardEntry[] = response.data.leaderboard.map(
                (
                  entry: {
                    username: string;
                    time: number;
                    difficulty: string;
                    hints: number;
                    score: number;
                  },
                  index: number
                ) => ({
                  rank: index + 1, // This will be recalculated later
                  username: entry.username,
                  time: formatTime(entry.time),
                  difficulty: difficulty as 'easy' | 'medium' | 'hard',
                  hintsUsed: entry.hints,
                  score: entry.score,
                })
              );
              allEntries.push(...transformedData);
            }
          });

          if (allEntries.length > 0) {
            // Sort by score descending and reassign ranks
            allEntries.sort((a, b) => b.score - a.score);
            allEntries.forEach((entry, index) => {
              entry.rank = index + 1;
            });

            setAllLeaderboardData(allEntries);
          } else {
            // Use validated fallback data if no real data available
            const fallbackData = createFallbackLeaderboardData();
            setAllLeaderboardData(fallbackData.entries);
          }
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard data');

        // Fallback to validated sample data on error
        const fallbackData = createFallbackLeaderboardData();
        setAllLeaderboardData(fallbackData.entries);
        setStats(fallbackData.stats);
      } finally {
        setLoading(false);
      }
    };

    void fetchLeaderboardData();
  }, []);

  // Fetch difficulty-specific data when filter changes (only for API mode, not postData mode)
  useEffect(() => {
    const fetchFilteredData = async () => {
      // Skip if we have postData (custom post mode) or if we're loading initial data
      if (loading) return;

      try {
        // Check if we're in postData mode
        const contextResponse = await fetch('/api/post-context');
        const contextData = await contextResponse.json();

        if (contextData.postData && validateLeaderboardPostData(contextData.postData)) {
          // We're in postData mode, don't fetch from API
          return;
        }

        // We're in API mode, fetch difficulty-specific data
        const apiService = ApiService.getInstance();
        const today = new Date().toISOString().split('T')[0];

        if (selectedDifficulty === 'all') {
          // Fetch all difficulties
          const [easyResponse, mediumResponse, hardResponse] = await Promise.all([
            apiService.getDailyLeaderboard(today, 100, 'easy').catch(() => ({ success: false })),
            apiService.getDailyLeaderboard(today, 100, 'medium').catch(() => ({ success: false })),
            apiService.getDailyLeaderboard(today, 100, 'hard').catch(() => ({ success: false })),
          ]);

          const allEntries: LeaderboardEntry[] = [];

          [
            { response: easyResponse, difficulty: 'easy' },
            { response: mediumResponse, difficulty: 'medium' },
            { response: hardResponse, difficulty: 'hard' },
          ].forEach(({ response, difficulty }) => {
            if (response.success && response.data) {
              const transformedData: LeaderboardEntry[] = response.data.leaderboard.map(
                (
                  entry: {
                    username: string;
                    time: number;
                    difficulty: string;
                    hints: number;
                    score: number;
                  },
                  index: number
                ) => ({
                  rank: index + 1,
                  username: entry.username,
                  time: formatTime(entry.time),
                  difficulty: difficulty as 'easy' | 'medium' | 'hard',
                  hintsUsed: entry.hints,
                  score: entry.score,
                })
              );
              allEntries.push(...transformedData);
            }
          });

          // Sort by score and reassign ranks
          allEntries.sort((a, b) => b.score - a.score);
          allEntries.forEach((entry, index) => {
            entry.rank = index + 1;
          });

          setAllLeaderboardData(allEntries);
        } else {
          // Fetch specific difficulty
          const response = await apiService.getDailyLeaderboard(
            today,
            100,
            selectedDifficulty as Difficulty
          );

          if (response.success && response.data) {
            const transformedData: LeaderboardEntry[] = response.data.leaderboard.map(
              (
                entry: {
                  username: string;
                  time: number;
                  difficulty: string;
                  hints: number;
                  score: number;
                },
                index: number
              ) => ({
                rank: index + 1,
                username: entry.username,
                time: formatTime(entry.time),
                difficulty: selectedDifficulty as 'easy' | 'medium' | 'hard',
                hintsUsed: entry.hints,
                score: entry.score,
              })
            );

            setAllLeaderboardData(transformedData);
          }
        }
      } catch (err) {
        console.error('Error fetching filtered leaderboard:', err);
        // Don't set error state here as it might interfere with initial load
      }
    };

    void fetchFilteredData();
  }, [selectedDifficulty, loading]);

  // Filter leaderboard data based on selected difficulty and update stats
  useEffect(() => {
    let filtered: LeaderboardEntry[];
    if (selectedDifficulty === 'all') {
      filtered = allLeaderboardData;
    } else {
      filtered = allLeaderboardData.filter((entry) => entry.difficulty === selectedDifficulty);
    }
    setFilteredData(filtered);

    // Update stats based on filtered data
    if (filtered.length > 0) {
      const fastestEntry = filtered.reduce((fastest, current) => {
        const fastestTime =
          typeof fastest.time === 'string'
            ? parseInt(fastest.time.split(':')[0]) * 60 + parseInt(fastest.time.split(':')[1])
            : fastest.time;
        const currentTime =
          typeof current.time === 'string'
            ? parseInt(current.time.split(':')[0]) * 60 + parseInt(current.time.split(':')[1])
            : current.time;
        return currentTime < fastestTime ? current : fastest;
      });

      const topScoreEntry = filtered.reduce((highest, current) =>
        current.score > highest.score ? current : highest
      );

      setStats({
        fastestTime:
          typeof fastestEntry.time === 'string' ? fastestEntry.time : formatTime(fastestEntry.time),
        topScore: topScoreEntry.score,
        totalPlayers: filtered.length,
      });
    } else {
      setStats({
        fastestTime: '00:00',
        topScore: 0,
        totalPlayers: 0,
      });
    }
  }, [allLeaderboardData, selectedDifficulty]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-bg flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-bg flex flex-col items-center justify-start p-4 md:p-8 overflow-auto">
      {/* Animated Background Particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              opacity: 0.3,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/">
            <Button variant="ghost" className="mb-4 group">
              <ArrowLeft className="mr-2 w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Game
            </Button>
          </Link>

          <h1 className="font-montserrat font-bold text-5xl md:text-7xl mb-3 bg-gradient-primary bg-clip-text text-transparent animate-shimmer bg-[length:200%_100%]">
            Leaderboard
          </h1>
          <p className="text-muted-foreground text-lg font-poppins">
            {selectedDifficulty === 'all'
              ? 'Top solvers across all difficulties'
              : `Top ${selectedDifficulty} difficulty solvers`}
          </p>
          {error && <p className="text-yellow-400 text-sm mt-2">{error} - Showing sample data</p>}
        </div>

        {/* Difficulty Filter */}
        <div className="flex justify-center mb-8">
          <Card className="p-2 bg-card/50 backdrop-blur-sm border-border">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground mr-2">Filter by:</span>
              <div className="flex gap-1">
                {(['all', 'easy', 'medium', 'hard'] as DifficultyFilter[]).map((difficulty) => (
                  <Button
                    key={difficulty}
                    variant={selectedDifficulty === difficulty ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedDifficulty(difficulty)}
                    className={`px-3 py-1 text-xs font-medium transition-all duration-200 ${
                      selectedDifficulty === difficulty
                        ? difficulty === 'easy'
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : difficulty === 'medium'
                            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                            : difficulty === 'hard'
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'bg-primary hover:bg-primary/90'
                        : 'hover:bg-muted'
                    }`}
                  >
                    {difficulty === 'all'
                      ? '🎯 All'
                      : difficulty === 'easy'
                        ? '🟢 Easy'
                        : difficulty === 'medium'
                          ? '🟡 Medium'
                          : '🔴 Hard'}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20 shadow-glow-primary">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Timer className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fastest Time</p>
                <p className="text-2xl font-orbitron font-bold text-primary">{stats.fastestTime}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/50 backdrop-blur-sm border-laser/20 shadow-glow-laser">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-laser/10 rounded-lg">
                <Trophy className="w-6 h-6 text-laser" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Top Score</p>
                <p className="text-2xl font-orbitron font-bold text-laser">
                  {stats.topScore.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary-light/20">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-light/10 rounded-lg">
                <Target className="w-6 h-6 text-primary-light" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {selectedDifficulty === 'all'
                    ? 'Total Players'
                    : `${selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1)} Players`}
                </p>
                <p className="text-2xl font-orbitron font-bold text-primary-light">
                  {stats.totalPlayers.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Leaderboard Table */}
        <Card className="bg-card/50 backdrop-blur-sm border-border shadow-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-primary font-semibold">Rank</TableHead>
                  <TableHead className="text-primary font-semibold">Player</TableHead>
                  <TableHead className="text-primary font-semibold hidden md:table-cell">
                    Time
                  </TableHead>
                  <TableHead className="text-primary font-semibold hidden sm:table-cell">
                    Difficulty
                  </TableHead>
                  <TableHead className="text-primary font-semibold hidden lg:table-cell">
                    Hints Used
                  </TableHead>
                  <TableHead className="text-primary font-semibold text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-primary/10 rounded-full">
                          <Trophy className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground mb-2">
                            No submissions yet today!
                          </h3>
                          <p className="text-muted-foreground text-sm mb-4">
                            Be the first to solve today's ReflectIQ puzzle and claim the top spot on
                            the leaderboard!
                          </p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>🎯 Find today's puzzle post in the subreddit</p>
                            <p>🔴 Trace the laser path through mirrors and materials</p>
                            <p>💡 Submit your answer as a comment: Exit: [Cell]</p>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((entry) => (
                    <TableRow
                      key={entry.rank}
                      className={`border-border transition-all duration-300 ${
                        entry.rank <= 3 ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'
                      }`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center justify-center w-10">
                          {getRankIcon(entry.rank)}
                        </div>
                      </TableCell>
                      <TableCell className="font-poppins font-medium text-foreground">
                        {entry.username}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="font-orbitron text-laser">{entry.time}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <DifficultyBadge difficulty={entry.difficulty} size="sm" />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center">
                        <span className="text-muted-foreground">{entry.hintsUsed}/4</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-orbitron font-bold text-primary">
                          {entry.score.toLocaleString()}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Footer Note */}
        <div className="text-center mt-8 text-muted-foreground text-sm">
          <p>Rankings updated in real-time • Score based on time, difficulty, and hints used</p>
        </div>
      </div>
    </div>
  );
}
