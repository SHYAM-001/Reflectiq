/**
 * Angle calculation utilities for laser reflection physics
 * Handles angle normalization, conversions, and reflection calculations
 */

// Normalize angle to 0-360 degrees
export function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
}

// Convert radians to degrees
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

// Convert degrees to radians
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Calculate reflection angle given incident angle and surface normal
export function calculateReflection(incidentAngle: number, surfaceNormal: number): number {
  // Normalize angles
  const incident = normalizeAngle(incidentAngle);
  const normal = normalizeAngle(surfaceNormal);

  // Calculate angle of incidence relative to normal
  const angleOfIncidence = normalizeAngle(incident - normal);

  // Reflection: angle of reflection equals angle of incidence
  const angleOfReflection = normalizeAngle(normal - angleOfIncidence);

  return angleOfReflection;
}

// Calculate mirror reflection with custom mirror angle
export function calculateMirrorReflection(incidentAngle: number, mirrorAngle: number): number {
  // Mirror normal is perpendicular to mirror surface
  const mirrorNormal = normalizeAngle(mirrorAngle + 90);
  return calculateReflection(incidentAngle, mirrorNormal);
}

// Calculate metal reversal (180-degree reflection)
export function calculateMetalReversal(incidentAngle: number): number {
  return normalizeAngle(incidentAngle + 180);
}

// Calculate water diffusion with random offset
export function calculateWaterReflection(
  incidentAngle: number,
  surfaceNormal: number,
  diffusionFactor: number
): number {
  const baseReflection = calculateReflection(incidentAngle, surfaceNormal);

  // Apply random diffusion within ±30 degrees
  const maxDiffusion = 30;
  const randomOffset = (Math.random() - 0.5) * 2 * maxDiffusion * diffusionFactor;

  return normalizeAngle(baseReflection + randomOffset);
}

// Get direction vector from angle (for movement calculations)
export function getDirectionVector(angle: number): [number, number] {
  const radians = degreesToRadians(angle);
  return [Math.cos(radians), Math.sin(radians)];
}

// Get angle from direction vector
export function getAngleFromVector(dx: number, dy: number): number {
  const radians = Math.atan2(dy, dx);
  return normalizeAngle(radiansToDegrees(radians));
}

// Calculate distance between two points
export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// Check if angle is within a range (accounting for 0/360 wraparound)
export function isAngleInRange(angle: number, minAngle: number, maxAngle: number): boolean {
  const normalizedAngle = normalizeAngle(angle);
  const normalizedMin = normalizeAngle(minAngle);
  const normalizedMax = normalizeAngle(maxAngle);

  if (normalizedMin <= normalizedMax) {
    return normalizedAngle >= normalizedMin && normalizedAngle <= normalizedMax;
  } else {
    // Range crosses 0/360 boundary
    return normalizedAngle >= normalizedMin || normalizedAngle <= normalizedMax;
  }
}

// Get the closest cardinal direction (0, 90, 180, 270)
export function getClosestCardinalDirection(angle: number): number {
  const normalized = normalizeAngle(angle);
  const cardinals = [0, 90, 180, 270];

  let closest = cardinals[0];
  let minDifference = Math.abs(normalized - closest);

  for (const cardinal of cardinals) {
    const difference = Math.min(
      Math.abs(normalized - cardinal),
      Math.abs(normalized - cardinal + 360),
      Math.abs(normalized - cardinal - 360)
    );

    if (difference < minDifference) {
      minDifference = difference;
      closest = cardinal;
    }
  }

  return closest;
}

// Calculate angle between two points
export function calculateAngleBetweenPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return getAngleFromVector(dx, dy);
}
