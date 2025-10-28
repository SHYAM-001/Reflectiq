import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Trophy, Medal, Award, Timer, Target, Users, Calendar } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  username: string;
  time?: string;
  difficulty?: string;
  hintsUsed?: number;
  score: number;
  totalScore?: number;
  puzzlesSolved?: number;
  bestTime?: string;
  avgDifficulty?: string;
}

interface LeaderboardStats {
  totalPlayers?: number;
  totalSubmissions?: number;
  fastestTime?: string;
  topScore?: number;
  puzzleStats?: {
    easy: number;
    medium: number;
    hard: number;
  };
  activePlayersCount?: number;
  totalPuzzlesSolved?: number;
  averageScore?: number;
}

interface LeaderboardData {
  type: 'leaderboard';
  leaderboardType: 'daily' | 'weekly';
  date?: string;
  weekStart?: string;
  weekEnd?: string;
  entries: LeaderboardEntry[];
  stats: LeaderboardStats;
}

interface InteractiveLeaderboardProps {
  postData?: LeaderboardData;
  fallbackType?: 'daily' | 'weekly';
}

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

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'easy':
      return 'bg-material-glass/20 text-material-glass border-material-glass/30';
    case 'medium':
      return 'bg-material-water/20 text-material-water border-material-water/30';
    case 'hard':
      return 'bg-laser/20 text-laser border-laser/30';
    default:
      return 'bg-muted';
  }
};

export default function InteractiveLeaderboard({
  postData,
  fallbackType = 'daily',
}: InteractiveLeaderboardProps) {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(postData || null);
  const [loading, setLoading] = useState(!postData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If no post data provided, fetch from API
    if (!postData) {
      fetchLeaderboardData(fallbackType);
    }
  }, [postData, fallbackType]);

  const fetchLeaderboardData = async (type: 'daily' | 'weekly') => {
    try {
      setLoading(true);
      const response = await fetch(`/api/leaderboard-data/${type}`);
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard data');
      }
      const data = await response.json();
      setLeaderboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error || !leaderboardData) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'No leaderboard data available'}</p>
          <Button onClick={() => fetchLeaderboardData(fallbackType)}>Try Again</Button>
        </div>
      </div>
    );
  }

  const isWeekly = leaderboardData.leaderboardType === 'weekly';
  const title = isWeekly
    ? `Weekly Leaderboard - Week ${leaderboardData.weekStart}`
    : `Daily Leaderboard - ${leaderboardData.date}`;

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
          <h1 className="font-montserrat font-bold text-4xl md:text-6xl mb-3 bg-gradient-primary bg-clip-text text-transparent animate-shimmer bg-[length:200%_100%]">
            🏆 {title}
          </h1>
          <p className="text-muted-foreground text-lg font-poppins">
            {isWeekly ? 'Top performers across the week' : "Today's top puzzle solvers"}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {isWeekly ? (
            <>
              <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20 shadow-glow-primary">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Players</p>
                    <p className="text-2xl font-orbitron font-bold text-primary">
                      {leaderboardData.stats.activePlayersCount || 0}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-card/50 backdrop-blur-sm border-laser/20 shadow-glow-laser">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-laser/10 rounded-lg">
                    <Target className="w-6 h-6 text-laser" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Puzzles Solved</p>
                    <p className="text-2xl font-orbitron font-bold text-laser">
                      {leaderboardData.stats.totalPuzzlesSolved || 0}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary-light/20">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary-light/10 rounded-lg">
                    <Trophy className="w-6 h-6 text-primary-light" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Average Score</p>
                    <p className="text-2xl font-orbitron font-bold text-primary-light">
                      {leaderboardData.stats.averageScore || 0}
                    </p>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <>
              <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20 shadow-glow-primary">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Timer className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fastest Time</p>
                    <p className="text-2xl font-orbitron font-bold text-primary">
                      {leaderboardData.stats.fastestTime || 'N/A'}
                    </p>
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
                      {leaderboardData.stats.topScore?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary-light/20">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary-light/10 rounded-lg">
                    <Users className="w-6 h-6 text-primary-light" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Players</p>
                    <p className="text-2xl font-orbitron font-bold text-primary-light">
                      {leaderboardData.stats.totalPlayers || 0}
                    </p>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>

        {/* Leaderboard Table */}
        <Card className="bg-card/50 backdrop-blur-sm border-border shadow-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-primary font-semibold">Rank</TableHead>
                  <TableHead className="text-primary font-semibold">Player</TableHead>
                  {isWeekly ? (
                    <>
                      <TableHead className="text-primary font-semibold hidden md:table-cell">
                        Total Score
                      </TableHead>
                      <TableHead className="text-primary font-semibold hidden sm:table-cell">
                        Puzzles Solved
                      </TableHead>
                      <TableHead className="text-primary font-semibold hidden lg:table-cell">
                        Best Time
                      </TableHead>
                      <TableHead className="text-primary font-semibold text-right">
                        Difficulties
                      </TableHead>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboardData.entries.map((entry) => (
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
                    {isWeekly ? (
                      <>
                        <TableCell className="hidden md:table-cell">
                          <span className="font-orbitron text-primary font-bold">
                            {entry.totalScore?.toLocaleString() || 0}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-center">
                          <span className="text-muted-foreground">{entry.puzzlesSolved || 0}</span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <span className="font-orbitron text-laser">
                            {entry.bestTime || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm text-muted-foreground">
                            {entry.avgDifficulty || 'Mixed'}
                          </span>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="hidden md:table-cell">
                          <span className="font-orbitron text-laser">{entry.time || 'N/A'}</span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {entry.difficulty && (
                            <Badge
                              variant="outline"
                              className={getDifficultyColor(entry.difficulty)}
                            >
                              {entry.difficulty}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-center">
                          <span className="text-muted-foreground">{entry.hintsUsed || 0}/4</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-orbitron font-bold text-primary">
                            {entry.score.toLocaleString()}
                          </span>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Footer Note */}
        <div className="text-center mt-8 text-muted-foreground text-sm">
          <p>
            {isWeekly
              ? 'Weekly rankings • Resets every Sunday • Play daily to climb higher!'
              : 'Rankings updated in real-time • Score based on time, difficulty, and hints used'}
          </p>
        </div>
      </div>
    </div>
  );
}
