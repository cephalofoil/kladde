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
  | "tile-image"
  | "tile-document";

// Document section types for tile-document
export type DocumentSectionType =
  | "tile-content"
  | "frame-image"
  | "heading"
  | "text"
  | "spacer";

export interface DocumentSectionBase {
  id: string;
  type: DocumentSectionType;
}

export interface TileContentSection extends DocumentSectionBase {
  type: "tile-content";
  tileId: string;
  cachedContent?: TileContent;
  cachedTileType?: TileType;
  cachedTileTitle?: string;
  mermaidScale?: number;
}

export interface FrameImageSection extends DocumentSectionBase {
  type: "frame-image";
  frameId: string;
  cachedFrameLabel?: string;
  cachedFrameStyle?: FrameStyle;
  contentIncluded?: boolean;
}

export interface HeadingSection extends DocumentSectionBase {
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
}

export interface TextSection extends DocumentSectionBase {
  type: "text";
  content: string;
}

export interface SpacerSection extends DocumentSectionBase {
  type: "spacer";
  height: number; // in millimeters
}

export type DocumentSection =
  | TileContentSection
  | FrameImageSection
  | HeadingSection
  | TextSection
  | SpacerSection;

export interface DocumentLayout {
  pageFormat: "A4" | "Letter";
  orientation: "portrait" | "landscape";
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  sections: DocumentSection[];
}

export interface DocumentMetadata {
  author?: string;
  createdAt: number;
  modifiedAt: number;
}

export interface DocumentContent {
  title: string;
  description: string;
  layout: DocumentLayout;
  metadata: DocumentMetadata;
}

export interface Point {
  x: number;
  y: number;
}

export type NoteColor = "butter" | "mint" | "lavender" | "natural-tan";
export type NoteStyle = "classic" | "torn";
export type FrameStyle = "minimal" | "cutting-mat" | "notebook";

export interface TileContent {
  // Text tile
  richText?: string;
  // Note tile
  noteText?: string;
  noteColor?: NoteColor;
  noteStyle?: NoteStyle;
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
  // Document tile
  documentContent?: DocumentContent;
  // Tile header customization
  headerBgColor?: string;
  headerTextColor?: string;
}

export interface CommentAuthor {
  id: string;
  name: string;
}

export interface CommentMessage {
  id: string;
  author: CommentAuthor;
  text: string;
  createdAt: number;
  reactions?: CommentReaction[];
}

export interface CommentReaction {
  emoji: string;
  userIds: string[];
}

export interface BoardComment {
  id: string;
  x: number;
  y: number;
  elementId?: string | null;
  offset?: { x: number; y: number };
  createdAt: number;
  createdBy: CommentAuthor;
  messages: CommentMessage[];
  reactions: CommentReaction[];
  resolved?: boolean;
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
  frameStyle?: FrameStyle;
  frameId?: string;
  // For web embed
  url?: string;
  // For object links
  link?: string;
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
    | "triangle_outline"
    | "diamond"
    | "diamond-outline"
    | "diamond_outline"
    | "circle"
    | "circle-outline"
    | "circle_outline"
    | "dot"
    | "bar"
    | "crowfoot-one"
    | "crowfoot-many"
    | "crowfoot-one-many"
    | "crowfoot_one"
    | "crowfoot_many"
    | "crowfoot_one_or_many";
  arrowEnd?:
    | "none"
    | "arrow"
    | "triangle"
    | "triangle-outline"
    | "triangle_outline"
    | "diamond"
    | "diamond-outline"
    | "diamond_outline"
    | "circle"
    | "circle-outline"
    | "circle_outline"
    | "dot"
    | "bar"
    | "crowfoot-one"
    | "crowfoot-many"
    | "crowfoot-one-many"
    | "crowfoot_one"
    | "crowfoot_many"
    | "crowfoot_one_or_many";
  // Text properties
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  textVerticalAlign?: "top" | "middle" | "bottom";
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
  fillPattern?: "none" | "solid" | "hachure" | "cross-hatch" | "zigzag";
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
  { name: "Virgil", value: "var(--font-caveat)", icon: "hand" },
  { name: "Helvetica", value: "var(--font-inter)", icon: "normal" },
  { name: "Cascadia", value: "var(--font-fira-code)", icon: "code" },
] as const;

export const EXTRA_FONTS = [
  { name: "Comic Neue", value: '"Comic Neue", cursive', icon: "hand" },
  { name: "Pacifico", value: '"Pacifico", cursive', icon: "hand" },
  { name: "Roboto", value: '"Roboto", sans-serif', icon: "normal" },
  { name: "Open Sans", value: '"Open Sans", sans-serif', icon: "normal" },
  { name: "Playfair", value: '"Playfair Display", serif', icon: "serif" },
  { name: "Merriweather", value: '"Merriweather", serif', icon: "serif" },
  {
    name: "JetBrains Mono",
    value: '"JetBrains Mono", monospace',
    icon: "code",
  },
  {
    name: "Source Code Pro",
    value: '"Source Code Pro", monospace',
    icon: "code",
  },
] as const;

export const FONT_SIZES = [16, 20, 28, 36];

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

export function areEndpointsNear(
  points: Point[],
  threshold: number = 40,
): boolean {
  if (points.length < 2) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const distance = Math.sqrt(
    Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2),
  );
  return distance <= threshold;
}

export interface ShadeworksFile {
  type: "kladde" | "shadeworks"; // Support both for backwards compatibility
  version: number;
  elements: BoardElement[];
  comments?: BoardComment[];
  appState: {
    canvasBackground: "none" | "dots" | "lines" | "grid";
    gridSize?: number;
    viewBackgroundColor?: string;
  };
}
