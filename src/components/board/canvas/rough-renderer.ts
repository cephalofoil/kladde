import rough from "roughjs";
import type { BoardElement, Point } from "@/lib/board-types";

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
 * Creates a rough.js drawable for a given element
 * Returns an SVG path string that can be used in an SVG <path> element
 */
export function getRoughPath(element: BoardElement): string | null {
  // Create a virtual SVG element for rough.js
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);

  // Use element ID as seed to make rendering deterministic
  const seed = hashCode(element.id);

  const options = {
    roughness: 1.2,
    bowing: 1.7,
    stroke: element.strokeColor,
    strokeWidth: element.strokeWidth,
    fill: element.fillColor !== "transparent" ? element.fillColor : undefined,
    fillStyle: "hachure",
    fillWeight: element.strokeWidth / 2,
    hachureGap: element.strokeWidth * 2,
    seed: seed,
  };

  try {
    let drawable;

    switch (element.type) {
      case "rectangle": {
        const w = element.width ?? 0;
        const h = element.height ?? 0;
        drawable = rc.rectangle(0, 0, w, h, options);
        break;
      }

      case "diamond": {
        // Diamond is a rotated square
        const w = element.width ?? 0;
        const h = element.height ?? 0;
        const cx = w / 2;
        const cy = h / 2;
        const points: [number, number][] = [
          [cx, 0],
          [w, cy],
          [cx, h],
          [0, cy],
        ];
        drawable = rc.polygon(points, options);
        break;
      }

      case "ellipse": {
        const w = element.width ?? 0;
        const h = element.height ?? 0;
        const cx = w / 2;
        const cy = h / 2;
        drawable = rc.ellipse(cx, cy, w, h, options);
        break;
      }

      case "line":
      case "arrow": {
        if (element.points.length < 2) return null;

        const connectorStyle = element.connectorStyle || "sharp";

        if (connectorStyle === "sharp") {
          // For sharp lines, draw line segments
          const pathData: [number, number][] = element.points.map((p) => [
            p.x,
            p.y,
          ]);
          drawable = rc.linearPath(pathData, {
            ...options,
            fill: undefined, // Lines don't have fill
          });
        } else if (connectorStyle === "curved") {
          // For curved lines, use curve
          const pathData: [number, number][] = element.points.map((p) => [
            p.x,
            p.y,
          ]);
          drawable = rc.curve(pathData, {
            ...options,
            fill: undefined,
          });
        } else {
          // For elbow, draw as linear path
          const pathData: [number, number][] = element.points.map((p) => [
            p.x,
            p.y,
          ]);
          drawable = rc.linearPath(pathData, {
            ...options,
            fill: undefined,
          });
        }
        break;
      }

      case "pen": {
        // For pen strokes, we can't really use rough.js effectively
        // Return null to fall back to regular rendering
        return null;
      }

      default:
        return null;
    }

    if (!drawable) return null;

    // Extract the path data from the rough.js drawable
    // rough.js returns a node with children containing path elements
    const pathElements = Array.from(drawable.children).filter(
      (child) => child.nodeName === "path",
    );

    if (pathElements.length === 0) return null;

    // Combine all paths into a single path string
    const paths = pathElements
      .map((path) => path.getAttribute("d"))
      .filter((d): d is string => d !== null);

    return paths.join(" ");
  } catch (error) {
    console.error("Error generating rough path:", error);
    return null;
  }
}

/**
 * Get rough.js rendering options for arrow markers
 */
export function getRoughArrowMarker(
  markerType:
    | NonNullable<BoardElement["arrowStart"]>
    | NonNullable<BoardElement["arrowEnd"]>,
  strokeColor: string,
  strokeWidth: number,
  elementId: string,
): { path: string; width: number; height: number } | null {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rc = rough.svg(svg);

  // Use element ID + marker type as seed for deterministic rendering
  const seed = hashCode(elementId + markerType);

  const size = strokeWidth * 3;
  const options = {
    roughness: 1.2,
    bowing: 1.7,
    stroke: strokeColor,
    strokeWidth: strokeWidth,
    fill: strokeColor,
    seed: seed,
  };

  try {
    let drawable;

    switch (markerType) {
      case "arrow": {
        // Triangle pointing right
        const points: [number, number][] = [
          [0, 0],
          [size, size / 2],
          [0, size],
        ];
        drawable = rc.polygon(points, {
          ...options,
          fill: strokeColor,
        });
        break;
      }

      case "triangle":
      case "triangle-outline": {
        const points: [number, number][] = [
          [0, 0],
          [size, size / 2],
          [0, size],
        ];
        drawable = rc.polygon(points, {
          ...options,
          fill: markerType === "triangle" ? strokeColor : undefined,
        });
        break;
      }

      case "diamond":
      case "diamond-outline": {
        const half = size / 2;
        const points: [number, number][] = [
          [0, half],
          [half, 0],
          [size, half],
          [half, size],
        ];
        drawable = rc.polygon(points, {
          ...options,
          fill: markerType === "diamond" ? strokeColor : undefined,
        });
        break;
      }

      case "circle":
      case "circle-outline": {
        drawable = rc.circle(size / 2, size / 2, size, {
          ...options,
          fill: markerType === "circle" ? strokeColor : undefined,
        });
        break;
      }

      case "bar": {
        drawable = rc.line(0, 0, 0, size, options);
        break;
      }

      default:
        return null;
    }

    if (!drawable) return null;

    const pathElements = Array.from(drawable.children).filter(
      (child) => child.nodeName === "path",
    );

    if (pathElements.length === 0) return null;

    const paths = pathElements
      .map((path) => path.getAttribute("d"))
      .filter((d): d is string => d !== null);

    return {
      path: paths.join(" "),
      width: size,
      height: size,
    };
  } catch (error) {
    console.error("Error generating rough arrow marker:", error);
    return null;
  }
}
