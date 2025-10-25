# Logic Reflections 🔄

**A sophisticated laser reflection puzzle game built for Reddit that challenges players to predict where a laser beam will exit after bouncing through various reflective materials.**

Logic Reflections is an innovative grid-based puzzle game that combines realistic physics simulation, strategic thinking, and competitive gameplay. Players analyze a 5x5 grid containing mirrors, water, glass, metal, and absorber materials to predict where a laser beam will exit after reflecting through the maze. The game features a beautiful blue-themed React interface with an engaging splash screen, intelligent hint system with laser path visualization, precision stopwatch timing, and dynamic puzzle generation, all running seamlessly within Reddit posts using the Devvit platform.

## What This Game Is

Logic Reflections is a **brain-teasing puzzle game** where players must:

- **Analyze a 5x5 grid** filled with different reflective materials
- **Trace a laser beam's path** as it bounces off mirrors, diffuses through water, splits through glass, reverses off metal, or gets absorbed
- **Predict the exit point** where the laser will leave the grid
- **Use strategic hints** to reveal laser path segments in different quadrants
- **Race against time** with a precision stopwatch tracking solving speed
- **Earn points** based on accuracy, speed, and hint usage

The game combines **logical deduction**, **spatial reasoning**, and **physics understanding** to create an engaging puzzle experience that's easy to learn but challenging to master.

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
- **Visual Path Tracing**: Foundation ready for animated beam visualization through hint system

### 🧩 **Strategic Quadrant-Based Hint System with Laser Path Visualization**

- **Four Vertical Hint Buttons**: Positioned on the right side of the screen in a vertical column for easy access during gameplay
- **Laser Path Simulation**: Each hint reveals the actual laser path segments within that quadrant area
- **Progressive Path Revelation**: Use hints strategically to reveal laser path sections step by step
- **Complete Path Discovery**: After using all 4 hints, the complete laser path to the exit is revealed
- **Visual Laser Segments**: Animated laser beam segments show exactly how the beam travels through materials
- **Contextual Hint Messages**: Each quadrant provides specific guidance about laser behavior in that area:
  - **Quadrant 1**: "Laser path revealed in top-left area"
  - **Quadrant 2**: "Laser path revealed in top-right area"
  - **Quadrant 3**: "Laser path revealed in bottom-left area"
  - **Quadrant 4**: "Laser path revealed in bottom-right area"
- **Smart Usage Tracking**: Visual indicators show used hints (grayed out) vs available hints (bright blue)
- **Hint Counter Display**: Real-time tracking of remaining hints (4 total available)
- **Auto-Dismiss Messages**: Hint overlays automatically disappear after 5 seconds
- **Strategic Placement**: Hints positioned vertically on the right side to not interfere with grid interaction

### 🏆 **Fixed Grid Challenge System**

- **5x5 Grid Format**: Consistent medium-difficulty grid size for balanced gameplay
- **200 Base Points**: Fixed scoring system with 10-minute time limit
- **Dynamic Puzzle Generation**: Each game creates unique material layouts with mirrors, water, glass, and metal
- **Stopwatch Timing**: Precise elapsed time tracking instead of countdown timer
- **Strategic Scoring**: Base score affected by hint usage with progressive penalty multipliers

### 📱 **Seamless Reddit Integration**

- **Native Devvit Experience**: Plays directly within Reddit posts with no external apps needed
- **Mobile-Optimized**: Responsive design works perfectly on mobile and desktop browsers
- **Automatic Authentication**: Uses Reddit login for seamless user identification
- **Persistent Progress**: Game state and scores saved across sessions

## How to Play Logic Reflections

### 🎯 **Objective**

Analyze the 5x5 puzzle grid and predict where the laser beam will exit after interacting with various reflective materials. Click on the correct exit cell to submit your answer and earn points based on accuracy, speed, and hint usage.

### 🎮 **Quick Start Guide**

1. **Click "🎯 Start to Solve"** on the splash screen to begin
2. **Find the red laser entry point** (🔴) on the grid - this shows where the beam starts
3. **Study the materials** in each cell using the visual legend and emoji icons
4. **Trace the laser path** mentally, following how it bounces off each material
5. **Click your predicted exit cell** to submit your answer
6. **Use hints if needed** - 4 hints available to reveal laser path segments
7. **Get instant feedback** and see your completion time and score

### 📋 **Step-by-Step Instructions**

#### 1. **Start Playing**

- **🎮 Interactive Splash Screen**: Beautiful gradient welcome screen with animated difficulty selection buttons
- **📖 Comprehensive How to Play**: Built-in tutorial with step-by-step instructions and visual material guide
- **🎯 Smart Difficulty Selection**: Choose from Easy (🟢), Medium (🟡), or Hard (🔴) with visual difficulty indicators
- **👋 Personalized Welcome**: If logged into Reddit, see a personalized greeting with your username

#### 2. **Start the Puzzle**

- **Fixed 5x5 Grid**: Consistent medium-difficulty challenge for all players
- **200 Base Points**: Standard scoring with 10-minute maximum time limit
- **Stopwatch Timer**: Track your solving speed with precise elapsed time display

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

#### 5. **Use the Strategic Hint System with Laser Path Visualization (Optional)**

- **4 Vertical Hint Buttons**: Click the 💡 buttons positioned on the right side of the screen for quadrant-specific laser path revelation
- **Laser Path Simulation**: Each hint reveals actual laser beam segments within that quadrant:
  - **Quadrant 1 (Top-Left)**: Shows laser path through the upper-left portion of the grid
  - **Quadrant 2 (Top-Right)**: Reveals beam segments in the upper-right area
  - **Quadrant 3 (Bottom-Left)**: Displays laser path through the lower-left section
  - **Quadrant 4 (Bottom-Right)**: Shows beam segments in the lower-right area
- **Progressive Path Discovery**: Use hints strategically to build up the complete laser path
- **Complete Path Revelation**: After using all 4 hints, the complete laser path to the exit point is automatically revealed
- **Visual Laser Segments**: See animated laser beam lines showing exactly how the beam travels and reflects
- **Contextual Hint Messages**: Each hint displays a specific message about the laser path in that area
- **Visual Feedback**: Used hints become grayed out, available hints remain bright blue with 💡 icon
- **Hint Counter**: Top-right corner shows remaining hints (e.g., "💡 3/4" after using one hint)
- **Auto-Dismiss**: Hint messages automatically disappear after 5 seconds
- **Strategic Usage**: Use hints to verify your laser path analysis and discover the correct exit point

#### 6. **Submit Your Answer**

- **Click to Answer**: Simply click on the grid cell where you think the laser will exit
- **Immediate Feedback**: Get instant confirmation if your answer is correct or incorrect
- **Timer Stops**: Your completion time is recorded the moment you submit
- **Score Calculation**: Final score combines base points, hint penalties, and time bonuses

#### 7. **View Results & Continue**

- **Instant Feedback**: Get immediate confirmation if your answer is correct or incorrect via alert popup
- **Score Display**: See your final score and completion time in the results alert
- **Return to Menu**: Automatically return to the blue-themed splash screen after viewing results
- **New Puzzle**: Click "🎯 Start to Solve" again to generate fresh puzzles with randomized material layouts

### 🏅 **Scoring System**

- **Base Score**: Fixed 200 points for correct answers
- **Hint Penalty**: Score reduced based on number of hints used (4 hints available)
- **Elapsed Time Tracking**: Stopwatch records your solving speed for performance comparison
- **Success/Failure**: Simple correct/incorrect feedback with completion time display
- **Return to Menu**: Easy navigation back to splash screen for new puzzles

### 💡 **Pro Tips for Success**

- **Master Material Behaviors**: Learn how mirrors, water, glass, and metal affect laser paths
- **Study the Grid Layout**: Analyze material placement before making your prediction
- **Strategic Hint Usage**: Use the 4 quadrant hints wisely to reveal laser path sections
- **Time Awareness**: Track your elapsed time to improve solving speed over multiple games
- **Visual Tracing**: Follow the laser path step-by-step from entry point through each material interaction

## Current Development Status

### ✅ **Completed Features**

- **Complete React Frontend**: Fully functional game interface with App.tsx entry point and LogicReflectionsGame component
- **Interactive Splash Screen**: Beautiful gradient background with game instructions, "How to Play" section, and personalized welcome
- **Advanced Puzzle Grid Component (PuzzleGrid.tsx)**:
  - Dynamic 5x5 grid system for consistent gameplay experience
  - Material-specific visual indicators with emoji icons (🪞 💧 🔍 ⚙️ ⚫)
  - Hover effects with material inspection tooltips showing coordinate and material type
  - Click-to-submit answer functionality with visual feedback and selection states
  - Laser entry point indicators with red laser icon (🔴)
  - Coordinate labeling system (A1, B2, C3, etc.) for easy navigation
  - Mobile-responsive cell sizing with automatic viewport optimization
  - Interactive material legend with color-coded reference guide
  - SVG laser beam overlay system for path visualization
- **Advanced Hint System with Laser Path Visualization**:
  - Four quadrant-based hint buttons positioned at screen corners
  - Laser path simulation engine that calculates beam segments for each quadrant
  - Progressive laser path revelation - each hint shows actual beam segments in that area
  - Complete path discovery after using all 4 hints with automatic full path display
  - Visual laser beam segments with coordinate-based positioning
  - Hint overlay messages with smooth animations and 5-second auto-dismiss
  - Visual hint status indicators (💡 available, grayed out when used)
  - Hint usage tracking with remaining hints display (4 total available)
  - Smart hint progression logic with final path revelation
- **Precision Stopwatch Timer**:
  - High-precision elapsed time tracking with 100ms update intervals
  - Real-time display in MM:SS.CC format (minutes:seconds.centiseconds)
  - Timer positioned in top-left corner with clean styling
  - Automatic start when puzzle begins, stop when completed
- **Material Physics System**: Complete type definitions for 6 material types with reflection behaviors
- **Dynamic Puzzle Generation**: Real-time puzzle creation with mirrors, water, glass, and metal placement
- **Game State Management**: Smooth transitions between splash screen and gameplay with proper state handling
- **Responsive CSS Design**: Mobile-first styling with gradient backgrounds and smooth animations
- **TypeScript Integration**: Comprehensive type safety with shared interfaces between components
- **Server API Infrastructure**: Complete Redis integration, game session management, and leaderboard systems
- **Beam Handler System**: Physics engine foundation for laser path calculations and animations

### 🚧 **In Development**

- **Enhanced Laser Path Animation**: SVG-based beam visualization with glow effects and smooth path tracing animations
- **Server API Integration**: Connecting frontend components to backend puzzle generation and validation
- **Physics Engine Integration**: Full laser beam physics simulation with realistic reflection calculations
- **Hint System Backend**: Server-side hint processing with advanced laser path calculations

### 📋 **Planned Features**

- **Daily Puzzle System**: Automated puzzle generation and Reddit post creation
- **Leaderboard System**: Competitive scoring and ranking displays with real-time updates
- **User Progress Tracking**: Achievement system and completion statistics
- **Advanced Puzzle Filtering**: Search and filter historical puzzles by difficulty and date
- **Enhanced Reddit Integration**: Automated daily puzzle posts and community features
- **Advanced Hint Animations**: Animated laser path reveals for each quadrant hint

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
- **Fixed 5x5 Grid System**: Consistent medium-difficulty challenge with dynamic puzzle generation
- **Precision Stopwatch Timer**: Real-time elapsed time tracking with 100ms accuracy and MM:SS.CC format display
- **Dynamic Grid Sizing**: Automatically calculates optimal cell size based on viewport and device type for perfect mobile and desktop experience
- **Mock Puzzle Generation**: Intelligent puzzle creation with proper material placement and coordinate system validation

### 🎯 **Advanced Hint System with Laser Path Visualization**

- **Four Quadrant Zones**: Strategic hint areas with buttons positioned vertically on the right side for easy access during gameplay
- **Laser Path Simulation**: Real-time laser beam segment calculation for each quadrant area
- **Progressive Path Discovery**: Each hint reveals actual laser path segments within that specific quadrant
- **Complete Path Revelation**: After using all 4 hints, the complete laser path to the exit is automatically shown
- **Visual Laser Segments**: SVG-based laser beam visualization with coordinate-based positioning
- **Smart Usage Tracking**: Visual indicators for used hints (grayed out), available hints (💡 bright blue)
- **Contextual Hint Messages**: Specific feedback for each quadrant with auto-dismiss after 5 seconds
- **Strategic Hint Progression**: Intelligent hint system that builds up the complete laser path step by step
- **Animation Status Feedback**: Smooth transitions and visual feedback during hint activation
- **Mobile-Optimized Positioning**: Vertically-positioned hint buttons on the right side that don't interfere with grid interaction

### 🏆 **Game Modes & Features**

- **Beautiful Blue-Themed Splash Screen**: Stunning blue gradient background with glassmorphism effects, single-click start button, and comprehensive game instructions
- **Smart Dynamic Puzzle Generation**: Real-time puzzle creation with proper material placement, coordinate validation, and 5x5 grid complexity
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
