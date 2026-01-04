export type Tool =
  | "hand"
  | "select"
  | "pen"
  | "highlighter"
  | "line"
  | "arrow"
  | "rectangle"
  | "diamond"
  | "ellipse"
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
  // Pattern fill properties
  fillPattern?: "none" | "solid" | "criss-cross";
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

// Utility function to detect if a pen stroke forms a closed shape
export function isClosedShape(
  points: Point[],
  threshold: number = 10,
): boolean {
  if (points.length < 10) return false;

  const first = points[0];
  const last = points[points.length - 1];
  const distance = Math.sqrt(
    Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2),
  );

  return distance < threshold;
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
