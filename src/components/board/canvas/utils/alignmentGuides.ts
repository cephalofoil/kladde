import type { BoardElement } from "@/lib/board-types";
import type { BoundingBox } from "../types";
import { getBoundingBox } from "../shapes";

export type HorizontalEdge = "left" | "center" | "right";
export type VerticalEdge = "top" | "middle" | "bottom";

const GUIDE_EXTENSION = 20; // How far the guide extends beyond the objects

export interface AlignmentGuide {
    type: "horizontal" | "vertical";
    position: number; // x for vertical lines, y for horizontal lines
    start: number; // start position (y for vertical, x for horizontal)
    end: number; // end position (y for vertical, x for horizontal)
}

export interface AlignmentResult {
    guides: AlignmentGuide[];
    snapDeltaX: number;
    snapDeltaY: number;
}

interface EdgePositions {
    left: number;
    center: number;
    right: number;
    top: number;
    middle: number;
    bottom: number;
}

function getEdgePositions(bounds: BoundingBox): EdgePositions {
    return {
        left: bounds.x,
        center: bounds.x + bounds.width / 2,
        right: bounds.x + bounds.width,
        top: bounds.y,
        middle: bounds.y + bounds.height / 2,
        bottom: bounds.y + bounds.height,
    };
}

/**
 * Find alignment guides for a dragging element against visible candidates.
 * Returns guides to render and snap deltas to apply.
 *
 * @param draggingBounds - The current bounds of the element(s) being dragged
 * @param candidates - Elements to check alignment against (should be pre-filtered for viewport)
 * @param excludeIds - IDs of elements being dragged (to exclude from candidates)
 * @param threshold - Snap threshold in canvas pixels
 */
export function findAlignmentGuides(
    draggingBounds: BoundingBox,
    candidates: BoardElement[],
    excludeIds: Set<string>,
    threshold: number,
): AlignmentResult {
    const draggingEdges = getEdgePositions(draggingBounds);

    // Track best snap for each axis
    let bestSnapX: { delta: number; distance: number } | null = null;
    let bestSnapY: { delta: number; distance: number } | null = null;

    // Track matches for building guide extents
    const verticalMatches: Array<{
        position: number;
        candidateBounds: BoundingBox;
        delta: number;
        distance: number;
    }> = [];
    const horizontalMatches: Array<{
        position: number;
        candidateBounds: BoundingBox;
        delta: number;
        distance: number;
    }> = [];

    const horizontalEdges: HorizontalEdge[] = ["left", "center", "right"];
    const verticalEdges: VerticalEdge[] = ["top", "middle", "bottom"];

    for (const candidate of candidates) {
        // Skip excluded elements (being dragged) and pen strokes
        if (excludeIds.has(candidate.id)) continue;
        if (candidate.type === "pen") continue;
        if (candidate.type === "laser") continue;
        if (candidate.hidden) continue;
        if (candidate.locked) continue;

        const candidateBounds = getBoundingBox(candidate);
        if (!candidateBounds) continue;

        const candidateEdges = getEdgePositions(candidateBounds);

        // Check horizontal alignment (vertical guide lines - X axis)
        for (const sourceEdge of horizontalEdges) {
            for (const targetEdge of horizontalEdges) {
                const sourcePos = draggingEdges[sourceEdge];
                const targetPos = candidateEdges[targetEdge];
                const distance = Math.abs(sourcePos - targetPos);

                if (distance <= threshold) {
                    const delta = targetPos - sourcePos;

                    // Track if this is the best snap for X
                    if (!bestSnapX || distance < bestSnapX.distance) {
                        bestSnapX = { delta, distance };
                    }

                    verticalMatches.push({
                        position: targetPos,
                        candidateBounds,
                        delta,
                        distance,
                    });
                }
            }
        }

        // Check vertical alignment (horizontal guide lines - Y axis)
        for (const sourceEdge of verticalEdges) {
            for (const targetEdge of verticalEdges) {
                const sourcePos = draggingEdges[sourceEdge];
                const targetPos = candidateEdges[targetEdge];
                const distance = Math.abs(sourcePos - targetPos);

                if (distance <= threshold) {
                    const delta = targetPos - sourcePos;

                    // Track if this is the best snap for Y
                    if (!bestSnapY || distance < bestSnapY.distance) {
                        bestSnapY = { delta, distance };
                    }

                    horizontalMatches.push({
                        position: targetPos,
                        candidateBounds,
                        delta,
                        distance,
                    });
                }
            }
        }
    }

    // Build guides with proper extents
    const guides: AlignmentGuide[] = [];

    // Calculate snapped dragging bounds
    const snappedDraggingBounds = {
        ...draggingBounds,
        x: draggingBounds.x + (bestSnapX?.delta ?? 0),
        y: draggingBounds.y + (bestSnapY?.delta ?? 0),
    };

    // Group vertical matches by position and build guides
    if (bestSnapX) {
        const relevantMatches = verticalMatches.filter(
            (m) => Math.abs(m.delta - bestSnapX!.delta) < 0.5,
        );

        // Group by position
        const byPosition = new Map<number, BoundingBox[]>();
        for (const match of relevantMatches) {
            const key = Math.round(match.position * 100) / 100;
            if (!byPosition.has(key)) {
                byPosition.set(key, []);
            }
            byPosition.get(key)!.push(match.candidateBounds);
        }

        for (const [position, candidateBoundsList] of byPosition) {
            // Find the extent in Y direction (vertical line spans Y)
            let minY = snappedDraggingBounds.y;
            let maxY = snappedDraggingBounds.y + snappedDraggingBounds.height;

            for (const cb of candidateBoundsList) {
                minY = Math.min(minY, cb.y);
                maxY = Math.max(maxY, cb.y + cb.height);
            }

            guides.push({
                type: "vertical",
                position,
                start: minY - GUIDE_EXTENSION,
                end: maxY + GUIDE_EXTENSION,
            });
        }
    }

    // Group horizontal matches by position and build guides
    if (bestSnapY) {
        const relevantMatches = horizontalMatches.filter(
            (m) => Math.abs(m.delta - bestSnapY!.delta) < 0.5,
        );

        // Group by position
        const byPosition = new Map<number, BoundingBox[]>();
        for (const match of relevantMatches) {
            const key = Math.round(match.position * 100) / 100;
            if (!byPosition.has(key)) {
                byPosition.set(key, []);
            }
            byPosition.get(key)!.push(match.candidateBounds);
        }

        for (const [position, candidateBoundsList] of byPosition) {
            // Find the extent in X direction (horizontal line spans X)
            let minX = snappedDraggingBounds.x;
            let maxX = snappedDraggingBounds.x + snappedDraggingBounds.width;

            for (const cb of candidateBoundsList) {
                minX = Math.min(minX, cb.x);
                maxX = Math.max(maxX, cb.x + cb.width);
            }

            guides.push({
                type: "horizontal",
                position,
                start: minX - GUIDE_EXTENSION,
                end: maxX + GUIDE_EXTENSION,
            });
        }
    }

    return {
        guides,
        snapDeltaX: bestSnapX?.delta ?? 0,
        snapDeltaY: bestSnapY?.delta ?? 0,
    };
}
