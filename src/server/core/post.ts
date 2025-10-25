import { context, reddit } from '@devvit/web/server';

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  // Ensure subredditName is properly typed as string
  const validSubredditName: string = subredditName;

  const today = new Date().toISOString().split('T')[0];
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return await reddit.submitCustomPost({
    subredditName: validSubredditName,
    title: `🔴 Daily ReflectIQ Puzzle - ${today} | Laser Reflection Challenge`,
    splash: {
      appDisplayName: 'ReflectIQ',
      backgroundUri: 'RQ-background.png',
      buttonLabel: 'Start Puzzle',
      description: `${formattedDate}'s laser reflection challenge! Trace the beam through mirrors and materials to find the exit.`,
      heading: `Daily ReflectIQ Puzzle`,
      appIconUri: 'RQ-icon.png',
    },
    postData: {
      puzzleDate: today as string,
      gameType: 'daily-puzzle',
      status: 'active',
    },
  });
};
