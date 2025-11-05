/**
 * Enhanced puzzle generation interfaces and types for guaranteed solvable puzzles
 * Extends existing ReflectIQ interfaces with reverse-engineering capabilities
 */

import {
  Puzzle,
  Material,
  MaterialType,
  Difficulty,
  GridPosition,
  LaserPath,
  DailyPuzzleSet,
} from './puzzle.js';

// Enhanced puzzle engine interface extending existing functionality
export interface EnhancedPuzzleEngine {
  // Legacy methods for backward compatibility
  generateDailyPuzzles(date: string): Promise<DailyPuzzleSet>;
  createPuzzle(difficulty: Difficulty, date: string): Promise<Puzzle>;

  // Enhanced guaranteed generation methods
  generateGuaranteedPuzzle(difficulty: Difficulty, date: string): Promise<Puzzle>;
  validateSpacingConstraints(
    entry: GridPosition,
    exit: GridPosition,
    difficulty: Difficulty
  ): boolean;
  reverseEngineerPath(
    entry: GridPosition,
    exit: GridPosition,
    gridSize: number,
    difficulty: Difficulty
  ): Promise<Material[]>;
  verifyUniqueSolution(puzzle: Puzzle): Promise<ValidationResult>;
}

// Entry/Exit pair with strategic placement data
export interface EntryExitPair {
  entry: GridPosition;
  exit: GridPosition;
  distance: number;
  difficulty: Difficulty;
  validationScore: number; // Higher score = better strategic placement
  placementType: 'corner' | 'edge' | 'optimal';
}

// Path planning data for reverse engineering
export interface PathPlan {
  entry: GridPosition;
  exit: GridPosition;
  requiredReflections: number;
  keyReflectionPoints: GridPosition[];
  materialRequirements: MaterialRequirement[];
  complexityScore: number; // 1-10 scale
  estimatedDifficulty: Difficulty;
}

// Material requirement for path construction
export interface MaterialRequirement {
  position: GridPosition;
  materialType: MaterialType;
  angle?: number; // For mirrors, angle in degrees
  priority: 'critical' | 'supporting' | 'decorative';
  reflectionIndex?: number; // Which reflection this material enables
}

// Comprehensive validation result
export interface ValidationResult {
  isValid: boolean;
  hasUniqueSolution: boolean;
  alternativeCount: number;
  physicsCompliant: boolean;
  confidenceScore: number; // 0-100
  issues: ValidationIssue[];
  solutionPath?: LaserPath;
  validationTime: number; // milliseconds
}

// Validation issue tracking
export interface ValidationIssue {
  type:
    | 'multiple_solutions'
    | 'no_solution'
    | 'physics_violation'
    | 'infinite_loop'
    | 'spacing_violation';
  description: string;
  affectedPositions: GridPosition[];
  severity: 'critical' | 'warning' | 'info';
  suggestedFix?: string;
}

// Generation metadata for analytics and debugging
export interface PuzzleGenerationMetadata {
  puzzleId: string;
  algorithm: 'guaranteed' | 'legacy';
  attempts: number;
  generationTime: number; // milliseconds
  confidenceScore: number;
  validationPassed: boolean;
  spacingDistance: number;
  pathComplexity: number;
  materialDensityAchieved: number;
  createdAt: Date;
  fallbackUsed: boolean;
  adaptedFromDifficulty?: Difficulty; // Track if difficulty was reduced during generation
}

// Spacing constraint configuration by difficulty
export interface SpacingConstraints {
  Easy: SpacingConfig;
  Medium: SpacingConfig;
  Hard: SpacingConfig;
}

export interface SpacingConfig {
  minDistance: number; // Minimum required distance
  preferredDistance: number; // Optimal distance for quality
  cornerBonus: number; // Preference weight for corner positions
  edgeBonus: number; // Preference weight for edge positions
  maxSearchAttempts: number; // Maximum attempts to find valid pairs
}

// Algorithm configuration for guaranteed generation
export interface GuaranteedGenerationConfig {
  maxGenerationAttempts: number; // Default: 10
  minConfidenceScore: number; // Default: 85
  timeoutMs: number; // Default: 5000
  enableFallback: boolean; // Fall back to legacy on failure

  spacingConstraints: SpacingConstraints;
  materialConfigs: Record<Difficulty, MaterialGenerationConfig>;
  complexityConfigs: Record<Difficulty, ComplexityConfig>;
}

// Material generation configuration by difficulty
export interface MaterialGenerationConfig {
  targetDensity: number; // 0.7, 0.8, 0.85
  allowedMaterials: MaterialType[];
  materialWeights: Record<MaterialType, number>; // Preference weights
  maxMaterialsPerType: number;
  minCriticalMaterials: number; // Materials required for solution path
}

// Complexity requirements by difficulty
export interface ComplexityConfig {
  minReflections: number;
  maxReflections: number;
  preferredReflections: number;
  pathLengthMultiplier: number; // Multiplier for path length scoring
  allowInfiniteLoopPrevention: boolean;
}

// Alternative solution path detection
export interface AlternativePath {
  path: LaserPath;
  confidence: number; // How likely this is a valid alternative
  differenceFromPrimary: number; // How different from the intended solution
}

// Physics validation specific to guaranteed generation
export interface PhysicsValidation {
  valid: boolean;
  materialInteractions: MaterialInteractionResult[];
  reflectionAccuracy: number; // 0-1 score
  pathContinuity: boolean;
  terminationCorrect: boolean;
  errors: string[];
  warnings: string[];
}

// Material interaction validation result
export interface MaterialInteractionResult {
  material: Material;
  incidentAngle: number;
  expectedReflection: number;
  actualReflection: number;
  accuracyScore: number; // 0-1
  compliant: boolean;
}

// Generation performance metrics
export interface GenerationMetrics {
  totalGenerated: number;
  successRate: number;
  averageGenerationTime: number;
  averageConfidenceScore: number;
  difficultyBreakdown: Record<Difficulty, DifficultyMetrics>;
  fallbackUsageRate: number;
  lastUpdated: Date;
}

export interface DifficultyMetrics {
  generated: number;
  successful: number;
  averageTime: number;
  averageConfidence: number;
  averageAttempts: number;
}

// Error handling for generation failures
export interface GenerationError {
  type:
    | 'timeout'
    | 'validation_failure'
    | 'spacing_failure'
    | 'material_placement_failure'
    | 'physics_violation';
  message: string;
  context: {
    difficulty: Difficulty;
    attempt: number;
    timeElapsed: number;
    lastValidState?: Partial<Puzzle>;
  };
  recoveryStrategy: 'retry' | 'fallback' | 'relax_constraints' | 'abort';
}

// Feature flags for gradual rollout
export interface GenerationFeatureFlags {
  enableGuaranteedGeneration: boolean;
  fallbackToLegacy: boolean;
  enableAdvancedValidation: boolean;
  enablePerformanceLogging: boolean;
  maxGenerationAttempts: number;
  confidenceThreshold: number;
  enhancedGenerationRollout: number; // 0-100 percentage
  timeoutMs: number; // Generation timeout in milliseconds
}
// Enhanced feature flag configuration for gradual rollout
export interface EnhancedFeatureFlags extends GenerationFeatureFlags {
  // Fallback configuration
  fallbackThresholds: FallbackThresholds;

  // Retry configuration
  retryLimits: RetryLimits;

  // Monitoring configuration
  monitoringConfig: MonitoringConfig;

  // A/B testing configuration
  abTestingConfig: ABTestingConfig;
}

export interface FallbackThresholds {
  maxConsecutiveFailures: number; // Fallback after N consecutive failures
  maxFailureRate: number; // Fallback if failure rate exceeds this (0-1)
  timeWindowMinutes: number; // Time window for failure rate calculation
  criticalErrorTypes: string[]; // Error types that trigger immediate fallback
  confidenceThreshold: number; // Minimum confidence to avoid fallback
}

export interface RetryLimits {
  maxAttemptsPerError: Record<string, number>; // Max retries per error type
  backoffMultiplier: number; // Exponential backoff multiplier
  maxBackoffMs: number; // Maximum backoff time
  circuitBreakerThreshold: number; // Failures before circuit breaker opens
  circuitBreakerTimeoutMs: number; // How long circuit breaker stays open
}

export interface MonitoringConfig {
  enableDetailedLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  metricsCollectionInterval: number; // Minutes between metric collections
  alertThresholds: AlertThresholds;
  dashboardDataRetention: number; // Days to retain dashboard data
}

export interface AlertThresholds {
  lowSuccessRate: number; // Alert if success rate drops below this
  highGenerationTime: number; // Alert if avg generation time exceeds this (ms)
  highFallbackRate: number; // Alert if fallback rate exceeds this (0-1)
  lowConfidenceScore: number; // Alert if avg confidence drops below this
}

export interface ABTestingConfig {
  enableABTesting: boolean;
  testGroups: ABTestGroup[];
  trafficSplitPercentage: Record<string, number>; // Group name -> percentage
  testDurationDays: number;
  minimumSampleSize: number;
}

export interface ABTestGroup {
  name: string;
  description: string;
  featureOverrides: Partial<GenerationFeatureFlags>;
  targetPercentage: number; // 0-100
  isActive: boolean;
}

// Dashboard data structures for monitoring
export interface DashboardMetrics {
  timestamp: Date;
  generationMetrics: GenerationMetrics;
  errorMetrics: ErrorMetrics;
  performanceMetrics: PerformanceMetrics;
  featureFlagMetrics: FeatureFlagMetrics;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorRate: number; // 0-1
  criticalErrors: number;
  recoverySuccessRate: number;
}

export interface PerformanceMetrics {
  averageGenerationTime: number;
  p95GenerationTime: number;
  p99GenerationTime: number;
  memoryUsage: number; // MB
  cpuUsage: number; // Percentage
}

export interface FeatureFlagMetrics {
  enhancedGenerationUsage: number;
  fallbackUsage: number;
  abTestParticipation: Record<string, number>;
  rolloutPercentage: number;
}
