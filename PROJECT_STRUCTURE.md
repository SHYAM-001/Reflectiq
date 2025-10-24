# Logic Reflections - Project Structure

## Overview

Logic Reflections is a grid-based laser puzzle game built on the Devvit platform for Reddit.

## Directory Structure

```
src/
├── client/                 # React frontend application
│   ├── components/
│   │   ├── game/          # Game-specific components (PuzzleGrid, HintSystem, GameTimer)
│   │   ├── ui/            # Reusable UI components
│   │   └── leaderboard/   # Leaderboard components
│   ├── services/          # Client-side API services
│   ├── utils/             # Client-side utilities
│   └── hooks/             # React hooks
├── server/                # Express server backend
│   ├── core/              # Core server functionality
│   ├── services/          # Business logic services (GameEngine, CommentMonitor, etc.)
│   ├── routes/            # API route handlers
│   └── utils/             # Server-side utilities
└── shared/                # Shared types and utilities
    ├── types/             # TypeScript type definitions
    │   ├── game.ts        # Core game types
    │   ├── daily-puzzles.ts # Daily puzzle and filtering types
    │   └── api.ts         # API request/response types
    ├── constants.ts       # Game constants and configuration
    └── utils.ts           # Shared utility functions
```

## Key Components

### Shared Types

- **Game Types**: Core game mechanics (GridCell, PuzzleConfiguration, LaserPath)
- **Daily Puzzle Types**: Daily puzzle generation and filtering
- **API Types**: Request/response interfaces for client-server communication

### Constants

- Grid sizes by difficulty (6x6, 8x8, 10x10)
- Base scores (100, 250, 500 points)
- Material colors and reflection behaviors
- Hint multipliers (1.0, 0.8, 0.6, 0.4, 0.2)

### Utilities

- Coordinate conversion (row/col ↔ grid labels like "D5")
- Answer parsing from Reddit comments
- Time formatting and bonus calculations
- Grid hashing for uniqueness validation

## Configuration

### Devvit Permissions

- `redis`: For data persistence
- `posts`: For creating puzzle posts
- `comments`: For monitoring answer submissions
- `users`: For user authentication
- `moderation`: For moderator actions

### Menu Actions

- Create Logic Reflections Puzzle
- Generate Daily Puzzles

### Triggers

- `onAppInstall`: Initialize app data
- `onCommentCreate`: Monitor answer submissions

## Next Steps

1. Implement laser physics engine (Task 2.1)
2. Create core UI components (Task 3)
3. Build server-side game logic (Task 4)
4. Integrate Reddit comment monitoring (Task 5)
