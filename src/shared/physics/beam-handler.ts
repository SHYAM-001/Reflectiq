// Beam handling utilities for client-side rendering in Devvit Web

import type { LaserPath, PathSegment, Coordinate, Direction } from '../types/game.js';

export interface BeamRenderData {
  segments: RenderSegment[];
  animationDuration: number;
  totalLength: number;
}

export interface RenderSegment {
  id: string;
  start: Coordinate;
  end: Coordinate;
  direction: Direction;
  material: string;
  animationDelay: number;
  length: number;
}

export class BeamHandler {
  private animationSpeed = 100; // pixels per second
  private segmentDelay = 50; // milliseconds between segments

  /**
   * Convert laser path to renderable beam data
   * Optimized for smooth animations in Devvit Web client
   */
  prepareBeamRender(path: LaserPath): BeamRenderData {
    const segments: RenderSegment[] = [];
    let totalLength = 0;
    let cumulativeDelay = 0;

    path.segments.forEach((segment, index) => {
      const length = this.calculateSegmentLength(segment);
      const renderSegment: RenderSegment = {
        id: `segment-${index}`,
        start: segment.start,
        end: segment.end,
        direction: segment.direction,
        material: segment.material,
        animationDelay: cumulativeDelay,
        length,
      };

      segments.push(renderSegment);
      totalLength += length;
      cumulativeDelay += this.segmentDelay;
    });

    const animationDuration = (totalLength / this.animationSpeed) * 1000; // Convert to milliseconds

    return {
      segments,
      animationDuration: Math.max(animationDuration, 1000), // Minimum 1 second
      totalLength,
    };
  }

  /**
   * Calculate the visual length of a path segment
   */
  private calculateSegmentLength(segment: PathSegment): number {
    const deltaRow = Math.abs(segment.end.row - segment.start.row);
    const deltaCol = Math.abs(segment.end.col - segment.start.col);

    // Use Euclidean distance for diagonal movements
    return Math.sqrt(deltaRow * deltaRow + deltaCol * deltaCol);
  }

  /**
   * Generate CSS animation keyframes for beam segments
   * Optimized for Devvit Web's client-side rendering
   */
  generateAnimationKeyframes(renderData: BeamRenderData, cellSize: number): string {
    let keyframes = '';

    renderData.segments.forEach((segment, index) => {
      const startX = segment.start.col * cellSize;
      const startY = segment.start.row * cellSize;
      const endX = segment.end.col * cellSize;
      const endY = segment.end.row * cellSize;

      keyframes += `
        @keyframes beam-segment-${index} {
          0% {
            transform: translate(${startX}px, ${startY}px) scale(0, 1);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translate(${startX}px, ${startY}px) scale(1, 1);
            opacity: 1;
          }
        }
      `;
    });

    return keyframes;
  }

  /**
   * Create beam trail effect for hint animations
   * Lightweight implementation for mobile performance
   */
  createBeamTrail(
    segments: PathSegment[],
    cellSize: number
  ): {
    path: string;
    length: number;
    duration: number;
  } {
    if (segments.length === 0) {
      return { path: '', length: 0, duration: 0 };
    }

    let pathData = '';
    let totalLength = 0;

    // Start from the first segment
    const firstSegment = segments[0];
    pathData += `M ${firstSegment.start.col * cellSize + cellSize / 2} ${firstSegment.start.row * cellSize + cellSize / 2}`;

    // Draw lines to each segment end
    segments.forEach((segment) => {
      const endX = segment.end.col * cellSize + cellSize / 2;
      const endY = segment.end.row * cellSize + cellSize / 2;
      pathData += ` L ${endX} ${endY}`;
      totalLength += this.calculateSegmentLength(segment) * cellSize;
    });

    const duration = Math.max(totalLength / this.animationSpeed, 0.5); // Minimum 0.5 seconds

    return {
      path: pathData,
      length: totalLength,
      duration,
    };
  }

  /**
   * Calculate beam color based on material interaction
   * Provides visual feedback for different materials
   */
  getBeamColor(material: string, intensity: number = 1): string {
    const baseColors = {
      empty: '#FF0000', // Red laser
      mirror: '#FF4444', // Slightly brighter red
      water: '#4488FF', // Blue tint for water
      glass: '#44FF44', // Green tint for glass
      metal: '#FFAA00', // Orange for metal
      absorber: '#000000', // Black (absorbed)
    };

    const color = baseColors[material as keyof typeof baseColors] || baseColors.empty;

    // Apply intensity (for fading effects)
    if (intensity < 1) {
      const rgb = this.hexToRgb(color);
      if (rgb) {
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${intensity})`;
      }
    }

    return color;
  }

  /**
   * Convert hex color to RGB for alpha blending
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  /**
   * Create particle effect data for material interactions
   * Lightweight particles for mobile performance
   */
  createInteractionEffect(
    coordinate: Coordinate,
    material: string,
    cellSize: number
  ): {
    x: number;
    y: number;
    color: string;
    type: 'spark' | 'splash' | 'reflection' | 'absorption';
    duration: number;
  } {
    const x = coordinate.col * cellSize + cellSize / 2;
    const y = coordinate.row * cellSize + cellSize / 2;

    const effects = {
      mirror: { type: 'reflection' as const, color: '#FFFFFF', duration: 300 },
      water: { type: 'splash' as const, color: '#4488FF', duration: 500 },
      glass: { type: 'spark' as const, color: '#44FF44', duration: 400 },
      metal: { type: 'spark' as const, color: '#FFAA00', duration: 350 },
      absorber: { type: 'absorption' as const, color: '#000000', duration: 600 },
    };

    const effect = effects[material as keyof typeof effects] || effects.mirror;

    return {
      x,
      y,
      color: effect.color,
      type: effect.type,
      duration: effect.duration,
    };
  }

  /**
   * Optimize beam rendering for mobile devices
   * Reduces complexity for better performance on Reddit mobile app
   */
  optimizeForMobile(renderData: BeamRenderData, isMobile: boolean): BeamRenderData {
    if (!isMobile) return renderData;

    // Reduce animation complexity for mobile
    const optimizedSegments = renderData.segments.map((segment) => ({
      ...segment,
      animationDelay: segment.animationDelay * 0.7, // Faster animations
    }));

    return {
      ...renderData,
      segments: optimizedSegments,
      animationDuration: renderData.animationDuration * 0.7,
    };
  }

  /**
   * Create beam glow effect for enhanced visibility
   * Optimized for Devvit Web's CSS capabilities
   */
  createGlowEffect(intensity: number = 0.8): string {
    return `
      filter: drop-shadow(0 0 ${intensity * 4}px #FF0000)
              drop-shadow(0 0 ${intensity * 8}px #FF0000)
              drop-shadow(0 0 ${intensity * 12}px #FF0000);
    `;
  }

  /**
   * Calculate optimal cell size for different screen sizes
   * Ensures good visibility on all devices in Reddit webview
   */
  calculateOptimalCellSize(
    gridSize: number,
    containerWidth: number,
    containerHeight: number,
    isMobile: boolean
  ): number {
    const padding = isMobile ? 20 : 40;
    const availableWidth = containerWidth - padding;
    const availableHeight = containerHeight - padding;

    // Calculate cell size based on available space
    const maxCellWidth = Math.floor(availableWidth / gridSize);
    const maxCellHeight = Math.floor(availableHeight / gridSize);

    // Use the smaller dimension to ensure grid fits
    const cellSize = Math.min(maxCellWidth, maxCellHeight);

    // Set reasonable bounds
    const minSize = isMobile ? 25 : 30;
    const maxSize = isMobile ? 50 : 80;

    return Math.max(minSize, Math.min(maxSize, cellSize));
  }
}
