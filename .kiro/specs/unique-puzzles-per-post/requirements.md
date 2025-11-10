# Requirements Document

## Introduction

This feature implements a major architectural change to ReflectIQ's puzzle system, transitioning from a shared daily puzzle model to unique puzzles for each Reddit post. Currently, all posts created on the same day share the same puzzle data, which limits scalability and creates issues when multiple posts exist for the same difficulty level. This change ensures each post has its own unique puzzle, stored and retrieved using Devvit's custom post data storage system.

## Glossary

- **Custom Post**: A Devvit post type that can store structured data and render interactive experiences
- **Post Data**: Structured data stored with a custom post using Devvit's `postData` field
- **Puzzle ID**: A unique identifier for each puzzle, formatted as `{date}_{difficulty}_{timestamp}_{random}`
- **Redis Cache**: Devvit's Redis instance used for temporary puzzle storage with TTL
- **PuzzleService**: Server-side service responsible for puzzle generation and retrieval
- **Session**: A user's active puzzle-solving attempt linked to a specific puzzle ID
- **Client Hook**: React hook (`use-game-state.ts`) that manages puzzle fetching and game state
- **Post Context API**: Devvit endpoint (`/api/post-context`) that provides access to custom post data
- **Enhanced Generator**: The guaranteed puzzle generation system that creates valid, solvable puzzles

## Requirements

### Requirement 1: Post-Specific Puzzle Storage

**User Story:** As a ReflectIQ developer, I want each Reddit post to store its own unique puzzle ID, so that multiple posts can exist with different puzzles even on the same day.

#### Acceptance Criteria

1. WHEN THE System creates a new custom post, THE System SHALL generate a unique puzzle ID in the format `{date}_{difficulty}_{timestamp}_{random}`
2. WHEN THE System creates a new custom post, THE System SHALL store the puzzle ID in the post's `postData` field under the key `puzzleId`
3. WHEN THE System creates a new custom post, THE System SHALL store the difficulty level in the post's `postData` field under the key `specificDifficulty`
4. WHEN THE System retrieves post data, THE System SHALL provide access to the stored `puzzleId` through the Post Context API
5. THE System SHALL maintain backward compatibility with existing posts that do not have a `puzzleId` field

### Requirement 2: Puzzle Generation and Storage

**User Story:** As a ReflectIQ developer, I want puzzles to be generated and stored with unique IDs, so that each post can retrieve its specific puzzle data.

#### Acceptance Criteria

1. WHEN THE PuzzleService generates a puzzle with a specific ID, THE PuzzleService SHALL use the Enhanced Generator to create a valid, solvable puzzle
2. WHEN THE PuzzleService stores a puzzle, THE PuzzleService SHALL use the Redis key format `reflectiq:puzzle:{puzzleId}`
3. WHEN THE PuzzleService stores a puzzle, THE PuzzleService SHALL set a TTL of 30 days for post-specific puzzles
4. WHEN THE PuzzleService retrieves a puzzle by ID, THE PuzzleService SHALL return the complete puzzle data including grid, materials, and metadata
5. IF THE PuzzleService cannot retrieve a puzzle by ID from Redis, THEN THE PuzzleService SHALL return null to trigger fallback generation

### Requirement 3: Post Creation Integration

**User Story:** As a ReflectIQ system, I want to generate and associate a unique puzzle when creating each post, so that the puzzle is ready when users open the post.

#### Acceptance Criteria

1. WHEN THE System creates a daily post, THE System SHALL generate a unique puzzle ID before submitting the post
2. WHEN THE System creates a daily post, THE System SHALL call PuzzleService to generate and store the puzzle with the unique ID
3. WHEN THE System creates a daily post, THE System SHALL include the puzzle ID and difficulty in the post's `postData`
4. WHEN THE System creates a daily post, THE System SHALL log the puzzle ID for debugging and monitoring purposes
5. IF puzzle generation fails during post creation, THEN THE System SHALL retry with fallback generation before failing the post creation

### Requirement 4: Client-Side Puzzle Retrieval

**User Story:** As a player, I want to load the specific puzzle associated with the post I'm viewing, so that I can solve the correct puzzle for that post.

#### Acceptance Criteria

1. WHEN THE Client initializes a game, THE Client SHALL fetch the post context to retrieve the puzzle ID
2. WHEN THE Client has a puzzle ID from post context, THE Client SHALL request the puzzle by ID from the API
3. WHEN THE Client receives puzzle data, THE Client SHALL initialize the game state with the retrieved puzzle
4. IF THE Client cannot retrieve a puzzle ID from post context, THEN THE Client SHALL fall back to requesting the current daily puzzle
5. WHEN THE Client successfully loads a puzzle, THE Client SHALL display a confirmation message indicating the puzzle source

### Requirement 5: API Endpoint for Puzzle Retrieval

**User Story:** As a client application, I want an API endpoint to retrieve puzzles by ID, so that I can fetch post-specific puzzles.

#### Acceptance Criteria

1. THE System SHALL provide an API endpoint at `/api/puzzle/by-id` that accepts puzzle ID and difficulty parameters
2. WHEN THE API receives a puzzle-by-ID request, THE API SHALL validate the puzzle ID format
3. WHEN THE API receives a puzzle-by-ID request, THE API SHALL call PuzzleService to retrieve the puzzle from Redis
4. IF THE API finds the puzzle in Redis, THEN THE API SHALL return the puzzle data with success status
5. IF THE API cannot find the puzzle in Redis, THEN THE API SHALL generate a new puzzle with the provided ID and return it

### Requirement 6: Session Management Updates

**User Story:** As a ReflectIQ system, I want sessions to be linked to specific puzzle IDs, so that user progress is tracked correctly for each unique puzzle.

#### Acceptance Criteria

1. WHEN THE System creates a session, THE System SHALL store the puzzle ID with the session data
2. WHEN THE System validates a session, THE System SHALL verify that the puzzle ID matches the expected puzzle
3. WHEN THE System retrieves session data, THE System SHALL include the associated puzzle ID
4. WHEN THE System submits an answer, THE System SHALL validate that the session's puzzle ID matches the puzzle being solved
5. THE System SHALL maintain session isolation between different puzzle IDs to prevent cross-puzzle submissions

### Requirement 7: Backward Compatibility

**User Story:** As a ReflectIQ system, I want to support existing posts without puzzle IDs, so that old posts continue to function correctly.

#### Acceptance Criteria

1. WHEN THE Client encounters a post without a puzzle ID, THE Client SHALL fall back to requesting the daily puzzle for that date and difficulty
2. WHEN THE API receives a request without a puzzle ID, THE API SHALL use the legacy daily puzzle retrieval method
3. WHEN THE System processes a session for a legacy puzzle, THE System SHALL use the date-based puzzle ID format
4. THE System SHALL log when legacy fallback behavior is triggered for monitoring purposes
5. THE System SHALL maintain full functionality for posts created before this feature implementation

### Requirement 8: Error Handling and Fallbacks

**User Story:** As a player, I want the system to handle errors gracefully, so that I can still play puzzles even if there are temporary issues.

#### Acceptance Criteria

1. IF THE PuzzleService cannot retrieve a puzzle by ID, THEN THE PuzzleService SHALL attempt to generate a new puzzle with that ID
2. IF puzzle generation fails, THEN THE System SHALL use backup puzzle templates as a last resort
3. WHEN THE System encounters a Redis error, THE System SHALL log the error and continue with fallback behavior
4. WHEN THE Client cannot retrieve post context, THE Client SHALL fall back to daily puzzle mode
5. THE System SHALL provide clear error messages to users when puzzle loading fails, with actionable retry options

### Requirement 9: Monitoring and Logging

**User Story:** As a ReflectIQ developer, I want comprehensive logging of puzzle generation and retrieval, so that I can monitor system health and debug issues.

#### Acceptance Criteria

1. WHEN THE System generates a puzzle with a unique ID, THE System SHALL log the puzzle ID, difficulty, and generation time
2. WHEN THE System stores a puzzle in Redis, THE System SHALL log the storage operation and TTL
3. WHEN THE System retrieves a puzzle by ID, THE System SHALL log whether the puzzle was found in cache or generated
4. WHEN THE System encounters an error, THE System SHALL log the error type, context, and fallback action taken
5. THE System SHALL track metrics for puzzle generation success rate, cache hit rate, and retrieval latency

### Requirement 10: Performance Optimization

**User Story:** As a player, I want puzzles to load quickly, so that I can start playing without delays.

#### Acceptance Criteria

1. WHEN THE System generates a puzzle during post creation, THE System SHALL complete generation within 5 seconds
2. WHEN THE Client requests a puzzle by ID, THE System SHALL retrieve it from Redis cache within 500 milliseconds
3. THE System SHALL use the Enhanced Generator for guaranteed puzzle generation to avoid retry loops
4. THE System SHALL implement circuit breaker patterns for Redis operations to prevent cascading failures
5. WHEN THE System experiences high load, THE System SHALL prioritize puzzle retrieval over generation for active users
