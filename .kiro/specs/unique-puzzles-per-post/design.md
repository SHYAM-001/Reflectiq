# Design Document: Unique Puzzles Per Post

## Overview

This design implements a major architectural shift from shared daily puzzles to unique puzzles for each Reddit post. The solution leverages Devvit's custom post data storage to associate each post with a unique puzzle ID, enabling multiple posts with different puzzles on the same day. This design ensures scalability, maintains backward compatibility, and follows Devvit best practices for data storage and retrieval.

### Key Design Goals

1. **Post-Puzzle Association**: Each custom post stores its unique puzzle ID in `postData`
2. **Efficient Storage**: Use Redis for puzzle caching with appropriate TTL
3. **Seamless Retrieval**: Client fetches puzzle by ID from post context
4. **Backward Compatibility**: Support legacy posts without puzzle IDs
5. **Performance**: Minimize latency with caching and circuit breakers
6. **Reliability**: Implement fallbacks for generation and retrieval failures

## Architecture

### High-Level Flow

```
Post Creation Flow:
1. Scheduler triggers daily post creation
2. Generate unique puzzle ID: {date}_{difficulty}_{timestamp}_{random}
3. PuzzleService generates puzzle with ID using Enhanced Generator
4. Store puzzle in Redis: reflectiq:puzzle:{puzzleId}
5. Create custom post with puzzleId in postData
6. Post is live with unique puzzle

Puzzle Retrieval Flow:
1. User opens custom post
2. Client fetches post context via /api/post-context
3. Extract puzzleId from postData
4. Client requests puzzle via /api/puzzle/by-id?puzzleId={id}&difficulty={diff}
5. Server retrieves from Redis or generates if missing
6. Client initializes game with puzzle data
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Reddit Custom Post                       │
│  postData: { puzzleId, specificDifficulty, puzzleDate }     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Client Application                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  use-game-state.ts (React Hook)                      │  │
│  │  - Fetch post context                                │  │
│  │  - Extract puzzleId                                  │  │
│  │  - Request puzzle by ID                              │  │
│  │  - Initialize game state                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
```

┌─────────────────────────────────────────────────────────────┐
│ API Layer │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ GET /api/puzzle/by-id │ │
│ │ - Validate puzzleId and difficulty │ │
│ │ - Call PuzzleService.getPuzzleById() │ │
│ │ - Return puzzle data or error │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ GET /api/post-context │ │
│ │ - Return postData from Devvit context │ │
│ └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ PuzzleService │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ getPuzzleById(puzzleId) │ │
│ │ - Check Redis cache │ │
│ │ - Return if found │ │
│ │ - Generate if missing │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ generatePuzzleWithId(puzzleId, difficulty) │ │
│ │ - Use Enhanced Generator │ │
│ │ - Store in Redis with 30-day TTL │ │
│ │ - Return puzzle data │ │
│ └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ Redis Storage │
│ Key: reflectiq:puzzle:{puzzleId} │
│ Value: JSON puzzle data │
│ TTL: 30 days (2,592,000 seconds) │
└─────────────────────────────────────────────────────────────┘

````

## Components and Interfaces

### 1. Post Creation Module (`src/server/core/post.ts`)

**Current State**: Already generates unique puzzle IDs and stores in postData

**Changes Required**:
- Add puzzle generation call before post creation
- Store generated puzzle in Redis
- Handle generation failures with retry logic

**Updated Interface**:
```typescript
export const createPost = async (
  puzzleType: 'daily' | 'special' | 'challenge' = 'daily',
  availableDifficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'],
  specificDifficulty?: 'easy' | 'medium' | 'hard',
  puzzleId?: string
) => {
  // Generate unique puzzle ID
  const uniquePuzzleId = puzzleId || generateUniquePuzzleId(date, difficulty);

  // Generate and store puzzle
  const puzzleService = PuzzleService.getInstance();
  await puzzleService.generatePuzzleWithId(uniquePuzzleId, difficulty);

  // Create post with puzzle ID in postData
  return await reddit.submitCustomPost({
    subredditName,
    title,
    splash: splashConfig,
    postData: {
      puzzleId: uniquePuzzleId,
      specificDifficulty,
      puzzleDate: today,
      // ... other fields
    }
  });
}
````

### 2. PuzzleService Module (`src/server/services/PuzzleService.ts`)

**Current State**: Has `getPuzzleById()` and `generatePuzzleWithId()` methods

**Changes Required**:

- Ensure proper error handling in `getPuzzleById()`
- Add circuit breaker for Redis operations
- Implement fallback to generation if cache miss

**Key Methods**:

```typescript
class PuzzleService {
  /**
   * Get puzzle by unique ID (for post-specific puzzles)
   * Returns null if not found, triggering generation
   */
  async getPuzzleById(puzzleId: string): Promise<Puzzle | null> {
    const key = `reflectiq:puzzle:${puzzleId}`;

    return await withRedisCircuitBreaker(
      async () => {
        const puzzleData = await redis.get(key);
        if (!puzzleData) return null;
        return JSON.parse(puzzleData) as Puzzle;
      },
      async () => {
        console.warn(`Redis unavailable for puzzle: ${puzzleId}`);
        return null;
      }
    );
  }

  /**
   * Generate and store a new puzzle with specific ID
   */
  async generatePuzzleWithId(puzzleId: string, difficulty: Difficulty): Promise<GetPuzzleResponse> {
    // Use Enhanced Generator for guaranteed generation
    const puzzle = await this.enhancedEngine.generateGuaranteedPuzzle(difficulty, puzzleId);

    // Store in Redis with 90-day TTL (Devvit supports up to 100 years)
    const key = `reflectiq:puzzle:${puzzleId}`;
    await redis.set(key, JSON.stringify(puzzle));
    await redis.expire(key, 90 * 24 * 60 * 60); // 7,776,000 seconds

    return createSuccessResponse(puzzle);
  }
}
```

### 3. API Endpoint (`src/server/index.ts`)

**New Endpoint Required**: `/api/puzzle/by-id`

**Implementation**:

```typescript
Devvit.addCustomPostType({
  name: 'ReflectIQ Puzzle',
  render: (context) => {
    return (
      <vstack>
        <webview
          url="index.html"
          onMessage={async (msg) => {
            if (msg.type === 'GET_PUZZLE_BY_ID') {
              const { puzzleId, difficulty } = msg.data;

              // Validate inputs
              if (!puzzleId || !difficulty) {
                return { success: false, error: 'Missing parameters' };
              }

              const puzzleService = PuzzleService.getInstance();

              // Try to get from cache
              let puzzle = await puzzleService.getPuzzleById(puzzleId);

              // Generate if not found
              if (!puzzle) {
                const response = await puzzleService.generatePuzzleWithId(
                  puzzleId,
                  difficulty
                );
                puzzle = response.data;
              }

              return { success: true, data: puzzle };
            }
          }}
        />
      </vstack>
    );
  }
});
```

### 4. Client Hook (`src/client/hooks/use-game-state.ts`)

**Current State**: Fetches post context and attempts to load puzzle by ID

**Changes Required**:

- Add proper error handling for missing puzzle IDs
- Implement fallback to daily puzzle mode
- Add loading states and user feedback

**Updated Flow**:

```typescript
const startGame = async () => {
  // 1. Fetch post context
  const postContext = await fetch('/api/post-context');
  const postData = await postContext.json();

  // 2. Extract puzzle ID and difficulty
  const puzzleId = postData?.puzzleId;
  const difficulty = postData?.specificDifficulty || 'Easy';

  // 3. Request puzzle by ID or fall back to daily
  let puzzleResponse;
  if (puzzleId) {
    puzzleResponse = await apiService.getPuzzleById(puzzleId, difficulty);
  } else {
    // Backward compatibility: use daily puzzle
    puzzleResponse = await apiService.getCurrentPuzzle(difficulty);
  }

  // 4. Initialize game state
  const puzzle = puzzleResponse.data;
  setState({ currentPuzzle: puzzle, gameState: 'playing' });
};
```

### 5. Enhanced API Service (`src/client/services/enhanced-api.ts`)

**New Method Required**: `getPuzzleById()`

**Implementation**:

```typescript
class EnhancedApiService {
  async getPuzzleById(puzzleId: string, difficulty: Difficulty): Promise<ApiResponse<Puzzle>> {
    return this.makeRequest(
      `/api/puzzle/by-id?puzzleId=${puzzleId}&difficulty=${difficulty}`,
      { method: 'GET' },
      'Get Puzzle By ID'
    );
  }
}
```

## Devvit Redis Capabilities & Best Practices

### Redis TTL Support

According to Devvit documentation, Redis supports:

- **Maximum TTL**: Up to 100 years
- **Automatic Expiration**: Keys are automatically deleted when TTL expires
- **No Manual Cleanup**: Devvit handles expired key removal
- **Memory Management**: Proper TTL usage prevents memory bloat

### TTL Strategy for ReflectIQ

**Post-Specific Puzzles**: 90 days (7,776,000 seconds)

- Rationale: Allows users to replay puzzles from posts up to 3 months old
- Balances user experience with memory efficiency
- Aligns with typical Reddit post engagement lifecycle
- Automatic cleanup after 90 days

**Why 90 Days vs 30 Days**:

- Reddit posts remain active and discoverable for months
- Users may return to old posts to replay or share
- 90 days covers most realistic replay scenarios
- Still provides automatic cleanup to prevent unbounded growth
- Can be adjusted based on actual usage patterns

**Alternative Approaches**:

- Could use longer TTL (1 year) for special/featured posts
- Could implement tiered TTL based on post engagement
- Could extend TTL dynamically if post receives new activity

### Key Naming Convention

Following Devvit best practices:

```
reflectiq:puzzle:{puzzleId}           // Post-specific puzzles
reflectiq:puzzles:{date}              // Legacy daily puzzle sets
reflectiq:session:{userId}:{puzzleId} // User sessions
reflectiq:leaderboard:{type}:{date}   // Leaderboards
```

## Data Models

### Post Data Structure

```typescript
interface PuzzlePostData {
  type: 'puzzle';
  puzzleId: string; // Unique: {date}_{difficulty}_{timestamp}_{random}
  specificDifficulty: 'easy' | 'medium' | 'hard';
  puzzleDate: string; // ISO date: YYYY-MM-DD
  gameType: 'daily' | 'special' | 'challenge';
  status: 'active' | 'archived';
  splashVariant: number; // 0-5 for splash screen variety
  generatedAt?: string; // ISO timestamp
}
```

### Redis Storage Schema

```typescript
// Key Pattern
const key = `reflectiq:puzzle:${puzzleId}`;

// Value Structure
interface StoredPuzzle extends Puzzle {
  id: string; // Same as puzzleId
  difficulty: Difficulty;
  grid: Cell[][];
  laserPath: LaserSegment[];
  exitCell: GridPosition;
  createdAt: string; // ISO timestamp
  metadata: {
    gridSize: number;
    materialCount: Record<MaterialType, number>;
    pathLength: number;
    complexity: number;
  };
}

// TTL Strategy:
// - Devvit Redis supports TTL up to 100 years (per Devvit docs)
// - For post-specific puzzles: 90 days (7,776,000 seconds)
// - Rationale: Allows users to replay old posts within 3 months
// - Automatic cleanup after expiration reduces memory usage
// - Can be extended for special/archived posts if needed
// - Aligns with Devvit best practice of setting explicit TTLs
```

### API Request/Response Models

```typescript
// GET /api/puzzle/by-id
interface GetPuzzleByIdRequest {
  puzzleId: string;
  difficulty: Difficulty;
}

interface GetPuzzleByIdResponse {
  success: boolean;
  data?: Puzzle;
  error?: {
    type: string;
    message: string;
  };
  metadata?: {
    source: 'cache' | 'generated';
    generationTime?: number;
  };
}
```

## Error Handling

### Error Scenarios and Responses

1. **Puzzle Not Found in Redis**

   - Action: Generate new puzzle with the provided ID
   - Fallback: Use backup puzzle templates
   - User Impact: Transparent, slight delay

2. **Puzzle Generation Failure**

   - Action: Retry with Enhanced Generator
   - Fallback: Use backup puzzle for that difficulty
   - User Impact: Warning message, game continues

3. **Post Context Unavailable**

   - Action: Fall back to daily puzzle mode
   - Fallback: Use date-based puzzle retrieval
   - User Impact: Notification about legacy mode

4. **Redis Connection Failure**

   - Action: Circuit breaker triggers
   - Fallback: Generate puzzle in-memory
   - User Impact: Slight performance degradation

5. **Invalid Puzzle ID Format**
   - Action: Validate and sanitize
   - Fallback: Extract date/difficulty, generate new ID
   - User Impact: Transparent correction

### Circuit Breaker Implementation

```typescript
const withRedisCircuitBreaker = async <T>(
  operation: () => Promise<T>,
  fallback: () => Promise<T>,
  context: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error(`Redis operation failed (${context}):`, error);
    errorMonitor.recordError('REDIS_ERROR', error.message, context);
    return await fallback();
  }
};
```

## Testing Strategy

### Unit Tests

1. **PuzzleService Tests**

   - Test `getPuzzleById()` with valid/invalid IDs
   - Test `generatePuzzleWithId()` with all difficulties
   - Test Redis storage and retrieval
   - Test TTL expiration behavior
   - Test error handling and fallbacks

2. **Post Creation Tests**

   - Test unique ID generation
   - Test puzzle generation integration
   - Test postData structure
   - Test failure scenarios

3. **API Endpoint Tests**
   - Test `/api/puzzle/by-id` with valid requests
   - Test parameter validation
   - Test error responses
   - Test cache hit/miss scenarios

### Integration Tests

1. **End-to-End Flow**

   - Create post → Generate puzzle → Store in Redis
   - Open post → Fetch context → Retrieve puzzle → Start game
   - Test with multiple concurrent posts
   - Test backward compatibility with old posts

2. **Redis Integration**

   - Test connection handling
   - Test TTL expiration
   - Test circuit breaker behavior
   - Test data consistency

3. **Client-Server Integration**
   - Test post context API
   - Test puzzle retrieval API
   - Test error propagation
   - Test loading states

### Performance Tests

1. **Load Testing**

   - Generate 100 puzzles concurrently
   - Retrieve 1000 puzzles from cache
   - Test Redis memory usage
   - Test API response times

2. **Stress Testing**
   - Test with Redis unavailable
   - Test with high concurrent requests
   - Test with expired cache entries
   - Test generation timeout scenarios

## Migration Strategy

### Phase 1: Backward Compatibility (Week 1)

1. Deploy new code with feature flag disabled
2. Test puzzle-by-ID retrieval with manual posts
3. Verify fallback to daily puzzles works
4. Monitor error rates and performance

### Phase 2: Gradual Rollout (Week 2)

1. Enable feature for 10% of new posts
2. Monitor puzzle generation success rate
3. Track cache hit rates
4. Collect user feedback

### Phase 3: Full Deployment (Week 3)

1. Enable for all new posts
2. Update scheduled post creation
3. Archive old daily puzzle system
4. Update documentation

### Phase 4: Cleanup (Week 4)

1. Remove legacy daily puzzle code
2. Optimize Redis key patterns
3. Update monitoring dashboards
4. Document lessons learned

## Performance Optimization

### Caching Strategy

1. **Redis Cache**

   - Store puzzles with 30-day TTL
   - Use consistent key pattern
   - Implement cache warming for scheduled posts
   - Monitor cache hit rate (target: >95%)

2. **Client-Side Caching**
   - Cache puzzle data in React state
   - Persist to localStorage for offline play
   - Invalidate on puzzle ID change

### Generation Optimization

1. **Pre-Generation**

   - Generate puzzles during post creation
   - Use Enhanced Generator for guaranteed success
   - Implement generation queue for bulk operations

2. **Lazy Generation**
   - Generate on-demand if cache miss
   - Use worker threads for heavy computation
   - Implement timeout protection (5 seconds max)

### Monitoring Metrics

```typescript
interface PuzzleMetrics {
  generation: {
    successRate: number; // Target: >99%
    averageTime: number; // Target: <2s
    failureCount: number;
  };
  retrieval: {
    cacheHitRate: number; // Target: >95%
    averageLatency: number; // Target: <500ms
    errorRate: number; // Target: <1%
  };
  storage: {
    redisMemoryUsage: number;
    keyCount: number;
    evictionRate: number;
  };
}
```

## Security Considerations

### Input Validation

1. **Puzzle ID Validation**

   - Format: `{date}_{difficulty}_{timestamp}_{random}`
   - Sanitize special characters
   - Limit length to 100 characters
   - Validate date format

2. **Difficulty Validation**
   - Whitelist: 'Easy', 'Medium', 'Hard'
   - Case-insensitive matching
   - Reject invalid values

### Data Protection

1. **Redis Security**

   - Use Devvit's managed Redis (secure by default)
   - No sensitive data in puzzle storage
   - Implement proper TTL for data cleanup

2. **API Security**
   - Rate limiting on puzzle retrieval
   - Validate Devvit context
   - Sanitize all inputs

## Rollback Plan

### Rollback Triggers

1. Puzzle generation success rate < 90%
2. API error rate > 5%
3. Redis connection failures > 10%
4. User-reported critical bugs

### Rollback Procedure

1. Disable feature flag for new posts
2. Revert to daily puzzle system
3. Keep existing unique puzzles functional
4. Investigate and fix issues
5. Re-deploy with fixes

### Data Preservation

- Keep all generated puzzles in Redis
- Maintain post-puzzle associations
- Preserve user sessions and progress
- No data loss during rollback
