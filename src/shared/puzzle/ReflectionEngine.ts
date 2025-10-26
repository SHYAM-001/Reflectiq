/**
 * Reflection Physics Engine for ReflectIQ
 * Handles laser path tracing through different materials with realistic physics
 */

import { Material, MaterialType, GridPosition, LaserPath, PathSegment } from '../types/puzzle.js';

import { ReflectionResult, RayTrace, RayStep, MaterialInteraction } from '../types/physics.js';

import { MATERIAL_PROPERTIES, PHYSICS_CONSTANTS } from '../physics/constants.js';

import {
  normalizeAngle,
  calculateReflection,
  calculateMirrorReflection,
  calculateMetalReversal,
  calculateWaterReflection,
  getDirectionVector,
  getAngleFromVector,
} from '../physics/angles.js';

import {
  isWithinBounds,
  isExitPoint,
  getExitSide,
  positionsEqual,
  positionToKey,
} from '../physics/grid.js';

export class ReflectionEngine {
  private static instance: ReflectionEngine;

  public static getInstance(): ReflectionEngine {
    if (!ReflectionEngine.instance) {
      ReflectionEngine.instance = new ReflectionEngine();
    }
    return ReflectionEngine.instance;
  }

  /**
   * Trace the complete laser path through a puzzle
   */
  public traceLaserPath(
    materials: Material[],
    entry: GridPosition,
    gridSize: number,
    initialDirection: number = 0
  ): LaserPath {
    const materialMap = this.createMaterialMap(materials);
    const rayTrace = this.performRayTrace(entry, initialDirection, materialMap, gridSize);

    return this.convertRayTraceToLaserPath(rayTrace);
  }

  /**
   * Create a map of positions to materials for efficient lookup
   */
  private createMaterialMap(materials: Material[]): Map<string, Material> {
    const materialMap = new Map<string, Material>();

    for (const material of materials) {
      materialMap.set(positionToKey(material.position), material);
    }

    return materialMap;
  }

  /**
   * Perform ray tracing through the grid
   */
  private performRayTrace(
    startPosition: GridPosition,
    startDirection: number,
    materialMap: Map<string, Material>,
    gridSize: number
  ): RayTrace {
    const steps: RayStep[] = [];
    let currentPosition = startPosition;
    let currentDirection = normalizeAngle(startDirection);
    let currentIntensity = 1.0;
    let bounceCount = 0;

    // Add initial step
    steps.push({
      position: currentPosition,
      direction: currentDirection,
      intensity: currentIntensity,
      bounceCount: 0,
    });

    while (bounceCount < PHYSICS_CONSTANTS.laser.maxBounces) {
      // Calculate next position based on current direction
      const nextPosition = this.calculateNextPosition(currentPosition, currentDirection, gridSize);

      if (!nextPosition) {
        // Ray went out of bounds
        break;
      }

      // Check if we hit a material
      const material = materialMap.get(positionToKey(nextPosition));

      if (material) {
        // Process material interaction
        const interaction = this.processMaterialInteraction(
          material,
          currentDirection,
          currentIntensity,
          nextPosition
        );

        if (interaction.result.reflected) {
          // Update ray properties
          currentDirection = interaction.result.newDirection;
          currentIntensity = interaction.result.intensity;
          currentPosition = interaction.result.position;
          bounceCount++;

          steps.push({
            position: currentPosition,
            direction: currentDirection,
            intensity: currentIntensity,
            material: material,
            bounceCount,
          });

          // Check if intensity is too low to continue
          if (currentIntensity < PHYSICS_CONSTANTS.laser.minIntensity) {
            return {
              steps,
              finalPosition: null,
              terminated: true,
              terminationReason: 'min_intensity',
              totalBounces: bounceCount,
            };
          }
        } else {
          // Ray was absorbed
          return {
            steps,
            finalPosition: null,
            terminated: true,
            terminationReason: 'absorbed',
            totalBounces: bounceCount,
          };
        }
      } else {
        // No material hit, continue in same direction
        currentPosition = nextPosition;

        steps.push({
          position: currentPosition,
          direction: currentDirection,
          intensity: currentIntensity,
          bounceCount,
        });

        // Check if we reached an exit point
        if (isExitPoint(currentPosition, gridSize)) {
          return {
            steps,
            finalPosition: currentPosition,
            terminated: false,
            terminationReason: 'exit',
            totalBounces: bounceCount,
          };
        }
      }
    }

    // Max bounces reached
    return {
      steps,
      finalPosition: null,
      terminated: true,
      terminationReason: 'max_bounces',
      totalBounces: bounceCount,
    };
  }

  /**
   * Calculate the next position based on current position and direction
   */
  private calculateNextPosition(
    position: GridPosition,
    direction: number,
    gridSize: number
  ): GridPosition | null {
    const [x, y] = position;
    const [dx, dy] = getDirectionVector(direction);

    // Move one step in the direction
    const newX = Math.round(x + dx);
    const newY = Math.round(y + dy);
    const newPosition: GridPosition = [newX, newY];

    // Check bounds
    if (!isWithinBounds(newPosition, gridSize)) {
      return null;
    }

    return newPosition;
  }

  /**
   * Process interaction between laser and material
   */
  private processMaterialInteraction(
    material: Material,
    incidentDirection: number,
    intensity: number,
    position: GridPosition
  ): MaterialInteraction {
    const result = this.processReflection(material, incidentDirection, intensity);

    return {
      material,
      incidentAngle: incidentDirection,
      result,
      probabilistic: material.type === 'water' || material.type === 'glass',
    };
  }

  /**
   * Process reflection based on material type
   */
  public processReflection(
    material: Material,
    incidentAngle: number,
    intensity: number
  ): ReflectionResult {
    const properties = material.properties;

    switch (material.type) {
      case 'mirror':
        return this.processMirrorReflection(material, incidentAngle, intensity);

      case 'water':
        return this.processWaterReflection(material, incidentAngle, intensity);

      case 'glass':
        return this.processGlassReflection(material, incidentAngle, intensity);

      case 'metal':
        return this.processMetalReflection(material, incidentAngle, intensity);

      case 'absorber':
        return this.processAbsorberReflection(material, incidentAngle, intensity);

      default:
        throw new Error(`Unknown material type: ${material.type}`);
    }
  }

  /**
   * Process mirror reflection with custom angle
   */
  private processMirrorReflection(
    material: Material,
    incidentAngle: number,
    intensity: number
  ): ReflectionResult {
    const mirrorAngle = material.angle || 45;
    const reflectedAngle = calculateMirrorReflection(incidentAngle, mirrorAngle);

    return {
      reflected: true,
      newDirection: reflectedAngle,
      intensity: intensity * material.properties.reflectivity,
      position: material.position,
      material,
    };
  }

  /**
   * Process water reflection with diffusion
   */
  private processWaterReflection(
    material: Material,
    incidentAngle: number,
    intensity: number
  ): ReflectionResult {
    // Water reflects with some diffusion
    const surfaceNormal = 90; // Assume horizontal water surface
    const reflectedAngle = calculateWaterReflection(
      incidentAngle,
      surfaceNormal,
      material.properties.diffusion
    );

    return {
      reflected: true,
      newDirection: reflectedAngle,
      intensity: intensity * material.properties.reflectivity,
      position: material.position,
      material,
    };
  }

  /**
   * Process glass reflection (50% pass-through, 50% reflect)
   */
  private processGlassReflection(
    material: Material,
    incidentAngle: number,
    intensity: number
  ): ReflectionResult {
    // Glass has 50% chance to reflect, 50% to pass through
    const shouldReflect = Math.random() < 0.5;

    if (shouldReflect) {
      const surfaceNormal = 90;
      const reflectedAngle = calculateReflection(incidentAngle, surfaceNormal);

      return {
        reflected: true,
        newDirection: reflectedAngle,
        intensity: intensity * material.properties.reflectivity,
        position: material.position,
        material,
      };
    } else {
      // Pass through - continue in same direction with reduced intensity
      return {
        reflected: true,
        newDirection: incidentAngle,
        intensity: intensity * material.properties.transparency,
        position: material.position,
        material,
      };
    }
  }

  /**
   * Process metal reflection (complete reversal)
   */
  private processMetalReflection(
    material: Material,
    incidentAngle: number,
    intensity: number
  ): ReflectionResult {
    const reversedAngle = calculateMetalReversal(incidentAngle);

    return {
      reflected: true,
      newDirection: reversedAngle,
      intensity: intensity * material.properties.reflectivity,
      position: material.position,
      material,
    };
  }

  /**
   * Process absorber (stops the beam)
   */
  private processAbsorberReflection(
    material: Material,
    incidentAngle: number,
    intensity: number
  ): ReflectionResult {
    return {
      reflected: false,
      newDirection: incidentAngle,
      intensity: 0,
      position: material.position,
      material,
    };
  }

  /**
   * Convert ray trace result to laser path format
   */
  private convertRayTraceToLaserPath(rayTrace: RayTrace): LaserPath {
    const segments: PathSegment[] = [];

    for (let i = 0; i < rayTrace.steps.length - 1; i++) {
      const currentStep = rayTrace.steps[i];
      const nextStep = rayTrace.steps[i + 1];

      segments.push({
        start: currentStep.position,
        end: nextStep.position,
        direction: currentStep.direction,
        material: currentStep.material,
      });
    }

    return {
      segments,
      exit: rayTrace.finalPosition,
      terminated: rayTrace.terminated,
    };
  }

  /**
   * Calculate the exit point of a laser path
   */
  public calculateExit(path: LaserPath): GridPosition | null {
    return path.exit;
  }

  /**
   * Validate that a puzzle has exactly one solution
   */
  public validateSolution(
    materials: Material[],
    entry: GridPosition,
    expectedSolution: GridPosition,
    gridSize: number
  ): boolean {
    const path = this.traceLaserPath(materials, entry, gridSize);
    const actualSolution = this.calculateExit(path);

    if (!actualSolution) {
      return false;
    }

    return positionsEqual(actualSolution, expectedSolution);
  }
}
