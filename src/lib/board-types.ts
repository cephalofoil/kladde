export type Tool =
  | "hand"
  | "select"
  | "lasso"
  | "pen"
  | "highlighter"
  | "line"
  | "arrow"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "frame"
  | "eraser"
  | "text"
  | "laser"
  | "tile";

export type TileType =
  | "tile-text"
  | "tile-note"
  | "tile-code"
  | "tile-mermaid"
  | "tile-image";

export interface Point {
  x: number;
  y: number;
}

export interface TileContent {
  // Text tile
  richText?: string;
  // Note tile
  noteText?: string;
  // Code tile
  code?: string;
  language?: string;
  // Mermaid tile
  chart?: string;
  mermaidScale?: number;
  mermaidOffsetX?: number;
  mermaidOffsetY?: number;
  // Bookmark tile
  url?: string;
  bookmarkTitle?: string;
  bookmarkDescription?: string;
  favicon?: string;
  siteName?: string;
  imageUrl?: string;
  displayName?: string;
  // Image tile
  imageSrc?: string;
  imageAlt?: string;
  // Shape tile
  shape?: "rectangle" | "circle" | "triangle";
  shapeFill?: string;
  // Tile header customization
  headerBgColor?: string;
  headerTextColor?: string;
}

/**
 * Describes a connection between an arrow endpoint and a shape/tile.
 * Used to maintain arrow attachments when shapes move.
 */
export interface ArrowConnection {
  /** The ID of the connected element (shape or tile) */
  elementId: string;
  /** The snap point position type on the connected element */
  position: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
}

export interface BoardElement {
  id: string;
  type:
    | "pen"
    | "line"
    | "arrow"
    | "rectangle"
    | "diamond"
    | "ellipse"
    | "text"
    | "frame"
    | "web-embed"
    | "laser"
    | "tile";
  penMode?: "pen" | "highlighter";
  groupId?: string;
  points: Point[];
  /**
   * Rotation in degrees, applied around the element's current bounding-box center.
   */
  rotation?: number;
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /**
   * Connection info for the start point of an arrow/line.
   * When set, the arrow endpoint stays attached to the connected element.
   */
  startConnection?: ArrowConnection;
  /**
   * Connection info for the end point of an arrow/line.
   * When set, the arrow endpoint stays attached to the connected element.
   */
  endConnection?: ArrowConnection;
  // For text scaling/squishing
  scaleX?: number;
  scaleY?: number;
  // For text wrapping in textbox mode
  isTextBox?: boolean;
  // For frame tool
  label?: string;
  // For web embed
  url?: string;
  // For laser pointer
  timestamp?: number;
  // Style properties
  opacity?: number;
  strokeStyle?: "solid" | "dashed" | "dotted";
  cornerRadius?: number;
  lineCap?: "butt" | "round";
  // Connector (line/arrow) properties
  connectorStyle?: "sharp" | "curved" | "elbow";
  elbowRoute?: "vertical" | "horizontal";
  arrowStart?:
    | "none"
    | "arrow"
    | "triangle"
    | "triangle-outline"
    | "diamond"
    | "diamond-outline"
    | "circle"
    | "circle-outline"
    | "bar";
  arrowEnd?:
    | "none"
    | "arrow"
    | "triangle"
    | "triangle-outline"
    | "diamond"
    | "diamond-outline"
    | "circle"
    | "circle-outline"
    | "bar";
  // Text properties
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  fontSize?: number;
  letterSpacing?: number;
  lineHeight?: number;
  // Layer order
  zIndex?: number;
  // Layer visibility and lock
  hidden?: boolean;
  locked?: boolean;
  // Folder organization
  folderId?: string;
  // Pattern fill properties
  fillPattern?: "none" | "solid";
  isClosed?: boolean;
  // Tile properties
  tileType?: TileType;
  tileTitle?: string;
  tileContent?: TileContent;
}

export interface Cursor {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

export interface LayerFolder {
  id: string;
  name: string;
  collapsed?: boolean;
  zIndex?: number;
}

export const COLORS = [
  "#000000",
  "#ffffff",
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#a3e635",
  "#4ade80",
  "#34d399",
  "#22d3d8",
  "#38bdf8",
  "#60a5fa",
  "#818cf8",
  "#a78bfa",
  "#c084fc",
  "#e879f9",
  "#f472b6",
];

export const STROKE_WIDTHS = [2, 4, 6, 8, 12];
export const HIGHLIGHTER_STROKE_WIDTHS = [8, 12, 16, 24, 32];

export const FONTS = [
  { name: "Inter", value: "var(--font-inter)" },
  { name: "Roboto", value: "var(--font-roboto)" },
  { name: "Playfair", value: "var(--font-playfair)" },
  { name: "Merriweather", value: "var(--font-merriweather)" },
  { name: "Fira Code", value: "var(--font-fira-code)" },
  { name: "Caveat", value: "var(--font-caveat)" },
  { name: "Lobster", value: "var(--font-lobster)" },
];

export const FONT_SIZES = [
  8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96,
];

export const DEFAULT_PEN_FILL_COLOR = "#d1d5db";

// Helper to check if two line segments intersect
function segmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point,
): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }
  return false;
}

function direction(p1: Point, p2: Point, p3: Point): number {
  return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}

// Calculate the area of a polygon using the shoelace formula
function calculatePolygonArea(points: Point[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

// Utility function to detect if a pen stroke forms a closed/enclosed shape
// Checks if the path self-intersects or if start/end are close enough to form an enclosure
export function isClosedShape(
  points: Point[],
  threshold: number = 40,
): boolean {
  if (points.length < 10) return false;

  // Check 1: Start and end points are close
  const first = points[0];
  const last = points[points.length - 1];
  const distance = Math.sqrt(
    Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2),
  );
  if (distance < threshold) {
    return true;
  }

  // Check 2: Path self-intersects (creates an enclosed area)
  // Sample points to reduce computation (check every nth segment)
  const step = Math.max(1, Math.floor(points.length / 50));
  const sampledPoints: Point[] = [];
  for (let i = 0; i < points.length; i += step) {
    sampledPoints.push(points[i]);
  }
  // Always include last point
  if (sampledPoints[sampledPoints.length - 1] !== points[points.length - 1]) {
    sampledPoints.push(points[points.length - 1]);
  }

  // Check for self-intersection
  for (let i = 0; i < sampledPoints.length - 2; i++) {
    for (let j = i + 2; j < sampledPoints.length - 1; j++) {
      // Skip adjacent segments
      if (i === 0 && j === sampledPoints.length - 2) continue;

      if (
        segmentsIntersect(
          sampledPoints[i],
          sampledPoints[i + 1],
          sampledPoints[j],
          sampledPoints[j + 1],
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

export interface ShadeworksFile {
  type: "kladde" | "shadeworks"; // Support both for backwards compatibility
  version: number;
  elements: BoardElement[];
  appState: {
    canvasBackground: "none" | "dots" | "lines" | "grid";
    gridSize?: number;
    viewBackgroundColor?: string;
  };
}
