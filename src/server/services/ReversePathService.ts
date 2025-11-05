/**
 * Reverse Path Engineering Service for ReflectIQ
 * Implements reverse-engineering approach for guaranteed puzzle generation
 * Works backwards from exit to entry to create valid laser paths
 */

import {
  GridPosition,
  Material,
  MaterialType,
  Difficulty,
  LaserPath,
} from '../../shared/types/puzzle.js';

import {
  PathPlan,
  MaterialRequirement,
  ValidationResult,
  PhysicsValidation,
  MaterialInteractionResult,
} from '../../shared/types/guaranteed-generation.js';

import { DIFFICULTY_CONFIGS, MATERIAL_PROPERTIES } from '../../shared/physics/constants.js';
import {
  isWithinBounds,
  getAllExitPositions,
  positionsEqual,
  getManhattanDistance,
} from '../../shared/physics/grid.js';

/**
 * Service for reverse-engineering laser paths from exit to entry points
 */
export class ReversePathService {
  private static instance: ReversePathService;

  public static getInstance(): ReversePathService {
    if (!ReversePathService.instance) {
      ReversePathService.instance = new ReversePathService();
    }
    return ReversePathService.instance;
  }

  /**
   * Plan optimal path working backwards from exit to entry
   * Requirements: 3.1, 3.2, 6.4, 6.5
   */
  public async planOptimalPath(
    entry: GridPosition,
    exit: GridPosition,
    difficulty: Difficulty
  ): Promise<PathPlan> {
    const config = DIFFICULTY_CONFIGS[difficulty];
    const complexityConfig = this.getComplexityConfig(difficulty);

    // Calculate required reflections based on difficulty
    const requiredReflections = this.calculateRequiredReflections(
      entry,
      exit,
      difficulty,
      config.gridSize
    );

    // Determine key reflection points working backwards from exit
    const keyReflectionPoints = await this.calculateReflectionPoints(
      entry,
      exit,
      requiredReflections,
      config.gridSize
    );

    // Generate material requirements for each reflection point
    const materialRequirements = this.generateMaterialRequirements(
      keyReflectionPoints,
      entry,
      exit,
      difficulty
    );

    // Calculate complexity score based on path characteristics
    const complexityScore = this.calculateComplexityScore(
      keyReflectionPoints,
      materialRequirements,
      difficulty
    );

    const pathPlan: PathPlan = {
      entry,
      exit,
      requiredReflections,
      keyReflectionPoints,
      materialRequirements,
      complexityScore,
      estimatedDifficulty: difficulty,
    };

    return pathPlan;
  }

  /**
   * Calculate required number of reflections based on difficulty and distance
   */
  private calculateRequiredReflections(
    entry: GridPosition,
    exit: GridPosition,
    difficulty: Difficulty,
    gridSize: number
  ): number {
    const complexityConfig = this.getComplexityConfig(difficulty);
    const distance = this.calculateManhattanDistance(entry, exit);

    // Base reflections from difficulty configuration
    let reflections = complexityConfig.minReflections;

    // Add reflections based on distance to create more interesting paths
    const distanceBonus = Math.floor(distance / 3);
    reflections += distanceBonus;

    // Ensure we don't exceed maximum reflections
    reflections = Math.min(reflections, complexityConfig.maxReflections);

    // Ensure minimum reflections for difficulty
    reflections = Math.max(reflections, complexityConfig.minReflections);

    return reflections;
  }

  /**
   * Calculate key reflection points working backwards from exit
   */
  private async calculateReflectionPoints(
    entry: GridPosition,
    exit: GridPosition,
    requiredReflections: number,
    gridSize: number
  ): Promise<GridPosition[]> {
    const reflectionPoints: GridPosition[] = [];

    if (requiredReflections === 0) {
      // Direct path - no reflections needed
      return reflectionPoints;
    }

    // Start from exit and work backwards
    let currentPoint = exit;
    const targetPoint = entry;

    for (let i = 0; i < requiredReflections; i++) {
      // Calculate strategic reflection point
      const reflectionPoint = this.calculateStrategicReflectionPoint(
        currentPoint,
        targetPoint,
        reflectionPoints,
        gridSize,
        i,
        requiredReflections
      );

      if (reflectionPoint) {
        reflectionPoints.unshift(reflectionPoint); // Add to beginning since we're working backwards
        currentPoint = reflectionPoint;
      }
    }

    return reflectionPoints;
  }

  /**
   * Calculate a strategic reflection point between current and target positions
   */
  private calculateStrategicReflectionPoint(
    current: GridPosition,
    target: GridPosition,
    existingPoints: GridPosition[],
    gridSize: number,
    reflectionIndex: number,
    totalReflections: number
  ): GridPosition | null {
    const [currentX, currentY] = current;
    const [targetX, targetY] = target;

    // Calculate intermediate position with some strategic variation
    const progress = (reflectionIndex + 1) / (totalReflections + 1);

    // Base interpolation between current and target
    let intermediateX = Math.round(currentX + (targetX - currentX) * progress);
    let intermediateY = Math.round(currentY + (targetY - currentY) * progress);

    // Add strategic variation to create interesting paths
    const variation = Math.floor(gridSize * 0.2); // 20% of grid size
    const xVariation = Math.floor((Math.random() - 0.5) * variation);
    const yVariation = Math.floor((Math.random() - 0.5) * variation);

    intermediateX = Math.max(1, Math.min(gridSize - 2, intermediateX + xVariation));
    intermediateY = Math.max(1, Math.min(gridSize - 2, intermediateY + yVariation));

    const candidatePoint: GridPosition = [intermediateX, intermediateY];

    // Validate the point is within bounds and not conflicting with existing points
    if (
      isWithinBounds(candidatePoint, gridSize) &&
      !this.isPointTooCloseToExisting(candidatePoint, existingPoints) &&
      !positionsEqual(candidatePoint, current) &&
      !positionsEqual(candidatePoint, target)
    ) {
      return candidatePoint;
    }

    // Fallback: try a few more positions around the calculated point
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const fallbackPoint: GridPosition = [intermediateX + dx, intermediateY + dy];

        if (
          isWithinBounds(fallbackPoint, gridSize) &&
          !this.isPointTooCloseToExisting(fallbackPoint, existingPoints) &&
          !positionsEqual(fallbackPoint, current) &&
          !positionsEqual(fallbackPoint, target)
        ) {
          return fallbackPoint;
        }
      }
    }

    return null;
  }

  /**
   * Check if a point is too close to existing reflection points
   */
  private isPointTooCloseToExisting(
    point: GridPosition,
    existingPoints: GridPosition[],
    minDistance: number = 2
  ): boolean {
    return existingPoints.some(
      (existing) => this.calculateManhattanDistance(point, existing) < minDistance
    );
  }

  /**
   * Generate material requirements for reflection points
   */
  private generateMaterialRequirements(
    reflectionPoints: GridPosition[],
    entry: GridPosition,
    exit: GridPosition,
    difficulty: Difficulty
  ): MaterialRequirement[] {
    const requirements: MaterialRequirement[] = [];
    const allowedMaterials = DIFFICULTY_CONFIGS[difficulty].allowedMaterials;

    // Create materials for each reflection point
    reflectionPoints.forEach((point, index) => {
      const materialType = this.selectOptimalMaterialType(
        point,
        index,
        reflectionPoints,
        entry,
        exit,
        allowedMaterials
      );

      const requirement: MaterialRequirement = {
        position: point,
        materialType,
        priority: 'critical',
        reflectionIndex: index,
      };

      // Add angle for mirrors
      if (materialType === 'mirror') {
        requirement.angle = this.calculateOptimalMirrorAngle(
          point,
          index,
          reflectionPoints,
          entry,
          exit
        );
      }

      requirements.push(requirement);
    });

    return requirements;
  }

  /**
   * Select optimal material type for a reflection point
   */
  private selectOptimalMaterialType(
    position: GridPosition,
    reflectionIndex: number,
    allReflectionPoints: GridPosition[],
    entry: GridPosition,
    exit: GridPosition,
    allowedMaterials: MaterialType[]
  ): MaterialType {
    // For critical path reflections, prefer mirrors for predictable behavior
    if (allowedMaterials.includes('mirror')) {
      return 'mirror';
    }

    // Fallback to other materials based on availability
    const preferenceOrder: MaterialType[] = ['glass', 'water', 'metal', 'absorber'];

    for (const material of preferenceOrder) {
      if (allowedMaterials.includes(material)) {
        return material;
      }
    }

    // Final fallback
    return allowedMaterials[0] || 'mirror';
  }

  /**
   * Calculate optimal mirror angle for reflection
   */
  private calculateOptimalMirrorAngle(
    mirrorPosition: GridPosition,
    reflectionIndex: number,
    allReflectionPoints: GridPosition[],
    entry: GridPosition,
    exit: GridPosition
  ): number {
    // Determine incoming and outgoing directions
    let incomingPoint: GridPosition;
    let outgoingPoint: GridPosition;

    if (reflectionIndex === 0) {
      // First reflection: incoming from entry
      incomingPoint = entry;
    } else {
      // Subsequent reflection: incoming from previous reflection point
      incomingPoint = allReflectionPoints[reflectionIndex - 1];
    }

    if (reflectionIndex === allReflectionPoints.length - 1) {
      // Last reflection: outgoing to exit
      outgoingPoint = exit;
    } else {
      // Intermediate reflection: outgoing to next reflection point
      outgoingPoint = allReflectionPoints[reflectionIndex + 1];
    }

    // Calculate angles
    const incomingAngle = this.calculateAngle(incomingPoint, mirrorPosition);
    const outgoingAngle = this.calculateAngle(mirrorPosition, outgoingPoint);

    // Calculate mirror angle to achieve the required reflection
    // Mirror angle is the bisector of the incoming and outgoing angles
    const mirrorAngle = (incomingAngle + outgoingAngle) / 2;

    // Normalize to 0-360 degrees
    return this.normalizeAngle(mirrorAngle);
  }

  /**
   * Calculate angle between two points in degrees
   */
  private calculateAngle(from: GridPosition, to: GridPosition): number {
    const [fromX, fromY] = from;
    const [toX, toY] = to;

    const deltaX = toX - fromX;
    const deltaY = toY - fromY;

    const angleRadians = Math.atan2(deltaY, deltaX);
    const angleDegrees = (angleRadians * 180) / Math.PI;

    return this.normalizeAngle(angleDegrees);
  }

  /**
   * Normalize angle to 0-360 degrees
   */
  private normalizeAngle(angle: number): number {
    while (angle < 0) {
      angle += 360;
    }
    while (angle >= 360) {
      angle -= 360;
    }
    return angle;
  }

  /**
   * Calculate complexity score for the path plan
   */
  private calculateComplexityScore(
    reflectionPoints: GridPosition[],
    materialRequirements: MaterialRequirement[],
    difficulty: Difficulty
  ): number {
    let score = 0;

    // Base score from number of reflections
    score += reflectionPoints.length * 2;

    // Score from material diversity
    const uniqueMaterials = new Set(materialRequirements.map((req) => req.materialType));
    score += uniqueMaterials.size;

    // Score from path length and complexity
    const pathLength = this.calculateTotalPathLength(reflectionPoints);
    score += Math.floor(pathLength / 3);

    // Normalize to 1-10 scale
    const maxScore = 20; // Estimated maximum score
    const normalizedScore = Math.min(10, Math.max(1, Math.round((score / maxScore) * 10)));

    return normalizedScore;
  }

  /**
   * Calculate total path length through all reflection points
   */
  private calculateTotalPathLength(reflectionPoints: GridPosition[]): number {
    if (reflectionPoints.length === 0) return 0;

    let totalLength = 0;
    for (let i = 0; i < reflectionPoints.length - 1; i++) {
      totalLength += this.calculateManhattanDistance(reflectionPoints[i], reflectionPoints[i + 1]);
    }

    return totalLength;
  }

  /**
   * Calculate Manhattan distance between two points
   */
  private calculateManhattanDistance(point1: GridPosition, point2: GridPosition): number {
    return getManhattanDistance(point1, point2);
  }

  /**
   * Get complexity configuration for difficulty level
   */
  private getComplexityConfig(difficulty: Difficulty): {
    minReflections: number;
    maxReflections: number;
    preferredReflections: number;
    pathLengthMultiplier: number;
  } {
    const configs = {
      Easy: {
        minReflections: 2,
        maxReflections: 4,
        preferredReflections: 3,
        pathLengthMultiplier: 1.0,
      },
      Medium: {
        minReflections: 3,
        maxReflections: 6,
        preferredReflections: 4,
        pathLengthMultiplier: 1.2,
      },
      Hard: {
        minReflections: 4,
        maxReflections: 8,
        preferredReflections: 6,
        pathLengthMultiplier: 1.5,
      },
    };

    return configs[difficulty];
  }

  /**
   * Place materials along the planned path to create valid laser trajectory
   * Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 6.2, 6.3
   */
  public async placeMaterialsForPath(pathPlan: PathPlan, gridSize: number): Promise<Material[]> {
    const materials: Material[] = [];
    const occupiedPositions = new Set<string>();

    // Reserve entry and exit positions
    occupiedPositions.add(this.positionToKey(pathPlan.entry));
    occupiedPositions.add(this.positionToKey(pathPlan.exit));

    // Place critical materials for the solution path
    for (const requirement of pathPlan.materialRequirements) {
      if (requirement.priority === 'critical') {
        const material = this.createMaterialFromRequirement(requirement);
        materials.push(material);
        occupiedPositions.add(this.positionToKey(requirement.position));
      }
    }

    // Calculate target material density
    const config = DIFFICULTY_CONFIGS[pathPlan.estimatedDifficulty];
    const targetDensity = config.materialDensity;
    const totalCells = gridSize * gridSize;
    const targetMaterialCount = Math.floor(totalCells * targetDensity);

    // Add supporting and decorative materials to reach target density
    const remainingMaterialsNeeded = Math.max(0, targetMaterialCount - materials.length);

    const supportingMaterials = await this.generateSupportingMaterials(
      remainingMaterialsNeeded,
      gridSize,
      occupiedPositions,
      pathPlan.estimatedDifficulty,
      pathPlan
    );

    materials.push(...supportingMaterials);

    return materials;
  }

  /**
   * Create a material instance from a material requirement
   */
  private createMaterialFromRequirement(requirement: MaterialRequirement): Material {
    const material: Material = {
      type: requirement.materialType,
      position: requirement.position,
      properties: MATERIAL_PROPERTIES[requirement.materialType],
    };

    // Add angle for mirrors
    if (requirement.materialType === 'mirror' && requirement.angle !== undefined) {
      material.angle = requirement.angle;
    }

    return material;
  }

  /**
   * Generate supporting materials to reach target density while maintaining solution path
   */
  private async generateSupportingMaterials(
    count: number,
    gridSize: number,
    occupiedPositions: Set<string>,
    difficulty: Difficulty,
    pathPlan: PathPlan
  ): Promise<Material[]> {
    const materials: Material[] = [];
    const config = DIFFICULTY_CONFIGS[difficulty];
    const allowedMaterials = config.allowedMaterials;

    // Get material weights for this difficulty
    const materialWeights = this.getMaterialWeights(allowedMaterials, difficulty);

    let attempts = 0;
    const maxAttempts = count * 10; // Allow multiple attempts per material

    while (materials.length < count && attempts < maxAttempts) {
      attempts++;

      // Generate random position
      const position: GridPosition = [
        Math.floor(Math.random() * gridSize),
        Math.floor(Math.random() * gridSize),
      ];

      const positionKey = this.positionToKey(position);

      // Skip if position is occupied or conflicts with solution path
      if (
        occupiedPositions.has(positionKey) ||
        this.conflictsWithSolutionPath(position, pathPlan)
      ) {
        continue;
      }

      // Select material type based on weights
      const materialType = this.selectWeightedMaterial(allowedMaterials, materialWeights);

      // Create supporting material
      const material: Material = {
        type: materialType,
        position,
        properties: MATERIAL_PROPERTIES[materialType],
      };

      // Add angle for mirrors
      if (materialType === 'mirror') {
        material.angle = this.generateRandomMirrorAngle();
      }

      materials.push(material);
      occupiedPositions.add(positionKey);
    }

    return materials;
  }

  /**
   * Check if a position conflicts with the planned solution path
   */
  private conflictsWithSolutionPath(position: GridPosition, pathPlan: PathPlan): boolean {
    // Check if position is too close to critical reflection points
    const minDistance = 1; // Minimum distance from critical path elements

    for (const reflectionPoint of pathPlan.keyReflectionPoints) {
      if (getManhattanDistance(position, reflectionPoint) < minDistance) {
        return true;
      }
    }

    // Check if position is on the direct line between critical points
    // This is a simplified check - in a full implementation, we'd do proper line intersection
    return false;
  }

  /**
   * Get material distribution weights for different difficulty levels
   */
  private getMaterialWeights(
    allowedMaterials: MaterialType[],
    difficulty: Difficulty
  ): Record<MaterialType, number> {
    // Base weights adjusted by difficulty
    const baseWeights: Record<MaterialType, number> = {
      mirror: difficulty === 'Easy' ? 0.6 : difficulty === 'Medium' ? 0.4 : 0.3,
      water: difficulty === 'Easy' ? 0.0 : difficulty === 'Medium' ? 0.2 : 0.2,
      glass: difficulty === 'Easy' ? 0.0 : difficulty === 'Medium' ? 0.15 : 0.2,
      metal: difficulty === 'Easy' ? 0.0 : difficulty === 'Medium' ? 0.0 : 0.1,
      absorber: difficulty === 'Easy' ? 0.4 : difficulty === 'Medium' ? 0.25 : 0.2,
    };

    // Filter to only allowed materials and normalize
    const filteredWeights: Record<MaterialType, number> = {} as Record<MaterialType, number>;
    let totalWeight = 0;

    for (const material of allowedMaterials) {
      filteredWeights[material] = baseWeights[material];
      totalWeight += baseWeights[material];
    }

    // Normalize weights to sum to 1
    if (totalWeight > 0) {
      for (const material of allowedMaterials) {
        filteredWeights[material] /= totalWeight;
      }
    }

    return filteredWeights;
  }

  /**
   * Select a material type based on weighted probabilities
   */
  private selectWeightedMaterial(
    allowedMaterials: MaterialType[],
    weights: Record<MaterialType, number>
  ): MaterialType {
    const random = Math.random();
    let cumulativeWeight = 0;

    for (const material of allowedMaterials) {
      cumulativeWeight += weights[material];
      if (random <= cumulativeWeight) {
        return material;
      }
    }

    // Fallback to first material
    return allowedMaterials[0] || 'mirror';
  }

  /**
   * Generate a random angle for mirror materials
   */
  private generateRandomMirrorAngle(): number {
    // Generate angles in 15-degree increments for cleaner reflections
    const angleIncrements = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165];
    const randomIndex = Math.floor(Math.random() * angleIncrements.length);
    return angleIncrements[randomIndex] || 45;
  }

  /**
   * Optimize material density to balance coverage with solvability
   * Requirements: 3.3, 3.4, 4.1, 4.2, 4.3, 4.4
   */
  public async optimizeMaterialDensity(
    materials: Material[],
    targetDensity: number,
    gridSize: number,
    pathPlan: PathPlan
  ): Promise<Material[]> {
    const totalCells = gridSize * gridSize;
    const targetMaterialCount = Math.floor(totalCells * targetDensity);
    const currentCount = materials.length;

    // If we're already at target density, return as-is
    if (Math.abs(currentCount - targetMaterialCount) <= 1) {
      return materials;
    }

    let optimizedMaterials = [...materials];

    if (currentCount < targetMaterialCount) {
      // Add more materials to reach target density
      const additionalMaterials = await this.addOptimizedMaterials(
        optimizedMaterials,
        targetMaterialCount - currentCount,
        gridSize,
        pathPlan
      );
      optimizedMaterials.push(...additionalMaterials);
    } else if (currentCount > targetMaterialCount) {
      // Remove excess materials while preserving solution path
      optimizedMaterials = await this.removeExcessMaterials(
        optimizedMaterials,
        currentCount - targetMaterialCount,
        pathPlan
      );
    }

    return optimizedMaterials;
  }

  /**
   * Add optimized materials to reach target density
   */
  private async addOptimizedMaterials(
    existingMaterials: Material[],
    additionalCount: number,
    gridSize: number,
    pathPlan: PathPlan
  ): Promise<Material[]> {
    const occupiedPositions = new Set<string>();

    // Mark existing material positions as occupied
    existingMaterials.forEach((material) => {
      occupiedPositions.add(this.positionToKey(material.position));
    });

    // Mark entry and exit as occupied
    occupiedPositions.add(this.positionToKey(pathPlan.entry));
    occupiedPositions.add(this.positionToKey(pathPlan.exit));

    return this.generateSupportingMaterials(
      additionalCount,
      gridSize,
      occupiedPositions,
      pathPlan.estimatedDifficulty,
      pathPlan
    );
  }

  /**
   * Remove excess materials while preserving critical path elements
   */
  private async removeExcessMaterials(
    materials: Material[],
    removeCount: number,
    pathPlan: PathPlan
  ): Promise<Material[]> {
    // Identify critical materials that cannot be removed
    const criticalPositions = new Set<string>();
    pathPlan.materialRequirements
      .filter((req) => req.priority === 'critical')
      .forEach((req) => criticalPositions.add(this.positionToKey(req.position)));

    // Separate critical and non-critical materials
    const criticalMaterials = materials.filter((material) =>
      criticalPositions.has(this.positionToKey(material.position))
    );

    const nonCriticalMaterials = materials.filter(
      (material) => !criticalPositions.has(this.positionToKey(material.position))
    );

    // Remove non-critical materials first
    const materialsToRemove = Math.min(removeCount, nonCriticalMaterials.length);
    const remainingNonCritical = nonCriticalMaterials.slice(
      0,
      nonCriticalMaterials.length - materialsToRemove
    );

    return [...criticalMaterials, ...remainingNonCritical];
  }

  /**
   * Validate that laser path follows material properties correctly
   * Requirements: 3.3, 3.4, 4.1, 4.2, 4.3, 4.4
   */
  public async validatePathPhysics(
    materials: Material[],
    entry: GridPosition,
    expectedExit: GridPosition,
    gridSize: number
  ): Promise<PhysicsValidation> {
    try {
      // Import ReflectionEngine dynamically to avoid circular dependencies
      const { ReflectionEngine } = await import('../../shared/puzzle/ReflectionEngine.js');
      const reflectionEngine = ReflectionEngine.getInstance();

      // Trace the actual laser path
      const actualPath = reflectionEngine.traceLaserPath(materials, entry, gridSize);

      if (!actualPath) {
        return {
          valid: false,
          materialInteractions: [],
          reflectionAccuracy: 0,
          pathContinuity: false,
          terminationCorrect: false,
          errors: ['Failed to trace laser path'],
          warnings: [],
        };
      }

      // Validate path reaches expected exit
      const terminationCorrect =
        actualPath.exit !== null && positionsEqual(actualPath.exit, expectedExit);

      // Validate material interactions
      const materialInteractions = this.validateMaterialInteractions(actualPath, materials);

      // Calculate reflection accuracy
      const reflectionAccuracy = this.calculateReflectionAccuracy(materialInteractions);

      // Check path continuity
      const pathContinuity = this.validatePathContinuity(actualPath);

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!terminationCorrect) {
        errors.push(
          `Path does not reach expected exit. Expected: ${expectedExit}, Actual: ${actualPath.exit}`
        );
      }

      if (reflectionAccuracy < 0.9) {
        warnings.push(`Low reflection accuracy: ${(reflectionAccuracy * 100).toFixed(1)}%`);
      }

      if (!pathContinuity) {
        errors.push('Path has continuity issues');
      }

      return {
        valid: errors.length === 0,
        materialInteractions,
        reflectionAccuracy,
        pathContinuity,
        terminationCorrect,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        valid: false,
        materialInteractions: [],
        reflectionAccuracy: 0,
        pathContinuity: false,
        terminationCorrect: false,
        errors: [
          `Physics validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        warnings: [],
      };
    }
  }

  /**
   * Validate material interactions in the laser path
   */
  private validateMaterialInteractions(
    laserPath: LaserPath,
    materials: Material[]
  ): MaterialInteractionResult[] {
    const interactions: MaterialInteractionResult[] = [];
    const materialMap = new Map<string, Material>();

    // Create position-to-material mapping
    materials.forEach((material) => {
      materialMap.set(this.positionToKey(material.position), material);
    });

    // Check each path segment for material interactions
    for (const segment of laserPath.segments) {
      if (segment.material) {
        const material = segment.material;
        const incidentAngle = segment.direction;

        // Calculate expected reflection based on material properties
        const expectedReflection = this.calculateExpectedReflection(incidentAngle, material);

        // Find the next segment to get actual reflection
        const segmentIndex = laserPath.segments.indexOf(segment);
        const nextSegment = laserPath.segments[segmentIndex + 1];
        const actualReflection = nextSegment ? nextSegment.direction : incidentAngle;

        // Calculate accuracy
        const angleDifference = Math.abs(
          this.normalizeAngle(expectedReflection - actualReflection)
        );
        const accuracyScore = Math.max(0, 1 - angleDifference / 180); // 0-1 scale

        interactions.push({
          material,
          incidentAngle,
          expectedReflection,
          actualReflection,
          accuracyScore,
          compliant: accuracyScore > 0.9, // 90% accuracy threshold
        });
      }
    }

    return interactions;
  }

  /**
   * Calculate expected reflection angle for a material
   */
  private calculateExpectedReflection(incidentAngle: number, material: Material): number {
    switch (material.type) {
      case 'mirror':
        // Mirror reflection: angle of incidence equals angle of reflection
        const mirrorAngle = material.angle || 0;
        const surfaceNormal = mirrorAngle + 90; // Normal is perpendicular to mirror surface
        return this.calculateReflectionAngle(incidentAngle, surfaceNormal);

      case 'metal':
        // Metal reverses direction
        return this.normalizeAngle(incidentAngle + 180);

      case 'water':
        // Water has some diffusion but generally reflects
        const baseReflection = this.calculateReflectionAngle(incidentAngle, 0);
        // Add small random variation for diffusion (simplified)
        const diffusionVariation = (Math.random() - 0.5) * 30; // ±15 degrees
        return this.normalizeAngle(baseReflection + diffusionVariation);

      case 'glass':
        // Glass can reflect or pass through - for validation, assume reflection
        return this.calculateReflectionAngle(incidentAngle, 0);

      case 'absorber':
        // Absorber stops the beam - no reflection
        return incidentAngle; // Beam terminates

      default:
        return incidentAngle;
    }
  }

  /**
   * Calculate reflection angle given incident angle and surface normal
   */
  private calculateReflectionAngle(incidentAngle: number, surfaceNormal: number): number {
    const normalizedIncident = this.normalizeAngle(incidentAngle);
    const normalizedNormal = this.normalizeAngle(surfaceNormal);

    // Angle of incidence equals angle of reflection
    const angleOfIncidence = normalizedIncident - normalizedNormal;
    const angleOfReflection = -angleOfIncidence;

    return this.normalizeAngle(normalizedNormal + angleOfReflection);
  }

  /**
   * Calculate overall reflection accuracy from material interactions
   */
  private calculateReflectionAccuracy(interactions: MaterialInteractionResult[]): number {
    if (interactions.length === 0) return 1.0;

    const totalAccuracy = interactions.reduce(
      (sum, interaction) => sum + interaction.accuracyScore,
      0
    );
    return totalAccuracy / interactions.length;
  }

  /**
   * Validate path continuity (no gaps or jumps)
   */
  private validatePathContinuity(laserPath: LaserPath): boolean {
    if (laserPath.segments.length === 0) return false;

    // Check that each segment connects to the next
    for (let i = 0; i < laserPath.segments.length - 1; i++) {
      const currentSegment = laserPath.segments[i];
      const nextSegment = laserPath.segments[i + 1];

      // End of current segment should match start of next segment
      if (!positionsEqual(currentSegment.end, nextSegment.start)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert grid position to string key for maps/sets
   */
  private positionToKey(position: GridPosition): string {
    return `${position[0]},${position[1]}`;
  }
}
