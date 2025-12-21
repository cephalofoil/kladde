"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import type { TileData } from "@/types/canvas";

interface AlignmentToolbarProps {
  selectedTiles: TileData[];
  onUpdateTile: (id: string, updates: Partial<TileData>) => void;
}

export function AlignmentToolbar({
  selectedTiles,
  onUpdateTile,
}: AlignmentToolbarProps) {
  if (selectedTiles.length < 2) {
    return null;
  }

  const alignLeft = () => {
    const leftmostX = Math.min(...selectedTiles.map((tile) => tile.x));
    selectedTiles.forEach((tile) => {
      onUpdateTile(tile.id, { x: leftmostX });
    });
  };

  const alignCenter = () => {
    const leftmostX = Math.min(...selectedTiles.map((tile) => tile.x));
    const rightmostX = Math.max(
      ...selectedTiles.map((tile) => tile.x + tile.width),
    );
    const centerX = (leftmostX + rightmostX) / 2;

    selectedTiles.forEach((tile) => {
      onUpdateTile(tile.id, { x: centerX - tile.width / 2 });
    });
  };

  const alignRight = () => {
    const rightmostX = Math.max(
      ...selectedTiles.map((tile) => tile.x + tile.width),
    );
    selectedTiles.forEach((tile) => {
      onUpdateTile(tile.id, { x: rightmostX - tile.width });
    });
  };

  const alignTop = () => {
    const topmostY = Math.min(...selectedTiles.map((tile) => tile.y));
    selectedTiles.forEach((tile) => {
      onUpdateTile(tile.id, { y: topmostY });
    });
  };

  const alignMiddle = () => {
    const topmostY = Math.min(...selectedTiles.map((tile) => tile.y));
    const bottommostY = Math.max(
      ...selectedTiles.map((tile) => tile.y + tile.height),
    );
    const centerY = (topmostY + bottommostY) / 2;

    selectedTiles.forEach((tile) => {
      onUpdateTile(tile.id, { y: centerY - tile.height / 2 });
    });
  };

  const alignBottom = () => {
    const bottommostY = Math.max(
      ...selectedTiles.map((tile) => tile.y + tile.height),
    );
    selectedTiles.forEach((tile) => {
      onUpdateTile(tile.id, { y: bottommostY - tile.height });
    });
  };

  const distributeHorizontally = () => {
    if (selectedTiles.length < 3) return;

    const sortedTiles = [...selectedTiles].sort((a, b) => a.x - b.x);
    const leftmostX = sortedTiles[0].x;
    const rightmostX =
      sortedTiles[sortedTiles.length - 1].x +
      sortedTiles[sortedTiles.length - 1].width;
    const totalSpace = rightmostX - leftmostX;
    const totalTileWidth = sortedTiles.reduce(
      (sum, tile) => sum + tile.width,
      0,
    );
    const availableSpace = totalSpace - totalTileWidth;
    const spacing = availableSpace / (sortedTiles.length - 1);

    let currentX = leftmostX;
    sortedTiles.forEach((tile, index) => {
      if (index === 0 || index === sortedTiles.length - 1) return; // Don't move first and last tiles
      onUpdateTile(tile.id, { x: currentX + spacing });
      currentX += tile.width + spacing;
    });
  };

  const distributeVertically = () => {
    if (selectedTiles.length < 3) return;

    const sortedTiles = [...selectedTiles].sort((a, b) => a.y - b.y);
    const topmostY = sortedTiles[0].y;
    const bottommostY =
      sortedTiles[sortedTiles.length - 1].y +
      sortedTiles[sortedTiles.length - 1].height;
    const totalSpace = bottommostY - topmostY;
    const totalTileHeight = sortedTiles.reduce(
      (sum, tile) => sum + tile.height,
      0,
    );
    const availableSpace = totalSpace - totalTileHeight;
    const spacing = availableSpace / (sortedTiles.length - 1);

    let currentY = topmostY;
    sortedTiles.forEach((tile, index) => {
      if (index === 0 || index === sortedTiles.length - 1) return; // Don't move first and last tiles
      onUpdateTile(tile.id, { y: currentY + spacing });
      currentY += tile.height + spacing;
    });
  };

  return (
    <Card className="p-2 bg-white/95 backdrop-blur-sm border shadow-lg">
      <div className="flex items-center gap-1">
        {/* Horizontal Alignment */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={alignLeft}
            className="h-8 w-8 p-0"
            title="Align Left"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={alignCenter}
            className="h-8 w-8 p-0"
            title="Align Center"
          >
            <AlignHorizontalJustifyCenter className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={alignRight}
            className="h-8 w-8 p-0"
            title="Align Right"
          >
            <AlignRight className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Vertical Alignment */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={alignTop}
            className="h-8 w-8 p-0"
            title="Align Top"
          >
            <AlignVerticalJustifyStart className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={alignMiddle}
            className="h-8 w-8 p-0"
            title="Align Middle"
          >
            <AlignVerticalJustifyCenter className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={alignBottom}
            className="h-8 w-8 p-0"
            title="Align Bottom"
          >
            <AlignVerticalJustifyEnd className="h-4 w-4" />
          </Button>
        </div>

        {/* Distribution (only show if 3+ tiles selected) */}
        {selectedTiles.length >= 3 && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={distributeHorizontally}
                className="h-8 w-8 p-0"
                title="Distribute Horizontally"
              >
                <AlignHorizontalDistributeCenter className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={distributeVertically}
                className="h-8 w-8 p-0"
                title="Distribute Vertically"
              >
                <AlignVerticalDistributeCenter className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        <Separator orientation="vertical" className="h-6" />

        <div className="text-xs text-muted-foreground px-2">
          {selectedTiles.length} selected
        </div>
      </div>
    </Card>
  );
}
