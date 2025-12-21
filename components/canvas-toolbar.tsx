"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RotateCcw, Square, Type, Code, ImageIcon, FileText, GitBranch, Grid3X3, Settings, Bookmark } from "lucide-react";
import { DocLinesIcon } from "@/components/icons/doc-lines-icon";
import type { TileData } from "@/types/canvas";

interface CanvasToolbarProps {
  onSelectTool: (type: TileData["type"]) => void;
  activeTool: TileData["type"] | null;
  showGrid: boolean;
  onToggleGrid: () => void;
  onResetZoom: () => void;
  onOpenAdminPanel: () => void;
  isAdminPanelOpen: boolean;
}

export function CanvasToolbar({
  onSelectTool,
  activeTool,
  showGrid,
  onToggleGrid,
  onResetZoom,
  onOpenAdminPanel,
  isAdminPanelOpen,
}: CanvasToolbarProps) {
  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-2 bg-card border rounded-lg p-2 shadow-lg">
      {/* Tile Creation Tools */}
      <div className="flex flex-col items-center gap-1">
        <Button
          variant={activeTool === "text" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelectTool("text")}
          title="Select Text Tool - Drag to create"
        >
          <Type className="h-4 w-4" />
        </Button>
        <Button
          variant={activeTool === "code" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelectTool("code")}
          title="Select Code Tool - Drag to create"
        >
          <Code className="h-4 w-4" />
        </Button>
        <Button
          variant={activeTool === "note" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelectTool("note")}
          title="Select Note Tool - Drag to create"
        >
          <FileText className="h-4 w-4" />
        </Button>
        <Button
          variant={activeTool === "mermaid" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelectTool("mermaid")}
          title="Select Mermaid Tool - Drag to create"
        >
          <GitBranch className="h-4 w-4" />
        </Button>
        <Button
          variant={activeTool === "bookmark" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelectTool("bookmark")}
          title="Select Bookmark Tool - Drag to create"
        >
          <Bookmark className="h-4 w-4" />
        </Button>
        <Button
          variant={activeTool === "image" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelectTool("image")}
          title="Select Image Tool - Drag to create"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button
          variant={activeTool === "shape" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelectTool("shape")}
          title="Select Shape Tool - Drag to create"
        >
          <Square className="h-4 w-4" />
        </Button>
        <Button
          variant={activeTool === "document" ? "default" : "ghost"}
          size="sm"
          onClick={() => onSelectTool("document")}
          title="Select Document Tool - Drag to create"
        >
          <DocLinesIcon className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="horizontal" className="w-6" />

      {/* Admin Tools */}
      <div className="flex flex-col items-center gap-1">
        <Button
          variant={isAdminPanelOpen ? "default" : "ghost"}
          size="sm"
          onClick={onOpenAdminPanel}
          title="Admin Development Panel (Ctrl+Shift+A)"
          className={
            isAdminPanelOpen
              ? "bg-primary text-primary-foreground"
              : "text-primary hover:text-primary/80"
          }
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="horizontal" className="w-6" />

      {/* View Controls */}
      <div className="flex flex-col items-center gap-1">
        <Button
          variant={showGrid ? "default" : "ghost"}
          size="sm"
          onClick={onToggleGrid}
          title="Toggle Grid"
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onResetZoom}
          title="Reset View"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
