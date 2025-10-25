# Requirements Document

## Introduction

ReflectIQ is a Reddit-based visual logic puzzle game where players trace laser beam paths through reflective surfaces on a grid to determine the exit point. The system requires a comprehensive backend to support puzzle generation, user submissions, scoring, leaderboards, and automated daily content management integrated with Reddit's Devvit platform.

## Glossary

- **ReflectIQ_System**: The complete backend infrastructure supporting the ReflectIQ puzzle game
- **Puzzle_Engine**: The service responsible for generating daily puzzles with reflective materials and laser physics
- **Reflection_Service**: The component that calculates laser beam paths through different materials
- **Scoring_System**: The service that calculates player scores based on accuracy, time, and hints used
- **Reddit_Integration**: The service managing automated posting and comment collection via Reddit API
- **Leaderboard_Service**: The component managing daily and global player rankings
- **Timer_Service**: The service tracking puzzle completion times
- **Hint_System**: The service providing progressive visual clues to players
- **Daily_Scheduler**: The automated system managing 24-hour puzzle cycles

## Requirements

### Requirement 1

**User Story:** As a Reddit user, I want to access daily puzzles of varying difficulty levels with rich material complexity and minimal empty space, so that I can challenge myself with increasingly sophisticated reflection scenarios.

#### Acceptance Criteria

1. WHEN the Daily_Scheduler executes at midnight, THE Puzzle_Engine SHALL generate three unique puzzles with Easy (6x6), Medium (8x8), and Hard (10x10) grid sizes optimized for Devvit mobile and desktop viewports
2. THE Puzzle_Engine SHALL populate Easy puzzles with 70% material coverage using mirrors and absorbers only
3. THE Puzzle_Engine SHALL populate Medium puzzles with 80% material coverage using mirrors, water, glass, and absorbers
4. THE Puzzle_Engine SHALL populate Hard puzzles with 85% material coverage using all materials including mirrors, water, glass, metal, and absorbers
5. THE Puzzle_Engine SHALL ensure minimal empty space with maximum 30% empty cells for Easy, 20% for Medium, and 15% for Hard puzzles
6. THE Puzzle*Engine SHALL store each puzzle with unique identifiers in the format "puzzle*{difficulty}\_{date}"
7. WHERE a puzzle is requested via API, THE ReflectIQ_System SHALL return the puzzle data in JSON format with grid size, materials, entry point, and solution
8. THE Puzzle_Engine SHALL ensure each puzzle has exactly one valid solution path through the dense material layout

### Requirement 2

**User Story:** As a player, I want the system to accurately simulate laser physics through different materials, so that I can solve puzzles based on realistic reflection behavior.

#### Acceptance Criteria

1. WHEN a laser encounters a mirror material, THE Reflection_Service SHALL calculate reflection at the specified angle
2. WHEN a laser encounters water material, THE Reflection_Service SHALL apply soft reflection with possible one-cell diffusion offset
3. WHEN a laser encounters glass material, THE Reflection_Service SHALL process 50% pass-through and 50% reflection
4. WHEN a laser encounters metal material, THE Reflection_Service SHALL reverse the laser direction completely
5. WHEN a laser encounters absorber material, THE Reflection_Service SHALL terminate the beam path
6. THE Reflection_Service SHALL return the final exit grid coordinates for solution validation

### Requirement 3

**User Story:** As a player, I want to use visual hints when stuck, so that I can progress through difficult puzzles while accepting score penalties.

#### Acceptance Criteria

1. THE Hint_System SHALL provide exactly four hints per puzzle
2. WHEN a hint is requested, THE Hint_System SHALL return partial beam path coordinates for one quadrant of the grid
3. THE Hint_System SHALL apply score multipliers of 1.0, 0.8, 0.6, 0.4, and 0.2 for 0, 1, 2, 3, and 4 hints used respectively
4. THE Hint_System SHALL track hint usage per player session
5. THE Hint_System SHALL precompute hint paths during puzzle generation

### Requirement 4

**User Story:** As a player, I want my puzzle completion time tracked accurately, so that my performance can be fairly evaluated against other players.

#### Acceptance Criteria

1. WHEN a player starts a puzzle, THE Timer_Service SHALL begin tracking elapsed time
2. WHEN a player submits an answer, THE Timer_Service SHALL record the final completion time
3. THE Timer_Service SHALL maintain timing precision to one decimal place
4. THE Timer_Service SHALL store timing data with the player's submission record
5. THE Timer_Service SHALL not allow timer manipulation by the client

### Requirement 5

**User Story:** As a player, I want to submit my answers privately through Reddit comments, so that other players cannot see my solution before completing their own puzzle.

#### Acceptance Criteria

1. WHEN a player submits an answer, THE Reddit_Integration SHALL capture the private comment containing the exit cell
2. THE Reddit_Integration SHALL validate the comment format matches "Exit: [Cell]" pattern
3. THE Reddit_Integration SHALL associate the submission with the player's Reddit username
4. THE Reddit_Integration SHALL ensure comment visibility is restricted to the bot only
5. THE Reddit_Integration SHALL store submission data including username, puzzle ID, answer, and timestamp

### Requirement 6

**User Story:** As a player, I want my score calculated fairly based on accuracy, time, and hint usage, so that I can compete meaningfully with other players.

#### Acceptance Criteria

1. THE Scoring_System SHALL calculate final score using the formula: BaseScore × HintMultiplier × (MaxTime - TimeTaken) / MaxTime
2. THE Scoring_System SHALL award base scores of 150, 400, and 800 points for Easy, Medium, and Hard difficulties respectively
3. WHEN the submitted answer matches the correct exit cell, THE Scoring_System SHALL mark accuracy as 100%
4. WHEN the submitted answer is incorrect, THE Scoring_System SHALL assign zero points
5. THE Scoring_System SHALL store the complete scoring breakdown with each submission

### Requirement 7

**User Story:** As a competitive player, I want to see leaderboards showing top performers, so that I can track my ranking and improvement over time.

#### Acceptance Criteria

1. THE Leaderboard_Service SHALL maintain separate leaderboards for each daily puzzle
2. THE Leaderboard_Service SHALL create a combined daily leaderboard aggregating all three puzzle difficulties
3. THE Leaderboard_Service SHALL rank players by score (descending), then time (ascending), then hints used (ascending)
4. THE Leaderboard_Service SHALL display top 10 players with username, difficulty, time, hints used, and score
5. THE Leaderboard_Service SHALL update rankings in real-time as submissions are received

### Requirement 8

**User Story:** As a regular player, I want new puzzles automatically posted daily, so that I have fresh content to engage with consistently.

#### Acceptance Criteria

1. THE Daily_Scheduler SHALL execute puzzle generation at midnight server time
2. THE Daily_Scheduler SHALL automatically post three new puzzles to Reddit with appropriate formatting
3. WHEN 24 hours elapse, THE Daily_Scheduler SHALL collect all submissions and generate the final leaderboard
4. THE Daily_Scheduler SHALL post the leaderboard results as a new Reddit post
5. THE Daily_Scheduler SHALL archive completed puzzles and maintain the continuous daily cycle

### Requirement 9

**User Story:** As a system administrator, I want reliable data persistence and retrieval, so that player progress and game state are never lost.

#### Acceptance Criteria

1. THE ReflectIQ_System SHALL store all puzzle data in Redis with appropriate expiration policies
2. THE ReflectIQ_System SHALL persist player submissions with complete metadata
3. THE ReflectIQ_System SHALL maintain leaderboard data using Redis sorted sets for efficient ranking
4. THE ReflectIQ_System SHALL implement data backup and recovery mechanisms
5. THE ReflectIQ_System SHALL handle concurrent access to shared data structures safely

### Requirement 10

**User Story:** As a mobile and desktop user, I want the puzzle to fit perfectly within the Reddit Devvit viewport, so that I can play without scrolling or viewport issues.

#### Acceptance Criteria

1. THE Puzzle_Engine SHALL ensure all puzzle grids fit within Devvit's mobile viewport constraints without requiring horizontal or vertical scrolling
2. THE Puzzle_Engine SHALL optimize grid cell sizes to maintain visibility and usability across mobile and desktop devices
3. THE ReflectIQ_System SHALL ensure the complete game interface including timer, hints, and submit button remains within the single viewport
4. THE ReflectIQ_System SHALL maintain responsive design compatibility with Reddit's mobile and desktop applications
5. THE Puzzle_Engine SHALL validate that puzzle complexity remains challenging despite viewport size constraints

### Requirement 11

**User Story:** As a developer, I want comprehensive API endpoints, so that the frontend can seamlessly integrate with backend services.

#### Acceptance Criteria

1. THE ReflectIQ_System SHALL provide GET /api/puzzle/current endpoint returning current day's puzzle by difficulty
2. THE ReflectIQ_System SHALL provide POST /api/puzzle/start endpoint to initialize player timing
3. THE ReflectIQ_System SHALL provide POST /api/puzzle/hint endpoint returning hint path data
4. THE ReflectIQ_System SHALL provide POST /api/puzzle/submit endpoint for answer processing and scoring
5. THE ReflectIQ_System SHALL provide GET /api/leaderboard/daily endpoint returning combined daily rankings
6. THE ReflectIQ_System SHALL return all API responses in JSON format with appropriate HTTP status codes
