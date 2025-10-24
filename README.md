# Logic Reflections

**A sophisticated laser puzzle game built for Reddit that challenges players to predict where a laser beam will exit after interacting with various reflective materials.**

Logic Reflections is an innovative grid-based puzzle game that combines physics simulation, strategic thinking, and competitive gameplay. Players must analyze complex reflection patterns, use strategic hints wisely, and submit their answers privately through Reddit comments to compete on time-based leaderboards.

## What Makes This Game Unique

### 🔬 **Realistic Laser Physics**

- **5 Different Materials**: Each material has unique reflection behaviors based on real-world physics
- **Complex Interactions**: Laser beams can reflect, absorb, split, reverse, or diffuse depending on the material
- **Predictable Yet Challenging**: While physics are consistent, predicting the final exit point requires careful analysis

### 🧩 **Strategic Hint System**

- **Quadrant-Based Reveals**: Get visual hints by revealing laser paths in specific grid quadrants
- **Risk vs. Reward**: Each hint reduces your final score, creating strategic decisions
- **Progressive Penalties**: Score multipliers decrease with each hint used (1.0x → 0.8x → 0.6x → 0.4x → 0.2x)

### 🏆 **Competitive Reddit Integration**

- **Private Submissions**: Answer through Reddit comments that only you and the game can see
- **Real-Time Leaderboards**: Compete against other players with live ranking updates
- **Time-Based Scoring**: Faster solutions earn higher scores with time bonus multipliers
- **Daily Challenges**: New puzzles generated daily across three difficulty levels

### 📱 **Seamless Platform Experience**

- **Native Reddit Integration**: Plays directly within Reddit posts using Devvit framework
- **Mobile-Optimized**: Responsive design works perfectly on mobile and desktop
- **No External Apps**: Everything runs within Reddit's ecosystem

## How to Play Logic Reflections

### 🎯 **Objective**

Predict where the laser beam will exit the grid after bouncing off various reflective materials.

### 📋 **Step-by-Step Instructions**

#### 1. **Choose Your Difficulty**

- **Easy (6x6 Grid)**: 100 base points, 5-minute time limit
- **Medium (8x8 Grid)**: 250 base points, 10-minute time limit
- **Hard (10x10 Grid)**: 500 base points, 15-minute time limit

#### 2. **Study the Grid**

- **Laser Entry Point**: Look for the red laser indicator showing where the beam starts
- **Material Types**: Each colored cell represents a different reflective material:
  - 🪞 **Silver Mirror**: Reflects laser at 90-degree angles
  - 💧 **Blue Water**: Soft reflection with possible 1-cell diffusion
  - 🔷 **Green Glass**: 50% chance to pass through, 50% chance to reflect
  - ⚫ **Red Metal**: Completely reverses the laser beam direction
  - ⬛ **Black Absorber**: Stops the laser beam entirely
  - **Empty Cells**: Laser passes through without interference

#### 3. **Trace the Laser Path (Mental Calculation)**

- Start from the laser entry point
- Follow the beam as it hits each material
- Apply the reflection rules for each material type
- Continue until the beam exits the grid or gets absorbed

#### 4. **Use Hints Strategically (Optional)**

- Click quadrant hint buttons to reveal actual laser path segments
- **Quadrants unlock in order**: Top-Left → Top-Right → Bottom-Left → Bottom-Right
- **Score Impact**: Each hint reduces your final score multiplier
- **Strategic Decision**: Balance learning vs. score preservation

#### 5. **Submit Your Answer**

- Click "Start Puzzle" to begin timing
- Once you know the exit point, submit via Reddit comment
- **Format**: Type "Exit: [COORDINATE]" (e.g., "Exit: D5")
- **Privacy**: Your comment is automatically set to private (only you and the game see it)
- **Timing**: Timer stops immediately when valid answer is submitted

#### 6. **Scoring & Leaderboard**

- **Base Score**: Determined by difficulty level
- **Hint Penalty**: Multiplied by hint usage (fewer hints = higher score)
- **Time Bonus**: Faster solutions earn additional points
- **Final Formula**: `Base Score × Hint Multiplier × Time Bonus`
- **Leaderboard**: See your rank among all players for that difficulty

### 🏅 **Pro Tips**

- **Start Simple**: Begin with Easy puzzles to learn material behaviors
- **Plan Ahead**: Trace the entire path mentally before using hints
- **Time Management**: Balance accuracy with speed for optimal scoring
- **Material Mastery**: Learn how each material affects laser direction
- **Strategic Hints**: Use hints to confirm tricky sections, not to solve the entire puzzle

## Getting Started (Development)

> Make sure you have Node 22 downloaded on your machine before running!

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start development server
4. Open the provided Reddit playtest URL to test the game

## Game Features

### 🎮 **Core Gameplay**

- **Physics-Based Puzzles**: Realistic laser reflection simulation
- **Multiple Difficulty Levels**: Progressive challenge with larger grids
- **Material Variety**: 5 different reflective materials with unique behaviors
- **Precise Timing**: Millisecond-accurate timer for competitive scoring

### 🎯 **Hint System**

- **4 Strategic Hints**: Reveal laser path by quadrant
- **Visual Animations**: See actual laser beam path during hints
- **Score Trade-offs**: Balance learning assistance with final score
- **Progressive Unlocking**: Quadrants unlock in logical sequence

### 🏆 **Competitive Features**

- **Real-Time Leaderboards**: Live ranking updates across difficulty levels
- **Time-Based Scoring**: Faster solutions earn bonus multipliers
- **Private Submissions**: Secure answer submission through Reddit comments
- **Daily Challenges**: Fresh puzzles generated automatically

### 📱 **Platform Integration**

- **Native Reddit Experience**: Seamless integration with Reddit posts
- **Mobile Responsive**: Optimized for both desktop and mobile play
- **Automatic Authentication**: Uses Reddit login for user identification
- **Persistent Progress**: Game state and scores saved across sessions

## Technology Stack

- **[Devvit](https://developers.reddit.com/)**: Reddit's developer platform for immersive games
- **[React](https://react.dev/)**: Frontend UI framework with TypeScript
- **[Vite](https://vite.dev/)**: Build tool for fast development and compilation
- **[Express](https://expressjs.com/)**: Backend API server for game logic
- **[Redis](https://redis.io/)**: Data persistence for puzzles and leaderboards
- **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first styling framework
- **[TypeScript](https://www.typescriptlang.org/)**: Type safety across the entire stack

## Development Commands

- `npm run dev`: Starts development server with live Reddit integration
- `npm run build`: Builds client and server for production
- `npm run deploy`: Uploads new version to Reddit
- `npm run launch`: Publishes app for Reddit review
- `npm run login`: Authenticates CLI with Reddit
- `npm run check`: Runs type checking, linting, and formatting

## Project Structure

```
src/
├── client/          # React frontend (runs in Reddit webview)
│   ├── components/  # Game UI components
│   │   ├── game/    # Core game components (PuzzleGrid, Timer, Hints)
│   │   ├── leaderboard/  # Ranking and scoring displays
│   │   └── ui/      # Shared UI components
│   ├── hooks/       # Custom React hooks
│   ├── services/    # API communication layer
│   └── utils/       # Client-side utilities
├── server/          # Express backend (handles Reddit integration)
│   ├── core/        # Game logic and puzzle generation
│   ├── services/    # Reddit API and Redis operations
│   └── routes/      # API endpoints
└── shared/          # Shared types and utilities
    ├── types/       # TypeScript interfaces
    ├── constants.ts # Game configuration
    └── utils.ts     # Shared helper functions
```

## Cursor Integration

This project comes with pre-configured Cursor AI integration. To get started:

1. [Download Cursor](https://www.cursor.com/downloads)
2. Enable the `devvit-mcp` when prompted
3. Use AI assistance for development and debugging
