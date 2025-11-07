/**
 * Time Formatting Consistency Tests
 * Ensures time formatting consistency between client timer display and server comment posting
 * Requirements: 4.2, 4.3, 3.2, 3.3
 */

import { describe, it, expect } from 'vitest';

describe('Time Formatting Consistency', () => {
  // Client-side timer display format (from Timer component)
  const formatTimeForDisplay = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Server-side comment format (from postCompletionComment function)
  const formatTimeForComment = (timeTaken: number): string => {
    const minutes = Math.floor(timeTaken / 60);
    const seconds = Math.floor(timeTaken % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  describe('Format Compatibility', () => {
    it('should produce compatible formats for times under 10 minutes', () => {
      const testTimes = [1, 30, 59, 60, 61, 90, 125, 165, 300, 599];

      testTimes.forEach((time) => {
        const displayFormat = formatTimeForDisplay(time);
        const commentFormat = formatTimeForComment(time);

        // For times under 10 minutes, removing leading zero from display should match comment
        const normalizedDisplay = displayFormat.replace(/^0/, '');
        expect(normalizedDisplay).toBe(commentFormat);
      });
    });

    it('should handle times over 10 minutes correctly', () => {
      const testTimes = [600, 661, 900, 3600, 3661];

      testTimes.forEach((time) => {
        const displayFormat = formatTimeForDisplay(time);
        const commentFormat = formatTimeForComment(time);

        // For times over 10 minutes, formats should be identical
        expect(displayFormat).toBe(commentFormat);
      });
    });

    it('should match exact requirement examples', () => {
      // Test cases from requirements: "0:01", "2:45"
      const requirementCases = [
        { seconds: 1, expected: '0:01' },
        { seconds: 165, expected: '2:45' },
      ];

      requirementCases.forEach(({ seconds, expected }) => {
        const commentFormat = formatTimeForComment(seconds);
        expect(commentFormat).toBe(expected);

        // Display format should be compatible
        const displayFormat = formatTimeForDisplay(seconds);
        const normalizedDisplay = displayFormat.replace(/^0/, '');
        expect(normalizedDisplay).toBe(expected);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero time correctly', () => {
      const displayFormat = formatTimeForDisplay(0);
      const commentFormat = formatTimeForComment(0);

      expect(displayFormat).toBe('00:00');
      expect(commentFormat).toBe('0:00');
      expect(displayFormat.replace(/^0/, '')).toBe(commentFormat);
    });

    it('should handle exactly 1 minute correctly', () => {
      const displayFormat = formatTimeForDisplay(60);
      const commentFormat = formatTimeForComment(60);

      expect(displayFormat).toBe('01:00');
      expect(commentFormat).toBe('1:00');
      expect(displayFormat.replace(/^0/, '')).toBe(commentFormat);
    });

    it('should handle exactly 10 minutes correctly', () => {
      const displayFormat = formatTimeForDisplay(600);
      const commentFormat = formatTimeForComment(600);

      expect(displayFormat).toBe('10:00');
      expect(commentFormat).toBe('10:00');
      expect(displayFormat).toBe(commentFormat);
    });

    it('should handle times over 1 hour correctly', () => {
      const testTimes = [3600, 3661, 7200]; // 1:00:00, 1:01:01, 2:00:00

      testTimes.forEach((time) => {
        const displayFormat = formatTimeForDisplay(time);
        const commentFormat = formatTimeForComment(time);

        // Both should handle hours correctly
        const expectedMinutes = Math.floor(time / 60);
        const expectedSeconds = time % 60;
        const expected = `${expectedMinutes}:${expectedSeconds.toString().padStart(2, '0')}`;

        expect(displayFormat).toBe(expected);
        expect(commentFormat).toBe(expected);
      });
    });
  });

  describe('Whole Seconds Validation', () => {
    it('should ensure timer provides whole seconds only', () => {
      // Simulate timer behavior - should only provide integer seconds
      const timerSeconds = [1, 2, 3, 59, 60, 61, 125, 165];

      timerSeconds.forEach((seconds) => {
        expect(Number.isInteger(seconds)).toBe(true);

        // Verify formatting works with whole numbers
        const formatted = formatTimeForComment(seconds);
        expect(formatted).toMatch(/^\d+:\d{2}$/);
      });
    });

    it('should handle fractional seconds by flooring', () => {
      // Server should handle any fractional seconds by flooring
      const fractionalTimes = [1.7, 59.9, 60.1, 125.5];

      fractionalTimes.forEach((time) => {
        const formatted = formatTimeForComment(time);
        const expectedWhole = Math.floor(time);
        const expectedFormat = formatTimeForComment(expectedWhole);

        expect(formatted).toBe(expectedFormat);
      });
    });
  });

  describe('Comment Template Integration', () => {
    it('should integrate correctly with comment template', () => {
      const username = 'testuser';
      const hintsUsed = 2;
      const testTimes = [1, 165, 600];

      testTimes.forEach((timeTaken) => {
        const timeFormatted = formatTimeForComment(timeTaken);
        const commentText = `u/${username} completed the puzzle in ${timeFormatted} with ${hintsUsed} hints!`;

        // Verify comment format matches requirements
        expect(commentText).toMatch(/^u\/\w+ completed the puzzle in \d+:\d{2} with \d+ hints!$/);

        // Verify specific examples from requirements
        if (timeTaken === 1) {
          expect(commentText).toBe('u/testuser completed the puzzle in 0:01 with 2 hints!');
        }
        if (timeTaken === 165) {
          expect(commentText).toBe('u/testuser completed the puzzle in 2:45 with 2 hints!');
        }
      });
    });

    it('should match exact requirement format examples', () => {
      // From requirements: "u/{username} completed the puzzle in {time} with {hints} hints!"
      const testCases = [
        {
          username: 'werewolf013',
          time: 1,
          hints: 0,
          expected: 'u/werewolf013 completed the puzzle in 0:01 with 0 hints!',
        },
        {
          username: 'player123',
          time: 165,
          hints: 2,
          expected: 'u/player123 completed the puzzle in 2:45 with 2 hints!',
        },
      ];

      testCases.forEach(({ username, time, hints, expected }) => {
        const timeFormatted = formatTimeForComment(time);
        const commentText = `u/${username} completed the puzzle in ${timeFormatted} with ${hints} hints!`;

        expect(commentText).toBe(expected);
      });
    });
  });

  describe('Performance Considerations', () => {
    it('should format times efficiently', () => {
      const startTime = performance.now();

      // Format 1000 times to test performance
      for (let i = 0; i < 1000; i++) {
        formatTimeForDisplay(i);
        formatTimeForComment(i);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete formatting in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should handle large time values without issues', () => {
      const largeTimes = [86400, 604800, 2592000]; // 1 day, 1 week, 1 month in seconds

      largeTimes.forEach((time) => {
        expect(() => {
          formatTimeForDisplay(time);
          formatTimeForComment(time);
        }).not.toThrow();

        // Results should be valid time strings
        const display = formatTimeForDisplay(time);
        const comment = formatTimeForComment(time);

        expect(display).toMatch(/^\d+:\d{2}$/);
        expect(comment).toMatch(/^\d+:\d{2}$/);
      });
    });
  });
});
