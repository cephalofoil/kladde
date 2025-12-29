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
    /** True if the snap point is not directly accessible (line of sight blocked) */
    outOfLineOfSight?: boolean;
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
        lineEnd.x >= x1 &&
        lineEnd.x <= x2 &&
        lineEnd.y >= y1 &&
        lineEnd.y <= y2;

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
        ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
        ccw(p1, p2, p3) !== ccw(p1, p2, p4)
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
            point: {
                x: bounds.x + bounds.width,
                y: bounds.y + bounds.height / 2,
            },
            type: "edge-mid",
            position: "e",
        },
        {
            point: {
                x: bounds.x + bounds.width / 2,
                y: bounds.y + bounds.height,
            },
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
                // Check if snap point is accessible (line of sight)
                let outOfLineOfSight = false;
                if (connectorStyle === "sharp" && otherEndpoint) {
                    // Check if the snap point can be reached without going through the target shape
                    if (
                        !isSnapPointAccessible(
                            otherEndpoint,
                            snapPoint.point,
                            element.id,
                            elements,
                        )
                    ) {
                        // Snap point not directly accessible - flag it but don't skip
                        outOfLineOfSight = true;
                    }
                }

                minDistance = dist;
                nearestTarget = {
                    elementId: element.id,
                    snapPoint,
                    distance: dist,
                    outOfLineOfSight,
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
                        Math.hypot(
                            cursorPoint.x - sp.point.x,
                            cursorPoint.y - sp.point.y,
                        ) < snapDistance,
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
 * Check if a polyline path intersects any obstacles
 */
function pathIntersectsObstacles(
    path: Point[],
    obstacles: BoundingBox[],
): boolean {
    for (let i = 0; i < path.length - 1; i++) {
        const segStart = path[i];
        const segEnd = path[i + 1];
        for (const obs of obstacles) {
            if (lineIntersectsBox(segStart, segEnd, obs, 0)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Determine which side of a shape a point is snapped to (or nearest to)
 * Returns: 'top', 'bottom', 'left', 'right', or null if point is inside
 */
function getSnapSide(
    point: Point,
    bounds: BoundingBox,
): "top" | "bottom" | "left" | "right" | null {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    // Check if point is on or near an edge
    const onTop = Math.abs(point.y - bounds.y) < 5;
    const onBottom = Math.abs(point.y - (bounds.y + bounds.height)) < 5;
    const onLeft = Math.abs(point.x - bounds.x) < 5;
    const onRight = Math.abs(point.x - (bounds.x + bounds.width)) < 5;

    if (onTop) return "top";
    if (onBottom) return "bottom";
    if (onLeft) return "left";
    if (onRight) return "right";

    // Determine based on relative position
    const dx = point.x - centerX;
    const dy = point.y - centerY;

    if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? "right" : "left";
    } else {
        return dy > 0 ? "bottom" : "top";
    }
}

/**
 * Check if a simple L-path would pass through or along a shape's bounds.
 *
 * Path is [start, corner, end] where:
 * - start: the arrow's far endpoint (NOT on the shape)
 * - corner: the L-bend point
 * - end: the connection point ON the shape edge
 */
function pathPassesThroughBounds(
    path: Point[],
    bounds: BoundingBox,
    _margin: number,
): boolean {
    if (path.length < 3) return false;

    const corner = path[1];
    const end = path[2];

    // Check 1: Is the corner point inside the shape? That means we cut through.
    const cornerInside =
        corner.x > bounds.x &&
        corner.x < bounds.x + bounds.width &&
        corner.y > bounds.y &&
        corner.y < bounds.y + bounds.height;

    if (cornerInside) {
        console.log("BAD: corner inside", { corner, bounds });
        return true;
    }

    // Check 2: Does the last segment (corner → end) pass through the shape interior?
    // This segment goes from corner to the connection point on the shape edge.
    // If the corner is outside but the segment has to cross through the shape to reach
    // the connection point, that's bad.

    // Check if the last segment passes through the shape's interior
    // The segment is from corner to end. end is ON the shape edge.
    // If corner is outside but the line to end crosses through the interior, that's bad.

    const isHorizontal = Math.abs(corner.y - end.y) < 1;
    const isVertical = Math.abs(corner.x - end.x) < 1;

    if (isVertical) {
        // Vertical segment from corner to end (same X, different Y)
        // Check if this vertical line at corner.x passes through the shape
        const withinX =
            corner.x > bounds.x && corner.x < bounds.x + bounds.width;
        if (withinX) {
            // The vertical line is within the shape's x-range
            // Check if it passes through the shape's y-range
            const minY = Math.min(corner.y, end.y);
            const maxY = Math.max(corner.y, end.y);
            // If the segment spans across the shape's top edge, it passes through
            if (minY < bounds.y && maxY > bounds.y + 5) {
                console.log("BAD: vertical segment passes through shape", {
                    corner,
                    end,
                    bounds,
                });
                return true;
            }
            // If the segment spans across the shape's bottom edge from below
            if (
                minY < bounds.y + bounds.height - 5 &&
                maxY > bounds.y + bounds.height
            ) {
                console.log(
                    "BAD: vertical segment passes through shape from bottom",
                    {
                        corner,
                        end,
                        bounds,
                    },
                );
                return true;
            }
        }

        // Check if vertical segment rides along left or right edge
        const onLeftEdge = Math.abs(corner.x - bounds.x) < 3;
        const onRightEdge = Math.abs(corner.x - (bounds.x + bounds.width)) < 3;
        if (onLeftEdge || onRightEdge) {
            // Check if the segment overlaps with the shape's height
            const minY = Math.min(corner.y, end.y);
            const maxY = Math.max(corner.y, end.y);
            if (minY < bounds.y + bounds.height && maxY > bounds.y) {
                console.log("BAD: vertical segment rides along edge", {
                    corner,
                    end,
                    bounds,
                    onLeftEdge,
                    onRightEdge,
                });
                return true;
            }
        }
    } else if (isHorizontal) {
        // Horizontal segment from corner to end (same Y, different X)
        const withinY =
            corner.y > bounds.y && corner.y < bounds.y + bounds.height;
        if (withinY) {
            // The horizontal line is within the shape's y-range
            const minX = Math.min(corner.x, end.x);
            const maxX = Math.max(corner.x, end.x);
            // If the segment spans across the shape's left edge, it passes through
            if (minX < bounds.x && maxX > bounds.x + 5) {
                console.log("BAD: horizontal segment passes through shape", {
                    corner,
                    end,
                    bounds,
                });
                return true;
            }
            // If the segment spans across the shape's right edge
            if (
                minX < bounds.x + bounds.width - 5 &&
                maxX > bounds.x + bounds.width
            ) {
                console.log(
                    "BAD: horizontal segment passes through shape from right",
                    {
                        corner,
                        end,
                        bounds,
                    },
                );
                return true;
            }
        }

        // Check if horizontal segment rides along top or bottom edge
        const onTopEdge = Math.abs(corner.y - bounds.y) < 3;
        const onBottomEdge =
            Math.abs(corner.y - (bounds.y + bounds.height)) < 3;
        if (onTopEdge || onBottomEdge) {
            // Check if the segment overlaps with the shape's width
            const minX = Math.min(corner.x, end.x);
            const maxX = Math.max(corner.x, end.x);
            if (minX < bounds.x + bounds.width && maxX > bounds.x) {
                console.log("BAD: horizontal segment rides along edge", {
                    corner,
                    end,
                    bounds,
                    onTopEdge,
                    onBottomEdge,
                });
                return true;
            }
        }
    }

    // Check 3: Does the first segment (start → corner) pass through the shape?
    // Only check this if the corner is NOT already adjacent to the shape
    const start = path[0];
    const cornerNearShape =
        Math.abs(corner.x - bounds.x) < 5 ||
        Math.abs(corner.x - (bounds.x + bounds.width)) < 5 ||
        Math.abs(corner.y - bounds.y) < 5 ||
        Math.abs(corner.y - (bounds.y + bounds.height)) < 5;

    if (!cornerNearShape) {
        // Corner is not near the shape, check if the first segment crosses through
        // Use a slightly shrunk bounds to avoid edge false positives
        const shrunk = {
            x: bounds.x + 3,
            y: bounds.y + 3,
            width: bounds.width - 6,
            height: bounds.height - 6,
        };
        if (shrunk.width > 0 && shrunk.height > 0) {
            if (lineIntersectsBox(start, corner, shrunk, 0)) {
                console.log("BAD: first segment through shape", {
                    start,
                    corner,
                    shrunk,
                });
                return true;
            }
        }
    }

    console.log("OK: path is valid", {
        start: { x: Math.round(path[0].x), y: Math.round(path[0].y) },
        corner: { x: Math.round(corner.x), y: Math.round(corner.y) },
        end: { x: Math.round(end.x), y: Math.round(end.y) },
        bounds: {
            x: Math.round(bounds.x),
            y: Math.round(bounds.y),
            right: Math.round(bounds.x + bounds.width),
            bottom: Math.round(bounds.y + bounds.height),
        },
    });
    return false;
}

/**
 * Generate elbow routing points that go around obstacles with proper spacing.
 * The algorithm ensures arrows don't ride along shape edges but maintain
 * a clear margin/spacing from all obstacles.
 *
 * IMPORTANT: The parameters are:
 * - start: The "other" endpoint (the one NOT being snapped)
 * - end: The snap point ON the target shape
 * - excludeElementId: The arrow element itself
 * - targetElementId: The shape being connected TO (where 'end' point is)
 */
export function generateElbowRouteAroundObstacles(
    start: Point,
    end: Point,
    elements: BoardElement[],
    excludeElementId: string | null,
    targetElementId: string | null,
): Point[] {
    const MARGIN = 80; // Spacing around obstacles

    // Get the target element bounds - this is the shape that 'end' point is ON
    let targetBounds: BoundingBox | null = null;
    if (targetElementId) {
        const targetEl = elements.find((el) => el.id === targetElementId);
        if (targetEl) {
            targetBounds = getBoundingBox(targetEl);
        }
    }

    // Collect all obstacle bounds with margin (excluding the arrow and target shape)
    const obstacles: BoundingBox[] = [];
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

        obstacles.push({
            x: bounds.x - MARGIN,
            y: bounds.y - MARGIN,
            width: bounds.width + MARGIN * 2,
            height: bounds.height + MARGIN * 2,
        });
    }

    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);

    // Simple paths for reference
    const hFirstPath = [start, { x: end.x, y: start.y }, end];
    const vFirstPath = [start, { x: start.x, y: end.y }, end];

    // IMPORTANT: If we're connecting TO a shape (targetBounds exists),
    // we MUST route around it - never allow paths that ride along or through it
    if (targetBounds) {
        // Check if simple paths would pass through the target shape
        const hFirstBad = pathPassesThroughBounds(hFirstPath, targetBounds, 2);
        const vFirstBad = pathPassesThroughBounds(vFirstPath, targetBounds, 2);

        // Also check other obstacles
        const hFirstObstacleClear =
            obstacles.length === 0 ||
            !pathIntersectsObstacles(hFirstPath, obstacles);
        const vFirstObstacleClear =
            obstacles.length === 0 ||
            !pathIntersectsObstacles(vFirstPath, obstacles);

        console.log("Route decision:", {
            hFirstBad,
            vFirstBad,
            hFirstObstacleClear,
            vFirstObstacleClear,
            dx,
            dy,
            obstacleCount: obstacles.length,
        });

        // Only use simple path if it doesn't pass through target AND is clear of obstacles
        if (!hFirstBad && hFirstObstacleClear && dx >= dy) {
            console.log("Using hFirstPath (simple)");
            return hFirstPath;
        }
        if (!vFirstBad && vFirstObstacleClear && dy > dx) {
            console.log("Using vFirstPath (simple)");
            return vFirstPath;
        }
        if (!hFirstBad && hFirstObstacleClear) {
            console.log("Using hFirstPath (fallback)");
            return hFirstPath;
        }
        if (!vFirstBad && vFirstObstacleClear) {
            console.log("Using vFirstPath (fallback)");
            return vFirstPath;
        }

        console.log("No simple path works, routing around...");

        // Need to route around the target shape
        // Determine which side of the target shape the END point is on (end is the snap point)
        const endSide = getSnapSide(end, targetBounds);

        // Calculate expanded bounds for routing around target
        const targetExpanded = {
            x: targetBounds.x - MARGIN,
            y: targetBounds.y - MARGIN,
            width: targetBounds.width + MARGIN * 2,
            height: targetBounds.height + MARGIN * 2,
        };

        if (endSide) {
            // Route based on which side of the target shape the endpoint is on
            // We need to approach from outside the expanded bounds
            switch (endSide) {
                case "left": {
                    // End point is on left side of target shape
                    // Arrow should approach from the left (outside the expanded bounds)
                    const approachX = targetExpanded.x;

                    if (start.y < targetExpanded.y) {
                        // Start is above - come down on the left side
                        return [
                            start,
                            { x: approachX, y: start.y },
                            { x: approachX, y: end.y },
                            end,
                        ];
                    } else if (
                        start.y >
                        targetExpanded.y + targetExpanded.height
                    ) {
                        // Start is below - come up on the left side
                        return [
                            start,
                            { x: approachX, y: start.y },
                            { x: approachX, y: end.y },
                            end,
                        ];
                    } else {
                        // Start is at same height range - need to go around
                        const goUp =
                            end.y <= targetBounds.y + targetBounds.height / 2;
                        const cornerY = goUp
                            ? targetExpanded.y
                            : targetExpanded.y + targetExpanded.height;
                        return [
                            start,
                            { x: start.x, y: cornerY },
                            { x: approachX, y: cornerY },
                            { x: approachX, y: end.y },
                            end,
                        ];
                    }
                }

                case "right": {
                    // End point is on right side of target shape
                    const approachX = targetExpanded.x + targetExpanded.width;

                    if (start.y < targetExpanded.y) {
                        return [
                            start,
                            { x: approachX, y: start.y },
                            { x: approachX, y: end.y },
                            end,
                        ];
                    } else if (
                        start.y >
                        targetExpanded.y + targetExpanded.height
                    ) {
                        return [
                            start,
                            { x: approachX, y: start.y },
                            { x: approachX, y: end.y },
                            end,
                        ];
                    } else {
                        const goUp =
                            end.y <= targetBounds.y + targetBounds.height / 2;
                        const cornerY = goUp
                            ? targetExpanded.y
                            : targetExpanded.y + targetExpanded.height;
                        return [
                            start,
                            { x: start.x, y: cornerY },
                            { x: approachX, y: cornerY },
                            { x: approachX, y: end.y },
                            end,
                        ];
                    }
                }

                case "top": {
                    // End point is on top of target shape
                    const approachY = targetExpanded.y;

                    if (start.x < targetExpanded.x) {
                        // Start is to the left - come across on top
                        return [
                            start,
                            { x: start.x, y: approachY },
                            { x: end.x, y: approachY },
                            end,
                        ];
                    } else if (
                        start.x >
                        targetExpanded.x + targetExpanded.width
                    ) {
                        // Start is to the right - come across on top
                        return [
                            start,
                            { x: start.x, y: approachY },
                            { x: end.x, y: approachY },
                            end,
                        ];
                    } else {
                        // Start is directly above/below - go around via left or right
                        const goLeft =
                            end.x <= targetBounds.x + targetBounds.width / 2;
                        const cornerX = goLeft
                            ? targetExpanded.x
                            : targetExpanded.x + targetExpanded.width;
                        return [
                            start,
                            { x: cornerX, y: start.y },
                            { x: cornerX, y: approachY },
                            { x: end.x, y: approachY },
                            end,
                        ];
                    }
                }

                case "bottom": {
                    // End point is on bottom of target shape
                    const approachY = targetExpanded.y + targetExpanded.height;

                    if (start.x < targetExpanded.x) {
                        return [
                            start,
                            { x: start.x, y: approachY },
                            { x: end.x, y: approachY },
                            end,
                        ];
                    } else if (
                        start.x >
                        targetExpanded.x + targetExpanded.width
                    ) {
                        return [
                            start,
                            { x: start.x, y: approachY },
                            { x: end.x, y: approachY },
                            end,
                        ];
                    } else {
                        const goLeft =
                            end.x <= targetBounds.x + targetBounds.width / 2;
                        const cornerX = goLeft
                            ? targetExpanded.x
                            : targetExpanded.x + targetExpanded.width;
                        return [
                            start,
                            { x: cornerX, y: start.y },
                            { x: cornerX, y: approachY },
                            { x: end.x, y: approachY },
                            end,
                        ];
                    }
                }
            }
        }
    }

    // No target shape to route around - check obstacles only
    const hFirstClear =
        obstacles.length === 0 ||
        !pathIntersectsObstacles(hFirstPath, obstacles);
    const vFirstClear =
        obstacles.length === 0 ||
        !pathIntersectsObstacles(vFirstPath, obstacles);

    if (hFirstClear && dx >= dy) {
        return hFirstPath;
    }
    if (vFirstClear && dy > dx) {
        return vFirstPath;
    }
    if (hFirstClear) {
        return hFirstPath;
    }
    if (vFirstClear) {
        return vFirstPath;
    }

    // Route around obstacles
    let blockingObstacle: BoundingBox | null = null;
    let minDist = Infinity;

    for (const obs of obstacles) {
        const obsCenter = {
            x: obs.x + obs.width / 2,
            y: obs.y + obs.height / 2,
        };
        const betweenX =
            obs.x <= Math.max(start.x, end.x) &&
            obs.x + obs.width >= Math.min(start.x, end.x);
        const betweenY =
            obs.y <= Math.max(start.y, end.y) &&
            obs.y + obs.height >= Math.min(start.y, end.y);

        if (betweenX && betweenY) {
            const dist = Math.hypot(
                obsCenter.x - (start.x + end.x) / 2,
                obsCenter.y - (start.y + end.y) / 2,
            );
            if (dist < minDist) {
                minDist = dist;
                blockingObstacle = obs;
            }
        }
    }

    if (!blockingObstacle) {
        return dx > dy ? hFirstPath : vFirstPath;
    }

    const obs = blockingObstacle;
    const corners = [
        { x: obs.x, y: obs.y },
        { x: obs.x + obs.width, y: obs.y },
        { x: obs.x + obs.width, y: obs.y + obs.height },
        { x: obs.x, y: obs.y + obs.height },
    ];

    const candidatePaths: { path: Point[]; dist: number }[] = [];

    for (const corner of corners) {
        const path1 = [
            start,
            { x: corner.x, y: start.y },
            corner,
            { x: corner.x, y: end.y },
            end,
        ];
        const path2 = [
            start,
            { x: start.x, y: corner.y },
            corner,
            { x: end.x, y: corner.y },
            end,
        ];

        const calcLen = (p: Point[]) => {
            let len = 0;
            for (let i = 0; i < p.length - 1; i++) {
                len +=
                    Math.abs(p[i + 1].x - p[i].x) +
                    Math.abs(p[i + 1].y - p[i].y);
            }
            return len;
        };

        if (!pathIntersectsObstacles(path1, obstacles)) {
            candidatePaths.push({ path: path1, dist: calcLen(path1) });
        }
        if (!pathIntersectsObstacles(path2, obstacles)) {
            candidatePaths.push({ path: path2, dist: calcLen(path2) });
        }
    }

    if (candidatePaths.length > 0) {
        candidatePaths.sort((a, b) => a.dist - b.dist);
        return candidatePaths[0].path;
    }

    // Last resort
    const obsCenter = {
        x: obs.x + obs.width / 2,
        y: obs.y + obs.height / 2,
    };

    if (start.y < obsCenter.y) {
        return [start, { x: start.x, y: obs.y }, { x: end.x, y: obs.y }, end];
    } else {
        return [
            start,
            { x: start.x, y: obs.y + obs.height },
            { x: end.x, y: obs.y + obs.height },
            end,
        ];
    }
}

/**
 * Generate a curved arrow path with a control point that routes around the target shape.
 * If existingPoints has a user-defined control point, preserve it and add routing points.
 * The control point is positioned to pull the curve away from the target shape
 * so the curve doesn't pass through it.
 */
export function generateCurvedRouteAroundObstacles(
    start: Point,
    end: Point,
    elements: BoardElement[],
    excludeElementId: string | null,
    targetElementId: string | null,
    existingPoints?: Point[],
): Point[] {
    const MARGIN = 80; // Spacing around obstacles for the control point
    const EDGE_OFFSET = 40; // Offset to avoid running along edges

    // Get the target element bounds
    let targetBounds: BoundingBox | null = null;
    if (targetElementId) {
        const targetEl = elements.find((el) => el.id === targetElementId);
        if (targetEl) {
            targetBounds = getBoundingBox(targetEl);
        }
    }

    // Check if there's an existing user-defined control point (3+ points means user moved it)
    const hasExistingCurve = existingPoints && existingPoints.length >= 3;
    const existingControlPoints = hasExistingCurve
        ? existingPoints.slice(1, existingPoints.length - 1)
        : [];

    // If no target bounds, just return a simple curved path with midpoint control
    if (!targetBounds) {
        if (hasExistingCurve) {
            // Preserve existing control points, just update start and end
            return [start, ...existingControlPoints, end];
        }
        return [
            start,
            { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
            end,
        ];
    }

    // Determine which side of the target shape the endpoint is on
    const endSide = getSnapSide(end, targetBounds);

    // Check if the midpoint of a straight line would be inside the shape
    // If so, we need to route around
    const midPoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const midInsideShape =
        midPoint.x > targetBounds.x &&
        midPoint.x < targetBounds.x + targetBounds.width &&
        midPoint.y > targetBounds.y &&
        midPoint.y < targetBounds.y + targetBounds.height;

    // Also check if the line from start to end intersects the shape
    // by checking multiple points along the line
    let lineIntersectsShape = midInsideShape;
    if (!lineIntersectsShape) {
        for (let t = 0.2; t <= 0.8; t += 0.2) {
            const testPoint = {
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t,
            };
            if (
                testPoint.x > targetBounds.x &&
                testPoint.x < targetBounds.x + targetBounds.width &&
                testPoint.y > targetBounds.y &&
                testPoint.y < targetBounds.y + targetBounds.height
            ) {
                lineIntersectsShape = true;
                break;
            }
        }
    }

    // If line doesn't intersect (line of sight), use a curve with offset to avoid edge
    if (!lineIntersectsShape) {
        if (hasExistingCurve) {
            // Preserve existing control points
            return [start, ...existingControlPoints, end];
        }

        // Calculate an offset midpoint that curves away from the shape
        const shapeCenter = {
            x: targetBounds.x + targetBounds.width / 2,
            y: targetBounds.y + targetBounds.height / 2,
        };

        // Offset perpendicular to the line, away from the shape center
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.hypot(dx, dy) || 1;
        // Perpendicular vector (normalized)
        const perpX = -dy / len;
        const perpY = dx / len;

        // Determine which side of the line the shape center is on
        // and offset to the opposite side
        const crossProduct =
            dx * (shapeCenter.y - start.y) - dy * (shapeCenter.x - start.x);
        const offsetDir = crossProduct > 0 ? -1 : 1;

        // Calculate distance from midpoint to closest shape edge
        const distToShape = Math.min(
            Math.abs(midPoint.x - targetBounds.x),
            Math.abs(midPoint.x - (targetBounds.x + targetBounds.width)),
            Math.abs(midPoint.y - targetBounds.y),
            Math.abs(midPoint.y - (targetBounds.y + targetBounds.height)),
        );

        // Offset needs to be larger than distance to shape, plus margin
        // For a quadratic bezier, the curve gets closest to the control point at t=0.5
        // but only reaches about 50% of the way to it, so we need 2x the desired clearance
        const requiredOffset = Math.max(
            EDGE_OFFSET,
            (distToShape + EDGE_OFFSET) * 2,
        );

        const offsetMidPoint = {
            x: midPoint.x + perpX * requiredOffset * offsetDir,
            y: midPoint.y + perpY * requiredOffset * offsetDir,
        };

        return [start, offsetMidPoint, end];
    }

    // Need to route around - use two control points to ensure curve clears the shape
    // One control point pulls the curve away, another ensures proper approach to endpoint

    // Calculate an "approach point" outside the shape on the same side as the endpoint
    let approachPoint: Point;
    switch (endSide) {
        case "left":
            approachPoint = { x: targetBounds.x - MARGIN, y: end.y };
            break;
        case "right":
            approachPoint = {
                x: targetBounds.x + targetBounds.width + MARGIN,
                y: end.y,
            };
            break;
        case "top":
            approachPoint = { x: end.x, y: targetBounds.y - MARGIN };
            break;
        case "bottom":
            approachPoint = {
                x: end.x,
                y: targetBounds.y + targetBounds.height + MARGIN,
            };
            break;
        default:
            approachPoint = { x: targetBounds.x - MARGIN, y: end.y };
    }

    // Calculate a "routing point" that pulls the curve around the corner
    const corners = [
        { x: targetBounds.x - MARGIN, y: targetBounds.y - MARGIN }, // nw
        {
            x: targetBounds.x + targetBounds.width + MARGIN,
            y: targetBounds.y - MARGIN,
        }, // ne
        {
            x: targetBounds.x + targetBounds.width + MARGIN,
            y: targetBounds.y + targetBounds.height + MARGIN,
        }, // se
        {
            x: targetBounds.x - MARGIN,
            y: targetBounds.y + targetBounds.height + MARGIN,
        }, // sw
    ];

    // Find the best corner based on which side the end is on and where start is
    let routingPoint: Point;

    switch (endSide) {
        case "left": {
            if (start.y < targetBounds.y + targetBounds.height / 2) {
                routingPoint = corners[0]; // nw
            } else {
                routingPoint = corners[3]; // sw
            }
            break;
        }
        case "right": {
            if (start.y < targetBounds.y + targetBounds.height / 2) {
                routingPoint = corners[1]; // ne
            } else {
                routingPoint = corners[2]; // se
            }
            break;
        }
        case "top": {
            if (start.x < targetBounds.x + targetBounds.width / 2) {
                routingPoint = corners[0]; // nw
            } else {
                routingPoint = corners[1]; // ne
            }
            break;
        }
        case "bottom": {
            if (start.x < targetBounds.x + targetBounds.width / 2) {
                routingPoint = corners[3]; // sw
            } else {
                routingPoint = corners[2]; // se
            }
            break;
        }
        default: {
            // Fallback - find nearest corner
            let minDist = Infinity;
            routingPoint = corners[0];
            for (const corner of corners) {
                const dist =
                    Math.hypot(corner.x - start.x, corner.y - start.y) +
                    Math.hypot(corner.x - end.x, corner.y - end.y);
                if (dist < minDist) {
                    minDist = dist;
                    routingPoint = corner;
                }
            }
        }
    }

    // If there are existing control points, preserve them and add the routing points
    if (hasExistingCurve) {
        // Add routing points near the end, preserving existing curve
        return [
            start,
            ...existingControlPoints,
            routingPoint,
            approachPoint,
            end,
        ];
    }

    // Use two control points: routing point to go around, approach point to enter correctly
    return [start, routingPoint, approachPoint, end];
}
