import rough from "roughjs";
import type { Drawable } from "roughjs/bin/core";
import type { BoardElement, Point } from "@/lib/board-types";
import { getElbowPolylineForVertices } from "./curves";

// Cache to store generated rough.js shapes
const shapeCache = new WeakMap<BoardElement, Drawable | Drawable[] | null>();

// Simple hash function to convert element ID to a number seed
function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

/**
 * Generate rough.js options based on element properties
 */
function generateRoughOptions(element: BoardElement) {
    const seed = hashCode(element.id);
    const strokeWidth = element.strokeWidth ?? 2;
    const elStrokeStyle = element.strokeStyle || "solid";

    return {
        seed,
        stroke: element.strokeColor,
        strokeWidth,
        strokeLineDash:
            elStrokeStyle === "dashed"
                ? [12, 8]
                : elStrokeStyle === "dotted"
                  ? [3, 6]
                  : undefined,
        fill:
            element.fillColor && element.fillColor !== "transparent"
                ? element.fillColor
                : undefined,
        fillStyle:
            element.fillPattern === "criss-cross"
                ? ("cross-hatch" as const)
                : ("hachure" as const),
        fillWeight: strokeWidth / 2,
        hachureGap: strokeWidth * 4,
        roughness: 2, // Increased from 1 to 2 for more sketchiness
        bowing: 2, // Increased from 1 to 2 for more wobble
        disableMultiStroke: elStrokeStyle !== "solid",
    };
}

/**
 * Get diamond points for a given width and height
 */
function getDiamondPoints(width: number, height: number): [number, number][] {
    const cx = width / 2;
    const cy = height / 2;
    return [
        [cx, 0],
        [width, cy],
        [cx, height],
        [0, cy],
    ];
}

function getRoundedDiamondPath(
    width: number,
    height: number,
    cornerRadius: number,
): string {
    const cx = width / 2;
    const cy = height / 2;
    const top = { x: cx, y: 0 };
    const right = { x: width, y: cy };
    const bottom = { x: cx, y: height };
    const left = { x: 0, y: cy };

    const edgeLength = Math.hypot(right.x - top.x, right.y - top.y);
    const maxRadius = edgeLength / 3;
    const r = Math.min(cornerRadius, maxRadius);

    const getPointAlongEdge = (
        from: { x: number; y: number },
        to: { x: number; y: number },
        dist: number,
    ) => {
        const len = Math.hypot(to.x - from.x, to.y - from.y);
        const t = len === 0 ? 0 : dist / len;
        return {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
        };
    };

    const topToRight = getPointAlongEdge(top, right, r);
    const rightFromTop = getPointAlongEdge(right, top, r);
    const rightToBottom = getPointAlongEdge(right, bottom, r);
    const bottomFromRight = getPointAlongEdge(bottom, right, r);
    const bottomToLeft = getPointAlongEdge(bottom, left, r);
    const leftFromBottom = getPointAlongEdge(left, bottom, r);
    const leftToTop = getPointAlongEdge(left, top, r);
    const topFromLeft = getPointAlongEdge(top, left, r);

    return (
        `M ${topToRight.x} ${topToRight.y} ` +
        `L ${rightFromTop.x} ${rightFromTop.y} ` +
        `Q ${right.x} ${right.y}, ${rightToBottom.x} ${rightToBottom.y} ` +
        `L ${bottomFromRight.x} ${bottomFromRight.y} ` +
        `Q ${bottom.x} ${bottom.y}, ${bottomToLeft.x} ${bottomToLeft.y} ` +
        `L ${leftFromBottom.x} ${leftFromBottom.y} ` +
        `Q ${left.x} ${left.y}, ${leftToTop.x} ${leftToTop.y} ` +
        `L ${topFromLeft.x} ${topFromLeft.y} ` +
        `Q ${top.x} ${top.y}, ${topToRight.x} ${topToRight.y} ` +
        `Z`
    );
}

/**
 * Get arrowhead points
 */
function getArrowheadPoints(
    tip: { x: number; y: number },
    from: { x: number; y: number },
    size: number,
): { x1: number; y1: number; x2: number; y2: number } {
    const angle = Math.atan2(from.y - tip.y, from.x - tip.x);
    const arrowAngle = Math.PI / 6; // 30 degrees

    return {
        x1: tip.x + size * Math.cos(angle - arrowAngle),
        y1: tip.y + size * Math.sin(angle - arrowAngle),
        x2: tip.x + size * Math.cos(angle + arrowAngle),
        y2: tip.y + size * Math.sin(angle + arrowAngle),
    };
}

/**
 * Generate rough.js shape for an element
 */
export function generateElementShape(
    element: BoardElement,
): Drawable | Drawable[] | null {
    // Check cache first
    const cached = shapeCache.get(element);
    if (cached !== undefined) {
        return cached;
    }

    // Create a rough.js generator
    const generator = rough.generator();
    const options = generateRoughOptions(element);

    let shape: Drawable | Drawable[] | null = null;

    try {
        switch (element.type) {
            case "rectangle": {
                const w = element.width ?? 0;
                const h = element.height ?? 0;
                const r = element.cornerRadius ?? 0;

                if (r > 0) {
                    // Use SVG path with quadratic Bézier curves for smooth corners
                    // This is the same approach Excalidraw uses
                    const maxRadius = Math.min(w / 2, h / 2);
                    const radius = Math.min(r, maxRadius);

                    // Build path using quadratic curves (Q) at corners
                    // M = move, L = line, Q = quadratic bezier, Z = close path
                    const path =
                        `M ${radius} 0 ` +
                        `L ${w - radius} 0 ` +
                        `Q ${w} 0, ${w} ${radius} ` +
                        `L ${w} ${h - radius} ` +
                        `Q ${w} ${h}, ${w - radius} ${h} ` +
                        `L ${radius} ${h} ` +
                        `Q 0 ${h}, 0 ${h - radius} ` +
                        `L 0 ${radius} ` +
                        `Q 0 0, ${radius} 0 ` +
                        `Z`;

                    // preserveVertices ensures smooth connections between path segments
                    shape = generator.path(path, {
                        ...options,
                        preserveVertices: true,
                    });
                } else {
                    shape = generator.rectangle(0, 0, w, h, options);
                }
                break;
            }

            case "diamond": {
                const w = element.width ?? 0;
                const h = element.height ?? 0;
                const r = element.cornerRadius ?? 0;
                if (r > 0) {
                    const path = getRoundedDiamondPath(w, h, r);
                    shape = generator.path(path, {
                        ...options,
                        preserveVertices: true,
                    });
                } else {
                    const points = getDiamondPoints(w, h);
                    shape = generator.polygon(points, options);
                }
                break;
            }

            case "ellipse": {
                const w = element.width ?? 0;
                const h = element.height ?? 0;
                const cx = w / 2;
                const cy = h / 2;
                shape = generator.ellipse(cx, cy, w, h, {
                    ...options,
                    curveFitting: 1,
                });
                break;
            }

            case "line":
            case "arrow": {
                if (element.points.length < 2) {
                    shape = null;
                    break;
                }

                const connectorStyle = element.connectorStyle || "sharp";
                const start = element.points[0];
                const end = element.points[element.points.length - 1];
                const hasCorner = element.points.length >= 3;
                const control = hasCorner ? element.points[1] : null;

                let pathData: [number, number][];

                // Determine the actual points to render based on connector style
                if (hasCorner && control) {
                    if (connectorStyle === "curved") {
                        // For curved connectors with exactly 3 points, use quadratic bezier
                        // For more points, use Catmull-Rom spline (roughjs curve)
                        pathData = element.points.map((p) => [p.x, p.y]);
                    } else if (connectorStyle === "elbow") {
                        // Always use getElbowPolylineForVertices for elbow arrows
                        // This correctly handles paths from generateElbowRouteAroundObstacles
                        const elbowPolyline = getElbowPolylineForVertices(
                            element.points,
                            0.5,
                        );
                        pathData = elbowPolyline.map((p) => [p.x, p.y]);
                    } else {
                        // Sharp connector: use points as-is
                        pathData = element.points.map((p) => [p.x, p.y]);
                    }
                } else {
                    // No corner: just start and end
                    pathData = element.points.map((p) => [p.x, p.y]);
                }

                let lineShape: Drawable;
                if (connectorStyle === "curved" && hasCorner) {
                    // Use rough.js curve for smooth curved lines
                    lineShape = generator.curve(pathData, {
                        ...options,
                        fill: undefined,
                    });
                } else {
                    // Use linearPath for sharp and elbow connectors
                    lineShape = generator.linearPath(pathData, {
                        ...options,
                        fill: undefined,
                    });
                }

                // Handle arrows
                if (element.type === "arrow") {
                    const shapes: Drawable[] = [lineShape];
                    const markerSize = Math.max(
                        6,
                        (element.strokeWidth ?? 2) * 3,
                    );

                    // Use pathData for arrowhead positioning (important for elbow connectors)
                    const renderPoints: Point[] = pathData.map(([x, y]) => ({
                        x,
                        y,
                    }));

                    // Start arrowhead
                    if (
                        element.arrowStart &&
                        element.arrowStart !== "none" &&
                        renderPoints.length >= 2
                    ) {
                        const tip = renderPoints[0];
                        const from = renderPoints[1];
                        const arrowheadShape = createArrowheadShape(
                            generator,
                            tip,
                            from,
                            markerSize,
                            element.arrowStart,
                            options,
                        );
                        if (arrowheadShape) {
                            shapes.push(
                                ...(Array.isArray(arrowheadShape)
                                    ? arrowheadShape
                                    : [arrowheadShape]),
                            );
                        }
                    }

                    // End arrowhead
                    if (
                        element.arrowEnd &&
                        element.arrowEnd !== "none" &&
                        renderPoints.length >= 2
                    ) {
                        const tip = renderPoints[renderPoints.length - 1];
                        const from = renderPoints[renderPoints.length - 2];
                        const arrowheadShape = createArrowheadShape(
                            generator,
                            tip,
                            from,
                            markerSize,
                            element.arrowEnd,
                            options,
                        );
                        if (arrowheadShape) {
                            shapes.push(
                                ...(Array.isArray(arrowheadShape)
                                    ? arrowheadShape
                                    : [arrowheadShape]),
                            );
                        }
                    }

                    shape = shapes;
                } else {
                    shape = lineShape;
                }
                break;
            }

            case "pen":
                // Pen strokes don't use rough.js
                shape = null;
                break;

            default:
                shape = null;
        }
    } catch (error) {
        console.error("Error generating rough shape:", error);
        shape = null;
    }

    // Cache the result
    shapeCache.set(element, shape);
    return shape;
}

/**
 * Create arrowhead shape
 */
function createArrowheadShape(
    generator: any,
    tip: { x: number; y: number },
    from: { x: number; y: number },
    size: number,
    markerType:
        | NonNullable<BoardElement["arrowStart"]>
        | NonNullable<BoardElement["arrowEnd"]>,
    options: any,
): Drawable | Drawable[] | null {
    const points = getArrowheadPoints(tip, from, size);

    switch (markerType) {
        case "arrow":
        case "triangle": {
            // Draw two lines forming a V
            const line1 = generator.line(tip.x, tip.y, points.x1, points.y1, {
                ...options,
                fill: undefined,
            });
            const line2 = generator.line(tip.x, tip.y, points.x2, points.y2, {
                ...options,
                fill: undefined,
            });
            return [line1, line2];
        }

        case "triangle-outline": {
            // Triangle outline
            const trianglePoints: [number, number][] = [
                [tip.x, tip.y],
                [points.x1, points.y1],
                [points.x2, points.y2],
            ];
            return generator.polygon(trianglePoints, {
                ...options,
                fill: undefined,
            });
        }

        case "diamond":
        case "diamond-outline": {
            const halfSize = size / 2;
            const angle = Math.atan2(from.y - tip.y, from.x - tip.x);
            const perpAngle = angle + Math.PI / 2;

            const diamondPoints: [number, number][] = [
                [tip.x, tip.y],
                [
                    tip.x + halfSize * Math.cos(perpAngle),
                    tip.y + halfSize * Math.sin(perpAngle),
                ],
                [
                    tip.x + size * Math.cos(angle),
                    tip.y + size * Math.sin(angle),
                ],
                [
                    tip.x - halfSize * Math.cos(perpAngle),
                    tip.y - halfSize * Math.sin(perpAngle),
                ],
            ];

            return generator.polygon(diamondPoints, {
                ...options,
                fill: markerType === "diamond" ? options.stroke : undefined,
            });
        }

        case "circle":
        case "circle-outline": {
            const angle = Math.atan2(from.y - tip.y, from.x - tip.x);
            const center = {
                x: tip.x + (size / 2) * Math.cos(angle),
                y: tip.y + (size / 2) * Math.sin(angle),
            };

            return generator.circle(center.x, center.y, size / 2, {
                ...options,
                fill: markerType === "circle" ? options.stroke : undefined,
            });
        }

        case "bar": {
            const angle = Math.atan2(from.y - tip.y, from.x - tip.x);
            const perpAngle = angle + Math.PI / 2;
            const barHalf = size * 0.65;

            return generator.line(
                tip.x + barHalf * Math.cos(perpAngle),
                tip.y + barHalf * Math.sin(perpAngle),
                tip.x - barHalf * Math.cos(perpAngle),
                tip.y - barHalf * Math.sin(perpAngle),
                options,
            );
        }

        case "none":
        default:
            return null;
    }
}

/**
 * Invalidate the cache for an element (call when element properties change)
 */
export function invalidateShapeForElement(element: BoardElement): void {
    shapeCache.delete(element);
}

/**
 * Get cached shape for an element
 */
export function getShapeForElement(
    element: BoardElement,
): Drawable | Drawable[] | null {
    return shapeCache.get(element) ?? null;
}
