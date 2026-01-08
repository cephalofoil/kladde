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
 * Find the closest point on a line segment to a given point
 */
function closestPointOnLineSegment(
    point: Point,
    lineStart: Point,
    lineEnd: Point,
): Point {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
        // Line segment is a point
        return lineStart;
    }

    // Project point onto line, clamping to segment
    let t =
        ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
        lengthSquared;
    t = Math.max(0, Math.min(1, t));

    return {
        x: lineStart.x + t * dx,
        y: lineStart.y + t * dy,
    };
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
 * For diamonds and ellipses, snap points are on the actual shape outline
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

    let localPoints: SnapPoint[];

    if (element.type === "ellipse") {
        // For ellipse/circle, snap points are on the ellipse outline at cardinal directions
        const rx = bounds.width / 2;
        const ry = bounds.height / 2;
        const cx = bounds.x + rx;
        const cy = bounds.y + ry;

        localPoints = [
            // Cardinal points on ellipse outline
            {
                point: { x: cx, y: cy - ry }, // top
                type: "edge-mid",
                position: "n",
            },
            {
                point: { x: cx + rx, y: cy }, // right
                type: "edge-mid",
                position: "e",
            },
            {
                point: { x: cx, y: cy + ry }, // bottom
                type: "edge-mid",
                position: "s",
            },
            {
                point: { x: cx - rx, y: cy }, // left
                type: "edge-mid",
                position: "w",
            },
            // Diagonal points on ellipse outline (at 45 degree angles)
            {
                point: {
                    x: cx + rx * Math.cos(-Math.PI / 4),
                    y: cy + ry * Math.sin(-Math.PI / 4),
                },
                type: "corner",
                position: "ne",
            },
            {
                point: {
                    x: cx + rx * Math.cos(Math.PI / 4),
                    y: cy + ry * Math.sin(Math.PI / 4),
                },
                type: "corner",
                position: "se",
            },
            {
                point: {
                    x: cx + rx * Math.cos((3 * Math.PI) / 4),
                    y: cy + ry * Math.sin((3 * Math.PI) / 4),
                },
                type: "corner",
                position: "sw",
            },
            {
                point: {
                    x: cx + rx * Math.cos((-3 * Math.PI) / 4),
                    y: cy + ry * Math.sin((-3 * Math.PI) / 4),
                },
                type: "corner",
                position: "nw",
            },
        ];
    } else if (element.type === "diamond") {
        // For diamond, snap points are at the diamond vertices (midpoints of bounding box edges)
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const halfWidth = bounds.width / 2;
        const halfHeight = bounds.height / 2;

        localPoints = [
            // Diamond vertices (these ARE the corners of the diamond shape)
            {
                point: { x: cx, y: cy - halfHeight }, // top vertex
                type: "corner",
                position: "n",
            },
            {
                point: { x: cx + halfWidth, y: cy }, // right vertex
                type: "corner",
                position: "e",
            },
            {
                point: { x: cx, y: cy + halfHeight }, // bottom vertex
                type: "corner",
                position: "s",
            },
            {
                point: { x: cx - halfWidth, y: cy }, // left vertex
                type: "corner",
                position: "w",
            },
            // Edge midpoints (midpoints of diamond edges)
            {
                point: { x: cx + halfWidth / 2, y: cy - halfHeight / 2 }, // NE edge mid
                type: "edge-mid",
                position: "ne",
            },
            {
                point: { x: cx + halfWidth / 2, y: cy + halfHeight / 2 }, // SE edge mid
                type: "edge-mid",
                position: "se",
            },
            {
                point: { x: cx - halfWidth / 2, y: cy + halfHeight / 2 }, // SW edge mid
                type: "edge-mid",
                position: "sw",
            },
            {
                point: { x: cx - halfWidth / 2, y: cy - halfHeight / 2 }, // NW edge mid
                type: "edge-mid",
                position: "nw",
            },
        ];
    } else {
        // Default: rectangle-like shapes (rectangle, tile, frame, text, etc.)
        localPoints = [
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
                point: {
                    x: bounds.x + bounds.width,
                    y: bounds.y + bounds.height,
                },
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
    }

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
 * For diamonds and ellipses, finds the closest point on the actual shape outline
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

    const { x, y, width, height } = bounds;
    const cx = x + width / 2;
    const cy = y + height / 2;

    let edgePoint: Point;
    let position: SnapPoint["position"];

    if (element.type === "ellipse") {
        // Find closest point on ellipse outline
        const rx = width / 2;
        const ry = height / 2;

        // Vector from center to target
        const dx = localTarget.x - cx;
        const dy = localTarget.y - cy;

        // Angle to target point
        const angle = Math.atan2(dy, dx);

        // Point on ellipse at this angle
        edgePoint = {
            x: cx + rx * Math.cos(angle),
            y: cy + ry * Math.sin(angle),
        };

        // Determine position based on angle
        if (angle >= -Math.PI / 4 && angle < Math.PI / 4) {
            position = "e";
        } else if (angle >= Math.PI / 4 && angle < (3 * Math.PI) / 4) {
            position = "s";
        } else if (angle >= (-3 * Math.PI) / 4 && angle < -Math.PI / 4) {
            position = "n";
        } else {
            position = "w";
        }
    } else if (element.type === "diamond") {
        // Find closest point on diamond outline
        const halfWidth = width / 2;
        const halfHeight = height / 2;

        // Diamond vertices
        const top = { x: cx, y: cy - halfHeight };
        const right = { x: cx + halfWidth, y: cy };
        const bottom = { x: cx, y: cy + halfHeight };
        const left = { x: cx - halfWidth, y: cy };

        // Diamond edges
        const edges = [
            { p1: top, p2: right, pos: "ne" as const },
            { p1: right, p2: bottom, pos: "se" as const },
            { p1: bottom, p2: left, pos: "sw" as const },
            { p1: left, p2: top, pos: "nw" as const },
        ];

        // Find closest point on any edge
        let minDist = Infinity;
        edgePoint = top;
        position = "n";

        for (const edge of edges) {
            const closest = closestPointOnLineSegment(
                localTarget,
                edge.p1,
                edge.p2,
            );
            const dist = Math.hypot(
                closest.x - localTarget.x,
                closest.y - localTarget.y,
            );
            if (dist < minDist) {
                minDist = dist;
                edgePoint = closest;
                position = edge.pos;
            }
        }
    } else {
        // Default: rectangle-like shapes
        const right = x + width;
        const bottom = y + height;

        // Calculate distance to each edge
        const distToTop = Math.abs(localTarget.y - y);
        const distToBottom = Math.abs(localTarget.y - bottom);
        const distToLeft = Math.abs(localTarget.x - x);
        const distToRight = Math.abs(localTarget.x - right);

        const minDist = Math.min(
            distToTop,
            distToBottom,
            distToLeft,
            distToRight,
        );

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

    // Helper: check if a point is inside bounds (with small buffer to catch edge cases)
    const pointInside = (p: Point, b: BoundingBox, buffer: number = 2) =>
        p.x > b.x - buffer &&
        p.x < b.x + b.width + buffer &&
        p.y > b.y - buffer &&
        p.y < b.y + b.height + buffer;

    // Helper: check if a straight line between two points passes through a shape
    const linePassesThrough = (
        p1: Point,
        p2: Point,
        bounds: BoundingBox,
    ): boolean => {
        // Sample points densely along the line
        const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
        const steps = Math.max(20, Math.ceil(dist / 5)); // Sample every 5px or at least 20 samples
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
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
    // BUT: only use straight line if there are NO connections - connected arrows
    // should always use elbow routing for proper margins
    const straightLine = [start, end];
    const hasAnyConnection = startBounds || targetBounds;
    const straightLineValid = (): boolean => {
        // Never use straight line for connected arrows - they need elbow routing
        if (hasAnyConnection) return false;
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
        // Helper: check if path is valid (no points inside shapes, no tunneling)
        const isPathValid = (path: Point[]): boolean => {
            // Check ALL intermediate points (corners) are not inside shapes
            for (let i = 1; i < path.length - 1; i++) {
                const pt = path[i];
                if (targetBounds && pointInside(pt, targetBounds)) return false;
                if (startBounds && pointInside(pt, startBounds)) return false;
            }

            // Check middle segments don't pass through shapes
            // First segment exits startBounds, last segment enters targetBounds
            // So we check: first segment against targetBounds only, last against startBounds only
            // Middle segments check against both
            for (let i = 0; i < path.length - 1; i++) {
                const p1 = path[i],
                    p2 = path[i + 1];
                const isFirstSeg = i === 0;
                const isLastSeg = i === path.length - 2;

                // First segment can touch startBounds but not targetBounds
                if (
                    !isFirstSeg &&
                    startBounds &&
                    linePassesThrough(p1, p2, startBounds)
                )
                    return false;
                // Last segment can touch targetBounds but not startBounds
                if (
                    !isLastSeg &&
                    targetBounds &&
                    linePassesThrough(p1, p2, targetBounds)
                )
                    return false;
            }
            return true;
        };

        // For SELF-connection (arrow connects to the same shape at both ends),
        // route around the shape with orthogonal exits
        if (targetBounds && startBounds && startElementId === targetElementId) {
            const bounds = startBounds; // Same as targetBounds
            const SELF_MARGIN = 40; // Margin for self-connection routing

            // Determine exit directions from start and end points
            const startSide = getSnapSide(start, bounds);
            const endSide = getSnapSide(end, bounds);

            // Calculate ORTHOGONAL exit points
            const getOrthogonalExit = (
                pt: Point,
                side: string | null,
            ): Point => {
                switch (side) {
                    case "left":
                        return { x: bounds.x - SELF_MARGIN, y: pt.y };
                    case "right":
                        return {
                            x: bounds.x + bounds.width + SELF_MARGIN,
                            y: pt.y,
                        };
                    case "top":
                        return { x: pt.x, y: bounds.y - SELF_MARGIN };
                    case "bottom":
                        return {
                            x: pt.x,
                            y: bounds.y + bounds.height + SELF_MARGIN,
                        };
                    default:
                        return { x: pt.x, y: bounds.y - SELF_MARGIN };
                }
            };

            const startExit = getOrthogonalExit(start, startSide);
            const endExit = getOrthogonalExit(end, endSide);

            // Calculate outer corners for routing around the shape
            const outerLeft = bounds.x - SELF_MARGIN;
            const outerRight = bounds.x + bounds.width + SELF_MARGIN;
            const outerTop = bounds.y - SELF_MARGIN;
            const outerBottom = bounds.y + bounds.height + SELF_MARGIN;

            const candidates: Point[][] = [];

            // Helper to check if two sides are adjacent (share a corner)
            const areAdjacent = (
                s1: string | null,
                s2: string | null,
            ): boolean => {
                if (!s1 || !s2) return false;
                const adjacencies: Record<string, string[]> = {
                    top: ["left", "right"],
                    bottom: ["left", "right"],
                    left: ["top", "bottom"],
                    right: ["top", "bottom"],
                };
                return adjacencies[s1]?.includes(s2) ?? false;
            };

            // Helper to check if two sides are opposite
            const areOpposite = (
                s1: string | null,
                s2: string | null,
            ): boolean => {
                if (!s1 || !s2) return false;
                return (
                    (s1 === "top" && s2 === "bottom") ||
                    (s1 === "bottom" && s2 === "top") ||
                    (s1 === "left" && s2 === "right") ||
                    (s1 === "right" && s2 === "left")
                );
            };

            if (startSide === endSide) {
                // Same side: route out and around via adjacent corner
                if (startSide === "top" || startSide === "bottom") {
                    // Horizontal - decide which corner based on positions
                    const goLeft =
                        start.x + end.x < bounds.x * 2 + bounds.width;
                    const cornerX = goLeft ? outerLeft : outerRight;
                    const cornerY =
                        startSide === "top" ? outerTop : outerBottom;
                    candidates.push([
                        start,
                        startExit,
                        { x: cornerX, y: cornerY },
                        { x: cornerX, y: endExit.y },
                        endExit,
                        end,
                    ]);
                } else {
                    // Vertical - decide which corner based on positions
                    const goUp = start.y + end.y < bounds.y * 2 + bounds.height;
                    const cornerY = goUp ? outerTop : outerBottom;
                    const cornerX =
                        startSide === "left" ? outerLeft : outerRight;
                    candidates.push([
                        start,
                        startExit,
                        { x: cornerX, y: cornerY },
                        { x: endExit.x, y: cornerY },
                        endExit,
                        end,
                    ]);
                }
            } else if (areAdjacent(startSide, endSide)) {
                // Adjacent sides: route via the shared corner
                const cornerX =
                    startSide === "left" || endSide === "left"
                        ? outerLeft
                        : outerRight;
                const cornerY =
                    startSide === "top" || endSide === "top"
                        ? outerTop
                        : outerBottom;
                candidates.push([
                    start,
                    startExit,
                    { x: cornerX, y: startExit.y },
                    { x: cornerX, y: cornerY },
                    { x: endExit.x, y: cornerY },
                    endExit,
                    end,
                ]);
                // Simpler path if exits align with corner
                candidates.push([
                    start,
                    startExit,
                    { x: startExit.x, y: endExit.y },
                    endExit,
                    end,
                ]);
                candidates.push([
                    start,
                    startExit,
                    { x: endExit.x, y: startExit.y },
                    endExit,
                    end,
                ]);
            } else if (areOpposite(startSide, endSide)) {
                // Opposite sides: route around via either left or right (or top/bottom)
                if (startSide === "top" || startSide === "bottom") {
                    // Top-bottom: go around left or right
                    const goLeft =
                        start.x + end.x < bounds.x * 2 + bounds.width;
                    const cornerX = goLeft ? outerLeft : outerRight;
                    candidates.push([
                        start,
                        startExit,
                        { x: cornerX, y: startExit.y },
                        { x: cornerX, y: endExit.y },
                        endExit,
                        end,
                    ]);
                } else {
                    // Left-right: go around top or bottom
                    const goUp = start.y + end.y < bounds.y * 2 + bounds.height;
                    const cornerY = goUp ? outerTop : outerBottom;
                    candidates.push([
                        start,
                        startExit,
                        { x: startExit.x, y: cornerY },
                        { x: endExit.x, y: cornerY },
                        endExit,
                        end,
                    ]);
                }
            }

            // Fallback: simple corner routing
            if (candidates.length === 0) {
                candidates.push([
                    start,
                    startExit,
                    { x: startExit.x, y: endExit.y },
                    endExit,
                    end,
                ]);
            }

            // Find shortest valid path
            let bestPath: Point[] | null = null;
            let bestLen = Infinity;

            for (const path of candidates) {
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

            if (bestPath) {
                // Simplify the path by removing collinear points
                const simplified: Point[] = [bestPath[0]];
                for (let i = 1; i < bestPath.length - 1; i++) {
                    const prev = simplified[simplified.length - 1];
                    const curr = bestPath[i];
                    const next = bestPath[i + 1];
                    const sameX =
                        Math.abs(prev.x - curr.x) < 1 &&
                        Math.abs(curr.x - next.x) < 1;
                    const sameY =
                        Math.abs(prev.y - curr.y) < 1 &&
                        Math.abs(curr.y - next.y) < 1;
                    if (!sameX && !sameY) {
                        simplified.push(curr);
                    }
                }
                simplified.push(bestPath[bestPath.length - 1]);
                return simplified;
            }
        }

        // For DUAL-connection (both startBounds and targetBounds exist, different shapes),
        // ALWAYS start orthogonal to the connected edge and use dynamic spacing
        // based on the available space between shapes
        if (targetBounds && startBounds) {
            const candidates: Point[][] = [];

            // Determine exit directions from start and end points
            const startSide = getSnapSide(start, startBounds);
            const endSide = getSnapSide(end, targetBounds);

            // Calculate dynamic margin based on available space between shapes
            // Use at least 20px but adapt to the space available
            const MIN_MARGIN = 20;
            const PREFERRED_MARGIN = 40;

            // Calculate the gap between shapes in relevant directions
            const horizontalGap = (() => {
                // Gap between right edge of left shape and left edge of right shape
                const leftShape =
                    startBounds.x < targetBounds.x ? startBounds : targetBounds;
                const rightShape =
                    startBounds.x < targetBounds.x ? targetBounds : startBounds;
                return rightShape.x - (leftShape.x + leftShape.width);
            })();

            const verticalGap = (() => {
                // Gap between bottom edge of top shape and top edge of bottom shape
                const topShape =
                    startBounds.y < targetBounds.y ? startBounds : targetBounds;
                const bottomShape =
                    startBounds.y < targetBounds.y ? targetBounds : startBounds;
                return bottomShape.y - (topShape.y + topShape.height);
            })();

            // Dynamic margin calculation - use available space proportionally
            const getMarginForGap = (gap: number): number => {
                if (gap <= 0) return PREFERRED_MARGIN; // Shapes overlap - route outside
                if (gap < MIN_MARGIN * 2) return MIN_MARGIN; // Too tight - keep a real buffer
                if (gap < PREFERRED_MARGIN * 2) return gap / 2; // Moderate - use half
                return PREFERRED_MARGIN; // Plenty of space - use preferred
            };

            const hMargin = getMarginForGap(horizontalGap);
            const vMargin = getMarginForGap(verticalGap);

            // Calculate ORTHOGONAL exit points - the first segment MUST be perpendicular to the edge
            // This ensures the arrow starts cleanly away from the shape, not riding along the edge
            const getOrthogonalExit = (
                pt: Point,
                side: string | null,
                bounds: BoundingBox,
                margin: number,
            ): Point => {
                switch (side) {
                    case "left":
                        return { x: bounds.x - margin, y: pt.y };
                    case "right":
                        return { x: bounds.x + bounds.width + margin, y: pt.y };
                    case "top":
                        return { x: pt.x, y: bounds.y - margin };
                    case "bottom":
                        return {
                            x: pt.x,
                            y: bounds.y + bounds.height + margin,
                        };
                    default:
                        // Fallback: determine side based on point position
                        const cx = bounds.x + bounds.width / 2;
                        const cy = bounds.y + bounds.height / 2;
                        if (Math.abs(pt.x - bounds.x) < 2)
                            return { x: bounds.x - margin, y: pt.y };
                        if (Math.abs(pt.x - (bounds.x + bounds.width)) < 2)
                            return {
                                x: bounds.x + bounds.width + margin,
                                y: pt.y,
                            };
                        if (Math.abs(pt.y - bounds.y) < 2)
                            return { x: pt.x, y: bounds.y - margin };
                        if (Math.abs(pt.y - (bounds.y + bounds.height)) < 2)
                            return {
                                x: pt.x,
                                y: bounds.y + bounds.height + margin,
                            };
                        // Last resort
                        return pt.x < cx
                            ? { x: bounds.x - margin, y: pt.y }
                            : { x: bounds.x + bounds.width + margin, y: pt.y };
                }
            };

            // Determine which margin to use based on exit direction
            const startMargin =
                startSide === "left" || startSide === "right"
                    ? hMargin
                    : vMargin;
            const endMargin =
                endSide === "left" || endSide === "right" ? hMargin : vMargin;

            const startExit = getOrthogonalExit(
                start,
                startSide,
                startBounds,
                startMargin,
            );
            const endExit = getOrthogonalExit(
                end,
                endSide,
                targetBounds,
                endMargin,
            );

            // Helper to check if two sides are on same axis (both horizontal or both vertical)
            const sameAxis =
                ((startSide === "left" || startSide === "right") &&
                    (endSide === "left" || endSide === "right")) ||
                ((startSide === "top" || startSide === "bottom") &&
                    (endSide === "top" || endSide === "bottom"));

            // Helper to check if exits can connect directly (on same line)
            const exitsAligned =
                Math.abs(startExit.x - endExit.x) < 2 ||
                Math.abs(startExit.y - endExit.y) < 2;

            // Build candidate paths - all starting orthogonally from both ends

            // Direct connection through aligned exits (if they line up)
            if (exitsAligned) {
                candidates.push([start, startExit, endExit, end]);
            }

            // Standard L-path through exits with corner at intersection
            if (sameAxis) {
                // Same axis exits (e.g., both left/right or both top/bottom)
                // Need to go around - use midpoint between exits
                if (startSide === "left" || startSide === "right") {
                    // Horizontal exits - find vertical midpoint
                    const midY = (startExit.y + endExit.y) / 2;
                    candidates.push([
                        start,
                        startExit,
                        { x: startExit.x, y: midY },
                        { x: endExit.x, y: midY },
                        endExit,
                        end,
                    ]);
                } else {
                    // Vertical exits - find horizontal midpoint
                    const midX = (startExit.x + endExit.x) / 2;
                    candidates.push([
                        start,
                        startExit,
                        { x: midX, y: startExit.y },
                        { x: midX, y: endExit.y },
                        endExit,
                        end,
                    ]);
                }
            } else {
                // Different axis exits - can use simple corner connection
                // Two options for the corner point
                candidates.push([
                    start,
                    startExit,
                    { x: startExit.x, y: endExit.y },
                    endExit,
                    end,
                ]);
                candidates.push([
                    start,
                    startExit,
                    { x: endExit.x, y: startExit.y },
                    endExit,
                    end,
                ]);
            }

            // Calculate outer bounds for routing around both shapes (for tight situations)
            const outerMargin = Math.max(hMargin, vMargin, MIN_MARGIN);
            const outerLeft =
                Math.min(startBounds.x, targetBounds.x) - outerMargin;
            const outerRight =
                Math.max(
                    startBounds.x + startBounds.width,
                    targetBounds.x + targetBounds.width,
                ) + outerMargin;
            const outerTop =
                Math.min(startBounds.y, targetBounds.y) - outerMargin;
            const outerBottom =
                Math.max(
                    startBounds.y + startBounds.height,
                    targetBounds.y + targetBounds.height,
                ) + outerMargin;

            // Routes that go around via outer edges (with proper orthogonal start)
            candidates.push([
                start,
                startExit,
                { x: startExit.x, y: outerTop },
                { x: endExit.x, y: outerTop },
                endExit,
                end,
            ]);
            candidates.push([
                start,
                startExit,
                { x: startExit.x, y: outerBottom },
                { x: endExit.x, y: outerBottom },
                endExit,
                end,
            ]);
            candidates.push([
                start,
                startExit,
                { x: outerLeft, y: startExit.y },
                { x: outerLeft, y: endExit.y },
                endExit,
                end,
            ]);
            candidates.push([
                start,
                startExit,
                { x: outerRight, y: startExit.y },
                { x: outerRight, y: endExit.y },
                endExit,
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
                    const sameX =
                        Math.abs(prev.x - curr.x) < 1 &&
                        Math.abs(curr.x - next.x) < 1;
                    const sameY =
                        Math.abs(prev.y - curr.y) < 1 &&
                        Math.abs(curr.y - next.y) < 1;
                    if (!sameX && !sameY) {
                        simplified.push(curr);
                    }
                }
                simplified.push(bestPath[bestPath.length - 1]);
                return simplified;
            }

            // Fallback: create a simple orthogonal path
            // Always start orthogonal, then route
            if (startSide === "left" || startSide === "right") {
                // Horizontal start - go horizontal first, then vertical
                return [start, startExit, { x: startExit.x, y: end.y }, end];
            } else {
                // Vertical start - go vertical first, then horizontal
                return [start, startExit, { x: end.x, y: startExit.y }, end];
            }
        }

        // Single-connection FROM a shape (startBounds exists, no targetBounds):
        // Route orthogonally away from the start shape, then to the free endpoint
        if (startBounds && !targetBounds) {
            const startSide = getSnapSide(start, startBounds);
            const EXIT_MARGIN = 40; // Margin for exiting the shape

            // Calculate orthogonal exit point
            const getOrthogonalExit = (
                pt: Point,
                side: string | null,
                bounds: BoundingBox,
            ): Point => {
                switch (side) {
                    case "left":
                        return { x: bounds.x - EXIT_MARGIN, y: pt.y };
                    case "right":
                        return {
                            x: bounds.x + bounds.width + EXIT_MARGIN,
                            y: pt.y,
                        };
                    case "top":
                        return { x: pt.x, y: bounds.y - EXIT_MARGIN };
                    case "bottom":
                        return {
                            x: pt.x,
                            y: bounds.y + bounds.height + EXIT_MARGIN,
                        };
                    default:
                        // Fallback based on point position
                        const cx = bounds.x + bounds.width / 2;
                        const cy = bounds.y + bounds.height / 2;
                        if (Math.abs(pt.x - bounds.x) < 5)
                            return { x: bounds.x - EXIT_MARGIN, y: pt.y };
                        if (Math.abs(pt.x - (bounds.x + bounds.width)) < 5)
                            return {
                                x: bounds.x + bounds.width + EXIT_MARGIN,
                                y: pt.y,
                            };
                        if (Math.abs(pt.y - bounds.y) < 5)
                            return { x: pt.x, y: bounds.y - EXIT_MARGIN };
                        if (Math.abs(pt.y - (bounds.y + bounds.height)) < 5)
                            return {
                                x: pt.x,
                                y: bounds.y + bounds.height + EXIT_MARGIN,
                            };
                        return pt.x < cx
                            ? { x: bounds.x - EXIT_MARGIN, y: pt.y }
                            : {
                                  x: bounds.x + bounds.width + EXIT_MARGIN,
                                  y: pt.y,
                              };
                }
            };

            const startExit = getOrthogonalExit(start, startSide, startBounds);

            // Route: start -> orthogonal exit -> corner -> end
            if (startSide === "left" || startSide === "right") {
                // Horizontal exit - go horizontal first, then vertical
                return [start, startExit, { x: startExit.x, y: end.y }, end];
            } else {
                // Vertical exit - go vertical first, then horizontal
                return [start, startExit, { x: end.x, y: startExit.y }, end];
            }
        }

        // Single-connection TO a shape (targetBounds exists): use the existing routing logic
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
 * For diamonds and ellipses, returns points on the actual shape outline.
 */
export function getSnapPointFromPosition(
    element: BoardElement,
    position: SnapPoint["position"],
): Point | null {
    const bounds = getBoundingBox(element);
    if (!bounds) return null;

    const rotationDeg = element.rotation ?? 0;
    const center = getBoundsCenter(bounds);
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;

    let localPoint: Point;

    if (element.type === "ellipse") {
        const rx = bounds.width / 2;
        const ry = bounds.height / 2;

        switch (position) {
            case "n":
                localPoint = { x: cx, y: cy - ry };
                break;
            case "e":
                localPoint = { x: cx + rx, y: cy };
                break;
            case "s":
                localPoint = { x: cx, y: cy + ry };
                break;
            case "w":
                localPoint = { x: cx - rx, y: cy };
                break;
            case "ne":
                localPoint = {
                    x: cx + rx * Math.cos(-Math.PI / 4),
                    y: cy + ry * Math.sin(-Math.PI / 4),
                };
                break;
            case "se":
                localPoint = {
                    x: cx + rx * Math.cos(Math.PI / 4),
                    y: cy + ry * Math.sin(Math.PI / 4),
                };
                break;
            case "sw":
                localPoint = {
                    x: cx + rx * Math.cos((3 * Math.PI) / 4),
                    y: cy + ry * Math.sin((3 * Math.PI) / 4),
                };
                break;
            case "nw":
                localPoint = {
                    x: cx + rx * Math.cos((-3 * Math.PI) / 4),
                    y: cy + ry * Math.sin((-3 * Math.PI) / 4),
                };
                break;
            default:
                return null;
        }
    } else if (element.type === "diamond") {
        const halfWidth = bounds.width / 2;
        const halfHeight = bounds.height / 2;

        switch (position) {
            case "n":
                localPoint = { x: cx, y: cy - halfHeight };
                break;
            case "e":
                localPoint = { x: cx + halfWidth, y: cy };
                break;
            case "s":
                localPoint = { x: cx, y: cy + halfHeight };
                break;
            case "w":
                localPoint = { x: cx - halfWidth, y: cy };
                break;
            case "ne":
                localPoint = { x: cx + halfWidth / 2, y: cy - halfHeight / 2 };
                break;
            case "se":
                localPoint = { x: cx + halfWidth / 2, y: cy + halfHeight / 2 };
                break;
            case "sw":
                localPoint = { x: cx - halfWidth / 2, y: cy + halfHeight / 2 };
                break;
            case "nw":
                localPoint = { x: cx - halfWidth / 2, y: cy - halfHeight / 2 };
                break;
            default:
                return null;
        }
    } else {
        // Default: rectangle-like shapes
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

            // Check for self-connection (both ends connect to the same element)
            const isSelfConnection =
                startConn &&
                endConn &&
                startConn.elementId === endConn.elementId;

            if (isSimpleStraightLine) {
                // For self-connections, always use elbow routing since a straight
                // line would pass through the shape
                if (isSelfConnection) {
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
                } else {
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
                }
            } else {
                // Sharp arrow with bend(s): for self-connections, regenerate the route
                // For regular connections, only move the connected part
                if (isSelfConnection) {
                    // Self-connection with bends: regenerate the entire route
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
                } else {
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
                    if (
                        endMoved &&
                        newPoints.length > 2 &&
                        !newConnectorStyle
                    ) {
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
