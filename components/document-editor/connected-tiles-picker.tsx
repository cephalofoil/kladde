"use client";

import React from "react";
import type { TileData, Connection } from "@/types/canvas";
import { getTileIcon, getTileContentPreview } from "@/lib/document-helpers";
import { Plus, FileText, Code2, BarChart3, StickyNote, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConnectedTilesPickerProps {
  documentTileId: string;
  allTiles: TileData[];
  connections: Connection[];
  onAddTileSection: (tile: TileData) => void;
}

export function ConnectedTilesPicker({
  documentTileId,
  allTiles,
  connections,
  onAddTileSection,
}: ConnectedTilesPickerProps) {
  // Find incoming connections (tiles pointing TO this document)
  const incomingConnections = connections.filter(
    (conn) => conn.toTileId === documentTileId,
  );

  // Resolve source tiles
  const connectedTiles = incomingConnections
    .map((conn) => allTiles.find((t) => t.id === conn.fromTileId))
    .filter((tile): tile is TileData => tile !== undefined);

  const getTileTypeIcon = (tileType: string) => {
    switch (tileType) {
      case "text":
        return <FileText className="w-4 h-4" />;
      case "code":
        return <Code2 className="w-4 h-4" />;
      case "mermaid":
        return <BarChart3 className="w-4 h-4" />;
      case "note":
        return <StickyNote className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTileTypeColor = (tileType: string) => {
    switch (tileType) {
      case "text":
        return "bg-slate-100 hover:bg-slate-200 border-slate-300";
      case "code":
        return "bg-slate-700 hover:bg-slate-800 border-slate-600 text-white";
      case "mermaid":
        return "bg-sky-100 hover:bg-sky-200 border-sky-300";
      case "note":
        return "bg-amber-100 hover:bg-amber-200 border-amber-300";
      default:
        return "bg-gray-100 hover:bg-gray-200 border-gray-300";
    }
  };

  if (connectedTiles.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-sm text-gray-700">Connected Tiles</h3>
          <p className="text-xs text-gray-500 mt-1">
            Tiles connected via arrows
          </p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <Inbox className="w-8 h-8 text-gray-400" />
          </div>
          <h4 className="font-medium text-gray-700 mb-1">No connected tiles</h4>
          <p className="text-sm text-gray-500 max-w-[200px]">
            Draw arrows from tiles to this document to add them here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="font-semibold text-sm text-gray-700">Connected Tiles</h3>
        <p className="text-xs text-gray-500 mt-1">
          {connectedTiles.length} {connectedTiles.length === 1 ? "tile" : "tiles"} available
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {connectedTiles.map((tile) => (
            <div
              key={tile.id}
              className={`border-2 rounded-lg p-3 transition-all ${getTileTypeColor(
                tile.type,
              )}`}
            >
              <div className="flex items-start gap-2 mb-2">
                <div className="mt-0.5">{getTileTypeIcon(tile.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {tile.title || "Untitled"}
                  </div>
                  <div className="text-xs opacity-75 capitalize">{tile.type} tile</div>
                </div>
              </div>

              <div className="text-xs opacity-80 line-clamp-2 mb-3">
                {getTileContentPreview(tile, 80)}
              </div>

              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => onAddTileSection(tile)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add to Document
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
