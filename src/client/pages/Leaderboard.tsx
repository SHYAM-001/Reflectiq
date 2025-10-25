import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Trophy, Medal, Award, ArrowLeft, Timer, Target } from "lucide-react";
import { Link } from "react-router-dom";

interface LeaderboardEntry {
  rank: number;
  username: string;
  time: string;
  difficulty: "easy" | "medium" | "hard";
  hintsUsed: number;
  score: number;
}

// Sample data - in production this would come from a backend
const sampleLeaderboard: LeaderboardEntry[] = [
  { rank: 1, username: "LaserMaster", time: "02:34", difficulty: "hard", hintsUsed: 0, score: 9850 },
  { rank: 2, username: "ReflectPro", time: "03:12", difficulty: "hard", hintsUsed: 1, score: 9200 },
  { rank: 3, username: "MirrorMage", time: "02:56", difficulty: "medium", hintsUsed: 0, score: 8900 },
  { rank: 4, username: "PhysicsPhenom", time: "04:21", difficulty: "hard", hintsUsed: 2, score: 8450 },
  { rank: 5, username: "LightBender", time: "03:45", difficulty: "medium", hintsUsed: 1, score: 8100 },
  { rank: 6, username: "OpticsSage", time: "05:08", difficulty: "medium", hintsUsed: 2, score: 7650 },
  { rank: 7, username: "BeamWizard", time: "06:22", difficulty: "easy", hintsUsed: 0, score: 7200 },
  { rank: 8, username: "PrismPilot", time: "04:55", difficulty: "medium", hintsUsed: 3, score: 6950 },
  { rank: 9, username: "RefractionKing", time: "07:11", difficulty: "easy", hintsUsed: 1, score: 6700 },
  { rank: 10, username: "SpectrumSeeker", time: "08:34", difficulty: "easy", hintsUsed: 2, score: 6200 },
];

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
    case "easy":
      return "bg-material-glass/20 text-material-glass border-material-glass/30";
    case "medium":
      return "bg-material-water/20 text-material-water border-material-water/30";
    case "hard":
      return "bg-laser/20 text-laser border-laser/30";
    default:
      return "bg-muted";
  }
};

export default function Leaderboard() {
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
            Top solvers across all difficulties
          </p>
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
                <p className="text-2xl font-orbitron font-bold text-primary">02:34</p>
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
                <p className="text-2xl font-orbitron font-bold text-laser">9,850</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary-light/20">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-light/10 rounded-lg">
                <Target className="w-6 h-6 text-primary-light" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Players</p>
                <p className="text-2xl font-orbitron font-bold text-primary-light">1,247</p>
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
                  <TableHead className="text-primary font-semibold hidden md:table-cell">Time</TableHead>
                  <TableHead className="text-primary font-semibold hidden sm:table-cell">Difficulty</TableHead>
                  <TableHead className="text-primary font-semibold hidden lg:table-cell">Hints Used</TableHead>
                  <TableHead className="text-primary font-semibold text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleLeaderboard.map((entry) => (
                  <TableRow
                    key={entry.rank}
                    className={`border-border transition-all duration-300 ${
                      entry.rank <= 3
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/50"
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
                      <Badge variant="outline" className={getDifficultyColor(entry.difficulty)}>
                        {entry.difficulty}
                      </Badge>
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
                ))}
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
