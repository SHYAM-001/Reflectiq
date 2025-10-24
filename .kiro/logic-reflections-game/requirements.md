# Requirements Document

## Introduction

Logic Reflections is a grid-based laser puzzle game for Reddit that challenges players to predict where a laser beam will exit after interacting with various reflective materials. Players must analyze reflection patterns, use strategic hints, and submit their answers privately through Reddit comments to compete on a time-based leaderboard.

## Glossary

- **Logic_Reflections_System**: The complete puzzle game application running on Reddit via Devvit
- **Puzzle_Grid**: The visual game board containing reflective materials and laser path
- **Laser_Beam**: The light ray that travels through the grid and reflects off materials
- **Reflective_Material**: Objects in the grid that alter laser direction (mirrors, water, glass, metal, absorbers)
- **Hint_System**: Visual assistance feature that reveals laser path in grid quadrants
- **Private_Comment**: Reddit comment visible only to the game system, not other users
- **Leaderboard_System**: Ranking display showing player performance across difficulty levels
- **Difficulty_Level**: Game complexity setting (Easy, Medium, Hard) affecting grid size and materials
- **Score_Calculator**: Algorithm determining final points based on accuracy, time, and hints used

## Requirements

### Requirement 1

**User Story:** As a Reddit user, I want to play a laser reflection puzzle game, so that I can challenge my logical reasoning skills in an engaging visual format

#### Acceptance Criteria

1. WHEN a user accesses the game post, THE Logic_Reflections_System SHALL display a grid-based puzzle with a laser entry point
2. THE Logic_Reflections_System SHALL render different reflective materials using distinct colors (silver mirrors, blue water, green glass, red metal, black absorbers)
3. THE Logic_Reflections_System SHALL provide three difficulty levels with varying grid sizes (6x6 Easy, 8x8 Medium, 10x10 Hard)
4. THE Logic_Reflections_System SHALL display material legend showing reflection behaviors for each type
5. WHEN a user selects a difficulty level, THE Logic_Reflections_System SHALL generate an appropriate puzzle configuration

### Requirement 2

**User Story:** As a player, I want to receive visual hints when stuck, so that I can learn the reflection mechanics without completely giving up

#### Acceptance Criteria

1. THE Logic_Reflections_System SHALL provide exactly four visual hints per puzzle
2. WHEN a user requests a hint, THE Logic_Reflections_System SHALL animate the laser path through one quadrant of the grid
3. THE Logic_Reflections_System SHALL unlock quadrants in sequential order (top-left, top-right, bottom-left, bottom-right)
4. THE Logic_Reflections_System SHALL apply score penalties for hint usage (0.8x for 1 hint, 0.6x for 2 hints, 0.4x for 3 hints, 0.2x for 4 hints)
5. THE Logic_Reflections_System SHALL disable used hint buttons to prevent duplicate usage

### Requirement 3

**User Story:** As a competitive player, I want to submit my answer privately and be timed, so that I can compete fairly without seeing others' solutions

#### Acceptance Criteria

1. WHEN a user clicks "Start Puzzle", THE Logic_Reflections_System SHALL begin timing the session
2. THE Logic_Reflections_System SHALL accept answers only through private Reddit comments
3. THE Logic_Reflections_System SHALL ensure private comments are visible only to the game system
4. WHEN a user submits a valid answer format, THE Logic_Reflections_System SHALL stop the timer immediately
5. THE Logic_Reflections_System SHALL validate answer format as grid coordinates (e.g., "Exit: D5")

### Requirement 4

**User Story:** As a player, I want to see how different materials affect laser behavior, so that I can understand the puzzle mechanics

#### Acceptance Criteria

1. WHEN laser hits a mirror, THE Logic_Reflections_System SHALL reflect the beam at 90-degree angles
2. WHEN laser hits water, THE Logic_Reflections_System SHALL reflect with possible one-cell random offset for diffusion
3. WHEN laser hits glass, THE Logic_Reflections_System SHALL split behavior with 50% pass-through and 50% reflection
4. WHEN laser hits metal, THE Logic_Reflections_System SHALL reverse beam direction completely
5. WHEN laser hits an absorber, THE Logic_Reflections_System SHALL terminate the beam path

### Requirement 5

**User Story:** As a competitive player, I want to see my ranking compared to others, so that I can track my performance and improvement

#### Acceptance Criteria

1. THE Logic_Reflections_System SHALL calculate scores using the formula: Base Score × Hint Multiplier × Time Bonus
2. THE Logic_Reflections_System SHALL assign base scores by difficulty (Easy: 100pts, Medium: 250pts, Hard: 500pts)
3. THE Logic_Reflections_System SHALL display leaderboard with rank, username, difficulty, time, hints used, and final score
4. THE Logic_Reflections_System SHALL update leaderboard immediately after each valid submission
5. THE Logic_Reflections_System SHALL award full points only for correct exit cell predictions

### Requirement 6

**User Story:** As a Reddit user, I want the game to integrate seamlessly with Reddit, so that I can play without leaving the platform

#### Acceptance Criteria

1. THE Logic_Reflections_System SHALL run within Reddit posts using Devvit framework
2. THE Logic_Reflections_System SHALL authenticate users automatically through Reddit login
3. THE Logic_Reflections_System SHALL create game posts with engaging splash screens
4. THE Logic_Reflections_System SHALL handle mobile and desktop Reddit interfaces
5. THE Logic_Reflections_System SHALL persist game data using Redis storage
