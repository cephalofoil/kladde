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
  targetPoint: Point
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
  snapDistance: number
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
        cursorPoint.y - snapPoint.point.y
      );

      if (dist < minDistance) {
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
        cursorPoint.y - edgeSnap.point.y
      );

      // For edge snapping, use a slightly larger threshold
      if (dist < snapDistance * 1.2) {
        // Prefer corner/midpoint snaps over edge snaps
        const preferredSnapPoints = snapPoints.filter(
          (sp) =>
            Math.hypot(
              cursorPoint.x - sp.point.x,
              cursorPoint.y - sp.point.y
            ) < snapDistance
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
