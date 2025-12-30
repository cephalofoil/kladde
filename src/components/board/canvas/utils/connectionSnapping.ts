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
                    // Check if edge snap point is accessible (line of sight)
                    let edgeOutOfLineOfSight = false;
                    if (connectorStyle === "sharp" && otherEndpoint) {
                        if (
                            !isSnapPointAccessible(
                                otherEndpoint,
                                edgeSnap.point,
                                element.id,
                                elements,
                            )
                        ) {
                            edgeOutOfLineOfSight = true;
                        }
                    }

                    minDistance = dist;
                    nearestTarget = {
                        elementId: element.id,
                        snapPoint: edgeSnap,
                        distance: dist,
                        outOfLineOfSight: edgeOutOfLineOfSight,
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
    // Simple check: does any segment pass through the shape interior?
    // We sample points along each segment and check if they're inside the bounds

    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];

        // Sample points along the segment (skip endpoints - they may be on shape edge)
        for (let t = 0.1; t <= 0.9; t += 0.1) {
            const px = p1.x + (p2.x - p1.x) * t;
            const py = p1.y + (p2.y - p1.y) * t;

            // Check if point is strictly inside bounds
            if (
                px > bounds.x &&
                px < bounds.x + bounds.width &&
                py > bounds.y &&
                py < bounds.y + bounds.height
            ) {
                return true; // Path passes through shape
            }
        }
    }

    // Also check if the corner point (for L-paths) is inside the shape
    if (path.length >= 3) {
        const corner = path[1];
        if (
            corner.x > bounds.x &&
            corner.x < bounds.x + bounds.width &&
            corner.y > bounds.y &&
            corner.y < bounds.y + bounds.height
        ) {
            return true;
        }
    }

    return false; // Path is clear
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
 * - startElementId: Optional - The shape connected at the 'start' point (for dual-connection arrows)
 */
export function generateElbowRouteAroundObstacles(
    start: Point,
    end: Point,
    elements: BoardElement[],
    excludeElementId: string | null,
    targetElementId: string | null,
    startElementId: string | null = null,
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

    // Get the start element bounds - this is the shape that 'start' point is ON (for dual-connection)
    let startBounds: BoundingBox | null = null;
    if (startElementId) {
        const startEl = elements.find((el) => el.id === startElementId);
        if (startEl) {
            startBounds = getBoundingBox(startEl);
        }
    }

    // Collect all obstacle bounds with margin (excluding the arrow and connected shapes)
    const obstacles: BoundingBox[] = [];
    for (const element of elements) {
        if (
            element.id === excludeElementId ||
            element.id === targetElementId ||
            element.id === startElementId
        ) {
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

    // Helper: check if a point is strictly inside bounds
    const pointInside = (p: Point, b: BoundingBox) =>
        p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.height;

    // Helper: check if a straight line between two points passes through a shape
    const linePassesThrough = (
        p1: Point,
        p2: Point,
        bounds: BoundingBox,
    ): boolean => {
        // Sample points along the line (skip endpoints which are on shape edges)
        for (let t = 0.1; t <= 0.9; t += 0.1) {
            const px = p1.x + (p2.x - p1.x) * t;
            const py = p1.y + (p2.y - p1.y) * t;
            if (pointInside({ x: px, y: py }, bounds)) {
                return true;
            }
        }
        return false;
    };

    // FIRST: Check for line of sight - if start and end are roughly aligned,
    // a straight line (2 points) is the most efficient path
    const straightLine = [start, end];
    const straightLineValid = (): boolean => {
        // Check the line doesn't pass through connected shapes
        if (targetBounds && linePassesThrough(start, end, targetBounds))
            return false;
        if (startBounds && linePassesThrough(start, end, startBounds))
            return false;
        // Check obstacles too
        if (
            obstacles.length > 0 &&
            pathIntersectsObstacles(straightLine, obstacles)
        )
            return false;
        return true;
    };

    // If straight line works, use it (this handles line of sight cases)
    if (straightLineValid()) {
        return straightLine;
    }

    // Simple L-paths for reference
    const hFirstPath = [start, { x: end.x, y: start.y }, end];
    const vFirstPath = [start, { x: start.x, y: end.y }, end];

    // IMPORTANT: If we're connecting TO shapes (targetBounds/startBounds exist),
    // we MUST route around them - never allow paths that ride along or through them
    if (targetBounds || startBounds) {
        // Helper: check if path is valid (corner not inside shapes, no tunneling)
        const isPathValid = (path: Point[]): boolean => {
            if (path.length < 3) return true;
            const corner = path[1];

            // Corner must not be inside either connected shape
            if (targetBounds && pointInside(corner, targetBounds)) return false;
            if (startBounds && pointInside(corner, startBounds)) return false;

            // Check segments don't pass through shapes (sample interior points)
            for (let i = 0; i < path.length - 1; i++) {
                const p1 = path[i],
                    p2 = path[i + 1];
                for (let t = 0.2; t <= 0.8; t += 0.2) {
                    const px = p1.x + (p2.x - p1.x) * t;
                    const py = p1.y + (p2.y - p1.y) * t;
                    const testPt = { x: px, y: py };
                    if (targetBounds && pointInside(testPt, targetBounds))
                        return false;
                    if (startBounds && pointInside(testPt, startBounds))
                        return false;
                }
            }
            return true;
        };

        // Check obstacles
        const hFirstObstacleClear =
            obstacles.length === 0 ||
            !pathIntersectsObstacles(hFirstPath, obstacles);
        const vFirstObstacleClear =
            obstacles.length === 0 ||
            !pathIntersectsObstacles(vFirstPath, obstacles);

        // Try simple L-paths first - these are the most efficient
        const hFirstValid = isPathValid(hFirstPath);
        const vFirstValid = isPathValid(vFirstPath);

        if (hFirstValid && hFirstObstacleClear && dx >= dy) {
            return hFirstPath;
        }
        if (vFirstValid && vFirstObstacleClear && dy > dx) {
            return vFirstPath;
        }
        if (hFirstValid && hFirstObstacleClear) {
            return hFirstPath;
        }
        if (vFirstValid && vFirstObstacleClear) {
            return vFirstPath;
        }

        // Simple L-paths don't work - need to route around
        // Generate candidate paths that go around each blocking shape individually
        if (targetBounds && startBounds) {
            const margin = 15;
            const candidates: Point[][] = [];

            // Helper to generate routes around a single shape
            const addRoutesAroundShape = (bounds: BoundingBox) => {
                const left = bounds.x - margin;
                const right = bounds.x + bounds.width + margin;
                const top = bounds.y - margin;
                const bottom = bounds.y + bounds.height + margin;

                // L-paths that go around this shape
                // Via top-left corner
                candidates.push([
                    start,
                    { x: left, y: start.y },
                    { x: left, y: top },
                    { x: end.x, y: top },
                    end,
                ]);
                // Via top-right corner
                candidates.push([
                    start,
                    { x: right, y: start.y },
                    { x: right, y: top },
                    { x: end.x, y: top },
                    end,
                ]);
                // Via bottom-left corner
                candidates.push([
                    start,
                    { x: left, y: start.y },
                    { x: left, y: bottom },
                    { x: end.x, y: bottom },
                    end,
                ]);
                // Via bottom-right corner
                candidates.push([
                    start,
                    { x: right, y: start.y },
                    { x: right, y: bottom },
                    { x: end.x, y: bottom },
                    end,
                ]);
                // Vertical first variants
                candidates.push([
                    start,
                    { x: start.x, y: top },
                    { x: left, y: top },
                    { x: left, y: end.y },
                    end,
                ]);
                candidates.push([
                    start,
                    { x: start.x, y: top },
                    { x: right, y: top },
                    { x: right, y: end.y },
                    end,
                ]);
                candidates.push([
                    start,
                    { x: start.x, y: bottom },
                    { x: left, y: bottom },
                    { x: left, y: end.y },
                    end,
                ]);
                candidates.push([
                    start,
                    { x: start.x, y: bottom },
                    { x: right, y: bottom },
                    { x: right, y: end.y },
                    end,
                ]);
            };

            // Add routes around each shape
            addRoutesAroundShape(startBounds);
            addRoutesAroundShape(targetBounds);

            // Also add simpler 3-point routes
            const sMargin = 15;
            const sLeft = Math.min(startBounds.x, targetBounds.x) - sMargin;
            const sRight =
                Math.max(
                    startBounds.x + startBounds.width,
                    targetBounds.x + targetBounds.width,
                ) + sMargin;
            const sTop = Math.min(startBounds.y, targetBounds.y) - sMargin;
            const sBottom =
                Math.max(
                    startBounds.y + startBounds.height,
                    targetBounds.y + targetBounds.height,
                ) + sMargin;

            candidates.push([
                start,
                { x: start.x, y: sTop },
                { x: end.x, y: sTop },
                end,
            ]);
            candidates.push([
                start,
                { x: start.x, y: sBottom },
                { x: end.x, y: sBottom },
                end,
            ]);
            candidates.push([
                start,
                { x: sLeft, y: start.y },
                { x: sLeft, y: end.y },
                end,
            ]);
            candidates.push([
                start,
                { x: sRight, y: start.y },
                { x: sRight, y: end.y },
                end,
            ]);

            // Find shortest valid path
            let bestPath: Point[] | null = null;
            let bestLen = Infinity;

            for (const path of candidates) {
                if (isPathValid(path)) {
                    let len = 0;
                    for (let i = 0; i < path.length - 1; i++) {
                        len +=
                            Math.abs(path[i + 1].x - path[i].x) +
                            Math.abs(path[i + 1].y - path[i].y);
                    }
                    if (len < bestLen) {
                        bestLen = len;
                        bestPath = path;
                    }
                }
            }

            if (bestPath) {
                // Simplify the path by removing collinear points
                const simplified: Point[] = [bestPath[0]];
                for (let i = 1; i < bestPath.length - 1; i++) {
                    const prev = simplified[simplified.length - 1];
                    const curr = bestPath[i];
                    const next = bestPath[i + 1];
                    // Keep point if direction changes
                    const sameX = prev.x === curr.x && curr.x === next.x;
                    const sameY = prev.y === curr.y && curr.y === next.y;
                    if (!sameX && !sameY) {
                        simplified.push(curr);
                    }
                }
                simplified.push(bestPath[bestPath.length - 1]);
                return simplified;
            }

            // Fallback: just use whichever simple path is shorter
            return dx > dy ? hFirstPath : vFirstPath;
        }

        // Single-connection: use the existing routing logic
        const routingBounds = targetBounds || startBounds;
        if (!routingBounds) {
            return dx > dy ? hFirstPath : vFirstPath;
        }

        const endSide = targetBounds
            ? getSnapSide(end, targetBounds)
            : getSnapSide(start, startBounds!);

        const targetExpanded = {
            x: routingBounds.x - MARGIN,
            y: routingBounds.y - MARGIN,
            width: routingBounds.width + MARGIN * 2,
            height: routingBounds.height + MARGIN * 2,
        };

        if (endSide) {
            switch (endSide) {
                case "left": {
                    const approachX = targetExpanded.x;
                    if (
                        start.y < targetExpanded.y ||
                        start.y > targetExpanded.y + targetExpanded.height
                    ) {
                        return [
                            start,
                            { x: approachX, y: start.y },
                            { x: approachX, y: end.y },
                            end,
                        ];
                    } else {
                        const goUp =
                            end.y <= routingBounds.y + routingBounds.height / 2;
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
                    const approachX = targetExpanded.x + targetExpanded.width;
                    if (
                        start.y < targetExpanded.y ||
                        start.y > targetExpanded.y + targetExpanded.height
                    ) {
                        return [
                            start,
                            { x: approachX, y: start.y },
                            { x: approachX, y: end.y },
                            end,
                        ];
                    } else {
                        const goUp =
                            end.y <= routingBounds.y + routingBounds.height / 2;
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
                    const approachY = targetExpanded.y;
                    if (
                        start.x < targetExpanded.x ||
                        start.x > targetExpanded.x + targetExpanded.width
                    ) {
                        return [
                            start,
                            { x: start.x, y: approachY },
                            { x: end.x, y: approachY },
                            end,
                        ];
                    } else {
                        const goLeft =
                            end.x <= routingBounds.x + routingBounds.width / 2;
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
                    const approachY = targetExpanded.y + targetExpanded.height;
                    if (
                        start.x < targetExpanded.x ||
                        start.x > targetExpanded.x + targetExpanded.width
                    ) {
                        return [
                            start,
                            { x: start.x, y: approachY },
                            { x: end.x, y: approachY },
                            end,
                        ];
                    } else {
                        const goLeft =
                            end.x <= routingBounds.x + routingBounds.width / 2;
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
 * Generate a curved arrow path with control points that route around the target shape.
 * For line-of-sight connections, uses a gentle midpoint curve.
 * For out-of-sight connections, routes around the target shape with proper clearance.
 */
export function generateCurvedRouteAroundObstacles(
    start: Point,
    end: Point,
    elements: BoardElement[],
    excludeElementId: string | null,
    targetElementId: string | null,
    startElementId: string | null = null,
): Point[] {
    const MARGIN = 80; // Spacing around obstacles for the control point

    // Get the target element bounds
    let targetBounds: BoundingBox | null = null;
    if (targetElementId) {
        const targetEl = elements.find((el) => el.id === targetElementId);
        if (targetEl) {
            targetBounds = getBoundingBox(targetEl);
        }
    }

    // Get the start element bounds (for dual-connection)
    let startBounds: BoundingBox | null = null;
    if (startElementId) {
        const startEl = elements.find((el) => el.id === startElementId);
        if (startEl) {
            startBounds = getBoundingBox(startEl);
        }
    }

    // If no bounds at all, just return a simple curved path with midpoint control
    if (!targetBounds && !startBounds) {
        return [
            start,
            { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
            end,
        ];
    }

    // Use whichever bounds we have for routing
    const routingBounds = targetBounds || startBounds!;

    // Determine which side of the shape the endpoint is on
    const endSide = targetBounds
        ? getSnapSide(end, targetBounds)
        : getSnapSide(start, startBounds!);

    // Helper to check if a point is inside bounds
    const pointInsideBounds = (p: Point, bounds: BoundingBox) =>
        p.x > bounds.x &&
        p.x < bounds.x + bounds.width &&
        p.y > bounds.y &&
        p.y < bounds.y + bounds.height;

    // Check if the midpoint of a straight line would be inside either shape
    // If so, we need to route around
    const midPoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const midInsideTarget = targetBounds
        ? pointInsideBounds(midPoint, targetBounds)
        : false;
    const midInsideStart = startBounds
        ? pointInsideBounds(midPoint, startBounds)
        : false;
    const midInsideShape = midInsideTarget || midInsideStart;

    // Also check if the line from start to end intersects either shape
    // by checking multiple points along the line
    let lineIntersectsShape = midInsideShape;
    if (!lineIntersectsShape) {
        for (let t = 0.2; t <= 0.8; t += 0.2) {
            const testPoint = {
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t,
            };
            const insideTarget = targetBounds
                ? pointInsideBounds(testPoint, targetBounds)
                : false;
            const insideStart = startBounds
                ? pointInsideBounds(testPoint, startBounds)
                : false;
            if (insideTarget || insideStart) {
                lineIntersectsShape = true;
                break;
            }
        }
    }

    // If line doesn't intersect (line of sight), try a gentle curve
    if (!lineIntersectsShape) {
        // For line-of-sight connections, create a gentle curve by offsetting
        // the control point slightly perpendicular to the line
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.hypot(dx, dy) || 1;

        // Perpendicular vector (normalized)
        const perpX = -dy / len;
        const perpY = dx / len;

        // Use a small offset proportional to line length for a gentle curve
        // About 10% of the line length, capped at a reasonable maximum
        const gentleOffset = Math.min(len * 0.1, 30);

        // Offset away from the shape center for a natural curve
        const shapeCenter = {
            x: routingBounds.x + routingBounds.width / 2,
            y: routingBounds.y + routingBounds.height / 2,
        };
        const crossProduct =
            dx * (shapeCenter.y - start.y) - dy * (shapeCenter.x - start.x);
        const offsetDir = crossProduct > 0 ? -1 : 1;

        const controlPoint = {
            x: midPoint.x + perpX * gentleOffset * offsetDir,
            y: midPoint.y + perpY * gentleOffset * offsetDir,
        };

        // Verify the curve doesn't pass through either shape by sampling points along it
        const curvePassesThroughShape = (() => {
            const margin = 5;

            // Check against both bounds if they exist
            const boundsToCheck: BoundingBox[] = [];
            if (targetBounds) {
                boundsToCheck.push({
                    x: targetBounds.x - margin,
                    y: targetBounds.y - margin,
                    width: targetBounds.width + margin * 2,
                    height: targetBounds.height + margin * 2,
                });
            }
            if (startBounds) {
                boundsToCheck.push({
                    x: startBounds.x - margin,
                    y: startBounds.y - margin,
                    width: startBounds.width + margin * 2,
                    height: startBounds.height + margin * 2,
                });
            }

            // Sample the quadratic bezier curve
            for (let t = 0.1; t <= 0.9; t += 0.1) {
                const mt = 1 - t;
                // Quadratic bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
                const curvePoint = {
                    x:
                        mt * mt * start.x +
                        2 * mt * t * controlPoint.x +
                        t * t * end.x,
                    y:
                        mt * mt * start.y +
                        2 * mt * t * controlPoint.y +
                        t * t * end.y,
                };

                for (const expandedBounds of boundsToCheck) {
                    if (
                        curvePoint.x > expandedBounds.x &&
                        curvePoint.x <
                            expandedBounds.x + expandedBounds.width &&
                        curvePoint.y > expandedBounds.y &&
                        curvePoint.y < expandedBounds.y + expandedBounds.height
                    ) {
                        return true;
                    }
                }
            }
            return false;
        })();

        // If curve doesn't pass through shape, use the gentle curve
        if (!curvePassesThroughShape) {
            return [start, controlPoint, end];
        }
        // Otherwise fall through to the more aggressive routing below
    }

    // Need to route around - use two control points to ensure curve clears the shape
    // One control point pulls the curve away, another ensures proper approach to endpoint

    // Calculate an "approach point" outside the shape on the same side as the endpoint
    let approachPoint: Point;
    switch (endSide) {
        case "left":
            approachPoint = { x: routingBounds.x - MARGIN, y: end.y };
            break;
        case "right":
            approachPoint = {
                x: routingBounds.x + routingBounds.width + MARGIN,
                y: end.y,
            };
            break;
        case "top":
            approachPoint = { x: end.x, y: routingBounds.y - MARGIN };
            break;
        case "bottom":
            approachPoint = {
                x: end.x,
                y: routingBounds.y + routingBounds.height + MARGIN,
            };
            break;
        default:
            approachPoint = { x: routingBounds.x - MARGIN, y: end.y };
    }

    // Calculate a "routing point" that pulls the curve around the corner
    const corners = [
        { x: routingBounds.x - MARGIN, y: routingBounds.y - MARGIN }, // nw
        {
            x: routingBounds.x + routingBounds.width + MARGIN,
            y: routingBounds.y - MARGIN,
        }, // ne
        {
            x: routingBounds.x + routingBounds.width + MARGIN,
            y: routingBounds.y + routingBounds.height + MARGIN,
        }, // se
        {
            x: routingBounds.x - MARGIN,
            y: routingBounds.y + routingBounds.height + MARGIN,
        }, // sw
    ];

    // Find the best corner based on which side the end is on and where start is
    let routingPoint: Point;

    switch (endSide) {
        case "left": {
            if (start.y < routingBounds.y + routingBounds.height / 2) {
                routingPoint = corners[0]; // nw
            } else {
                routingPoint = corners[3]; // sw
            }
            break;
        }
        case "right": {
            if (start.y < routingBounds.y + routingBounds.height / 2) {
                routingPoint = corners[1]; // ne
            } else {
                routingPoint = corners[2]; // se
            }
            break;
        }
        case "top": {
            if (start.x < routingBounds.x + routingBounds.width / 2) {
                routingPoint = corners[0]; // nw
            } else {
                routingPoint = corners[1]; // ne
            }
            break;
        }
        case "bottom": {
            if (start.x < routingBounds.x + routingBounds.width / 2) {
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

    // When routing around obstacles, always use fresh routing points.
    // Don't preserve existing control points here because they may be from previous
    // routing iterations during drag, which would cause points to accumulate and
    // create a "bundled up" arrow. User-defined control points (from manual curve
    // adjustment) are preserved in the non-intersecting path above.
    // Use two control points: routing point to go around, approach point to enter correctly
    return [start, routingPoint, approachPoint, end];
}

/**
 * Get the snap point position for an element based on its bounds.
 */
export function getSnapPointFromPosition(
    element: BoardElement,
    position: SnapPoint["position"],
): Point | null {
    const bounds = getBoundingBox(element);
    if (!bounds) return null;

    const rotationDeg = element.rotation ?? 0;
    const center = getBoundsCenter(bounds);

    let localPoint: Point;
    switch (position) {
        case "nw":
            localPoint = { x: bounds.x, y: bounds.y };
            break;
        case "n":
            localPoint = { x: bounds.x + bounds.width / 2, y: bounds.y };
            break;
        case "ne":
            localPoint = { x: bounds.x + bounds.width, y: bounds.y };
            break;
        case "e":
            localPoint = {
                x: bounds.x + bounds.width,
                y: bounds.y + bounds.height / 2,
            };
            break;
        case "se":
            localPoint = {
                x: bounds.x + bounds.width,
                y: bounds.y + bounds.height,
            };
            break;
        case "s":
            localPoint = {
                x: bounds.x + bounds.width / 2,
                y: bounds.y + bounds.height,
            };
            break;
        case "sw":
            localPoint = { x: bounds.x, y: bounds.y + bounds.height };
            break;
        case "w":
            localPoint = { x: bounds.x, y: bounds.y + bounds.height / 2 };
            break;
        default:
            return null;
    }

    if (rotationDeg) {
        return rotatePoint(localPoint, center, rotationDeg);
    }
    return localPoint;
}

/**
 * Check if a straight line between two points passes through any obstacle.
 */
function hasLineOfSightBetweenPoints(
    start: Point,
    end: Point,
    elements: BoardElement[],
    excludeIds: string[],
): boolean {
    for (const element of elements) {
        if (excludeIds.includes(element.id)) continue;
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

export interface ArrowUpdate {
    id: string;
    updates: Partial<BoardElement>;
}

/**
 * Update all arrows that are connected to the given moved elements.
 * Returns an array of updates to apply.
 *
 * Behavior based on arrow type:
 * - Sharp: If straight (2 points), move entire arrow. If has bend, only move connected endpoint.
 *          If endpoint would be inside shape after move, switch to elbow mode.
 * - Curved: Slight curve if line-of-sight, otherwise use out-of-sight routing behavior.
 * - Elbow: Normal elbow routing behavior (re-route around obstacles).
 */
export function getConnectedArrowUpdates(
    movedElementIds: string[],
    elements: BoardElement[],
): ArrowUpdate[] {
    const updates: ArrowUpdate[] = [];
    const movedIdSet = new Set(movedElementIds);

    // Find all arrows that have connections to the moved elements
    for (const arrow of elements) {
        if (arrow.type !== "line" && arrow.type !== "arrow") continue;

        const startConn = arrow.startConnection;
        const endConn = arrow.endConnection;

        const startMoved = startConn && movedIdSet.has(startConn.elementId);
        const endMoved = endConn && movedIdSet.has(endConn.elementId);

        if (!startMoved && !endMoved) continue;

        // Get the connected elements
        const startElement = startConn
            ? elements.find((el) => el.id === startConn.elementId)
            : null;
        const endElement = endConn
            ? elements.find((el) => el.id === endConn.elementId)
            : null;

        // Calculate new positions for connected endpoints
        const newStartPoint =
            startElement && startConn
                ? getSnapPointFromPosition(startElement, startConn.position)
                : null;
        const newEndPoint =
            endElement && endConn
                ? getSnapPointFromPosition(endElement, endConn.position)
                : null;

        const style = arrow.connectorStyle ?? "sharp";
        const currentPoints = [...arrow.points];

        // Get the current/new start and end points
        const startPoint =
            startMoved && newStartPoint ? newStartPoint : currentPoints[0];
        const endPoint =
            endMoved && newEndPoint
                ? newEndPoint
                : currentPoints[currentPoints.length - 1];

        // Determine update based on connector style
        let newPoints: Point[];
        let newConnectorStyle: "sharp" | "curved" | "elbow" | undefined;

        if (style === "elbow") {
            // Elbow mode: normal routing behavior
            // Generate elbow route around obstacles
            const excludeIds = [arrow.id];
            if (startConn) excludeIds.push(startConn.elementId);
            if (endConn) excludeIds.push(endConn.elementId);

            const targetElementId = endConn?.elementId ?? null;
            const startElementId = startConn?.elementId ?? null;
            newPoints = generateElbowRouteAroundObstacles(
                startPoint,
                endPoint,
                elements,
                arrow.id,
                targetElementId,
                startElementId,
            );
        } else if (style === "curved") {
            // Curved mode: slight curve if line-of-sight, otherwise route around
            const excludeIds = [arrow.id];
            if (startConn) excludeIds.push(startConn.elementId);
            if (endConn) excludeIds.push(endConn.elementId);

            const targetElementId = endConn?.elementId ?? null;
            const startElementId = startConn?.elementId ?? null;
            newPoints = generateCurvedRouteAroundObstacles(
                startPoint,
                endPoint,
                elements,
                arrow.id,
                targetElementId,
                startElementId,
            );
        } else {
            // Sharp mode
            const isSimpleStraightLine = currentPoints.length === 2;

            if (isSimpleStraightLine) {
                // Straight arrow: check if we need to switch to elbow mode
                const excludeIds = [arrow.id];
                if (startConn) excludeIds.push(startConn.elementId);
                if (endConn) excludeIds.push(endConn.elementId);

                const hasLineOfSight = hasLineOfSightBetweenPoints(
                    startPoint,
                    endPoint,
                    elements,
                    excludeIds,
                );

                if (hasLineOfSight) {
                    // Simple case: just update the points
                    newPoints = [startPoint, endPoint];
                } else {
                    // Would be inside a shape: switch to elbow mode
                    const targetElementId = endConn?.elementId ?? null;
                    const startElementId = startConn?.elementId ?? null;
                    newPoints = generateElbowRouteAroundObstacles(
                        startPoint,
                        endPoint,
                        elements,
                        arrow.id,
                        targetElementId,
                        startElementId,
                    );
                    newConnectorStyle = "elbow";
                }
            } else {
                // Sharp arrow with bend(s): only move the connected part
                newPoints = [...currentPoints];

                if (startMoved && newStartPoint) {
                    // Move just the start point, keep the bend
                    newPoints[0] = newStartPoint;
                }

                if (endMoved && newEndPoint) {
                    // Move just the end point, keep the bend
                    newPoints[newPoints.length - 1] = newEndPoint;
                }

                // Check if any segment now passes through an obstacle
                const excludeIds = [arrow.id];
                if (startConn) excludeIds.push(startConn.elementId);
                if (endConn) excludeIds.push(endConn.elementId);

                // Check first segment (start to first bend)
                if (startMoved && newPoints.length > 2) {
                    const firstBend = newPoints[1];
                    if (
                        !hasLineOfSightBetweenPoints(
                            newPoints[0],
                            firstBend,
                            elements,
                            excludeIds,
                        )
                    ) {
                        // Need to re-route: switch to elbow mode
                        const targetElementId = endConn?.elementId ?? null;
                        const startElementId = startConn?.elementId ?? null;
                        newPoints = generateElbowRouteAroundObstacles(
                            startPoint,
                            endPoint,
                            elements,
                            arrow.id,
                            targetElementId,
                            startElementId,
                        );
                        newConnectorStyle = "elbow";
                    }
                }

                // Check last segment (last bend to end)
                if (endMoved && newPoints.length > 2 && !newConnectorStyle) {
                    const lastBend = newPoints[newPoints.length - 2];
                    if (
                        !hasLineOfSightBetweenPoints(
                            lastBend,
                            newPoints[newPoints.length - 1],
                            elements,
                            excludeIds,
                        )
                    ) {
                        // Need to re-route: switch to elbow mode
                        const targetElementId = endConn?.elementId ?? null;
                        const startElementId = startConn?.elementId ?? null;
                        newPoints = generateElbowRouteAroundObstacles(
                            startPoint,
                            endPoint,
                            elements,
                            arrow.id,
                            targetElementId,
                            startElementId,
                        );
                        newConnectorStyle = "elbow";
                    }
                }
            }
        }

        // Build the update object
        const update: Partial<BoardElement> = { points: newPoints };
        if (newConnectorStyle) {
            update.connectorStyle = newConnectorStyle;
            update.elbowRoute = undefined;
        }

        updates.push({ id: arrow.id, updates: update });
    }

    return updates;
}
