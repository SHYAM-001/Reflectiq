// Test setup file for Devvit Web integration tests
// Configures global test environment and mocks

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Global test configuration
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  
  // Configure console for tests
  console.log('🧪 Starting Logic Reflections integration tests...');
  
  // Global timeout for async operations
  vi.setConfig({ testTimeout: 30000 });
});

afterAll(() => {
  console.log('✅ Logic Reflections integration tests completed');
});

// Setup for each test
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset modules to ensure clean state
  vi.resetModules();
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});

// Mock Devvit Web server imports globally
vi.mock('@devvit/web/server', () => ({
  redis: {
    // String operations
    get: vi.fn(),
    set: vi.fn(),
    setEx: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    
    // Hash operations
    hGet: vi.fn(),
    hSet: vi.fn(),
    hGetAll: vi.fn(),
    hDel: vi.fn(),
    hExists: vi.fn(),
    hKeys: vi.fn(),
    hLen: vi.fn(),
    hIncrBy: vi.fn(),
    
    // Sorted set operations
    zAdd: vi.fn(),
    zRange: vi.fn(),
    zRank: vi.fn(),
    zRem: vi.fn(),
    zCard: vi.fn(),
    zScore: vi.fn(),
    zIncrBy: vi.fn(),
    zScan: vi.fn(),
    zRemRangeByRank: vi.fn(),
    zRemRangeByScore: vi.fn(),
    
    // Transaction operations
    multi: vi.fn(),
    exec: vi.fn(),
    watch: vi.fn(),
    discard: vi.fn(),
  },
  
  // Mock other Devvit server utilities
  createServer: vi.fn(),
  context: {
    postId: 'test-post-123',
    userId: 'test-user-123',
    subredditName: 'test-subreddit',
  },
  getServerPort: vi.fn(() => 3000),
  
  // Mock Reddit API
  reddit: {
    getCurrentUsername: vi.fn(() => Promise.resolve('testuser')),
    getSubredditInfoByName: vi.fn(),
    submitPost: vi.fn(),
    getPostById: vi.fn(),
  },
}));

// Export for explicit imports if needed
export {};"
