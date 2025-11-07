import { context, reddit } from '@devvit/web/server';

// Enhanced splash screen configuration for different contexts
interface SplashConfig {
  appDisplayName: string;
  backgroundUri: string;
  buttonLabel: string;
  description: string;
  heading: string;
  appIconUri: string;
}

// Generate contextual splash screen based on puzzle type and date
const generateSplashConfig = (
  puzzleType: 'daily' | 'special' | 'challenge' = 'daily',
  availableDifficulties?: ('easy' | 'medium' | 'hard')[],
  specificDifficulty?: 'easy' | 'medium' | 'hard'
): SplashConfig => {
  console.log(
    `[generateSplashConfig] puzzleType: ${puzzleType}, availableDifficulties: ${JSON.stringify(availableDifficulties)}, specificDifficulty: ${specificDifficulty}`
  );
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );

  // Check for special occasions
  const month = today.getMonth() + 1;
  const date = today.getDate();
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;

  // Special event detection
  let eventType: 'normal' | 'weekend' | 'holiday' | 'newyear' = 'normal';
  if (month === 12 && date >= 20) eventType = 'holiday';
  else if (month === 1 && date === 1) eventType = 'newyear';
  else if (isWeekend) eventType = 'weekend';

  // Add difficulty indicators to descriptions
  let difficultyText = '';
  if (specificDifficulty) {
    // Single difficulty post
    const difficultyEmoji =
      specificDifficulty === 'easy' ? '🟢' : specificDifficulty === 'medium' ? '🟡' : '🔴';
    const difficultyName = specificDifficulty.charAt(0).toUpperCase() + specificDifficulty.slice(1);
    difficultyText = ` | ${difficultyEmoji} ${difficultyName}`;
  } else if (availableDifficulties) {
    // Multi-difficulty post
    const difficultyIndicators = availableDifficulties.map((diff: 'easy' | 'medium' | 'hard') =>
      diff === 'easy' ? '🟢 Easy' : diff === 'medium' ? '🟡 Medium' : '🔴 Hard'
    );
    difficultyText =
      difficultyIndicators.length > 0 ? ` | ${difficultyIndicators.join(' • ')}` : '';
  }

  // Create difficulty-specific descriptions
  let descriptions: string[];
  if (specificDifficulty === 'easy') {
    descriptions = [
      `🟢 Perfect for beginners${difficultyText}! Start your laser journey with mirrors and absorbers on a cozy 6x6 grid.`,
      `🌱 New to ReflectIQ${difficultyText}? This gentle introduction will teach you the basics of laser reflection!`,
      `☕ Morning brain warm-up${difficultyText}! A relaxing puzzle to start your day with simple mirrors and clear paths.`,
      `🎯 Learn the ropes${difficultyText}! Master basic reflection principles in this beginner-friendly challenge.`,
      `🌟 First steps in laser physics${difficultyText}! Discover how light bounces off mirrors in this accessible puzzle.`,
      `💡 Bright ideas start here${difficultyText}! Build your confidence with this straightforward reflection challenge.`,
    ];
  } else if (specificDifficulty === 'medium') {
    descriptions = [
      `🟡 Ready to level up${difficultyText}? Navigate through mirrors, water, glass, and absorbers on an 8x8 battlefield!`,
      `⚖️ Perfect balance of challenge${difficultyText}! Test your skills with multiple materials and trickier paths.`,
      `🌊 Dive deeper${difficultyText}! Water and glass join the party in this intermediate laser adventure.`,
      `🎓 Intermediate mastery${difficultyText}! Show your growing expertise with this moderately complex reflection puzzle.`,
      `🔍 Sharp thinking required${difficultyText}! Multiple materials create fascinating interaction patterns to solve.`,
      `⚡ Electrifying challenge${difficultyText}! Step up your game with this engaging medium-difficulty brain teaser.`,
    ];
  } else if (specificDifficulty === 'hard') {
    descriptions = [
      `🔴 Ultimate laser mastery${difficultyText}! Conquer all materials including metal on a massive 10x10 grid of complexity!`,
      `🏆 For true puzzle champions${difficultyText}! Only the most skilled can navigate this intricate maze of reflections.`,
      `🔥 Extreme difficulty${difficultyText}! Metal, mirrors, water, glass, and absorbers create the ultimate challenge.`,
      `⚔️ Battle-tested complexity${difficultyText}! Prove your laser-guiding prowess in this expert-level puzzle.`,
      `🧠 Maximum brain power${difficultyText}! Every material, every interaction, every reflection matters in this epic challenge.`,
      `💎 Diamond-tier difficulty${difficultyText}! The most complex laser paths await those brave enough to attempt them.`,
    ];
  } else {
    // Multi-difficulty fallback
    descriptions = [
      `🔴 ${formattedDate}'s laser challenge awaits${difficultyText}! Guide the beam through mirrors, glass, and mysterious materials to discover the exit.`,
      `⚡ Ready for today's mind-bending puzzle${difficultyText}? Trace the laser path through a maze of reflective surfaces and find where it escapes!`,
      `🎯 ${dayOfWeek}'s brain teaser is here${difficultyText}! Master the art of light reflection and solve today's intricate laser maze.`,
      `🌟 New puzzle, new challenge${difficultyText}! Navigate your laser through mirrors, water, and absorbers to reach the exit point.`,
      `🔬 Physics meets fun${difficultyText}! Bend light through materials and discover the science of reflection in today's puzzle.`,
      `💎 Crystal clear challenge ahead${difficultyText}! Use mirrors and glass to guide your laser beam to victory.`,
    ];
  }

  // Dynamic content arrays for variety
  // Use explicit if-else for better debugging and clarity
  let buttons: string[];
  let headings: string[];

  if (specificDifficulty === 'easy') {
    buttons = [
      '🌱 Start Learning',
      '☕ Begin Gently',
      '🎯 Try Easy Mode',
      '💡 Light Start',
      '🌟 First Steps',
      '🟢 Play Easy',
    ];
    headings = [
      `🟢 Easy ReflectIQ${difficultyText}`,
      `🌱 Beginner's Laser Lab${difficultyText}`,
      `☕ Gentle Brain Teaser${difficultyText}`,
      `💡 Learning Mode${difficultyText}`,
      `🌟 First Light${difficultyText}`,
      `🎯 Starter Challenge${difficultyText}`,
    ];
  } else if (specificDifficulty === 'medium') {
    buttons = [
      '⚖️ Accept Challenge',
      '🌊 Dive In',
      '🎓 Level Up',
      '⚡ Play Medium',
      '🔍 Test Skills',
      '🟡 Start Medium',
    ];
    headings = [
      `🟡 Medium ReflectIQ${difficultyText}`,
      `⚖️ Balanced Challenge${difficultyText}`,
      `🌊 Intermediate Quest${difficultyText}`,
      `🎓 Skill Builder${difficultyText}`,
      `⚡ Medium Mastery${difficultyText}`,
      `🔍 Sharp Thinking${difficultyText}`,
    ];
  } else if (specificDifficulty === 'hard') {
    buttons = [
      '🔥 Face the Fire',
      '🏆 Prove Mastery',
      '⚔️ Enter Battle',
      '💎 Ultimate Test',
      '🧠 Max Challenge',
      '🔴 Play Hard',
    ];
    headings = [
      `🔴 Hard ReflectIQ${difficultyText}`,
      `🔥 Extreme Challenge${difficultyText}`,
      `🏆 Master's Trial${difficultyText}`,
      `⚔️ Ultimate Battle${difficultyText}`,
      `💎 Expert Mode${difficultyText}`,
      `🧠 Maximum Difficulty${difficultyText}`,
    ];
  } else {
    // Fallback for multi-difficulty or undefined
    buttons = [
      '🚀 Start Challenge',
      '⚡ Begin Puzzle',
      '🎯 Play Now',
      '🔴 Launch Game',
      '💡 Illuminate Path',
      '🌟 Start Quest',
    ];
    headings = [
      `Daily ReflectIQ Challenge${difficultyText}`,
      `⚡ Today's Laser Puzzle${difficultyText}`,
      `🎯 ${dayOfWeek}'s Brain Teaser${difficultyText}`,
      `🌟 ReflectIQ: Light & Logic${difficultyText}`,
      `💎 Crystal Reflection Quest${difficultyText}`,
      `🔬 Physics Puzzle Lab${difficultyText}`,
    ];
  }

  const configs = {
    normal: {
      descriptions,
      buttons,
      headings,
    },
    weekend: {
      descriptions: [
        `🎉 Weekend laser adventure! Take your time and enjoy this relaxing reflection puzzle.`,
        `☕ ${dayOfWeek} morning brain exercise! Sip your coffee and solve today's laser maze.`,
        `🌅 Weekend vibes with laser beams! A perfect puzzle to start your ${dayOfWeek}.`,
      ],
      buttons: ['🎉 Weekend Play', '☕ Relax & Solve', '🌅 Morning Puzzle'],
      headings: [`🎉 Weekend ReflectIQ`, `☕ ${dayOfWeek} Laser Fun`, `🌅 Weekend Brain Game`],
    },
    holiday: {
      descriptions: [
        `🎄 Holiday laser magic! Spread some festive cheer with today's special reflection puzzle.`,
        `✨ Season's greetings from ReflectIQ! Unwrap today's gift of a challenging laser maze.`,
        `🎁 Holiday brain present! Guide the laser through a winter wonderland of mirrors.`,
      ],
      buttons: ['🎄 Holiday Play', '✨ Festive Solve', '🎁 Unwrap Puzzle'],
      headings: ['🎄 Holiday ReflectIQ', '✨ Festive Laser Quest', '🎁 Holiday Brain Gift'],
    },
    newyear: {
      descriptions: [
        `🎊 New Year, new puzzles! Start 2025 with a brilliant laser reflection challenge.`,
        `🥳 Happy New Year! Celebrate with today's sparkling laser maze adventure.`,
        `✨ Fresh start, fresh puzzle! Begin the year with light, logic, and laser beams.`,
      ],
      buttons: ['🎊 New Year Play', '🥳 Celebrate & Solve', '✨ Start Fresh'],
      headings: ['🎊 New Year ReflectIQ', '🥳 2025 Laser Launch', '✨ Fresh Start Puzzle'],
    },
  };

  const config = configs[eventType];
  const variant = dayOfYear % config.descriptions.length;

  return {
    appDisplayName: 'ReflectIQ',
    backgroundUri: 'RQ-background.png',
    buttonLabel: (config.buttons[variant] || config.buttons[0]) as string,
    description: (config.descriptions[variant] || config.descriptions[0]) as string,
    heading: (config.headings[variant] || config.headings[0]) as string,
    appIconUri: 'RQ-icon.png',
  };
};

// Interface for leaderboard post data
interface LeaderboardPostData {
  type: 'leaderboard';
  leaderboardType: 'daily' | 'weekly';
  date: string;
  weekStart?: string;
  weekEnd?: string;
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

export const createLeaderboardPost = async (
  leaderboardData: LeaderboardPostData,
  type: 'daily' | 'weekly' = 'daily'
) => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  const validSubredditName: string = subredditName;
  const formattedDate = new Date(leaderboardData.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Create enhanced splash screen for leaderboard
  const splashConfig: SplashConfig = {
    appDisplayName: 'ReflectIQ Leaderboard',
    backgroundUri: 'RQ-background.png',
    buttonLabel: type === 'daily' ? '🏆 View Daily Rankings' : '🏆 View Weekly Rankings',
    description:
      type === 'daily'
        ? `🏆 ${formattedDate}'s top puzzle solvers! See who mastered today's laser challenges across all difficulty levels. ${leaderboardData.entries.length} players competing today!`
        : `🏆 Weekly champions from ${leaderboardData.weekStart} to ${leaderboardData.weekEnd}! See the top performers across multiple puzzle challenges. ${leaderboardData.entries.length} players featured!`,
    heading:
      type === 'daily'
        ? `🏆 Daily Leaderboard - ${formattedDate}`
        : `🏆 Weekly Leaderboard - Week ${leaderboardData.weekStart}`,
    appIconUri: 'RQ-icon.png',
  };

  const title =
    type === 'daily'
      ? `🏆 ReflectIQ Daily Leaderboard - ${leaderboardData.date} | ${leaderboardData.entries.length} Players`
      : `🏆 ReflectIQ Weekly Leaderboard - Week ${leaderboardData.weekStart} | ${leaderboardData.entries.length} Champions`;

  return await reddit.submitCustomPost({
    subredditName: validSubredditName,
    title: title,
    splash: splashConfig,
    postData: leaderboardData as Record<string, unknown>,
  });
};

export const createPost = async (
  puzzleType: 'daily' | 'special' | 'challenge' = 'daily',
  availableDifficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'],
  specificDifficulty?: 'easy' | 'medium' | 'hard'
) => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  // Ensure subredditName is properly typed as string
  const validSubredditName: string = subredditName;

  const today = new Date().toISOString().split('T')[0];

  // Generate dynamic splash screen configuration with available difficulties
  const splashConfig = generateSplashConfig(puzzleType, availableDifficulties, specificDifficulty);

  // Create dynamic title based on puzzle type and difficulty
  const titlePrefixes = {
    daily: 'Daily ReflectIQ Puzzle',
    special: '⭐ Special ReflectIQ Challenge',
    challenge: '🏆 ReflectIQ Championship',
  };

  // Create difficulty-specific title
  let title: string;
  if (specificDifficulty) {
    // Single difficulty post
    const difficultyEmoji =
      specificDifficulty === 'easy' ? '🟢' : specificDifficulty === 'medium' ? '🟡' : '🔴';
    const difficultyName = specificDifficulty.charAt(0).toUpperCase() + specificDifficulty.slice(1);
    title = `${difficultyEmoji} ${titlePrefixes[puzzleType]} - ${today} | ${difficultyName} Challenge`;
  } else {
    // Multi-difficulty post (fallback)
    const difficultyIndicators = availableDifficulties.map((diff: 'easy' | 'medium' | 'hard') =>
      diff === 'easy' ? '🟢 Easy' : diff === 'medium' ? '🟡 Medium' : '🔴 Hard'
    );
    title = `${titlePrefixes[puzzleType]} - ${today} | ${difficultyIndicators.join(' • ')} Challenges`;
  }

  // Calculate day of year for variant tracking
  const dayOfYear = Math.floor(
    (new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );

  return await reddit.submitCustomPost({
    subredditName: validSubredditName,
    title: title,
    splash: splashConfig,
    postData: {
      puzzleDate: today,
      gameType: puzzleType,
      availableDifficulties: availableDifficulties,
      specificDifficulty: specificDifficulty, // Add specific difficulty for single-difficulty posts
      status: 'active',
      splashVariant: dayOfYear % 6, // Track which variant was used (0-5)
    } as Record<string, unknown>,
  });
};
