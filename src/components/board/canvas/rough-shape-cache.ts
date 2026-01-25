import rough from "roughjs";
import type { Drawable, Options } from "roughjs/bin/core";
import type { RoughGenerator } from "roughjs/bin/generator";
import type { BoardElement, Point } from "@/lib/board-types";
import { getElbowPolylineForVertices } from "./curves";
import { normalizeArrowhead, getArrowheadPoints } from "@/lib/arrowheads";
import { getAdjustedRoughness } from "@/lib/roughness";

// Cache to store generated rough.js shapes
const shapeCache = new WeakMap<
  BoardElement,
  Map<string, Drawable | Drawable[] | null>
>();

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
function generateRoughOptions(
  element: BoardElement,
  baseRoughness: number,
  bowing: number,
) {
  const seed = hashCode(element.id);
  const strokeWidth = element.strokeWidth ?? 2;
  const elStrokeStyle = element.strokeStyle || "solid";
  const fillPattern =
    element.fillPattern ??
    (element.fillColor &&
    element.fillColor !== "none" &&
    element.fillColor !== "transparent"
      ? "solid"
      : "none");
  const fillStyle =
    fillPattern === "cross-hatch"
      ? "cross-hatch"
      : fillPattern === "zigzag"
        ? "zigzag"
        : fillPattern === "solid"
          ? "solid"
          : "hachure";

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
      fillPattern !== "none" &&
      element.fillColor &&
      element.fillColor !== "transparent"
        ? element.fillColor
        : undefined,
    fillStyle,
    fillWeight: strokeWidth / 2,
    hachureGap: strokeWidth * 4,
    roughness: getAdjustedRoughness(element, baseRoughness),
    bowing,
    disableMultiStroke: elStrokeStyle !== "solid",
    disableMultiStrokeFill: fillStyle === "solid",
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
 * Generate rough.js shape for an element
 */
export function generateElementShape(
  element: BoardElement,
  options?: { roughness?: number; bowing?: number },
): Drawable | Drawable[] | null {
  const baseRoughness = options?.roughness ?? 2;
  const bowing = options?.bowing ?? 1;
  const cacheKey = `${baseRoughness}:${bowing}`;
  const cached = shapeCache.get(element);
  const cachedShape = cached?.get(cacheKey);
  if (cachedShape !== undefined) {
    return cachedShape;
  }

  // Create a rough.js generator
  const generator = rough.generator();
  const roughOptions = generateRoughOptions(element, baseRoughness, bowing);

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
            ...roughOptions,
            preserveVertices: true,
          });
        } else {
          shape = generator.rectangle(0, 0, w, h, roughOptions);
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
            ...roughOptions,
            preserveVertices: true,
          });
        } else {
          const points = getDiamondPoints(w, h);
          shape = generator.polygon(points, roughOptions);
        }
        break;
      }

      case "ellipse": {
        const w = element.width ?? 0;
        const h = element.height ?? 0;
        const cx = w / 2;
        const cy = h / 2;
        shape = generator.ellipse(cx, cy, w, h, {
          ...roughOptions,
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
            ...roughOptions,
            fill: undefined,
          });
        } else {
          // Use linearPath for sharp and elbow connectors
          lineShape = generator.linearPath(pathData, {
            ...roughOptions,
            fill: undefined,
          });
        }

        // Handle arrows
        if (element.type === "arrow") {
          const shapes: Drawable[] = [lineShape];
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
              normalizeArrowhead(element.arrowStart),
              roughOptions,
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
              normalizeArrowhead(element.arrowEnd),
              roughOptions,
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

      case "pen": {
        if (
          !element.isClosed ||
          element.points.length < 3 ||
          element.fillPattern === "none" ||
          element.fillColor === "transparent" ||
          element.fillColor === undefined
        ) {
          shape = null;
          break;
        }
        const points = element.points.map(
          (p) => [p.x, p.y] as [number, number],
        );
        shape = generator.polygon(points, roughOptions);
        break;
      }

      default:
        shape = null;
    }
  } catch (error) {
    console.error("Error generating rough shape:", error);
    shape = null;
  }

  // Cache the result
  const nextCache = cached ?? new Map<string, Drawable | Drawable[] | null>();
  nextCache.set(cacheKey, shape);
  shapeCache.set(element, nextCache);
  return shape;
}

/**
 * Create arrowhead shape
 */
function createArrowheadShape(
  generator: RoughGenerator,
  tip: { x: number; y: number },
  from: { x: number; y: number },
  markerType:
    | NonNullable<BoardElement["arrowStart"]>
    | NonNullable<BoardElement["arrowEnd"]>,
  options: Options,
): Drawable | Drawable[] | null {
  const points = getArrowheadPoints(
    tip,
    from,
    normalizeArrowhead(markerType),
    options.strokeWidth ?? 1,
  );
  if (!points) return null;
  const roughnessLimit =
    markerType === "dot" ||
    markerType === "circle" ||
    markerType === "circle_outline"
      ? 0.5
      : 1;
  const arrowOptions = {
    ...options,
    fillStyle: "solid",
    roughness: Math.min(roughnessLimit, options.roughness || 0),
  };

  switch (markerType) {
    case "circle":
    case "circle_outline":
    case "dot": {
      const [x, y, diameter] = points;
      return generator.circle(x, y, diameter, {
        ...arrowOptions,
        fill: markerType === "circle_outline" ? undefined : options.stroke,
      });
    }

    case "triangle":
    case "triangle_outline": {
      const [x1, y1, x2, y2, x3, y3] = points;
      return generator.polygon(
        [
          [x1, y1],
          [x2, y2],
          [x3, y3],
          [x1, y1],
        ],
        {
          ...arrowOptions,
          fill: markerType === "triangle_outline" ? undefined : options.stroke,
        },
      );
    }

    case "diamond":
    case "diamond_outline": {
      const [x1, y1, x2, y2, x3, y3, x4, y4] = points;
      return generator.polygon(
        [
          [x1, y1],
          [x2, y2],
          [x3, y3],
          [x4, y4],
          [x1, y1],
        ],
        {
          ...arrowOptions,
          fill: markerType === "diamond_outline" ? undefined : options.stroke,
        },
      );
    }

    case "crowfoot_one": {
      const [, , x2, y2, x3, y3] = points;
      return generator.line(x2, y2, x3, y3, arrowOptions);
    }

    case "crowfoot_many":
    case "crowfoot_one_or_many": {
      const [x1, y1, x2, y2, x3, y3] = points;
      const lines = [
        generator.line(x2, y2, x1, y1, arrowOptions),
        generator.line(x3, y3, x1, y1, arrowOptions),
      ];
      if (markerType === "crowfoot_one_or_many") {
        const barPoints = getArrowheadPoints(
          tip,
          from,
          "crowfoot_one",
          options.strokeWidth ?? 1,
        );
        if (barPoints) {
          const [, , bx1, by1, bx2, by2] = barPoints;
          lines.push(generator.line(bx1, by1, bx2, by2, arrowOptions));
        }
      }
      return lines;
    }

    case "bar": {
      const [, , x2, y2, x3, y3] = points;
      return generator.line(x2, y2, x3, y3, arrowOptions);
    }

    case "arrow": {
      const [x1, y1, x2, y2, x3, y3] = points;
      return [
        generator.line(x2, y2, x1, y1, arrowOptions),
        generator.line(x3, y3, x1, y1, arrowOptions),
      ];
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
