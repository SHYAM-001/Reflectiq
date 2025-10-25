/**
 * Physics and reflection calculation types for ReflectIQ
 * Defines the laser physics simulation system
 */

import { GridPosition, Material, MaterialType } from './puzzle.js';

// Physics constants for different materials
export interface PhysicsConstants {
  materials: Record<
    MaterialType,
    {
      reflectivity: number;
      transparency: number;
      diffusion: number;
      absorption: boolean;
    }
  >;

  // Laser properties
  laser: {
    maxBounces: number; // prevent infinite loops
    minIntensity: number; // minimum intensity before absorption
    defaultDirection: number; // starting direction in degrees
  };

  // Grid physics
  grid: {
    cellSize: number; // logical cell size for calculations
    precision: number; // decimal precision for calculations
  };
}

// Reflection calculation result
export interface ReflectionResult {
  reflected: boolean;
  newDirection: number; // angle in degrees
  intensity: number; // remaining beam intensity (0-1)
  position: GridPosition;
  material: Material;
}

// Ray tracing step
export interface RayStep {
  position: GridPosition;
  direction: number;
  intensity: number;
  material?: Material;
  bounceCount: number;
}

// Complete ray trace result
export interface RayTrace {
  steps: RayStep[];
  finalPosition: GridPosition | null;
  terminated: boolean;
  terminationReason: 'absorbed' | 'exit' | 'max_bounces' | 'min_intensity';
  totalBounces: number;
}

// Angle calculation utilities
export interface AngleUtils {
  normalizeAngle: (angle: number) => number; // 0-360
  radiansToDegrees: (radians: number) => number;
  degreesToRadians: (degrees: number) => number;
  calculateReflection: (incident: number, surfaceNormal: number) => number;
}

// Grid boundary detection
export interface BoundaryCheck {
  isWithinBounds: (position: GridPosition, gridSize: number) => boolean;
  isExitPoint: (position: GridPosition, gridSize: number) => boolean;
  getExitSide: (
    position: GridPosition,
    gridSize: number
  ) => 'top' | 'right' | 'bottom' | 'left' | null;
}

// Material interaction calculation
export interface MaterialInteraction {
  material: Material;
  incidentAngle: number;
  result: ReflectionResult;
  probabilistic?: boolean; // for materials like glass with random behavior
}

// Physics validation result
export interface PhysicsValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  solutionPath?: RayTrace;
}
