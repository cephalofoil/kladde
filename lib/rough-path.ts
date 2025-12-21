/**
 * Utility for creating hand-drawn style SVG paths
 * Inspired by Excalidraw's rough sketchy aesthetic
 */

export interface Point {
  x: number;
  y: number;
}

export interface PathOptions {
  roughness?: number; // 0-2, controls how sketchy the line is (default: 1)
  bowing?: number; // 0-10, controls curve deviation (default: 1)
  seed?: number; // Random seed for consistent randomness
  controlPointOffset?: { x: number; y: number }; // Offset for middle waypoint
}

/**
 * Generates a random number with optional seed for consistency
 */
function random(seed?: number): number {
  if (seed !== undefined) {
    // Simple seeded random using sine
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }
  return Math.random();
}

/**
 * Adds controlled randomness to a value based on roughness
 */
function offset(
  min: number,
  max: number,
  roughness: number,
  seed?: number
): number {
  const range = max - min;
  return min + random(seed) * range * roughness;
}

/**
 * Creates a hand-drawn bezier curve between two points
 * Returns an SVG path string with slight variations for organic feel
 */
export function createHandDrawnCurve(
  start: Point,
  end: Point,
  options: PathOptions = {}
): string {
  const { roughness = 1, bowing = 1, seed } = options;

  // Calculate distance and angle
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // No curve needed for very short distances
  if (distance < 10) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  // Calculate control points for bezier curve
  // We use two control points for a cubic bezier (C command)
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  // Perpendicular vector for bowing
  const perpX = -dy / distance;
  const perpY = dx / distance;

  // Control point 1 (1/3 along the path)
  const cp1X = start.x + dx * 0.33 + offset(-5, 5, roughness, seed) + perpX * distance * bowing * 0.1;
  const cp1Y = start.y + dy * 0.33 + offset(-5, 5, roughness, seed ? seed + 1 : undefined) + perpY * distance * bowing * 0.1;

  // Control point 2 (2/3 along the path)
  const cp2X = start.x + dx * 0.67 + offset(-5, 5, roughness, seed ? seed + 2 : undefined) - perpX * distance * bowing * 0.1;
  const cp2Y = start.y + dy * 0.67 + offset(-5, 5, roughness, seed ? seed + 3 : undefined) - perpY * distance * bowing * 0.1;

  // Add slight randomness to endpoints for hand-drawn feel
  const startX = start.x + offset(-0.5, 0.5, roughness * 0.5, seed ? seed + 4 : undefined);
  const startY = start.y + offset(-0.5, 0.5, roughness * 0.5, seed ? seed + 5 : undefined);
  const endX = end.x + offset(-0.5, 0.5, roughness * 0.5, seed ? seed + 6 : undefined);
  const endY = end.y + offset(-0.5, 0.5, roughness * 0.5, seed ? seed + 7 : undefined);

  // Create cubic bezier curve
  return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
}

/**
 * Creates a hand-drawn path with multiple segments for a more sketchy effect
 * This creates a "double-line" effect similar to Excalidraw
 */
export function createRoughPath(
  start: Point,
  end: Point,
  options: PathOptions = {}
): string[] {
  const { roughness = 1, seed } = options;

  // Create primary path
  const primaryPath = createHandDrawnCurve(start, end, {
    ...options,
    seed: seed,
  });

  // For higher roughness, add a second slightly offset path for sketchy effect
  if (roughness > 0.5) {
    const secondaryPath = createHandDrawnCurve(start, end, {
      ...options,
      roughness: roughness * 0.7,
      bowing: (options.bowing || 1) * 0.8,
      seed: seed ? seed + 100 : undefined,
    });
    return [primaryPath, secondaryPath];
  }

  return [primaryPath];
}

/**
 * Creates an L-shaped path (orthogonal) with hand-drawn style
 * Properly routes around tiles based on start and end directions
 * Returns both the path data and the middle control point position
 */
export function createHandDrawnOrthogonalPath(
  start: Point,
  end: Point,
  startDirection: "top" | "right" | "bottom" | "left",
  endDirection: "top" | "right" | "bottom" | "left",
  options: PathOptions = {}
): { pathData: string; controlPoint: Point } {
  const { roughness = 1, seed, controlPointOffset } = options;
  const offset = 30; // Distance to extend from tile edge before turning

  // Determine routing waypoints based on start and end directions
  let waypoints: Point[] = [start];

  // Calculate routing based on directions to avoid going through tiles
  if (startDirection === "right" && endDirection === "left") {
    const midX = Math.max(start.x + offset, (start.x + end.x) / 2);
    waypoints.push({ x: midX, y: start.y });
    waypoints.push({ x: midX, y: end.y });
  } else if (startDirection === "left" && endDirection === "right") {
    const midX = Math.min(start.x - offset, (start.x + end.x) / 2);
    waypoints.push({ x: midX, y: start.y });
    waypoints.push({ x: midX, y: end.y });
  } else if (startDirection === "bottom" && endDirection === "top") {
    const midY = Math.max(start.y + offset, (start.y + end.y) / 2);
    waypoints.push({ x: start.x, y: midY });
    waypoints.push({ x: end.x, y: midY });
  } else if (startDirection === "top" && endDirection === "bottom") {
    const midY = Math.min(start.y - offset, (start.y + end.y) / 2);
    waypoints.push({ x: start.x, y: midY });
    waypoints.push({ x: end.x, y: midY });
  } else {
    // Mixed directions - route with two segments
    if (startDirection === "right" || startDirection === "left") {
      const extendX = startDirection === "right" ? start.x + offset : start.x - offset;
      waypoints.push({ x: extendX, y: start.y });
      waypoints.push({ x: extendX, y: end.y });
    } else {
      // top or bottom
      const extendY = startDirection === "bottom" ? start.y + offset : start.y - offset;
      waypoints.push({ x: start.x, y: extendY });
      waypoints.push({ x: end.x, y: extendY });
    }
  }

  waypoints.push(end);

  // Calculate the middle waypoint position (typically waypoint 1 or the bend point)
  const middleWaypointIndex = Math.floor(waypoints.length / 2);
  let controlPoint = waypoints[middleWaypointIndex];

  // Apply control point offset if provided
  if (controlPointOffset) {
    controlPoint = {
      x: controlPoint.x + controlPointOffset.x,
      y: controlPoint.y + controlPointOffset.y,
    };
    // Also adjust the waypoint in the path
    waypoints[middleWaypointIndex] = controlPoint;
  }

  // Create hand-drawn curves between each waypoint
  let pathData = "";
  for (let i = 0; i < waypoints.length - 1; i++) {
    const segmentPath = createHandDrawnCurve(waypoints[i], waypoints[i + 1], {
      ...options,
      roughness: roughness * 0.6, // Less rough for orthogonal segments
      bowing: 0.2, // Minimal bowing for straighter orthogonal paths
      seed: seed ? seed + i * 10 : undefined,
    });

    if (i === 0) {
      pathData = segmentPath;
    } else {
      // Append the segment (skip the M command)
      const pathWithoutMove = segmentPath.replace(/^M[^C]+/, "");
      pathData += " " + pathWithoutMove;
    }
  }

  return { pathData, controlPoint };
}

/**
 * Creates a smooth bezier curve (non-rough) for comparison
 */
export function createSmoothCurve(start: Point, end: Point): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 10) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  // Calculate control points for smooth S-curve
  const cp1X = start.x + dx * 0.4;
  const cp1Y = start.y + dy * 0.1;
  const cp2X = start.x + dx * 0.6;
  const cp2Y = start.y + dy * 0.9;

  return `M ${start.x} ${start.y} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${end.x} ${end.y}`;
}

/**
 * Creates a straight line (direct line, no routing)
 */
export function createStraightLine(start: Point, end: Point): string {
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

/**
 * Creates a clean orthogonal path (90-degree angles, no hand-drawn style)
 * Similar to draw.io routing
 */
export function createOrthogonalPath(
  start: Point,
  end: Point,
  startDirection: "top" | "right" | "bottom" | "left",
  endDirection: "top" | "right" | "bottom" | "left",
  options: PathOptions = {}
): { pathData: string; controlPoint: Point } {
  const { controlPointOffset } = options;
  const offset = 30; // Distance to extend from tile edge before turning

  // Determine routing waypoints based on start and end directions
  let waypoints: Point[] = [start];

  // Calculate routing based on directions to avoid going through tiles
  if (startDirection === "right" && endDirection === "left") {
    const midX = Math.max(start.x + offset, (start.x + end.x) / 2);
    waypoints.push({ x: midX, y: start.y });
    waypoints.push({ x: midX, y: end.y });
  } else if (startDirection === "left" && endDirection === "right") {
    const midX = Math.min(start.x - offset, (start.x + end.x) / 2);
    waypoints.push({ x: midX, y: start.y });
    waypoints.push({ x: midX, y: end.y });
  } else if (startDirection === "bottom" && endDirection === "top") {
    const midY = Math.max(start.y + offset, (start.y + end.y) / 2);
    waypoints.push({ x: start.x, y: midY });
    waypoints.push({ x: end.x, y: midY });
  } else if (startDirection === "top" && endDirection === "bottom") {
    const midY = Math.min(start.y - offset, (start.y + end.y) / 2);
    waypoints.push({ x: start.x, y: midY });
    waypoints.push({ x: end.x, y: midY });
  } else {
    // Mixed directions - route with two segments
    if (startDirection === "right" || startDirection === "left") {
      const extendX = startDirection === "right" ? start.x + offset : start.x - offset;
      waypoints.push({ x: extendX, y: start.y });
      waypoints.push({ x: extendX, y: end.y });
    } else {
      // top or bottom
      const extendY = startDirection === "bottom" ? start.y + offset : start.y - offset;
      waypoints.push({ x: start.x, y: extendY });
      waypoints.push({ x: end.x, y: extendY });
    }
  }

  waypoints.push(end);

  // Calculate the middle waypoint position
  const middleWaypointIndex = Math.floor(waypoints.length / 2);
  let controlPoint = waypoints[middleWaypointIndex];

  // Apply control point offset if provided (maintaining orthogonal angles)
  if (controlPointOffset) {
    controlPoint = {
      x: controlPoint.x + controlPointOffset.x,
      y: controlPoint.y + controlPointOffset.y,
    };
    waypoints[middleWaypointIndex] = controlPoint;
  }

  // Create clean straight lines between waypoints
  let pathData = `M ${waypoints[0].x} ${waypoints[0].y}`;
  for (let i = 1; i < waypoints.length; i++) {
    pathData += ` L ${waypoints[i].x} ${waypoints[i].y}`;
  }

  return { pathData, controlPoint };
}
