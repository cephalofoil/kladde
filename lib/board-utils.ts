import {
  Board,
  Workstream,
  BoardData,
  TileData,
  Connection,
} from "@/types/canvas";
import { BOARD_DATA_VERSION } from "@/types/version";

// ID generation utilities
export function generateId(): string {
  // Use crypto.randomUUID() for better uniqueness if available
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback with timestamp for better uniqueness
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}

// Board creation utilities
export function createDefaultWorkstream(
  name: string,
  color: string = "#3b82f6",
  icon: string = "Folder",
): Omit<Workstream, "id" | "createdAt" | "updatedAt"> {
  return {
    name,
    description: "",
    color,
    icon,
    boardIds: [],
    metadata: {
      boardCount: 0,
      lastAccessed: new Date(),
      collaboratorCount: 1,
    },
  };
}

export function createDefaultBoard(
  workstreamId: string,
  name: string,
  description?: string,
): Omit<Board, "id" | "createdAt" | "updatedAt"> {
  return {
    workstreamId,
    name,
    description: description || "",
    thumbnail: undefined,
    lastAccessed: new Date(),
    tags: [],
    metadata: {
      tileCount: 0,
      connectionCount: 0,
      canvasBounds: { width: 0, height: 0, minX: 0, minY: 0 },
    },
    settings: {
      isPublic: false,
      allowComments: true,
      backgroundColor: "#ffffff",
      gridVisible: true,
    },
  };
}

export function createEmptyBoardData(): BoardData {
  return {
    tiles: [],
    connections: [],
    assets: {},
    version: BOARD_DATA_VERSION,
  };
}

// Board metadata calculations
export function calculateBoardMetadata(
  tiles: TileData[],
  connections: Connection[],
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  tiles.forEach((tile) => {
    minX = Math.min(minX, tile.x);
    minY = Math.min(minY, tile.y);
    maxX = Math.max(maxX, tile.x + tile.width);
    maxY = Math.max(maxY, tile.y + tile.height);
  });

  // Default bounds if no tiles
  if (tiles.length === 0) {
    // Match defaults from calculateContentBounds
    minX = -500;
    minY = -500;
    maxX = 1500;
    maxY = 1500;
  }

  return {
    tileCount: tiles.length,
    connectionCount: connections.length,
    canvasBounds: {
      width: maxX - minX,
      height: maxY - minY,
      minX,
      minY,
    },
  };
}

// Board thumbnail generation
export function generateBoardThumbnail(
  tiles: TileData[],
  canvasElement?: HTMLCanvasElement,
): string | undefined {
  if (!canvasElement || tiles.length === 0) {
    return undefined;
  }

  // Check for browser environment
  if (typeof document === "undefined") {
    return undefined;
  }

  // Create a smaller canvas for thumbnail
  const thumbnailCanvas = document.createElement("canvas");
  const thumbnailCtx = thumbnailCanvas.getContext("2d");
  if (!thumbnailCtx) return undefined;

  const thumbnailWidth = 300;
  const thumbnailHeight = 200;

  thumbnailCanvas.width = thumbnailWidth;
  thumbnailCanvas.height = thumbnailHeight;

  // Calculate bounds
  const metadata = calculateBoardMetadata(tiles, []);
  const { canvasBounds } = metadata;

  // Calculate scaling to fit thumbnail
  const scaleX = thumbnailWidth / Math.max(canvasBounds.width, 1);
  const scaleY = thumbnailHeight / Math.max(canvasBounds.height, 1);
  const scale = Math.min(scaleX, scaleY, 1); // Don't upscale

  // Clear and set background
  thumbnailCtx.fillStyle = "#ffffff";
  thumbnailCtx.fillRect(0, 0, thumbnailWidth, thumbnailHeight);

  // Draw simplified tiles
  tiles.forEach((tile) => {
    const x = (tile.x - canvasBounds.minX) * scale;
    const y = (tile.y - canvasBounds.minY) * scale;
    const width = tile.width * scale;
    const height = tile.height * scale;

    // Draw tile background
    thumbnailCtx.fillStyle = tile.style?.backgroundColor || "#f3f4f6";
    thumbnailCtx.fillRect(x, y, width, height);

    // Draw tile border
    thumbnailCtx.strokeStyle = tile.style?.borderColor || "#d1d5db";
    thumbnailCtx.lineWidth = 1;
    thumbnailCtx.strokeRect(x, y, width, height);
  });

  return thumbnailCanvas.toDataURL("image/png", 0.8);
}

// Search and filtering utilities
export function filterBoardsByQuery(boards: Board[], query: string): Board[] {
  if (!query.trim()) return boards;

  const lowercaseQuery = query.toLowerCase();
  return boards.filter(
    (board) =>
      board.name.toLowerCase().includes(lowercaseQuery) ||
      board.description?.toLowerCase().includes(lowercaseQuery) ||
      board.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)),
  );
}

export function filterBoardsByTags(
  boards: Board[],
  selectedTags: string[],
): Board[] {
  if (selectedTags.length === 0) return boards;

  return boards.filter((board) =>
    selectedTags.some((tag) => board.tags.includes(tag)),
  );
}

export function getAllTagsFromBoards(boards: Board[]): string[] {
  const allTags = new Set<string>();
  boards.forEach((board) => {
    board.tags.forEach((tag) => allTags.add(tag));
  });
  return Array.from(allTags).sort();
}

// Workstream utilities
export function getBoardsInWorkstream(
  boards: Board[],
  workstreamId: string,
): Board[] {
  return boards.filter((board) => board.workstreamId === workstreamId);
}

export function updateWorkstreamBoardCount(
  workstream: Workstream,
  boards: Board[],
): Workstream {
  const boardsInWorkstream = getBoardsInWorkstream(boards, workstream.id);
  return {
    ...workstream,
    boardIds: boardsInWorkstream.map((board) => board.id),
    metadata: {
      ...workstream.metadata,
      boardCount: boardsInWorkstream.length,
    },
  };
}

// Data validation utilities
export function validateBoard(board: Partial<Board>): string[] {
  const errors: string[] = [];

  if (!board.name?.trim()) {
    errors.push("Board name is required");
  }

  if (!board.workstreamId?.trim()) {
    errors.push("Workstream ID is required");
  }

  if (board.name && board.name.length > 100) {
    errors.push("Board name must be less than 100 characters");
  }

  if (board.description && board.description.length > 500) {
    errors.push("Board description must be less than 500 characters");
  }

  return errors;
}

export function validateWorkstream(workstream: Partial<Workstream>): string[] {
  const errors: string[] = [];

  if (!workstream.name?.trim()) {
    errors.push("Workstream name is required");
  }

  if (workstream.name && workstream.name.length > 50) {
    errors.push("Workstream name must be less than 50 characters");
  }

  if (workstream.description && workstream.description.length > 200) {
    errors.push("Workstream description must be less than 200 characters");
  }

  if (workstream.color && !/^#[0-9A-Fa-f]{6}$/.test(workstream.color)) {
    errors.push("Color must be a valid hex color");
  }

  return errors;
}

// Board duplication utility
export function duplicateBoard(
  originalBoard: Board,
  originalBoardData: BoardData,
  newName?: string,
): {
  board: Omit<Board, "id" | "createdAt" | "updatedAt">;
  boardData: BoardData;
} {
  const duplicatedTiles = originalBoardData.tiles.map((tile) => ({
    ...tile,
    id: generateId(), // Generate new IDs
  }));

  // Update connection IDs to match new tile IDs
  const tileIdMap = new Map(
    originalBoardData.tiles.map((tile, index) => [
      tile.id,
      duplicatedTiles[index].id,
    ]),
  );

  const duplicatedConnections = originalBoardData.connections.map(
    (connection) => ({
      ...connection,
      id: generateId(),
      fromTileId: tileIdMap.get(connection.fromTileId) || connection.fromTileId,
      toTileId: tileIdMap.get(connection.toTileId) || connection.toTileId,
    }),
  );

  const duplicatedBoardData: BoardData = {
    tiles: duplicatedTiles,
    connections: duplicatedConnections,
    assets: { ...originalBoardData.assets },
    version: originalBoardData.version,
  };

  const metadata = calculateBoardMetadata(
    duplicatedTiles,
    duplicatedConnections,
  );

  const duplicatedBoard = {
    workstreamId: originalBoard.workstreamId,
    name: newName || `${originalBoard.name} (Copy)`,
    description: originalBoard.description,
    thumbnail: originalBoard.thumbnail,
    lastAccessed: new Date(),
    tags: [...originalBoard.tags],
    metadata,
    settings: { ...originalBoard.settings },
  };

  return { board: duplicatedBoard, boardData: duplicatedBoardData };
}
