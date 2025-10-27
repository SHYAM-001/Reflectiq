/**
 * Navigation utilities for ReflectIQ
 * Handles navigation to Reddit posts and comments using Devvit Web client
 */

import { navigateTo } from '@devvit/web/client';

// Store the app context globally so it can be accessed by navigation functions
let appContext: { postId?: string; subreddit?: string } = {};

/**
 * Set the app context from the init response
 */
export const setAppContext = (context: { postId: string; subreddit?: string }): void => {
  appContext = context;
};

/**
 * Get the current Reddit post context
 */
export const getCurrentPostContext = (): { postId?: string; subreddit?: string } => {
  return appContext;
};

/**
 * Navigate to the current Reddit post to submit a comment
 */
export const navigateToPostComments = async (): Promise<void> => {
  try {
    const { postId } = getCurrentPostContext();

    if (postId) {
      // Navigate to the specific post using Devvit's navigateTo
      // Remove the 't3_' prefix if present to get the clean post ID
      const cleanPostId = postId.startsWith('t3_') ? postId.substring(3) : postId;
      const postUrl = `https://reddit.com/comments/${cleanPostId}`;

      console.log('Navigating to post:', postUrl);
      await navigateTo(postUrl);
    } else {
      // Fallback: try to navigate to the current context
      console.log('No postId available, using current location');
      await navigateTo(window.location.origin);
    }
  } catch (error) {
    console.error('Failed to navigate to post comments:', error);

    // Fallback: Open Reddit in a new tab
    const { postId } = getCurrentPostContext();
    if (postId) {
      const cleanPostId = postId.startsWith('t3_') ? postId.substring(3) : postId;
      const fallbackUrl = `https://reddit.com/comments/${cleanPostId}`;
      window.open(fallbackUrl, '_blank');
    } else {
      window.open('https://reddit.com', '_blank');
    }
  }
};

/**
 * Navigate to a specific Reddit post by ID
 */
export const navigateToPost = async (postId: string): Promise<void> => {
  try {
    // Remove the 't3_' prefix if present
    const cleanPostId = postId.startsWith('t3_') ? postId.substring(3) : postId;
    const postUrl = `https://reddit.com/comments/${cleanPostId}`;

    console.log('Navigating to specific post:', postUrl);
    await navigateTo(postUrl);
  } catch (error) {
    console.error('Failed to navigate to post:', error);

    // Fallback: Open in new tab
    const cleanPostId = postId.startsWith('t3_') ? postId.substring(3) : postId;
    const fallbackUrl = `https://reddit.com/comments/${cleanPostId}`;
    window.open(fallbackUrl, '_blank');
  }
};

/**
 * Navigate to Reddit with a pre-filled comment
 * This opens Reddit and attempts to focus the comment box
 */
export const navigateToCommentWithText = async (commentText: string): Promise<void> => {
  try {
    const { postId } = getCurrentPostContext();

    // Store the comment text in localStorage so it can be retrieved
    // This is a workaround since we can't directly pre-fill Reddit's comment box
    localStorage.setItem('reflectiq_pending_comment', commentText);

    if (postId) {
      // Navigate to the specific post
      await navigateToPost(postId);
    } else {
      // Navigate to the current post context
      await navigateToPostComments();
    }
  } catch (error) {
    console.error('Failed to navigate to comment:', error);

    // Show instructions to user as fallback
    const message = `Please copy this text and paste it as a comment on Reddit:\n\n${commentText}`;

    // Try to copy to clipboard first
    try {
      await navigator.clipboard.writeText(commentText);
      alert(`${message}\n\n(Text has been copied to your clipboard)`);
    } catch (clipboardError) {
      alert(message);
    }
  }
};
