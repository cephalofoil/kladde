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
    SquareStack,
    Pencil,
    Lock,
    Unlock,
} from "lucide-react";
import type { Tool, TileType, ToolbarMode } from "@/lib/board-types";
import { cn } from "@/lib/utils";

interface ModeSidebarProps {
    currentTool: Tool;
    onToolChange: (tool: Tool) => void;
    onTileTypeSelect: (tileType: TileType) => void;
    selectedTileType?: TileType | null;
    toolLock: boolean;
    onToggleToolLock: () => void;
    mode: ToolbarMode;
    onModeChange: (mode: ToolbarMode) => void;
}

interface TileTypeInfo {
    type: TileType;
    icon: React.ReactNode;
    label: string;
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
        icon: <Type className="h-4 w-4" />,
        label: "Text",
        color: "bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700",
    },
    {
        type: "tile-note",
        icon: <StickyNote className="h-4 w-4" />,
        label: "Note",
        color: "bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30",
    },
    {
        type: "tile-code",
        icon: <Code className="h-4 w-4" />,
        label: "Code",
        color: "bg-slate-700 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-950 text-white",
    },
    {
        type: "tile-mermaid",
        icon: <GitBranch className="h-4 w-4" />,
        label: "Diagram",
        color: "bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/20 dark:hover:bg-sky-900/30",
    },
    {
        type: "tile-bookmark",
        icon: <Bookmark className="h-4 w-4" />,
        label: "Bookmark",
        color: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30",
    },
    {
        type: "tile-image",
        icon: <ImageIcon className="h-4 w-4" />,
        label: "Image",
        color: "bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30",
    },
    {
        type: "tile-shape",
        icon: <Square className="h-4 w-4" />,
        label: "Shape",
        color: "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/30",
    },
];

const DRAW_TOOLS: DrawToolInfo[] = [
    {
        tool: "hand",
        icon: <Hand className="h-4 w-4" />,
        label: "Hand",
        hotkey: "H",
    },
    {
        tool: "select",
        icon: <MousePointer2 className="h-4 w-4" />,
        label: "Select",
        hotkey: "V",
    },
    {
        tool: "pen",
        icon: <Pen className="h-4 w-4" />,
        label: "Pen",
        hotkey: "1",
    },
    {
        tool: "line",
        icon: <Minus className="h-4 w-4" />,
        label: "Line",
        hotkey: "2",
    },
    {
        tool: "arrow",
        icon: <MoveRight className="h-4 w-4" />,
        label: "Arrow",
        hotkey: "3",
    },
    {
        tool: "rectangle",
        icon: <RectangleHorizontal className="h-4 w-4" />,
        label: "Rectangle",
        hotkey: "4",
    },
    {
        tool: "diamond",
        icon: <Diamond className="h-4 w-4" />,
        label: "Diamond",
        hotkey: "5",
    },
    {
        tool: "ellipse",
        icon: <Circle className="h-4 w-4" />,
        label: "Ellipse",
        hotkey: "6",
    },
    {
        tool: "text",
        icon: <Type className="h-4 w-4" />,
        label: "Text",
        hotkey: "7",
    },
    {
        tool: "eraser",
        icon: <Eraser className="h-4 w-4" />,
        label: "Eraser",
        hotkey: "8",
    },
    {
        tool: "laser",
        icon: <Pointer className="h-4 w-4" />,
        label: "Laser",
        hotkey: "9",
    },
];

export function ModeSidebar({
    currentTool,
    onToolChange,
    onTileTypeSelect,
    selectedTileType,
    toolLock,
    onToggleToolLock,
    mode,
    onModeChange,
}: ModeSidebarProps) {
    const handleModeToggle = () => {
        onModeChange(mode === "tiles" ? "draw" : "tiles");
    };

    const handleTileTypeClick = (tileType: TileType) => {
        onTileTypeSelect(tileType);
        onToolChange("tile");
    };

    return (
        <div className="fixed left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
            {/* Lock Button */}
            <button
                onClick={onToggleToolLock}
                className={cn(
                    "w-16 h-12 rounded-md transition-all duration-200 flex items-center justify-center shadow-2xl",
                    toolLock
                        ? "bg-blue-500 hover:bg-blue-600 text-white"
                        : "bg-card/95 backdrop-blur-md border border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground",
                )}
                title={toolLock ? "Tool locked" : "Tool unlocked"}
            >
                {toolLock ? (
                    <Lock className="w-4 h-4" />
                ) : (
                    <Unlock className="w-4 h-4" />
                )}
            </button>

            {/* Main Sidebar - Fixed height */}
            <div className="relative w-16 h-[564px]">
                {/* Hint of the back panel */}
                <div
                    className="absolute inset-0 bg-card/60 backdrop-blur-sm border border-border rounded-lg shadow-md translate-x-0.5 translate-y-0.5 opacity-20"
                    style={{ zIndex: -1 }}
                />

                {/* Main panel */}
                <div className="relative w-full h-full bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-lg p-2 overflow-hidden">
                    {/* Tiles Mode */}
                    <div
                        className={cn(
                            "absolute inset-2 transition-all duration-300",
                            mode === "tiles"
                                ? "opacity-100 translate-x-0 pointer-events-auto"
                                : "opacity-0 -translate-x-4 pointer-events-none",
                        )}
                    >
                        <div className="text-[9px] font-medium text-muted-foreground mb-2 px-1 text-center">
                            TILES
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {TILE_TYPES.map((tileType) => (
                                <button
                                    key={tileType.type}
                                    onClick={() =>
                                        handleTileTypeClick(tileType.type)
                                    }
                                    className={cn(
                                        "flex flex-col items-center gap-1 p-2.5 rounded-md border-2 transition-all",
                                        selectedTileType === tileType.type
                                            ? "border-blue-500 shadow-sm"
                                            : "border-transparent",
                                        tileType.color,
                                    )}
                                    title={tileType.label}
                                >
                                    {tileType.icon}
                                    <span className="text-[9px] font-medium text-center leading-tight">
                                        {tileType.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Draw Mode */}
                    <div
                        className={cn(
                            "absolute inset-2 transition-all duration-300",
                            mode === "draw"
                                ? "opacity-100 translate-x-0 pointer-events-auto"
                                : "opacity-0 translate-x-4 pointer-events-none",
                        )}
                    >
                        <div className="text-[9px] font-medium text-muted-foreground mb-2 px-1 text-center">
                            DRAW
                        </div>
                        <div className="flex flex-col gap-1">
                            {DRAW_TOOLS.map((drawTool) => (
                                <button
                                    key={drawTool.tool}
                                    onClick={() => onToolChange(drawTool.tool)}
                                    className={cn(
                                        "flex items-center justify-center gap-2 px-2 py-3.5 rounded-md transition-all group relative",
                                        currentTool === drawTool.tool
                                            ? "bg-accent text-accent-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                                    )}
                                    title={`${drawTool.label} (${drawTool.hotkey})`}
                                >
                                    <div className="flex items-center justify-center">
                                        {drawTool.icon}
                                    </div>
                                    <span className="text-[10px] font-mono opacity-60 absolute right-1.5 top-1">
                                        {drawTool.hotkey}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Switch Button - styled like lock button */}
            <button
                onClick={handleModeToggle}
                className="w-16 h-12 bg-card/95 backdrop-blur-md border border-border rounded-md shadow-2xl hover:bg-muted/60 transition-all flex items-center justify-center gap-1.5 group"
                title={`Switch to ${mode === "tiles" ? "Draw" : "Tiles"} mode`}
            >
                {mode === "tiles" ? (
                    <Pencil className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                ) : (
                    <SquareStack className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                )}
            </button>
        </div>
    );
}
