import type { BoardElement, Point } from "@/lib/board-types";
import type { BoundingBox } from "../types";
import { getBoundingBox } from "../shapes";
import { rotatePoint, getBoundsCenter } from "../geometry";

export interface SnapPoint {
  point: Point;
  type: "corner" | "edge-mid";
  position: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
}

export interface SnapTarget {
  elementId: string;
  snapPoint: SnapPoint;
  distance: number;
}

/**
 * Check if a line segment intersects with a bounding box
 */
function lineIntersectsBox(
  lineStart: Point,
  lineEnd: Point,
  box: BoundingBox,
  margin = 0,
): boolean {
  const x1 = box.x - margin;
  const y1 = box.y - margin;
  const x2 = box.x + box.width + margin;
  const y2 = box.y + box.height + margin;

  // Check if either endpoint is inside the box
  const startInside =
    lineStart.x >= x1 &&
    lineStart.x <= x2 &&
    lineStart.y >= y1 &&
    lineStart.y <= y2;
  const endInside =
    lineEnd.x >= x1 && lineEnd.x <= x2 && lineEnd.y >= y1 && lineEnd.y <= y2;

  if (startInside || endInside) return true;

  // Check line-box intersection using separating axis theorem
  // Check if line intersects any of the 4 box edges
  const edges = [
    { p1: { x: x1, y: y1 }, p2: { x: x2, y: y1 } }, // top
    { p1: { x: x2, y: y1 }, p2: { x: x2, y: y2 } }, // right
    { p1: { x: x2, y: y2 }, p2: { x: x1, y: y2 } }, // bottom
    { p1: { x: x1, y: y2 }, p2: { x: x1, y: y1 } }, // left
  ];

  for (const edge of edges) {
    if (lineSegmentsIntersect(lineStart, lineEnd, edge.p1, edge.p2)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if two line segments intersect
 */
function lineSegmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
): boolean {
  const ccw = (a: Point, b: Point, c: Point) =>
    (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);

  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

/**
 * Check if the snap point is accessible without the line going through the target shape
 * The snap point should be on the edge/corner, not requiring the line to pass through the interior
 */
export function isSnapPointAccessible(
  start: Point,
  snapPoint: Point,
  targetElementId: string,
  elements: BoardElement[],
): boolean {
  const targetElement = elements.find((el) => el.id === targetElementId);
  if (!targetElement) return true;

  const bounds = getBoundingBox(targetElement);
  if (!bounds) return true;

  // Add a small margin around the bounding box
  const margin = 5;
  const expandedBounds = {
    x: bounds.x - margin,
    y: bounds.y - margin,
    width: bounds.width + margin * 2,
    height: bounds.height + margin * 2,
  };

  // Check if the line from start to snapPoint intersects the target shape's interior
  // We shrink the bounds to represent the interior (not the edges)
  const interiorBounds = {
    x: bounds.x + margin,
    y: bounds.y + margin,
    width: bounds.width - margin * 2,
    height: bounds.height - margin * 2,
  };

  // If the bounds are too small after shrinking, allow the snap
  if (interiorBounds.width <= 0 || interiorBounds.height <= 0) {
    return true;
  }

  // Check if the line intersects the interior (not just the edges)
  return !lineIntersectsBox(start, snapPoint, interiorBounds, 0);
}

/**
 * Check if there's a clear line of sight between two points (no shapes blocking)
 * Used for elbow routing to check if direct path is clear
 */
function hasLineOfSight(
  start: Point,
  end: Point,
  elements: BoardElement[],
  excludeElementId: string | null,
  targetElementId: string | null,
): boolean {
  for (const element of elements) {
    // Skip the element being dragged and the target element
    if (element.id === excludeElementId || element.id === targetElementId) {
      continue;
    }

    // Only check collision with solid shapes
    if (
      element.type === "line" ||
      element.type === "arrow" ||
      element.type === "pen" ||
      element.type === "laser"
    ) {
      continue;
    }

    const bounds = getBoundingBox(element);
    if (!bounds) continue;

    // Check if line intersects this element's bounding box
    if (lineIntersectsBox(start, end, bounds, 2)) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate all snap points for an element (corners + edge midpoints)
 */
export function getElementSnapPoints(element: BoardElement): SnapPoint[] {
  // Only snap to shapes and tiles, not lines/arrows/pen/laser
  if (
    element.type === "line" ||
    element.type === "arrow" ||
    element.type === "pen" ||
    element.type === "laser"
  ) {
    return [];
  }

  const bounds = getBoundingBox(element);
  if (!bounds) return [];

  const rotationDeg = element.rotation ?? 0;
  const center = getBoundsCenter(bounds);

  const localPoints: SnapPoint[] = [
    // Corners
    {
      point: { x: bounds.x, y: bounds.y },
      type: "corner",
      position: "nw",
    },
    {
      point: { x: bounds.x + bounds.width, y: bounds.y },
      type: "corner",
      position: "ne",
    },
    {
      point: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      type: "corner",
      position: "se",
    },
    {
      point: { x: bounds.x, y: bounds.y + bounds.height },
      type: "corner",
      position: "sw",
    },
    // Edge midpoints
    {
      point: { x: bounds.x + bounds.width / 2, y: bounds.y },
      type: "edge-mid",
      position: "n",
    },
    {
      point: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
      type: "edge-mid",
      position: "e",
    },
    {
      point: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
      type: "edge-mid",
      position: "s",
    },
    {
      point: { x: bounds.x, y: bounds.y + bounds.height / 2 },
      type: "edge-mid",
      position: "w",
    },
  ];

  // Apply rotation if element is rotated
  if (rotationDeg) {
    return localPoints.map((sp) => ({
      ...sp,
      point: rotatePoint(sp.point, center, rotationDeg),
    }));
  }

  return localPoints;
}

/**
 * Calculate snap point on an element's edge at the nearest position to a given point
 */
export function getEdgeSnapPoint(
  element: BoardElement,
  targetPoint: Point,
): SnapPoint | null {
  const bounds = getBoundingBox(element);
  if (!bounds) return null;

  const rotationDeg = element.rotation ?? 0;
  const center = getBoundsCenter(bounds);

  // Convert target point to local space if element is rotated
  const localTarget = rotationDeg
    ? rotatePoint(targetPoint, center, -rotationDeg)
    : targetPoint;

  // Find closest point on bounding box edges
  const { x, y, width, height } = bounds;
  const right = x + width;
  const bottom = y + height;

  // Calculate distance to each edge
  const distToTop = Math.abs(localTarget.y - y);
  const distToBottom = Math.abs(localTarget.y - bottom);
  const distToLeft = Math.abs(localTarget.x - x);
  const distToRight = Math.abs(localTarget.x - right);

  const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);

  let edgePoint: Point;
  let position: SnapPoint["position"];

  if (minDist === distToTop && localTarget.y <= center.y) {
    // Top edge
    edgePoint = {
      x: Math.max(x, Math.min(right, localTarget.x)),
      y: y,
    };
    position = "n";
  } else if (minDist === distToBottom && localTarget.y > center.y) {
    // Bottom edge
    edgePoint = {
      x: Math.max(x, Math.min(right, localTarget.x)),
      y: bottom,
    };
    position = "s";
  } else if (minDist === distToLeft && localTarget.x <= center.x) {
    // Left edge
    edgePoint = {
      x: x,
      y: Math.max(y, Math.min(bottom, localTarget.y)),
    };
    position = "w";
  } else {
    // Right edge
    edgePoint = {
      x: right,
      y: Math.max(y, Math.min(bottom, localTarget.y)),
    };
    position = "e";
  }

  // Rotate back to world space if needed
  const worldPoint = rotationDeg
    ? rotatePoint(edgePoint, center, rotationDeg)
    : edgePoint;

  return {
    point: worldPoint,
    type: "edge-mid",
    position,
  };
}

/**
 * Find the nearest snap target within snap distance
 */
export function findNearestSnapTarget(
  cursorPoint: Point,
  elements: BoardElement[],
  excludeElementId: string | null,
  snapDistance: number,
  connectorStyle: "sharp" | "curved" | "elbow",
  otherEndpoint?: Point,
): SnapTarget | null {
  let nearestTarget: SnapTarget | null = null;
  let minDistance = snapDistance;

  for (const element of elements) {
    // Skip the element being dragged or elements that can't be snap targets
    if (element.id === excludeElementId) continue;
    if (
      element.type === "line" ||
      element.type === "arrow" ||
      element.type === "pen" ||
      element.type === "laser"
    ) {
      continue;
    }

    // Get all snap points for this element
    const snapPoints = getElementSnapPoints(element);

    for (const snapPoint of snapPoints) {
      const dist = Math.hypot(
        cursorPoint.x - snapPoint.point.x,
        cursorPoint.y - snapPoint.point.y,
      );

      if (dist < minDistance) {
        // For curved and sharp modes, check if snap point is accessible
        if (
          (connectorStyle === "curved" || connectorStyle === "sharp") &&
          otherEndpoint
        ) {
          // Check if the snap point can be reached without going through the target shape
          if (
            !isSnapPointAccessible(
              otherEndpoint,
              snapPoint.point,
              element.id,
              elements,
            )
          ) {
            // Snap point not accessible (would go through shape interior), skip it
            continue;
          }
        }

        minDistance = dist;
        nearestTarget = {
          elementId: element.id,
          snapPoint,
          distance: dist,
        };
      }
    }

    // Also check edge snapping (for free sliding along edges)
    const edgeSnap = getEdgeSnapPoint(element, cursorPoint);
    if (edgeSnap) {
      const dist = Math.hypot(
        cursorPoint.x - edgeSnap.point.x,
        cursorPoint.y - edgeSnap.point.y,
      );

      // For edge snapping, use a slightly larger threshold
      if (dist < snapDistance * 1.2) {
        // Prefer corner/midpoint snaps over edge snaps
        const preferredSnapPoints = snapPoints.filter(
          (sp) =>
            Math.hypot(cursorPoint.x - sp.point.x, cursorPoint.y - sp.point.y) <
            snapDistance,
        );

        if (preferredSnapPoints.length === 0 && dist < minDistance) {
          minDistance = dist;
          nearestTarget = {
            elementId: element.id,
            snapPoint: edgeSnap,
            distance: dist,
          };
        }
      }
    }
  }

  return nearestTarget;
}

/**
 * Generate elbow routing points that go around obstacles
 * Simple algorithm: try to route around the bounding box of blocking elements
 */
export function generateElbowRouteAroundObstacles(
  start: Point,
  end: Point,
  elements: BoardElement[],
  excludeElementId: string | null,
  targetElementId: string | null,
): Point[] {
  // Check if direct path is clear
  if (hasLineOfSight(start, end, elements, excludeElementId, targetElementId)) {
    // Direct path is clear, use simple elbow
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);

    if (dx > dy) {
      // Horizontal-first routing
      return [start, { x: end.x, y: start.y }, end];
    } else {
      // Vertical-first routing
      return [start, { x: start.x, y: end.y }, end];
    }
  }

  // Find blocking elements
  const blockingElements: BoundingBox[] = [];
  for (const element of elements) {
    if (element.id === excludeElementId || element.id === targetElementId) {
      continue;
    }
    if (
      element.type === "line" ||
      element.type === "arrow" ||
      element.type === "pen" ||
      element.type === "laser"
    ) {
      continue;
    }

    const bounds = getBoundingBox(element);
    if (!bounds) continue;

    // Add margin around obstacles
    const margin = 10;
    blockingElements.push({
      x: bounds.x - margin,
      y: bounds.y - margin,
      width: bounds.width + margin * 2,
      height: bounds.height + margin * 2,
    });
  }

  // Simple routing: go around the nearest obstacle
  // Find the obstacle that's most in the way
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  let nearestObstacle: BoundingBox | null = null;
  let minDistToMid = Infinity;

  for (const obstacle of blockingElements) {
    const obstacleCenter = {
      x: obstacle.x + obstacle.width / 2,
      y: obstacle.y + obstacle.height / 2,
    };
    const dist = Math.hypot(obstacleCenter.x - midX, obstacleCenter.y - midY);

    if (dist < minDistToMid) {
      minDistToMid = dist;
      nearestObstacle = obstacle;
    }
  }

  if (!nearestObstacle) {
    // No obstacles found, return simple path
    return [start, { x: end.x, y: start.y }, end];
  }

  // Route around the obstacle
  // Determine which side to route around based on start/end positions
  const obs = nearestObstacle;
  const goRight = start.x < obs.x && end.x > obs.x + obs.width;
  const goLeft = start.x > obs.x + obs.width && end.x < obs.x;
  const goDown = start.y < obs.y && end.y > obs.y + obs.height;
  const goUp = start.y > obs.y + obs.height && end.y < obs.y;

  if (goRight || goLeft) {
    // Route horizontally around
    if (Math.abs(start.y - end.y) < obs.height / 2) {
      // Route above or below the obstacle
      const routeAbove = start.y < obs.y;
      const routeY = routeAbove ? obs.y : obs.y + obs.height;

      return [
        start,
        { x: start.x, y: routeY },
        { x: end.x, y: routeY },
        { x: end.x, y: end.y },
        end,
      ];
    }
  }

  if (goDown || goUp) {
    // Route vertically around
    if (Math.abs(start.x - end.x) < obs.width / 2) {
      // Route left or right of the obstacle
      const routeLeft = start.x < obs.x;
      const routeX = routeLeft ? obs.x : obs.x + obs.width;

      return [
        start,
        { x: routeX, y: start.y },
        { x: routeX, y: end.y },
        { x: end.x, y: end.y },
        end,
      ];
    }
  }

  // Default: try to route around closest corner
  const corners = [
    { x: obs.x, y: obs.y }, // top-left
    { x: obs.x + obs.width, y: obs.y }, // top-right
    { x: obs.x + obs.width, y: obs.y + obs.height }, // bottom-right
    { x: obs.x, y: obs.y + obs.height }, // bottom-left
  ];

  let bestCorner = corners[0];
  let bestDist = Infinity;

  for (const corner of corners) {
    const dist =
      Math.hypot(start.x - corner.x, start.y - corner.y) +
      Math.hypot(end.x - corner.x, end.y - corner.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestCorner = corner;
    }
  }

  return [
    start,
    { x: start.x, y: bestCorner.y },
    bestCorner,
    { x: bestCorner.x, y: end.y },
    end,
  ];
}
