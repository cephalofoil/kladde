"use client";

import { Plus, Type, StickyNote, Code2, GitBranch, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardElement, DocumentSection } from "@/lib/board-types";

interface TilesPickerProps {
  tiles: BoardElement[];
  onAddTile: (tile: BoardElement) => void;
  documentSections: DocumentSection[];
}

const getTileIcon = (tileType: string | undefined) => {
  switch (tileType) {
    case "tile-text":
      return <Type className="w-4 h-4" />;
    case "tile-note":
      return <StickyNote className="w-4 h-4" />;
    case "tile-code":
      return <Code2 className="w-4 h-4" />;
    case "tile-mermaid":
      return <GitBranch className="w-4 h-4" />;
    case "tile-image":
      return <Image className="w-4 h-4" />;
    default:
      return <Type className="w-4 h-4" />;
  }
};

const getTileTypeColor = (tileType: string | undefined) => {
  switch (tileType) {
    case "tile-text":
      return "bg-blue-500";
    case "tile-note":
      return "bg-yellow-500";
    case "tile-code":
      return "bg-green-500";
    case "tile-mermaid":
      return "bg-purple-500";
    case "tile-image":
      return "bg-pink-500";
    default:
      return "bg-gray-500";
  }
};

const getTilePreview = (tile: BoardElement): string => {
  const content = tile.tileContent;
  if (!content) return "Empty tile";

  if (content.richText) {
    // Strip HTML tags for preview
    const text = content.richText.replace(/<[^>]*>/g, "");
    return text.slice(0, 80) + (text.length > 80 ? "..." : "");
  }
  if (content.noteText) {
    return content.noteText.slice(0, 80) + (content.noteText.length > 80 ? "..." : "");
  }
  if (content.code) {
    return content.code.slice(0, 80) + (content.code.length > 80 ? "..." : "");
  }
  if (content.chart) {
    return "Mermaid diagram";
  }
  if (content.imageSrc) {
    return content.imageAlt || "Image";
  }

  return "Empty tile";
};

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
      {/* Header */}
      <div className="p-3 border-b border-border">
        <h3 className="text-sm font-medium text-muted-foreground">
          Available Tiles
        </h3>
      </div>

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
            {tiles.map((tile) => {
              const isAdded = isTileInDocument(tile.id);
              return (
                <div
                  key={tile.id}
                  className={cn(
                    "group relative p-2 rounded-lg border transition-colors",
                    isAdded
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                  )}
                >
                  {/* Type Badge */}
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={cn(
                        "flex items-center justify-center w-5 h-5 rounded text-white",
                        getTileTypeColor(tile.tileType)
                      )}
                    >
                      {getTileIcon(tile.tileType)}
                    </div>
                    <span className="text-xs font-medium truncate flex-1">
                      {tile.tileTitle || "Untitled"}
                    </span>
                  </div>

                  {/* Content Preview */}
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {getTilePreview(tile)}
                  </p>

                  {/* Add Button */}
                  <button
                    onClick={() => onAddTile(tile)}
                    disabled={isAdded}
                    className={cn(
                      "w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
                      isAdded
                        ? "bg-green-500/10 text-green-600 cursor-default"
                        : "bg-primary/10 hover:bg-primary/20 text-primary"
                    )}
                  >
                    {isAdded ? (
                      "Added"
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        Add
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
