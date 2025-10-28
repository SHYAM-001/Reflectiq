# Design Document

## Overview

This design enhances the existing ReflectIQ puzzle game by integrating the leaderboard system with Devvit's custom post functionality. The system will leverage the existing Leaderboard.tsx component and backend LeaderboardService to create interactive Reddit posts that display real-time leaderboard data. The design also includes adding difficulty level indicators to puzzle splash screens and ensuring both manual and automated leaderboard posts use the same high-quality UI components.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Reddit Interface"
        MM[Moderator Menu]
        CP[Custom Posts]
        SP[Splash Screens]
    end

    subgraph "Devvit Server"
        ME[Menu Endpoints]
        SE[Scheduler Endpoints]
        PD[Post Data API]
        CPF[Custom Post Factory]
    end

    subgraph "Client Components"
        LC[Leaderboard Component]
        DB[Difficulty Badges]
        SS[Splash Screen]
    end

    subgraph "Backend Services"
        LS[LeaderboardService]
        PS[PuzzleService]
        RD[Redis Data]
    end

    MM --> ME
    ME --> LS
    ME --> CPF
    CPF --> CP
    CP --> LC
    SE --> LS
    SE --> CPF
    LC --> PD
    PD --> LS
    LS --> RD
    PS --> RD
    SP --> SS
    SS --> DB
```

### Component Integration Flow

1. **Manual Leaderboard Creation**: Moderator clicks menu → Server fetches data → Creates custom post with postData → Client renders Leaderboard component
2. **Automated Leaderboard Creation**: Scheduler runs → Server fetches data → Creates custom post with postData → Client renders Leaderboard component
3. **Difficulty Display**: Puzzle post loads → Client reads postData → Renders splash screen with difficulty badge

## Components and Interfaces

### 1. Custom Post Type Registration

**File**: `src/server/index.ts` (enhancement)

```typescript
// Add custom post type registration for leaderboard posts
interface LeaderboardPostData {
  type: 'leaderboard';
  leaderboardType: 'daily' | 'weekly';
  date: string;
  entries: LeaderboardEntry[];
  stats: LeaderboardStats;
}

interface PuzzlePostData {
  puzzleDate: string;
  gameType: 'daily' | 'special' | 'challenge';
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'active';
  splashVariant: number;
}
```

### 2. Enhanced Post Creation Service

**File**: `src/server/core/post.ts` (enhancement)

```typescript
export const createLeaderboardPost = async (
  leaderboardData: LeaderboardPostData,
  type: 'daily' | 'weekly' = 'daily'
) => {
  // Enhanced splash screen with difficulty indicators
  const splashConfig = generateLeaderboardSplashConfig(leaderboardData, type);

  return await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: generateLeaderboardTitle(leaderboardData, type),
    splash: splashConfig,
    postData: leaderboardData,
  });
};

// Enhanced puzzle post creation with difficulty in splash
export const createPuzzlePost = async (
  puzzleData: PuzzlePostData,
  difficulty: 'easy' | 'medium' | 'hard'
) => {
  const splashConfig = generatePuzzleSplashConfig(puzzleData, difficulty);

  return await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: generatePuzzleTitle(puzzleData, difficulty),
    splash: splashConfig,
    postData: { ...puzzleData, difficulty },
  });
};
```

### 3. Client-Side Post Data Integration

**File**: `src/client/pages/Leaderboard.tsx` (enhancement)

```typescript
// Enhanced Leaderboard component to work with Devvit postData
export default function Leaderboard() {
  const [postData, setPostData] = useState<LeaderboardPostData | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<LeaderboardStats>({...});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First try to get postData from Devvit context
        const contextResponse = await fetch('/api/post-context');
        const contextData = await contextResponse.json();

        if (contextData.postData && contextData.postData.type === 'leaderboard') {
          // Use postData from custom post
          setPostData(contextData.postData);
          setLeaderboardData(contextData.postData.entries);
          setStats(contextData.postData.stats);
        } else {
          // Fallback to API call for standalone usage
          const apiService = ApiService.getInstance();
          const today = new Date().toISOString().split('T')[0];
          const response = await apiService.getDailyLeaderboard(today, 10);

          if (response.success && response.data) {
            // Transform and set data as before
            // ... existing transformation logic
          }
        }
      } catch (err) {
        // Error handling with fallback to sample data
        // ... existing error handling
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Rest of component remains the same
  // ... existing render logic
}
```

### 4. Difficulty Badge Component

**File**: `src/client/components/DifficultyBadge.tsx` (new)

```typescript
interface DifficultyBadgeProps {
  difficulty: 'easy' | 'medium' | 'hard';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({
  difficulty,
  size = 'md',
  showIcon = true
}) => {
  const configs = {
    easy: {
      color: 'bg-green-500/20 text-green-400 border-green-500/30',
      icon: '🟢',
      label: 'Easy'
    },
    medium: {
      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      icon: '🟡',
      label: 'Medium'
    },
    hard: {
      color: 'bg-red-500/20 text-red-400 border-red-500/30',
      icon: '🔴',
      label: 'Hard'
    }
  };

  const config = configs[difficulty];
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  return (
    <Badge variant="outline" className={`${config.color} ${sizeClasses[size]}`}>
      {showIcon && config.icon} {config.label}
    </Badge>
  );
};
```

### 5. Enhanced Splash Screen Component

**File**: `src/client/components/SplashScreen.tsx` (new)

```typescript
interface SplashScreenProps {
  postData?: PuzzlePostData | LeaderboardPostData;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ postData }) => {
  if (!postData) return null;

  if (postData.type === 'leaderboard') {
    return (
      <div className="splash-screen leaderboard">
        <h1>🏆 Daily Leaderboard</h1>
        <p>{new Date(postData.date).toLocaleDateString()}</p>
        <p>{postData.entries.length} players competing</p>
      </div>
    );
  }

  // Puzzle splash screen with difficulty badge
  return (
    <div className="splash-screen puzzle">
      <h1>🔴 Daily ReflectIQ Puzzle</h1>
      <p>{new Date(postData.puzzleDate).toLocaleDateString()}</p>
      <DifficultyBadge
        difficulty={postData.difficulty}
        size="lg"
        showIcon={true}
      />
      <p>Trace the laser path to find the exit!</p>
    </div>
  );
};
```

## Data Models

### LeaderboardPostData Interface

```typescript
interface LeaderboardPostData {
  type: 'leaderboard';
  leaderboardType: 'daily' | 'weekly';
  date: string;
  weekStart?: string; // For weekly leaderboards
  weekEnd?: string; // For weekly leaderboards
  entries: Array<{
    rank: number;
    username: string;
    time: string;
    difficulty: 'easy' | 'medium' | 'hard';
    hintsUsed: number;
    score: number;
  }>;
  stats: {
    totalPlayers: number;
    totalSubmissions: number;
    fastestTime: string;
    topScore: number;
    puzzleStats: {
      easy: number;
      medium: number;
      hard: number;
    };
  };
}
```

### Enhanced PuzzlePostData Interface

```typescript
interface PuzzlePostData {
  puzzleDate: string;
  gameType: 'daily' | 'special' | 'challenge';
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'active';
  splashVariant: number;
}
```

## Error Handling

### 1. Data Availability Fallbacks

```typescript
// Leaderboard component error handling
const handleDataFetch = async () => {
  try {
    // Try postData first
    const postDataResult = await fetchPostData();
    if (postDataResult.success) return postDataResult.data;

    // Fallback to API
    const apiResult = await fetchFromAPI();
    if (apiResult.success) return apiResult.data;

    // Final fallback to sample data
    return getSampleData();
  } catch (error) {
    console.error('Data fetch failed:', error);
    setError('Failed to load leaderboard data');
    return getSampleData();
  }
};
```

### 2. Menu Action Error Handling

```typescript
// Enhanced menu action with comprehensive error handling
router.post('/internal/menu/leaderboard', async (_req, res) => {
  try {
    const leaderboardData = await fetchLeaderboardData();

    if (!leaderboardData.entries.length) {
      // Handle empty leaderboard case
      return createEmptyLeaderboardPost(res);
    }

    const post = await createLeaderboardPost(leaderboardData);

    res.json({
      showToast: {
        text: `Leaderboard posted! ${leaderboardData.entries.length} players featured.`,
        appearance: 'success',
      },
      navigateTo: post.url,
    });
  } catch (error) {
    console.error('Leaderboard menu error:', error);
    res.json({
      showToast: {
        text: 'Failed to create leaderboard post. Please try again.',
        appearance: 'neutral',
      },
    });
  }
});
```

## Testing Strategy

### 1. Component Testing

- **Leaderboard Component**: Test with postData, API data, and sample data fallbacks
- **DifficultyBadge Component**: Test all difficulty levels and sizes
- **SplashScreen Component**: Test with both puzzle and leaderboard post data

### 2. Integration Testing

- **Menu Actions**: Test daily and weekly leaderboard creation
- **Post Data Flow**: Test data passing from server to client components
- **Error Scenarios**: Test network failures, empty data, and malformed data

### 3. End-to-End Testing

- **Manual Leaderboard Creation**: Full flow from menu click to post display
- **Automated Leaderboard Creation**: Scheduler execution and post creation
- **Cross-Device Compatibility**: Mobile and desktop rendering

## Performance Considerations

### 1. Data Caching

```typescript
// Cache leaderboard data to reduce Redis calls
const LEADERBOARD_CACHE_TTL = 300; // 5 minutes
const cachedLeaderboardData = new Map<
  string,
  {
    data: LeaderboardPostData;
    timestamp: number;
  }
>();

const getCachedLeaderboardData = (key: string) => {
  const cached = cachedLeaderboardData.get(key);
  if (cached && Date.now() - cached.timestamp < LEADERBOARD_CACHE_TTL * 1000) {
    return cached.data;
  }
  return null;
};
```

### 2. Component Optimization

```typescript
// Memoize expensive calculations in Leaderboard component
const memoizedStats = useMemo(() => {
  return calculateLeaderboardStats(leaderboardData);
}, [leaderboardData]);

const memoizedRankings = useMemo(() => {
  return processRankingData(leaderboardData);
}, [leaderboardData]);
```

### 3. Bundle Size Optimization

- Lazy load Leaderboard component when not immediately needed
- Use dynamic imports for large dependencies
- Optimize image assets used in splash screens

## Security Considerations

### 1. Data Validation

```typescript
// Validate leaderboard data before creating posts
const validateLeaderboardData = (data: any): data is LeaderboardPostData => {
  return (
    data &&
    typeof data.type === 'string' &&
    data.type === 'leaderboard' &&
    Array.isArray(data.entries) &&
    data.entries.every(
      (entry) =>
        typeof entry.username === 'string' &&
        typeof entry.score === 'number' &&
        ['easy', 'medium', 'hard'].includes(entry.difficulty)
    )
  );
};
```

### 2. User Data Protection

- Only display Reddit usernames (no additional PII)
- Sanitize user input in leaderboard entries
- Implement rate limiting on menu actions

### 3. Access Control

- Ensure menu actions are restricted to moderators
- Validate subreddit context before creating posts
- Implement proper error messages without exposing internal details
