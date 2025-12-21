export interface Connection {
  id: string;
  fromTileId: string;
  toTileId: string;
  fromSide: "top" | "right" | "bottom" | "left";
  toSide: "top" | "right" | "bottom" | "left";
  label?: string;
  // Hand-drawn styling properties
  style?: "hand-drawn" | "smooth" | "straight"; // default: hand-drawn
  roughness?: number; // 0-2, controls sketch intensity (default: 1)
  strokeWidth?: number; // 1-5 (default: 2)
  color?: string; // hex color (default: theme color)
  // Path customization
  controlPointOffset?: { x: number; y: number }; // Offset for middle control point
}

// Improved tile content typing
export type TileType =
  | "text"
  | "code"
  | "note"
  | "image"
  | "shape"
  | "mermaid"
  | "document"
  | "bookmark";

// Type-safe content mapping for each tile type
export interface TileContentMap {
  text: {
    text: string;
  };
  code: {
    code: string;
    language?: string;
  };
  note: {
    text?: string;
    title?: string;
    description?: string;
    status?: string;
    dueDate?: string;
    assignees?: string[];
    tags?: string[];
    attachments?: Array<{ name: string; size: string; type: string }>;
    subtasks?: Array<{
      id: string;
      text: string;
      completed: boolean;
      isBlocker?: boolean;
    }>;
    comments?: Array<{
      id: string;
      author: string;
      text: string;
      timestamp: string;
    }>;
  };
  image: {
    src: string;
    alt?: string;
  };
  shape: {
    shape: string;
    fill?: string;
  };
  mermaid: {
    chart: string;
    scale?: number;
    offsetX?: number;
    offsetY?: number;
  };
  document: {
    blocks?: unknown[];
    title?: string;
    description?: string;
    layout?: DocumentLayout;
    linkedTileIds?: string[];
  };
  bookmark: {
    url: string;
    title?: string;
    description?: string;
    favicon?: string;
    siteName?: string;
    imageUrl?: string;
    displayName?: string;
    isValidated?: boolean;
  };
}

export interface TileContent {
  text?: string;
  language?: string;
  code?: string;
  src?: string;
  alt?: string;
  shape?: string;
  fill?: string;
  chart?: string;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  blocks?: unknown[];
  title?: string;
  description?: string;
  status?: string;
  dueDate?: string;
  assignees?: string[];
  tags?: string[];
  attachments?: Array<{ name: string; size: string; type: string }>;
  subtasks?: Array<{
    id: string;
    text: string;
    completed: boolean;
    isBlocker?: boolean;
  }>;
  comments?: Array<{
    id: string;
    author: string;
    text: string;
    timestamp: string;
  }>;
  // Bookmark fields
  url?: string;
  favicon?: string;
  siteName?: string;
  imageUrl?: string;
  displayName?: string;
  isValidated?: boolean;
  [key: string]: unknown;
}

export interface TileData {
  id: string;
  type: TileType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  title?: string;
  content: TileContent;
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
  };
  /** @deprecated Connections are tracked at BoardData.connections. This field will be removed. */
  connections?: Connection[];
}

export interface CanvasState {
  tiles: TileData[];
  selectedTileIds: string[];
  zoom: number;
  pan: { x: number; y: number };
}

// Document Editor Types for Enhanced Document Tiles

export interface DocumentSection {
  id: string;
  type: "tile-content" | "heading" | "text" | "spacer";
  order: number; // For sorting

  // For tile-content sections
  sourceTileId?: string; // Reference to connected tile
  content?: string | object; // Cached content from tile

  // For heading/text sections
  text?: string;
  level?: 1 | 2 | 3; // For headings

  // Layout
  width?: "full" | "half" | "third";
  height?: number; // In mm or auto
}

export interface DocumentLayout {
  // Page configuration
  pageFormat: "A4" | "Letter"; // Default: A4
  orientation: "portrait" | "landscape"; // Default: portrait
  margins: { top: number; right: number; bottom: number; left: number }; // mm

  // Tile placements on the document
  sections: DocumentSection[];

  // Metadata
  author?: string;
  createdDate: string;
  lastModified: string;
}

// Multi-Board Architecture Types

export interface Workstream {
  id: string;
  name: string;
  description?: string;
  color: string; // Theme color for visual organization
  icon: string; // Lucide icon name
  createdAt: Date;
  updatedAt: Date;
  boardIds: string[];
  metadata: {
    boardCount: number;
    lastAccessed?: Date;
    collaboratorCount?: number; // Future collaboration
  };
}

export interface Board {
  id: string;
  workstreamId: string;
  name: string;
  description?: string;
  thumbnail?: string; // Base64 or blob URL for preview
  createdAt: Date;
  updatedAt: Date;
  lastAccessed: Date;
  tags: string[];
  metadata: {
    tileCount: number;
    connectionCount: number;
    canvasBounds: { width: number; height: number; minX: number; minY: number };
  };
  settings: {
    isPublic: boolean; // Future collaboration
    allowComments: boolean; // Future collaboration
    backgroundColor: string;
    gridVisible: boolean;
  };
}

export interface BoardData {
  tiles: TileData[];
  connections: Connection[];
  assets: Record<string, string>;
  version: string;
}

// Input types for creation APIs
export interface CreateWorkstreamInput {
  name: string;
  description?: string;
  color: string;
  icon: string;
}

export interface CreateBoardInput {
  workstreamId: string;
  name: string;
  description?: string;
  tags?: string[];
  settings?: Partial<Board["settings"]>;
  thumbnail?: string;
}

// Enhanced types with board context
export interface EnhancedTileData extends TileData {
  boardId: string; // Associate tile with specific board
  workstreamId: string; // Quick workstream reference
}

// Update the base TileData to include board context as optional for backward compatibility
export interface TileDataWithBoardContext extends TileData {
  boardId?: string; // Associate tile with specific board (optional for compatibility)
  workstreamId?: string; // Quick workstream reference (optional for compatibility)
}

export interface EnhancedConnection extends Connection {
  boardId: string; // Associate connection with specific board
}

// Store interfaces
export interface BoardManagementStore {
  // Workstream management
  workstreams: Workstream[];
  currentWorkstreamId: string | null;

  // Board management
  boards: Board[];
  currentBoardId: string | null;
  boardData: Record<string, BoardData>; // Cached board data

  // UI state
  dashboardView: "grid" | "list" | "timeline";
  searchQuery: string;
  selectedTags: string[];

  // Actions
  createWorkstream: (
    workstream: Omit<Workstream, "id" | "createdAt" | "updatedAt">,
  ) => void; // workstream creation
  createBoard: (
    boardData: Omit<Board, "id" | "createdAt" | "updatedAt" | "lastAccessed">,
  ) => string; // return board id
  switchToBoard: (boardId: string) => void;
  duplicateBoard: (id: string) => void; // duplicate board
  deleteBoard: (id: string) => void; // delete board
  updateBoardThumbnail: (boardId: string, thumbnail: string) => void;
  updateBoard: (boardId: string, updates: Partial<Board>) => void;
  updateLastAccessed: (boardId: string) => void;

  // Selectors/helpers
  getFilteredBoards: () => Board[];
  getAllTags: () => string[];

  // UI setters
  setSearchQuery: (query: string) => void;
  setSelectedTags: (tags: string[]) => void;
  setDashboardView: (view: "grid" | "list" | "timeline") => void;
}

export interface EnhancedCanvasStore extends CanvasState {
  currentBoardId: string | null;

  // Enhanced isolation methods
  loadBoardData: (boardId: string) => void;
  saveBoardData: () => void;
  clearBoardData: () => void;
}
