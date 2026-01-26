import type { BoardElement } from "@/lib/board-types";
import type { BoundingBox } from "../types";
import { getBoundingBox } from "../shapes/shapes";

export type HorizontalEdge = "left" | "center" | "right";
export type VerticalEdge = "top" | "middle" | "bottom";

const GUIDE_EXTENSION = 20; // How far the guide extends beyond the objects

export interface AlignmentGuide {
  type: "horizontal" | "vertical";
  position: number; // x for vertical lines, y for horizontal lines
  start: number; // start position (y for vertical, x for horizontal)
  end: number; // end position (y for vertical, x for horizontal)
}

export interface DistanceGuide {
  axis: "horizontal" | "vertical"; // horizontal = gap in X direction, vertical = gap in Y direction
  distance: number; // the gap distance in canvas units
  gapStart: number; // start of gap (right edge of left element, or bottom of top element)
  gapEnd: number; // end of gap (left edge of right element, or top of bottom element)
  crossAxisPosition: number; // Y position for horizontal gaps, X position for vertical gaps
  isReference?: boolean; // true when showing the source gap for the snap distance
}

export interface AlignmentResult {
  guides: AlignmentGuide[];
  distanceGuides: DistanceGuide[];
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

interface CandidateBounds {
  id: string;
  bounds: BoundingBox;
}

/**
 * Find alignment guides for a dragging element against visible candidates.
 * Returns guides to render and snap deltas to apply.
 */
export function findAlignmentGuides(
  draggingBounds: BoundingBox,
  candidates: BoardElement[],
  excludeIds: Set<string>,
  threshold: number,
): AlignmentResult {
  const draggingEdges = getEdgePositions(draggingBounds);

  // Track best snap for each axis (same pattern as edge alignment)
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

  // Collect candidate bounds for distance snapping
  const candidateBoundsList: CandidateBounds[] = [];

  for (const candidate of candidates) {
    if (excludeIds.has(candidate.id)) continue;
    if (candidate.type === "pen") continue;
    if (candidate.type === "laser") continue;
    if (candidate.hidden) continue;
    if (candidate.locked) continue;

    const candidateBounds = getBoundingBox(candidate);
    if (!candidateBounds) continue;

    candidateBoundsList.push({ id: candidate.id, bounds: candidateBounds });

    const candidateEdges = getEdgePositions(candidateBounds);

    // Check horizontal alignment (vertical guide lines - X axis)
    for (const sourceEdge of horizontalEdges) {
      for (const targetEdge of horizontalEdges) {
        const sourcePos = draggingEdges[sourceEdge];
        const targetPos = candidateEdges[targetEdge];
        const distance = Math.abs(sourcePos - targetPos);

        if (distance <= threshold) {
          const delta = targetPos - sourcePos;

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

  // Build alignment guides with proper extents
  const guides: AlignmentGuide[] = [];

  const snappedDraggingBounds = {
    ...draggingBounds,
    x: draggingBounds.x + (bestSnapX?.delta ?? 0),
    y: draggingBounds.y + (bestSnapY?.delta ?? 0),
  };

  if (bestSnapX) {
    const relevantMatches = verticalMatches.filter(
      (m) => Math.abs(m.delta - bestSnapX!.delta) < 0.5,
    );

    const byPosition = new Map<number, BoundingBox[]>();
    for (const match of relevantMatches) {
      const key = Math.round(match.position * 100) / 100;
      if (!byPosition.has(key)) {
        byPosition.set(key, []);
      }
      byPosition.get(key)!.push(match.candidateBounds);
    }

    for (const [position, boundsList] of byPosition) {
      let minY = snappedDraggingBounds.y;
      let maxY = snappedDraggingBounds.y + snappedDraggingBounds.height;

      for (const cb of boundsList) {
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

  if (bestSnapY) {
    const relevantMatches = horizontalMatches.filter(
      (m) => Math.abs(m.delta - bestSnapY!.delta) < 0.5,
    );

    const byPosition = new Map<number, BoundingBox[]>();
    for (const match of relevantMatches) {
      const key = Math.round(match.position * 100) / 100;
      if (!byPosition.has(key)) {
        byPosition.set(key, []);
      }
      byPosition.get(key)!.push(match.candidateBounds);
    }

    for (const [position, boundsList] of byPosition) {
      let minX = snappedDraggingBounds.x;
      let maxX = snappedDraggingBounds.x + snappedDraggingBounds.width;

      for (const cb of boundsList) {
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

  // ===== DISTANCE SNAPPING =====
  // Find equal spacing opportunities using the same pattern as edge alignment

  let distanceSnapX: { delta: number; distance: number; gap: number } | null =
    null;
  let distanceSnapY: { delta: number; distance: number; gap: number } | null =
    null;
  const distanceGuides: DistanceGuide[] = [];
  let referenceGuideX: DistanceGuide | null = null;
  let referenceGuideY: DistanceGuide | null = null;

  // Only check distance snapping if we don't have edge alignment on that axis
  if (!bestSnapX || !bestSnapY) {
    const allBounds = candidateBoundsList.map((c) => c.bounds);

    // Sort by X for horizontal gap calculation
    const sortedByX = [...allBounds].sort((a, b) => a.x - b.x);
    // Sort by Y for vertical gap calculation
    const sortedByY = [...allBounds].sort((a, b) => a.y - b.y);

    // Collect all existing gaps between elements
    const existingHorizontalGaps: Array<{
      gap: number;
      left: BoundingBox;
      right: BoundingBox;
    }> = [];
    const existingVerticalGaps: Array<{
      gap: number;
      top: BoundingBox;
      bottom: BoundingBox;
    }> = [];

    for (let i = 0; i < sortedByX.length - 1; i++) {
      const left = sortedByX[i];
      const right = sortedByX[i + 1];
      const gap = right.x - (left.x + left.width);
      if (gap > 0) {
        existingHorizontalGaps.push({ gap, left, right });
      }
    }

    for (let i = 0; i < sortedByY.length - 1; i++) {
      const top = sortedByY[i];
      const bottom = sortedByY[i + 1];
      const gap = bottom.y - (top.y + top.height);
      if (gap > 0) {
        existingVerticalGaps.push({ gap, top, bottom });
      }
    }

    // Find neighbors for the dragging element
    const draggingLeft = draggingBounds.x;
    const draggingRight = draggingBounds.x + draggingBounds.width;
    const draggingTop = draggingBounds.y;
    const draggingBottom = draggingBounds.y + draggingBounds.height;

    // HORIZONTAL: Find left and right neighbors
    if (!bestSnapX) {
      let leftNeighbor: BoundingBox | null = null;
      let rightNeighbor: BoundingBox | null = null;

      for (const cb of allBounds) {
        const cbRight = cb.x + cb.width;
        const cbLeft = cb.x;

        // Vertical overlap check
        if (cb.y >= draggingBottom || cb.y + cb.height <= draggingTop) continue;

        // Left neighbor: right edge is left of dragging's left edge
        if (cbRight <= draggingLeft) {
          if (!leftNeighbor || cbRight > leftNeighbor.x + leftNeighbor.width) {
            leftNeighbor = cb;
          }
        }

        // Right neighbor: left edge is right of dragging's right edge
        if (cbLeft >= draggingRight) {
          if (!rightNeighbor || cbLeft < rightNeighbor.x) {
            rightNeighbor = cb;
          }
        }
      }

      // Case 1: Between two neighbors - snap to equal gaps
      if (leftNeighbor && rightNeighbor) {
        const leftNeighborRight = leftNeighbor.x + leftNeighbor.width;
        const rightNeighborLeft = rightNeighbor.x;
        const totalSpace = rightNeighborLeft - leftNeighborRight;
        const equalGap = (totalSpace - draggingBounds.width) / 2;

        if (equalGap > 0) {
          const targetLeft = leftNeighborRight + equalGap;
          const delta = targetLeft - draggingLeft;
          const dist = Math.abs(delta);

          if (dist <= threshold) {
            distanceSnapX = { delta, distance: dist, gap: equalGap };
          }
        }
      }
      // Case 2: Only left neighbor - match existing gaps
      else if (leftNeighbor) {
        const leftNeighborRight = leftNeighbor.x + leftNeighbor.width;

        for (const existingGap of existingHorizontalGaps) {
          const targetLeft = leftNeighborRight + existingGap.gap;
          const delta = targetLeft - draggingLeft;
          const dist = Math.abs(delta);

          if (
            dist <= threshold &&
            (!distanceSnapX || dist < distanceSnapX.distance)
          ) {
            distanceSnapX = { delta, distance: dist, gap: existingGap.gap };
            if (
              existingGap.left.y <
                existingGap.right.y + existingGap.right.height &&
              existingGap.left.y + existingGap.left.height > existingGap.right.y
            ) {
              const crossY =
                (Math.max(existingGap.left.y, existingGap.right.y) +
                  Math.min(
                    existingGap.left.y + existingGap.left.height,
                    existingGap.right.y + existingGap.right.height,
                  )) /
                2;
              referenceGuideX = {
                axis: "horizontal",
                distance: existingGap.gap,
                gapStart: existingGap.left.x + existingGap.left.width,
                gapEnd: existingGap.right.x,
                crossAxisPosition: crossY,
                isReference: true,
              };
            } else {
              referenceGuideX = null;
            }
          }
        }
      }
      // Case 3: Only right neighbor - match existing gaps
      else if (rightNeighbor) {
        const rightNeighborLeft = rightNeighbor.x;

        for (const existingGap of existingHorizontalGaps) {
          const targetRight = rightNeighborLeft - existingGap.gap;
          const targetLeft = targetRight - draggingBounds.width;
          const delta = targetLeft - draggingLeft;
          const dist = Math.abs(delta);

          if (
            dist <= threshold &&
            (!distanceSnapX || dist < distanceSnapX.distance)
          ) {
            distanceSnapX = { delta, distance: dist, gap: existingGap.gap };
            if (
              existingGap.left.y <
                existingGap.right.y + existingGap.right.height &&
              existingGap.left.y + existingGap.left.height > existingGap.right.y
            ) {
              const crossY =
                (Math.max(existingGap.left.y, existingGap.right.y) +
                  Math.min(
                    existingGap.left.y + existingGap.left.height,
                    existingGap.right.y + existingGap.right.height,
                  )) /
                2;
              referenceGuideX = {
                axis: "horizontal",
                distance: existingGap.gap,
                gapStart: existingGap.left.x + existingGap.left.width,
                gapEnd: existingGap.right.x,
                crossAxisPosition: crossY,
                isReference: true,
              };
            } else {
              referenceGuideX = null;
            }
          }
        }
      }
    }

    // VERTICAL: Find top and bottom neighbors
    if (!bestSnapY) {
      let topNeighbor: BoundingBox | null = null;
      let bottomNeighbor: BoundingBox | null = null;

      for (const cb of allBounds) {
        const cbBottom = cb.y + cb.height;
        const cbTop = cb.y;

        // Horizontal overlap check
        if (cb.x >= draggingRight || cb.x + cb.width <= draggingLeft) continue;

        // Top neighbor: bottom edge is above dragging's top edge
        if (cbBottom <= draggingTop) {
          if (!topNeighbor || cbBottom > topNeighbor.y + topNeighbor.height) {
            topNeighbor = cb;
          }
        }

        // Bottom neighbor: top edge is below dragging's bottom edge
        if (cbTop >= draggingBottom) {
          if (!bottomNeighbor || cbTop < bottomNeighbor.y) {
            bottomNeighbor = cb;
          }
        }
      }

      // Case 1: Between two neighbors - snap to equal gaps
      if (topNeighbor && bottomNeighbor) {
        const topNeighborBottom = topNeighbor.y + topNeighbor.height;
        const bottomNeighborTop = bottomNeighbor.y;
        const totalSpace = bottomNeighborTop - topNeighborBottom;
        const equalGap = (totalSpace - draggingBounds.height) / 2;

        if (equalGap > 0) {
          const targetTop = topNeighborBottom + equalGap;
          const delta = targetTop - draggingTop;
          const dist = Math.abs(delta);

          if (dist <= threshold) {
            distanceSnapY = { delta, distance: dist, gap: equalGap };
          }
        }
      }
      // Case 2: Only top neighbor - match existing gaps
      else if (topNeighbor) {
        const topNeighborBottom = topNeighbor.y + topNeighbor.height;

        for (const existingGap of existingVerticalGaps) {
          const targetTop = topNeighborBottom + existingGap.gap;
          const delta = targetTop - draggingTop;
          const dist = Math.abs(delta);

          if (
            dist <= threshold &&
            (!distanceSnapY || dist < distanceSnapY.distance)
          ) {
            distanceSnapY = { delta, distance: dist, gap: existingGap.gap };
            if (
              existingGap.top.x <
                existingGap.bottom.x + existingGap.bottom.width &&
              existingGap.top.x + existingGap.top.width > existingGap.bottom.x
            ) {
              const crossX =
                (Math.max(existingGap.top.x, existingGap.bottom.x) +
                  Math.min(
                    existingGap.top.x + existingGap.top.width,
                    existingGap.bottom.x + existingGap.bottom.width,
                  )) /
                2;
              referenceGuideY = {
                axis: "vertical",
                distance: existingGap.gap,
                gapStart: existingGap.top.y + existingGap.top.height,
                gapEnd: existingGap.bottom.y,
                crossAxisPosition: crossX,
                isReference: true,
              };
            } else {
              referenceGuideY = null;
            }
          }
        }
      }
      // Case 3: Only bottom neighbor - match existing gaps
      else if (bottomNeighbor) {
        const bottomNeighborTop = bottomNeighbor.y;

        for (const existingGap of existingVerticalGaps) {
          const targetBottom = bottomNeighborTop - existingGap.gap;
          const targetTop = targetBottom - draggingBounds.height;
          const delta = targetTop - draggingTop;
          const dist = Math.abs(delta);

          if (
            dist <= threshold &&
            (!distanceSnapY || dist < distanceSnapY.distance)
          ) {
            distanceSnapY = { delta, distance: dist, gap: existingGap.gap };
            if (
              existingGap.top.x <
                existingGap.bottom.x + existingGap.bottom.width &&
              existingGap.top.x + existingGap.top.width > existingGap.bottom.x
            ) {
              const crossX =
                (Math.max(existingGap.top.x, existingGap.bottom.x) +
                  Math.min(
                    existingGap.top.x + existingGap.top.width,
                    existingGap.bottom.x + existingGap.bottom.width,
                  )) /
                2;
              referenceGuideY = {
                axis: "vertical",
                distance: existingGap.gap,
                gapStart: existingGap.top.y + existingGap.top.height,
                gapEnd: existingGap.bottom.y,
                crossAxisPosition: crossX,
                isReference: true,
              };
            } else {
              referenceGuideY = null;
            }
          }
        }
      }
    }

    // Build distance guides if we're snapping
    if (distanceSnapX) {
      const snappedLeft = draggingLeft + distanceSnapX.delta;
      const gap = distanceSnapX.gap;

      // Include dragging element in the sorted list to find all matching gaps
      const draggingSnapped: BoundingBox = {
        x: snappedLeft,
        y: draggingTop,
        width: draggingBounds.width,
        height: draggingBounds.height,
      };
      const allWithDragging = [...allBounds, draggingSnapped].sort(
        (a, b) => a.x - b.x,
      );

      for (let i = 0; i < allWithDragging.length - 1; i++) {
        const left = allWithDragging[i];
        const right = allWithDragging[i + 1];
        const thisGap = right.x - (left.x + left.width);

        if (Math.abs(thisGap - gap) < 1) {
          // Check vertical overlap
          if (
            left.y < right.y + right.height &&
            left.y + left.height > right.y
          ) {
            const crossY =
              (Math.max(left.y, right.y) +
                Math.min(left.y + left.height, right.y + right.height)) /
              2;
            distanceGuides.push({
              axis: "horizontal",
              distance: gap,
              gapStart: left.x + left.width,
              gapEnd: right.x,
              crossAxisPosition: crossY,
              isReference:
                left !== draggingSnapped && right !== draggingSnapped,
            });
          }
        }
      }

      const refGuideX = referenceGuideX;
      if (
        refGuideX &&
        !distanceGuides.some(
          (guide) =>
            guide.axis === refGuideX.axis &&
            Math.abs(guide.gapStart - refGuideX.gapStart) < 0.5 &&
            Math.abs(guide.gapEnd - refGuideX.gapEnd) < 0.5 &&
            Math.abs(guide.crossAxisPosition - refGuideX.crossAxisPosition) <
              0.5,
        )
      ) {
        distanceGuides.push(refGuideX);
      }
    }

    if (distanceSnapY) {
      const snappedTop = draggingTop + distanceSnapY.delta;
      const gap = distanceSnapY.gap;

      const draggingSnapped: BoundingBox = {
        x: draggingLeft,
        y: snappedTop,
        width: draggingBounds.width,
        height: draggingBounds.height,
      };
      const allWithDragging = [...allBounds, draggingSnapped].sort(
        (a, b) => a.y - b.y,
      );

      for (let i = 0; i < allWithDragging.length - 1; i++) {
        const top = allWithDragging[i];
        const bottom = allWithDragging[i + 1];
        const thisGap = bottom.y - (top.y + top.height);

        if (Math.abs(thisGap - gap) < 1) {
          // Check horizontal overlap
          if (top.x < bottom.x + bottom.width && top.x + top.width > bottom.x) {
            const crossX =
              (Math.max(top.x, bottom.x) +
                Math.min(top.x + top.width, bottom.x + bottom.width)) /
              2;
            distanceGuides.push({
              axis: "vertical",
              distance: gap,
              gapStart: top.y + top.height,
              gapEnd: bottom.y,
              crossAxisPosition: crossX,
              isReference:
                top !== draggingSnapped && bottom !== draggingSnapped,
            });
          }
        }
      }

      const refGuideY = referenceGuideY;
      if (
        refGuideY &&
        !distanceGuides.some(
          (guide) =>
            guide.axis === refGuideY.axis &&
            Math.abs(guide.gapStart - refGuideY.gapStart) < 0.5 &&
            Math.abs(guide.gapEnd - refGuideY.gapEnd) < 0.5 &&
            Math.abs(guide.crossAxisPosition - refGuideY.crossAxisPosition) <
              0.5,
        )
      ) {
        distanceGuides.push(refGuideY);
      }
    }
  }

  // Determine final snap - edge alignment takes priority
  const finalSnapX = bestSnapX?.delta ?? distanceSnapX?.delta ?? 0;
  const finalSnapY = bestSnapY?.delta ?? distanceSnapY?.delta ?? 0;

  return {
    guides,
    distanceGuides,
    snapDeltaX: finalSnapX,
    snapDeltaY: finalSnapY,
  };
}
