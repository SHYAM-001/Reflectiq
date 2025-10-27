/**
 * API Service for ReflectIQ Client
 * Handles communication with Devvit Web server endpoints
 */

import {
  GetPuzzleResponse,
  StartPuzzleResponse,
  RequestHintResponse,
  SubmitAnswerResponse,
  Difficulty,
  GridPosition,
} from '../types/api';

class ApiService {
  private static instance: ApiService;

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  /**
   * Get current puzzle by difficulty
   */
  async getCurrentPuzzle(difficulty: Difficulty): Promise<GetPuzzleResponse> {
    try {
      const response = await fetch(`/api/puzzle/current?difficulty=${difficulty}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching puzzle:', error);
      throw error;
    }
  }

  /**
   * Start a new puzzle session
   */
  async startPuzzleSession(puzzleId: string, userId: string): Promise<StartPuzzleResponse> {
    try {
      const response = await fetch('/api/puzzle/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          puzzleId,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error starting puzzle session:', error);
      throw error;
    }
  }

  /**
   * Request a hint for the current session
   */
  async requestHint(sessionId: string, hintNumber: number): Promise<RequestHintResponse> {
    try {
      const response = await fetch('/api/puzzle/hint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          hintNumber,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error requesting hint:', error);
      throw error;
    }
  }

  /**
   * Submit puzzle answer
   */
  async submitAnswer(
    sessionId: string,
    answer: GridPosition,
    timeTaken: number
  ): Promise<SubmitAnswerResponse> {
    try {
      const response = await fetch('/api/puzzle/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          answer,
          timeTaken,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error submitting answer:', error);
      throw error;
    }
  }

  /**
   * Get daily leaderboard
   */
  async getDailyLeaderboard(date?: string, limit: number = 10) {
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (limit) params.append('limit', limit.toString());

      const response = await fetch(`/api/leaderboard/daily?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  }

  /**
   * Initialize app and get user context
   */
  async initializeApp() {
    try {
      const response = await fetch('/api/init', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error initializing app:', error);
      throw error;
    }
  }
}

export default ApiService;
