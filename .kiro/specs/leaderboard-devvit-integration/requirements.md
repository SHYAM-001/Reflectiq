# Requirements Document

## Introduction

This feature enhances the existing ReflectIQ puzzle game by integrating the leaderboard system with Devvit's custom post functionality and moderator menu actions. The system will leverage the existing InteractiveLeaderboard component and backend LeaderboardService to create Reddit posts that display real-time leaderboard data with proper difficulty level indicators.

## Glossary

- **Custom_Post**: A Devvit-specific post type that renders interactive content within Reddit
- **Moderator_Menu**: Reddit's moderator interface accessible through the three-dot menu on posts/subreddits
- **LeaderboardService**: Existing backend service that manages puzzle completion rankings and statistics
- **Leaderboard_Component**: Existing React component (Leaderboard.tsx) that displays leaderboard data with animations and styling
- **Difficulty_Badge**: Color-coded visual indicator showing puzzle difficulty (easy=green, medium=yellow, hard=red)
- **Post_Data**: Devvit mechanism for passing structured data from server to client components
- **Splash_Screen**: Initial display screen shown when users open a puzzle post

## Requirements

### Requirement 1

**User Story:** As a moderator, I want to create leaderboard posts through the moderator menu, so that I can share daily rankings with the community

#### Acceptance Criteria

1. WHEN a moderator clicks the "📊 Daily Leaderboard" menu item, THE Custom_Post SHALL be created with current day's leaderboard data
2. WHEN a moderator clicks the "🏆 Weekly Leaderboard" menu item, THE Custom_Post SHALL be created with current week's leaderboard data
3. WHEN the leaderboard post is created, THE Custom_Post SHALL display a success toast notification to the moderator
4. WHEN the leaderboard post is created, THE Custom_Post SHALL automatically navigate the moderator to the new post
5. IF the leaderboard data retrieval fails, THEN THE Custom_Post SHALL display an error message and use fallback sample data

### Requirement 2

**User Story:** As a Reddit user, I want to view interactive leaderboard posts, so that I can see current puzzle rankings and statistics

#### Acceptance Criteria

1. WHEN a user opens a leaderboard Custom_Post, THE Leaderboard_Component SHALL render with real backend data
2. WHEN the leaderboard loads, THE Leaderboard_Component SHALL display player rankings with usernames, times, scores, and difficulty levels
3. WHEN the leaderboard displays difficulty levels, THE Difficulty_Badge SHALL show green for easy, yellow for medium, and red for hard
4. WHEN the leaderboard loads, THE Leaderboard_Component SHALL show statistics cards with fastest time, top score, total players, and submissions
5. IF the backend data is unavailable, THEN THE Leaderboard_Component SHALL display sample data with a warning message

### Requirement 3

**User Story:** As a Reddit user, I want to see difficulty levels on puzzle splash screens, so that I can understand the challenge level before starting

#### Acceptance Criteria

1. WHEN a user opens a puzzle Custom_Post, THE Splash_Screen SHALL display the puzzle date and difficulty level
2. WHEN the difficulty level is displayed, THE Difficulty_Badge SHALL use green color for easy puzzles
3. WHEN the difficulty level is displayed, THE Difficulty_Badge SHALL use yellow color for medium puzzles
4. WHEN the difficulty level is displayed, THE Difficulty_Badge SHALL use red color for hard puzzles
5. WHEN the difficulty badge is shown, THE Splash_Screen SHALL include both the difficulty text and color coding

### Requirement 4

**User Story:** As a system administrator, I want leaderboard posts to use real backend data, so that rankings reflect actual player performance

#### Acceptance Criteria

1. WHEN a leaderboard Custom_Post is created, THE LeaderboardService SHALL provide current leaderboard data via Post_Data
2. WHEN leaderboard data is retrieved, THE LeaderboardService SHALL include player usernames, completion times, scores, hints used, and difficulty levels
3. WHEN leaderboard statistics are calculated, THE LeaderboardService SHALL provide fastest time, top score, total players, and submission counts
4. WHEN difficulty distribution is calculated, THE LeaderboardService SHALL provide player counts for easy, medium, and hard puzzles
5. IF the LeaderboardService is unavailable, THEN THE Custom_Post SHALL gracefully degrade to sample data with error indication

### Requirement 5

**User Story:** As a system, I want the existing automated leaderboard posting to use the InteractiveLeaderboard design, so that scheduled posts have the same visual quality as manual posts

#### Acceptance Criteria

1. WHEN the existing daily leaderboard scheduler runs, THE Custom_Post SHALL use the Leaderboard_Component design
2. WHEN the automated leaderboard post is created, THE Custom_Post SHALL pass real LeaderboardService data through Post_Data
3. WHEN the scheduled leaderboard post renders, THE Leaderboard_Component SHALL display the same animations, styling, and layout as manual posts
4. WHEN the automated post includes leaderboard data, THE Custom_Post SHALL show proper difficulty badges and ranking icons
5. WHEN the existing scheduler creates the post, THE Custom_Post SHALL maintain all existing logging and error handling functionality

### Requirement 6

**User Story:** As a competitive player, I want only my first correct attempt to count for leaderboard scoring, so that the rankings reflect genuine first-try performance and prevent score manipulation

#### Acceptance Criteria

1. WHEN a player submits a correct answer for a puzzle they have already completed, THE LeaderboardService SHALL not update their leaderboard position or score
2. WHEN a player attempts a puzzle they have already solved correctly, THE Submission_System SHALL return their original completion data without adding new leaderboard entries
3. WHEN checking for existing completions, THE Submission_System SHALL use the existing hasUserCompleted method from SubmissionService
4. WHEN a repeat attempt is detected, THE Submission_System SHALL display a message indicating "Puzzle already completed. Only first correct attempt counts for leaderboard."
5. WHEN a player views their submission result for a repeat attempt, THE Submission_System SHALL show their original completion time, score, and hints used

### Requirement 7

**User Story:** As a puzzle player, I want to filter the leaderboard by difficulty level, so that I can compare my performance against players who solved puzzles of the same difficulty

#### Acceptance Criteria

1. WHEN the leaderboard loads, THE Leaderboard_Component SHALL display difficulty filter buttons for Easy, Medium, Hard, and All difficulties
2. WHEN the leaderboard initializes, THE Leaderboard_Component SHALL default to showing Easy difficulty rankings
3. WHEN a player clicks a difficulty filter, THE Leaderboard_Component SHALL fetch and display only entries for that specific difficulty level
4. WHEN filtering by difficulty, THE LeaderboardService SHALL provide a getDailyLeaderboardByDifficulty method that filters entries by the specified difficulty
5. WHEN the difficulty filter is active, THE Leaderboard_Component SHALL update the statistics cards to show difficulty-specific metrics (player count, fastest time, top score)
