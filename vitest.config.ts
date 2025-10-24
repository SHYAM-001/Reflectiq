// Vitest configuration for Devvit Web integration tests
// Follows Node.js testing patterns compatible with Devvit serverless environment

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment configuration
    environment: 'node',

    // Test file patterns
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],

    // Exclude patterns
    exclude: ['node_modules/**', 'dist/**', 'build/**'],

    // Global test configuration
    globals: true,

    // Test timeout (aligned with Devvit's 30s serverless limit)
    testTimeout: 30000,

    // Hook timeout
    hookTimeout: 10000,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/shared/types/**',
        'vitest.config.ts',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },

    // Mock configuration
    clearMocks: true,
    restoreMocks: true,

    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },

    // Reporter configuration
    reporter: ['verbose', 'json'],

    // Output configuration
    outputFile: {
      json: './test-results.json',
    },
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@server': path.resolve(__dirname, './src/server'),
      '@client': path.resolve(__dirname, './src/client'),
    },
  },

  // Define configuration for Node.js compatibility
  define: {
    'process.env.NODE_ENV': JSON.stringify('test'),
  },
});
