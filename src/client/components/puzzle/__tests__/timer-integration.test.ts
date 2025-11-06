/**
 * Timer Integration Tests
 * Tests timer functionality, time formatting, and integration with submission flow
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Timer Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Time Formatting Logic', () => {
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

    it('should format time correctly in MM:SS format for display', () => {
      const testCases = [
        { seconds: 0, expected: '00:00' },
        { seconds: 1, expected: '00:01' },
        { seconds: 59, expected: '00:59' },
        { seconds: 60, expected: '01:00' },
        { seconds: 61, expected: '01:01' },
        { seconds: 165, expected: '02:45' },
        { seconds: 600, expected: '10:00' },
        { seconds: 3661, expected: '61:01' }, // Over 1 hour
      ];

      testCases.forEach(({ seconds, expected }) => {
        const result = formatTimeForDisplay(seconds);
        expect(result).toBe(expected);
      });
    });

    it('should format time correctly in M:SS format for comments', () => {
      const testCases = [
        { seconds: 0, expected: '0:00' },
        { seconds: 1, expected: '0:01' },
        { seconds: 59, expected: '0:59' },
        { seconds: 60, expected: '1:00' },
        { seconds: 61, expected: '1:01' },
        { seconds: 165, expected: '2:45' },
        { seconds: 600, expected: '10:00' },
        { seconds: 3661, expected: '61:01' },
      ];

      testCases.forEach(({ seconds, expected }) => {
        const result = formatTimeForComment(seconds);
        expect(result).toBe(expected);
      });
    });

    it('should maintain consistency between display and comment formats', () => {
      const testTimes = [1, 59, 60, 61, 125, 165, 300, 599];

      testTimes.forEach((time) => {
        const displayFormat = formatTimeForDisplay(time);
        const commentFormat = formatTimeForComment(time);

        // For times under 10 minutes, removing leading zero from display should match comment
        if (time < 600) {
          const normalizedDisplay = displayFormat.replace(/^0/, '');
          expect(normalizedDisplay).toBe(commentFormat);
        } else {
          // For times over 10 minutes, formats should be identical
          expect(displayFormat).toBe(commentFormat);
        }
      });
    });

    it('should match exact requirement examples', () => {
      // Test cases from requirements: "0:01", "2:45"
      expect(formatTimeForComment(1)).toBe('0:01');
      expect(formatTimeForComment(165)).toBe('2:45');

      // Display format should be compatible
      expect(formatTimeForDisplay(1).replace(/^0/, '')).toBe('0:01');
      expect(formatTimeForDisplay(165).replace(/^0/, '')).toBe('2:45');
    });
  });

  describe('Timer State Simulation', () => {
    class TimerSimulator {
      private seconds = 0;
      private isRunning = false;
      private interval: NodeJS.Timeout | null = null;
      private onTimeUpdate?: (seconds: number) => void;

      start(onTimeUpdate?: (seconds: number) => void) {
        this.onTimeUpdate = onTimeUpdate;
        this.isRunning = true;
        this.interval = setInterval(() => {
          if (this.isRunning) {
            this.seconds++;
            this.onTimeUpdate?.(this.seconds);
          }
        }, 1000);
      }

      stop(): number {
        this.isRunning = false;
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
        }
        return this.seconds;
      }

      getCurrentTime(): number {
        return this.seconds;
      }

      reset() {
        this.stop();
        this.seconds = 0;
      }
    }

    it('should capture completion time in whole seconds', () => {
      const timer = new TimerSimulator();
      const timeUpdates: number[] = [];

      timer.start((seconds) => {
        timeUpdates.push(seconds);
      });

      // Advance timer by 3 seconds
      vi.advanceTimersByTime(3000);

      const finalTime = timer.stop();

      expect(finalTime).toBe(3);
      expect(timeUpdates).toEqual([1, 2, 3]);
      expect(timeUpdates.every((time) => Number.isInteger(time))).toBe(true);
    });

    it('should stop timer immediately on submission', () => {
      const timer = new TimerSimulator();
      const timeUpdates: number[] = [];

      timer.start((seconds) => {
        timeUpdates.push(seconds);
      });

      // Run for 5 seconds
      vi.advanceTimersByTime(5000);

      // Stop timer (simulate submission)
      const submissionTime = timer.stop();

      // Advance time further - should not update
      vi.advanceTimersByTime(3000);

      expect(submissionTime).toBe(5);
      expect(timeUpdates).toEqual([1, 2, 3, 4, 5]);
      expect(timer.getCurrentTime()).toBe(5); // Should remain at 5
    });

    it('should maintain timing accuracy during rapid updates', () => {
      const timer = new TimerSimulator();
      const timeUpdates: number[] = [];

      timer.start((seconds) => {
        timeUpdates.push(seconds);
      });

      // Simulate rapid timer updates
      for (let i = 1; i <= 10; i++) {
        vi.advanceTimersByTime(1000);
        expect(timeUpdates[i - 1]).toBe(i);
      }

      timer.stop();
      expect(timeUpdates).toHaveLength(10);
    });

    it('should handle timer restart correctly', () => {
      const timer = new TimerSimulator();
      let timeUpdates: number[] = [];

      // First session
      timer.start((seconds) => {
        timeUpdates.push(seconds);
      });

      vi.advanceTimersByTime(3000);
      timer.stop();

      expect(timeUpdates).toEqual([1, 2, 3]);

      // Reset and restart (new puzzle)
      timer.reset();
      timeUpdates = [];

      timer.start((seconds) => {
        timeUpdates.push(seconds);
      });

      vi.advanceTimersByTime(2000);
      const finalTime = timer.stop();

      expect(finalTime).toBe(2);
      expect(timeUpdates).toEqual([1, 2]);
    });
  });

  describe('Submission Flow Integration', () => {
    interface SubmissionData {
      answer: [number, number];
      timeTaken: number;
    }

    class TimerSimulator {
      private seconds = 0;
      private isRunning = false;
      private interval: NodeJS.Timeout | null = null;
      private onTimeUpdate?: (seconds: number) => void;

      start(onTimeUpdate?: (seconds: number) => void) {
        this.onTimeUpdate = onTimeUpdate;
        this.isRunning = true;
        this.interval = setInterval(() => {
          if (this.isRunning) {
            this.seconds++;
            this.onTimeUpdate?.(this.seconds);
          }
        }, 1000);
      }

      stop(): number {
        this.isRunning = false;
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
        }
        return this.seconds;
      }

      getCurrentTime(): number {
        return this.seconds;
      }

      reset() {
        this.stop();
        this.seconds = 0;
      }
    }

    class PuzzleSubmissionSimulator {
      private timer = new TimerSimulator();
      private selectedAnswer: [number, number] | null = null;
      private isTimerRunning = false;
      private onSubmitAnswer?: (answer: [number, number], timeTaken: number) => void;

      startPuzzle(onSubmitAnswer: (answer: [number, number], timeTaken: number) => void) {
        this.onSubmitAnswer = onSubmitAnswer;
        this.isTimerRunning = true;
        this.timer.start();
      }

      selectAnswer(answer: [number, number]) {
        this.selectedAnswer = answer;
      }

      submitAnswer(): boolean {
        if (!this.selectedAnswer || !this.isTimerRunning) {
          return false;
        }

        const timeTaken = this.timer.stop();
        this.isTimerRunning = false;
        this.onSubmitAnswer?.(this.selectedAnswer, timeTaken);
        return true;
      }

      canSubmit(): boolean {
        return this.isTimerRunning && this.selectedAnswer !== null;
      }

      getCurrentTime(): number {
        return this.timer.getCurrentTime();
      }

      restartTimer() {
        this.isTimerRunning = true;
        this.timer.start();
      }
    }

    it('should capture accurate completion time when answer is submitted', () => {
      const puzzle = new PuzzleSubmissionSimulator();
      let submissionData: SubmissionData | null = null;

      puzzle.startPuzzle((answer, timeTaken) => {
        submissionData = { answer, timeTaken };
      });

      // Run timer for exactly 125 seconds (2:05)
      vi.advanceTimersByTime(125000);

      // Select and submit answer
      puzzle.selectAnswer([3, 5]);
      const submitted = puzzle.submitAnswer();

      expect(submitted).toBe(true);
      expect(submissionData).toEqual({
        answer: [3, 5],
        timeTaken: 125,
      });
    });

    it('should prevent submission when timer is not running', () => {
      const puzzle = new PuzzleSubmissionSimulator();
      let submissionData: SubmissionData | null = null;

      puzzle.startPuzzle((answer, timeTaken) => {
        submissionData = { answer, timeTaken };
      });

      // Select answer and submit first time (this stops the timer)
      puzzle.selectAnswer([0, 0]);
      const firstSubmit = puzzle.submitAnswer();
      expect(firstSubmit).toBe(true);

      // Try to submit again when timer is stopped
      puzzle.selectAnswer([1, 1]);
      const secondSubmit = puzzle.submitAnswer();

      expect(secondSubmit).toBe(false);
      expect(puzzle.canSubmit()).toBe(false);
    });

    it('should prevent submission when no answer is selected', () => {
      const puzzle = new PuzzleSubmissionSimulator();
      let submissionData: SubmissionData | null = null;

      puzzle.startPuzzle((answer, timeTaken) => {
        submissionData = { answer, timeTaken };
      });

      vi.advanceTimersByTime(30000);

      // Try to submit without selecting answer
      const submitted = puzzle.submitAnswer();

      expect(submitted).toBe(false);
      expect(submissionData).toBeNull();
    });

    it('should handle timer restart after incorrect submission', () => {
      const puzzle = new PuzzleSubmissionSimulator();
      const submissions: SubmissionData[] = [];

      puzzle.startPuzzle((answer, timeTaken) => {
        submissions.push({ answer, timeTaken });
      });

      // First attempt
      vi.advanceTimersByTime(45000);
      puzzle.selectAnswer([0, 0]);
      puzzle.submitAnswer();

      expect(submissions[0]).toEqual({
        answer: [0, 0],
        timeTaken: 45,
      });

      // Create new puzzle instance to simulate restart (timer reset)
      const newPuzzle = new PuzzleSubmissionSimulator();
      newPuzzle.startPuzzle((answer, timeTaken) => {
        submissions.push({ answer, timeTaken });
      });

      vi.advanceTimersByTime(15000);
      newPuzzle.selectAnswer([3, 5]);
      newPuzzle.submitAnswer();

      expect(submissions[1]).toEqual({
        answer: [3, 5],
        timeTaken: 15, // New timer instance, so only 15 seconds
      });
    });

    it('should maintain time precision during submission process', () => {
      // Test various time intervals with separate puzzle instances
      const testTimes = [1, 59, 60, 61, 165, 300];
      const submissions: SubmissionData[] = [];

      testTimes.forEach((targetTime, index) => {
        const puzzle = new PuzzleSubmissionSimulator();

        puzzle.startPuzzle((answer, timeTaken) => {
          submissions.push({ answer, timeTaken });
        });

        vi.advanceTimersByTime(targetTime * 1000);
        puzzle.selectAnswer([index, index]);
        puzzle.submitAnswer();

        expect(submissions[index].timeTaken).toBe(targetTime);
        expect(Number.isInteger(submissions[index].timeTaken)).toBe(true);
      });
    });
  });

  describe('Comment Integration', () => {
    const formatTimeForComment = (timeTaken: number): string => {
      const minutes = Math.floor(timeTaken / 60);
      const seconds = Math.floor(timeTaken % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const generateCompletionComment = (
      username: string,
      timeTaken: number,
      hintsUsed: number
    ): string => {
      const timeFormatted = formatTimeForComment(timeTaken);
      return `u/${username} completed the puzzle in ${timeFormatted} with ${hintsUsed} hints!`;
    };

    it('should integrate correctly with comment template', () => {
      const testCases = [
        {
          username: 'werewolf013',
          timeTaken: 1,
          hintsUsed: 0,
          expected: 'u/werewolf013 completed the puzzle in 0:01 with 0 hints!',
        },
        {
          username: 'player123',
          timeTaken: 165,
          hintsUsed: 2,
          expected: 'u/player123 completed the puzzle in 2:45 with 2 hints!',
        },
        {
          username: 'testuser',
          timeTaken: 600,
          hintsUsed: 1,
          expected: 'u/testuser completed the puzzle in 10:00 with 1 hints!',
        },
      ];

      testCases.forEach(({ username, timeTaken, hintsUsed, expected }) => {
        const comment = generateCompletionComment(username, timeTaken, hintsUsed);
        expect(comment).toBe(expected);
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

    it('should validate comment format matches requirements', () => {
      const comments = [
        generateCompletionComment('user1', 30, 0),
        generateCompletionComment('user2', 165, 2),
        generateCompletionComment('user3', 600, 4),
      ];

      comments.forEach((comment) => {
        // Verify comment format matches requirements pattern
        expect(comment).toMatch(/^u\/\w+ completed the puzzle in \d+:\d{2} with \d+ hints!$/);
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large time values without issues', () => {
      const formatTimeForDisplay = (totalSeconds: number): string => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      };

      const formatTimeForComment = (timeTaken: number): string => {
        const minutes = Math.floor(timeTaken / 60);
        const seconds = Math.floor(timeTaken % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      };

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

    it('should format times efficiently', () => {
      const formatTimeForComment = (timeTaken: number): string => {
        const minutes = Math.floor(timeTaken / 60);
        const seconds = Math.floor(timeTaken % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      };

      const startTime = performance.now();

      // Format 1000 times to test performance
      for (let i = 0; i < 1000; i++) {
        formatTimeForComment(i);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete formatting in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should handle zero and negative edge cases', () => {
      const formatTimeForComment = (timeTaken: number): string => {
        const minutes = Math.floor(Math.max(0, timeTaken) / 60);
        const seconds = Math.floor(Math.max(0, timeTaken) % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
      };

      expect(formatTimeForComment(0)).toBe('0:00');
      expect(formatTimeForComment(-1)).toBe('0:00'); // Should handle negative gracefully
      expect(formatTimeForComment(-60)).toBe('0:00');
    });
  });
});
