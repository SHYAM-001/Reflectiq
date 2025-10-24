# Logic Reflections 🔄

**A sophisticated laser reflection puzzle game built for Reddit that challenges players to predict where a laser beam will exit after bouncing through various reflective materials.**

Logic Reflections is an innovative grid-based puzzle game that combines realistic physics simulation, strategic thinking, and competitive gameplay. Players must analyze how laser beams interact with mirrors, water, glass, metal, and absorbers to predict the correct exit point. The game features a fully functional React-based interface with an engaging splash screen, strategic quadrant-based hint system, precise time-based scoring, and multiple difficulty levels (Easy 4x4, Medium 5x5, Hard 6x6 grids), all running seamlessly within Reddit posts using the Devvit platform.

## What Makes This Game Unique

### 🔬 **Realistic Laser Physics Simulation**

- **6 Different Materials**: Each material has unique reflection behaviors based on real-world physics
  - 🪞 **Mirrors**: Reflect laser beams at precise angles (45° and -45° orientations)
  - 💧 **Water**: Creates diffused reflections with variable beam spreading
  - 🔍 **Glass**: Probabilistic behavior - beams may pass through or reflect based on chance
  - ⚙️ **Metal**: Completely reverses the laser beam direction
  - ⚫ **Absorber**: Stops the laser beam entirely, ending the path
  - **Empty Cells**: Allow laser beams to pass through unobstructed
- **Advanced Beam Physics**: Realistic direction vectors, coordinate systems, and reflection algorithms
- **Visual Path Tracing**: See exactly how beams interact with each material through animated hints

### 🧩 **Strategic Quadrant-Based Hint System**

- **Four Quadrant Zones**: Top-Left ↖️, Top-Right ↗️, Bottom-Left ↙️, Bottom-Right ↘️
- **Animated Laser Paths**: Hints reveal actual beam trajectories with smooth SVG animations and glow effects
- **Strategic Score Impact**: Real-time display of how each hint affects your final score multiplier
- **Progressive Penalties**: Score multipliers decrease with each hint used (1.0x → 0.8x → 0.6x → 0.4x → 0.2x)
- **Smart Usage Tracking**: Visual indicators show which quadrants have been revealed and remaining hints
- **Cooldown System**: Prevents rapid hint usage with 1-second cooldown between requests

### 🏆 **Progressive Difficulty System**

- **Easy Mode (4x4 Grid)**: 100 base points, 5-minute time limit, perfect for learning the mechanics
- **Medium Mode (5x5 Grid)**: 200 base points, 10-minute time limit, balanced challenge with more materials
- **Hard Mode (6x6 Grid)**: 300 base points, 15-minute time limit, complex puzzles with intricate beam paths
- **Dynamic Puzzle Generation**: Each game creates unique material layouts with guaranteed solvable solutions
- **Adaptive Scoring**: Base score, hint penalties, and time bonuses combine for competitive gameplay

### 📱 **Seamless Reddit Integration**

- **Native Devvit Experience**: Plays directly within Reddit posts with no external apps needed
- **Mobile-Optimized**: Responsive design works perfectly on mobile and desktop browsers
- **Automatic Authentication**: Uses Reddit login for seamless user identification
- **Persistent Progress**: Game state and scores saved across sessions

## How to Play Logic Reflections

### 🎯 **Objective**

Analyze the puzzle grid and predict where the laser beam will exit after interacting with various reflective materials. Click on the correct exit cell to submit your answer and earn points based on accuracy, speed, and hint usage.

### 📋 **Step-by-Step Instructions**

#### 1. **Start Playing**

- **🎮 Interactive Splash Screen**: Beautiful gradient welcome screen with animated difficulty selection buttons
- **📖 Comprehensive How to Play**: Built-in tutorial with step-by-step instructions and visual material guide
- **🎯 Smart Difficulty Selection**: Choose from Easy (🟢), Medium (🟡), or Hard (🔴) with visual difficulty indicators
- **👋 Personalized Welcome**: If logged into Reddit, see a personalized greeting with your username

#### 2. **Select Your Difficulty**

- **🟢 Easy (4x4 Grid)**: 100 base points, 5-minute time limit, perfect for learning
- **🟡 Medium (5x5 Grid)**: 200 base points, 10-minute time limit, balanced challenge
- **🔴 Hard (6x6 Grid)**: 300 base points, 15-minute time limit, expert level

#### 3. **Study the Puzzle Grid**

- **Laser Entry Point**: Look for the red laser indicator (🔴) showing where the beam starts and its initial direction
- **Interactive Material Legend**: Reference the built-in material guide with color-coded examples:
  - 🪞 **Mirror**: Reflects laser at 45° or -45° angles based on orientation (silver color)
  - 💧 **Water**: Diffuses beam with variable reflection patterns (blue color)
  - 🔍 **Glass**: Probabilistic behavior - may pass through or reflect based on chance (light blue color)
  - ⚙️ **Metal**: Completely reverses the laser beam direction (metallic color)
  - ⚫ **Absorber**: Stops the laser beam entirely, ending the path (black color)
  - **Empty Cells**: Laser passes through without interference (light gray color)
- **Smart Grid Coordinates**: Each cell displays a coordinate label (A1, B2, C3, etc.) for easy identification
- **Enhanced Hover Effects**: Hover over any cell to see detailed material information, coordinate, and interaction tooltip
- **Responsive Grid Sizing**: Grid automatically adjusts cell size based on your device for optimal viewing

#### 4. **Trace the Laser Path**

- Start from the laser entry point and follow the beam direction
- Apply reflection rules as the beam hits each material
- Consider multiple bounces and direction changes
- Continue tracing until the beam exits the grid or gets absorbed

#### 5. **Use the Strategic Hint System (Optional)**

- **4 Quadrant Hints Available**: Top-Left ↖️, Top-Right ↗️, Bottom-Left ↙️, Bottom-Right ↘️ with clear directional indicators
- **Animated Laser Paths**: Hints reveal actual beam trajectories with smooth SVG animations and glow effects (when connected to physics engine)
- **Real-Time Score Impact Display**: Live calculation showing exactly how each hint affects your projected final score
- **Progressive Penalty System**: Score multipliers decrease with each hint (1.0x → 0.8x → 0.6x → 0.4x → 0.2x) with visual feedback
- **Smart Visual Indicators**: Used hints show ✅, available hints show 💡, locked hints show 🔒, animating hints show ⚡
- **Cooldown Protection**: 1-second cooldown between hint requests prevents accidental usage with loading animations
- **Built-in Strategy Tips**: Integrated guidance panel with tips for optimal hint usage and puzzle-solving techniques
- **Animation Status Feedback**: Loading spinners and status messages during hint processing for clear user feedback

#### 6. **Submit Your Answer**

- **Click to Answer**: Simply click on the grid cell where you think the laser will exit
- **Immediate Feedback**: Get instant confirmation if your answer is correct or incorrect
- **Timer Stops**: Your completion time is recorded the moment you submit
- **Score Calculation**: Final score combines base points, hint penalties, and time bonuses

#### 7. **View Results & Continue**

- **Instant Feedback**: Get immediate confirmation if your answer is correct or incorrect
- **Score Breakdown**: See detailed scoring with base points, hint penalties, and time bonuses
- **Return to Menu**: Navigate back to the splash screen to try different difficulty levels
- **New Puzzle**: Generate fresh puzzles with randomized material layouts for endless gameplay

### 🏅 **Scoring System**

- **Base Score**: Set by difficulty level (Easy: 100, Medium: 200, Hard: 300)
- **Hint Multiplier**: Decreases with each hint used (1.0x → 0.8x → 0.6x → 0.4x → 0.2x)
- **Time Bonus**: Faster completion earns additional multiplier based on remaining time
- **Final Formula**: `Base Score × Hint Multiplier × Time Bonus`
- **Real-Time Calculation**: See projected scores update as you use hints and time progresses

### 💡 **Pro Tips for Success**

- **Master Material Behaviors**: Learn how mirrors, water, glass, metal, and absorbers affect laser paths
- **Start with Easy Mode**: Build confidence with 4x4 grids before tackling larger puzzles
- **Strategic Hint Usage**: Use hints to verify complex beam interactions, not to solve the entire puzzle
- **Time Management**: Balance careful analysis with speed to maximize time bonus multipliers
- **Visual Tracing**: Follow the laser path step-by-step from entry point through each material interaction

## Current Development Status

### ✅ **Completed Features**

- **Complete React Frontend**: Fully functional game interface with App.tsx entry point and LogicReflectionsGame component
- **Interactive Splash Screen**: Beautiful gradient background with difficulty selection, game instructions, and "How to Play" section
- **Advanced Puzzle Grid Component**:
  - Dynamic grid sizing based on difficulty (4x4, 5x5, 6x6)
  - Material-specific visual indicators with emoji icons (🪞 🔍 💧 ⚙️ ⚫)
  - Hover effects with material inspection tooltips
  - Click-to-submit answer functionality with visual feedback
  - Laser entry point indicators with red laser icon (🔴)
  - Coordinate labeling system (A1, B2, C3, etc.)
  - Mobile-responsive cell sizing with viewport optimization
- **Sophisticated Hint System Component**:
  - Four quadrant-based hint buttons (Top-Left, Top-Right, Bottom-Left, Bottom-Right)
  - Real-time score impact calculations with multiplier display
  - Visual hint status indicators (💡 available, ✅ used, 🔒 locked)
  - Animation states with loading spinners during hint processing
  - Strategy tips and usage guidance built into the interface
  - API integration ready for server-side hint processing
- **Precision Game Timer Component**:
  - High-precision timing using requestAnimationFrame for smooth updates
  - Multiple timer states (idle, running, paused, completed, expired)
  - Visual progress bar with percentage completion
  - Warning and critical time thresholds with color-coded alerts
  - Millisecond display for precise timing under 1 minute
  - Timer controls (start, pause, resume, reset) with intuitive icons
- **Material Physics System**: Complete type definitions for 6 material types with reflection behaviors
- **Responsive CSS Design**: Mobile-first styling with gradient backgrounds, glassmorphism effects, and smooth animations
- **TypeScript Integration**: Comprehensive type safety with shared interfaces between components

### 🚧 **In Development**

- **Physics Engine Integration**: Connecting laser beam simulation logic to UI components for path visualization
- **Server API Endpoints**: Backend puzzle generation, answer validation, and scoring system
- **Data Persistence**: Redis integration for leaderboards, user progress, and puzzle storage
- **Laser Path Animation**: SVG-based beam visualization with glow effects and smooth path tracing

### 📋 **Planned Features**

- **Daily Puzzle System**: Automated puzzle generation and Reddit post creation
- **Leaderboard System**: Competitive scoring and ranking displays with real-time updates
- **User Progress Tracking**: Achievement system and completion statistics
- **Advanced Puzzle Filtering**: Search and filter historical puzzles by difficulty and date
- **Enhanced Reddit Integration**: Automated daily puzzle posts and community features

## Getting Started (Development)

> Make sure you have Node 22 downloaded on your machine before running!

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start development server
4. Open the provided Reddit playtest URL to test the game

## Game Features

### 🎮 **Core Gameplay Features**

- **Interactive Puzzle Grid**: Click-to-play interface with hover effects, emoji material icons (🪞💧🔍⚙️⚫), and coordinate labels
- **Advanced Physics Engine**: Realistic laser reflection with 6 distinct material types and complex beam interactions (ready for integration)
- **Progressive Difficulty**: Three challenge levels with 4x4, 5x5, and 6x6 grids with dynamic puzzle generation
- **Precision Timer**: Real-time countdown using requestAnimationFrame with progress bar, state indicators, and millisecond accuracy
- **Dynamic Grid Sizing**: Automatically calculates optimal cell size based on viewport and device type for perfect mobile and desktop experience
- **Mock Puzzle Generation**: Intelligent puzzle creation with proper material placement and coordinate system validation

### 🎯 **Advanced Hint System**

- **Four Quadrant Zones**: Strategic hint areas with clear directional icons (↖️ ↗️ ↙️ ↘️) and position labels
- **SVG Laser Animations**: Ready for smooth animated beam paths with glow effects and realistic physics visualization
- **Real-Time Score Impact**: Live calculation displaying current multiplier, next hint penalty, and projected final scores
- **Smart Usage Tracking**: Visual indicators for used hints (✅), available hints (💡), locked hints (🔒), and animating hints (⚡)
- **Integrated Strategy Tips**: Built-in guidance panel with tips for optimal hint usage and puzzle-solving techniques
- **Animation Status Feedback**: Loading indicators with spinners during hint processing and cooldown protection
- **API Integration Ready**: Fully prepared for server-side hint processing with proper error handling and user feedback

### 🏆 **Game Modes & Features**

- **Beautiful Splash Screen Interface**: Gradient background with glassmorphism effects, animated difficulty selection, and comprehensive game instructions
- **Smart Dynamic Puzzle Generation**: Real-time puzzle creation with proper material placement, coordinate validation, and difficulty-appropriate complexity
- **Interactive Tutorial System**: Built-in "How to Play" section with step-by-step instructions, material guide, and strategy tips with emoji icons
- **Mobile-First Responsive Design**: Optimized interface that automatically adapts to all device sizes with touch-friendly interactions
- **Comprehensive Material Legend**: Interactive reference guide showing all material types with colors, emoji icons, and detailed behavior descriptions
- **Intelligent Coordinate System**: Clear cell labeling (A1, B2, C3, etc.) with hover tooltips for easy navigation and answer submission
- **Game State Management**: Proper state transitions between splash screen and playing modes with smooth animations

### 📱 **User Experience**

- **Native Reddit Integration**: Built with Devvit platform for seamless Reddit post integration
- **Touch-Optimized Interface**: Mobile-first design with responsive grid sizing and touch-friendly interactions
- **Visual Material Legend**: Clear material identification with icons, colors, and behavior descriptions
- **Smooth Animations**: Polished transitions, hover effects, and laser beam visualizations

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
