"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowRight } from "lucide-react";
import type { TileData } from "@/types/canvas";
import { getMinTileSize } from "@/lib/tile-utils";

interface PropertiesPanelProps {
  selectedTiles: TileData[];
  onUpdateTile: (id: string, updates: Partial<TileData>) => void;
  allTiles?: TileData[];
}

/**
 * Properties panel for editing one or more selected tiles.
 *
 * Renders different UIs depending on selection count:
 * - 0 selected: a prompt card asking the user to select a tile.
 * - >1 selected: a summary card with the selected count (multi-editing not supported yet).
 * - 1 selected: a full properties editor for the single tile (name, position & size, connections, and content editors per tile type).
 *
 * When editing a single tile, width/height updates are clamped to the minimum sizes returned by `getMinTileSize(selectedTile.type)`.
 * Updates are propagated by calling the provided `onUpdateTile` callback. Removing an incoming connection updates the source tile via `onUpdateTile`.
 *
 * @param selectedTiles - Array of selected TileData; single-tile UI is shown only when exactly one tile is selected.
 * @param onUpdateTile - Callback invoked to apply partial updates to a tile: onUpdateTile(tileId, updates).
 * @param allTiles - Optional list of all tiles (used to resolve connection targets and incoming connections).
 */
export function PropertiesPanel({
  selectedTiles,
  onUpdateTile,
  allTiles = [],
}: PropertiesPanelProps) {
  const selectedTile = selectedTiles.length === 1 ? selectedTiles[0] : null;

  if (selectedTiles.length === 0) {
    return (
      <div className="h-full p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Select a tile to edit its properties
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedTiles.length > 1) {
    return (
      <div className="h-full p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Multiple Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {selectedTiles.length} tiles selected
              </span>
              <Badge variant="secondary">{selectedTiles.length}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Multi-tile editing coming soon!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedTile) return null;

  const minSizes = getMinTileSize(selectedTile.type);

  const handleUpdateTile = (updates: Partial<TileData>) => {
    const clamped: Partial<TileData> = { ...updates };
    if (clamped.width !== undefined) {
      clamped.width = Math.max(clamped.width, minSizes.width);
    }
    if (clamped.height !== undefined) {
      clamped.height = Math.max(clamped.height, minSizes.height);
    }
    onUpdateTile(selectedTile.id, clamped);
  };

  const handleRemoveConnection = (connectionId: string) => {
    const updatedConnections = (selectedTile.connections || []).filter(
      (conn) => conn.id !== connectionId,
    );
    handleUpdateTile({ connections: updatedConnections });
  };

  const handleRemoveIncomingConnection = (
    connectionId: string,
    sourceTileId: string,
  ) => {
    const sourceTile = allTiles.find((t) => t.id === sourceTileId);
    if (sourceTile) {
      const updatedConnections = (sourceTile.connections || []).filter(
        (conn) => conn.id !== connectionId,
      );
      onUpdateTile(sourceTileId, { connections: updatedConnections });
    }
  };

  const getTileName = (tileId: string) => {
    const tile = allTiles.find((t) => t.id === tileId);
    return tile?.title || `${tile?.type || "Unknown"}`;
  };

  const getIncomingConnections = () => {
    if (!selectedTile) return [];

    const incomingConnections: Array<{
      id: string;
      fromTileId: string;
      fromSide: string;
      toSide: string;
    }> = [];

    allTiles.forEach((tile) => {
      if (tile.connections) {
        tile.connections.forEach((connection) => {
          if (connection.toTileId === selectedTile.id) {
            incomingConnections.push({
              id: connection.id,
              fromTileId: tile.id,
              fromSide: connection.fromSide,
              toSide: connection.toSide,
            });
          }
        });
      }
    });

    return incomingConnections;
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Tile Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Tile Properties</span>
              <Badge variant="outline">{selectedTile.type}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-xs font-medium">
                Name
              </Label>
              <Input
                id="title"
                value={selectedTile.title || ""}
                onChange={(e) => handleUpdateTile({ title: e.target.value })}
                placeholder="Enter tile name..."
                className="h-8"
              />
            </div>

            <Separator />

            {/* Position & Size */}
            <div className="space-y-3">
              <Label className="text-xs font-medium">Position & Size</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="x" className="text-xs">
                    X
                  </Label>
                  <Input
                    id="x"
                    type="number"
                    value={Math.round(selectedTile.x)}
                    onChange={(e) =>
                      handleUpdateTile({
                        x: Number.parseInt(e.target.value) || 0,
                      })
                    }
                    className="h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="y" className="text-xs">
                    Y
                  </Label>
                  <Input
                    id="y"
                    type="number"
                    value={Math.round(selectedTile.y)}
                    onChange={(e) =>
                      handleUpdateTile({
                        y: Number.parseInt(e.target.value) || 0,
                      })
                    }
                    className="h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="width" className="text-xs">
                    Width
                  </Label>
                  <Input
                    id="width"
                    type="number"
                    min={minSizes.width}
                    value={Math.round(selectedTile.width)}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      handleUpdateTile({
                        width: Number.isFinite(n) ? n : minSizes.width,
                      });
                    }}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label htmlFor="height" className="text-xs">
                    Height
                  </Label>
                  <Input
                    id="height"
                    type="number"
                    min={minSizes.height}
                    value={Math.round(selectedTile.height)}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      handleUpdateTile({
                        height: Number.isFinite(n) ? n : minSizes.height,
                      });
                    }}
                    className="h-8"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {((selectedTile.connections &&
              selectedTile.connections.length > 0) ||
              getIncomingConnections().length > 0) && (
              <>
                <div className="space-y-3">
                  <Label className="text-xs font-medium">Connections</Label>

                  {/* Outgoing Connections */}
                  {selectedTile.connections &&
                    selectedTile.connections.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground font-medium">
                          Outgoing
                        </div>
                        {selectedTile.connections.map((connection) => (
                          <div
                            key={connection.id}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="text-xs text-sky-600 font-medium">
                                {connection.fromSide}
                              </div>
                              <ArrowRight className="h-3 w-3 text-sky-500" />
                              <div className="text-xs truncate">
                                {getTileName(connection.toTileId)}
                              </div>
                              <div className="text-xs text-sky-600 font-medium">
                                {connection.toSide}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() =>
                                handleRemoveConnection(connection.id)
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Incoming Connections */}
                  {getIncomingConnections().length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground font-medium">
                        Incoming
                      </div>
                      {getIncomingConnections().map((connection) => (
                        <div
                          key={connection.id}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded-md"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="text-xs truncate">
                              {getTileName(connection.fromTileId)}
                            </div>
                            <div className="text-xs text-sky-600 font-medium">
                              {connection.fromSide}
                            </div>
                            <ArrowRight className="h-3 w-3 text-sky-500" />
                            <div className="text-xs text-sky-600 font-medium">
                              {connection.toSide}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() =>
                              handleRemoveIncomingConnection(
                                connection.id,
                                connection.fromTileId,
                              )
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Separator />
              </>
            )}

            {/* Content */}
            <div className="space-y-3">
              <Label className="text-xs font-medium">Content</Label>
              {selectedTile.type === "text" && (
                <div>
                  <Label htmlFor="text" className="text-xs">
                    Text
                  </Label>
                  <Textarea
                    id="text"
                    value={selectedTile.content?.text || ""}
                    onChange={(e) =>
                      handleUpdateTile({
                        content: {
                          ...selectedTile.content,
                          text: e.target.value,
                        },
                      })
                    }
                    className="min-h-[80px]"
                  />
                </div>
              )}
              {selectedTile.type === "code" && (
                <>
                  <div>
                    <Label htmlFor="language" className="text-xs">
                      Language
                    </Label>
                    <Select
                      value={selectedTile.content?.language || "javascript"}
                      onValueChange={(value) =>
                        handleUpdateTile({
                          content: { ...selectedTile.content, language: value },
                        })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="javascript">JavaScript</SelectItem>
                        <SelectItem value="typescript">TypeScript</SelectItem>
                        <SelectItem value="python">Python</SelectItem>
                        <SelectItem value="html">HTML</SelectItem>
                        <SelectItem value="css">CSS</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="code" className="text-xs">
                      Code
                    </Label>
                    <Textarea
                      id="code"
                      value={selectedTile.content?.code || ""}
                      onChange={(e) =>
                        handleUpdateTile({
                          content: {
                            ...selectedTile.content,
                            code: e.target.value,
                          },
                        })
                      }
                      className="min-h-[120px] font-mono text-sm"
                    />
                  </div>
                </>
              )}
              {selectedTile.type === "note" && (
                <div>
                  <Label htmlFor="note" className="text-xs">
                    Note
                  </Label>
                  <Textarea
                    id="note"
                    value={selectedTile.content?.text || ""}
                    onChange={(e) =>
                      handleUpdateTile({
                        content: {
                          ...selectedTile.content,
                          text: e.target.value,
                        },
                      })
                    }
                    className="min-h-[100px]"
                  />
                </div>
              )}
              {selectedTile.type === "mermaid" && (
                <div>
                  <Label htmlFor="mermaid" className="text-xs">
                    Mermaid Chart
                  </Label>
                  <Textarea
                    id="mermaid"
                    value={selectedTile.content?.chart || ""}
                    onChange={(e) =>
                      handleUpdateTile({
                        content: {
                          ...selectedTile.content,
                          chart: e.target.value,
                        },
                      })
                    }
                    className="min-h-[120px] font-mono text-sm"
                    placeholder="Enter your Mermaid diagram code here..."
                  />
                </div>
              )}


            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
