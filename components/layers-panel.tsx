"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Eye,
  Unlock,
  Type,
  Code,
  FileText,
  ImageIcon,
  Square,
  Trash2,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TileData } from "@/types/canvas";

interface LayersPanelProps {
  tiles: TileData[];
  selectedTileIds: string[];
  onSelectTile: (id: string, multiSelect?: boolean) => void;
  onDeleteTile: (id: string) => void;
  compact?: boolean;
}

export function LayersPanel({
  tiles,
  selectedTileIds,
  onSelectTile,
  onDeleteTile,
  compact = false,
}: LayersPanelProps) {
  const getTileIcon = (type: string) => {
    switch (type) {
      case "text":
        return <Type className="h-3 w-3" />;
      case "code":
        return <Code className="h-3 w-3" />;
      case "note":
        return <FileText className="h-3 w-3" />;
      case "image":
        return <ImageIcon className="h-3 w-3" />;
      case "mermaid":
        return <GitBranch className="h-3 w-3" />;
      case "shape":
        return <Square className="h-3 w-3" />;
      default:
        return <Square className="h-3 w-3" />;
    }
  };

  const getTileLabel = (tile: TileData) => {
    if (tile.title) {
      return tile.title;
    }

    switch (tile.type) {
      case "text":
        return tile.content?.text?.substring(0, 20) || "Text";
      case "code":
        return `${tile.content?.language || "code"} snippet`;
      case "note":
        return tile.content?.text?.substring(0, 20) || "Note";
      case "image":
        return "Image";
      case "mermaid":
        return "Mermaid Diagram";
      case "shape":
        return "Shape";
      default:
        return tile.type;
    }
  };

  if (compact) {
    return (
      <div className="h-full p-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Layers</h3>
          <Badge variant="secondary" className="text-xs">
            {tiles.length}
          </Badge>
        </div>
        <ScrollArea className="h-24">
          <div className="space-y-1">
            {tiles.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                No tiles yet
              </p>
            ) : (
              tiles
                .slice()
                .reverse()
                .map((tile) => (
                  <div
                    key={tile.id}
                    className={cn(
                      "flex items-center gap-2 p-1 rounded text-xs cursor-pointer hover:bg-accent/50 transition-colors",
                      selectedTileIds.includes(tile.id) &&
                        "bg-accent border border-primary",
                    )}
                    onClick={() => onSelectTile(tile.id)}
                  >
                    <div className="text-muted-foreground">
                      {getTileIcon(tile.type)}
                    </div>
                    <div className="flex-1 min-w-0 truncate">
                      {getTileLabel(tile)}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-4 w-4 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTile(tile.id);
                      }}
                    >
                      <Trash2 className="h-2 w-2" />
                    </Button>
                  </div>
                ))
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full p-4">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Layers</span>
            <Badge variant="secondary">{tiles.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="p-4 space-y-2">
              {tiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No tiles yet. Create one to get started!
                </p>
              ) : (
                tiles
                  .slice()
                  .reverse()
                  .map((tile) => (
                    <div
                      key={tile.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors",
                        selectedTileIds.includes(tile.id) &&
                          "bg-accent border-primary",
                      )}
                      onClick={() => onSelectTile(tile.id)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="text-muted-foreground">
                          {getTileIcon(tile.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {getTileLabel(tile)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {Math.round(tile.x)}, {Math.round(tile.y)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Toggle visibility (would need to add to tile data)
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Toggle lock (would need to add to tile data)
                          }}
                        >
                          <Unlock className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTile(tile.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </ScrollArea>

          {selectedTileIds.length > 0 && (
            <div className="p-4 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectTile("", false)}
                className="w-full bg-transparent"
              >
                Deselect All ({selectedTileIds.length})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
