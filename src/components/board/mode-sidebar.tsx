"use client";

import { useState } from "react";
import {
  Type,
  StickyNote,
  Code,
  GitBranch,
  Bookmark,
  Image as ImageIcon,
  Square,
  Hand,
  MousePointer2,
  Pen,
  Minus,
  MoveRight,
  RectangleHorizontal,
  Diamond,
  Circle,
  Eraser,
  Pointer,
} from "lucide-react";
import type { Tool, TileType, ToolbarMode } from "@/lib/board-types";
import { cn } from "@/lib/utils";

interface ModeSidebarProps {
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
  onTileTypeSelect: (tileType: TileType) => void;
  selectedTileType?: TileType | null;
  toolLock: boolean;
}

interface TileTypeInfo {
  type: TileType;
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
}

interface DrawToolInfo {
  tool: Tool;
  icon: React.ReactNode;
  label: string;
  hotkey: string;
}

const TILE_TYPES: TileTypeInfo[] = [
  {
    type: "tile-text",
    icon: <Type className="h-5 w-5" />,
    label: "Text",
    description: "Rich text with formatting",
    color: "bg-slate-50 hover:bg-slate-100",
  },
  {
    type: "tile-note",
    icon: <StickyNote className="h-5 w-5" />,
    label: "Note",
    description: "Quick sticky note",
    color: "bg-amber-50 hover:bg-amber-100",
  },
  {
    type: "tile-code",
    icon: <Code className="h-5 w-5" />,
    label: "Code",
    description: "Syntax highlighted code",
    color: "bg-slate-700 hover:bg-slate-800 text-white",
  },
  {
    type: "tile-mermaid",
    icon: <GitBranch className="h-5 w-5" />,
    label: "Diagram",
    description: "Mermaid flowcharts",
    color: "bg-sky-50 hover:bg-sky-100",
  },
  {
    type: "tile-bookmark",
    icon: <Bookmark className="h-5 w-5" />,
    label: "Bookmark",
    description: "Save website links",
    color: "bg-blue-50 hover:bg-blue-100",
  },
  {
    type: "tile-image",
    icon: <ImageIcon className="h-5 w-5" />,
    label: "Image",
    description: "Upload images",
    color: "bg-purple-50 hover:bg-purple-100",
  },
  {
    type: "tile-shape",
    icon: <Square className="h-5 w-5" />,
    label: "Shape",
    description: "Geometric shapes",
    color: "bg-indigo-50 hover:bg-indigo-100",
  },
];

const DRAW_TOOLS: DrawToolInfo[] = [
  { tool: "hand", icon: <Hand className="h-4 w-4" />, label: "Hand", hotkey: "H" },
  { tool: "select", icon: <MousePointer2 className="h-4 w-4" />, label: "Select", hotkey: "V" },
  { tool: "pen", icon: <Pen className="h-4 w-4" />, label: "Pen", hotkey: "1" },
  { tool: "line", icon: <Minus className="h-4 w-4" />, label: "Line", hotkey: "2" },
  { tool: "arrow", icon: <MoveRight className="h-4 w-4" />, label: "Arrow", hotkey: "3" },
  { tool: "rectangle", icon: <RectangleHorizontal className="h-4 w-4" />, label: "Rectangle", hotkey: "4" },
  { tool: "diamond", icon: <Diamond className="h-4 w-4" />, label: "Diamond", hotkey: "5" },
  { tool: "ellipse", icon: <Circle className="h-4 w-4" />, label: "Ellipse", hotkey: "6" },
  { tool: "text", icon: <Type className="h-4 w-4" />, label: "Text", hotkey: "7" },
  { tool: "eraser", icon: <Eraser className="h-4 w-4" />, label: "Eraser", hotkey: "8" },
  { tool: "laser", icon: <Pointer className="h-4 w-4" />, label: "Laser", hotkey: "9" },
];

export function ModeSidebar({
  currentTool,
  onToolChange,
  onTileTypeSelect,
  selectedTileType,
  toolLock,
}: ModeSidebarProps) {
  const [mode, setMode] = useState<ToolbarMode>("tiles");

  const handleModeChange = (newMode: ToolbarMode) => {
    setMode(newMode);
    // When switching to draw mode, ensure we're not in tile tool
    if (newMode === "draw" && currentTool === "tile") {
      onToolChange("select");
    }
  };

  const handleTileTypeClick = (tileType: TileType) => {
    onTileTypeSelect(tileType);
    // Switch to tile tool
    onToolChange("tile");
  };

  return (
    <div className="fixed left-4 top-20 z-20 flex flex-col gap-2 w-64">
      {/* Mode Toggle */}
      <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-lg p-1 flex gap-1">
        <button
          onClick={() => handleModeChange("tiles")}
          className={cn(
            "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all",
            mode === "tiles"
              ? "bg-accent text-accent-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          Tiles
        </button>
        <button
          onClick={() => handleModeChange("draw")}
          className={cn(
            "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all",
            mode === "draw"
              ? "bg-accent text-accent-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          Draw
        </button>
      </div>

      {/* Tiles Mode Content */}
      {mode === "tiles" && (
        <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-lg p-3">
          <div className="text-xs font-medium text-muted-foreground mb-3 px-1">
            Click a tile type, then click on canvas to place
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TILE_TYPES.map((tileType) => (
              <button
                key={tileType.type}
                onClick={() => handleTileTypeClick(tileType.type)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                  selectedTileType === tileType.type
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-transparent",
                  tileType.color
                )}
                title={tileType.description}
              >
                <div className="flex items-center justify-center">
                  {tileType.icon}
                </div>
                <div className="text-xs font-medium text-center">
                  {tileType.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Draw Mode Content */}
      {mode === "draw" && (
        <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-lg p-3">
          <div className="text-xs font-medium text-muted-foreground mb-3 px-1">
            Drawing Tools
          </div>
          <div className="flex flex-col gap-1">
            {DRAW_TOOLS.map((drawTool) => (
              <button
                key={drawTool.tool}
                onClick={() => onToolChange(drawTool.tool)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-all group",
                  currentTool === drawTool.tool
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                title={`${drawTool.label} (${drawTool.hotkey})`}
              >
                <div className="flex items-center justify-center w-5">
                  {drawTool.icon}
                </div>
                <span className="text-sm font-medium flex-1 text-left">
                  {drawTool.label}
                </span>
                <span className="text-xs opacity-60 font-mono">
                  {drawTool.hotkey}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
