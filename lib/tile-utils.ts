import type { TileData } from "@/types/canvas";

type TileType = TileData["type"];
type Size = { width: number; height: number };

/**
 * Exhaustive mapping of tile types to their minimum sizes.
 *
 * This ensures that all tile types are explicitly defined and TypeScript
 * will error if a new tile type is added without updating this mapping.
 */
const MIN_TILE_SIZES: Record<TileType, Size> = {
  text: { width: 420, height: 400 },
  note: { width: 200, height: 200 },
  code: { width: 250, height: 250 },
  image: { width: 150, height: 150 },
  shape: { width: 120, height: 80 },
  mermaid: { width: 300, height: 300 },
  document: { width: 200, height: 280 }, // matches creation defaults
  bookmark: { width: 400, height: 400 }, // slim rectangle strip with big icon
};

/**
 * Returns the minimum width and height for a tile based on its content type.
 *
 * @param type - Tile content type (from `TileData["type"]`)
 * @returns An object with `width` and `height` numeric minimums for the given tile type
 */
export function getMinTileSize(type: TileType): Size {
  return MIN_TILE_SIZES[type];
}
