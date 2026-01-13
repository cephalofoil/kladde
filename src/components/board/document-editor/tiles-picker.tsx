"use client";

import type { BoardElement, DocumentSection } from "@/lib/board-types";
import { TileCard } from "./tile-card";

interface TilesPickerProps {
  tiles: BoardElement[];
  onAddTile: (tile: BoardElement) => void;
  documentSections: DocumentSection[];
}

export function TilesPicker({
  tiles,
  onAddTile,
  documentSections,
}: TilesPickerProps) {
  // Check if a tile is already in the document
  const isTileInDocument = (tileId: string) => {
    return documentSections.some(
      (section) => section.type === "tile-content" && section.tileId === tileId
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tiles List */}
      <div className="flex-1 overflow-y-auto p-2">
        {tiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <p className="text-sm text-muted-foreground">
              No tiles available.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Create tiles on the canvas to add them here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tiles.map((tile) => (
              <TileCard
                key={tile.id}
                tile={tile}
                isAdded={isTileInDocument(tile.id)}
                onAdd={() => onAddTile(tile)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
