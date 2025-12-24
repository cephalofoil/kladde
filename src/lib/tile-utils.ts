import type { TileType } from "./board-types";

/**
 * Get minimum tile size based on tile type
 */
export function getMinTileSize(tileType: TileType): {
  width: number;
  height: number;
} {
  switch (tileType) {
    case "tile-text":
      return { width: 200, height: 150 };
    case "tile-note":
      return { width: 200, height: 150 };
    case "tile-code":
      return { width: 300, height: 200 };
    case "tile-mermaid":
      return { width: 300, height: 250 };
    case "tile-image":
      return { width: 200, height: 200 };
    default:
      return { width: 200, height: 150 };
  }
}

/**
 * Get default tile size based on tile type
 */
export function getDefaultTileSize(tileType: TileType): {
  width: number;
  height: number;
} {
  switch (tileType) {
    case "tile-text":
      return { width: 300, height: 200 };
    case "tile-note":
      return { width: 250, height: 200 };
    case "tile-code":
      return { width: 400, height: 300 };
    case "tile-mermaid":
      return { width: 400, height: 300 };
    case "tile-image":
      return { width: 300, height: 300 };
    default:
      return { width: 300, height: 200 };
  }
}
