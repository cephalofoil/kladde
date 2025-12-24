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
    RefreshCw,
} from "lucide-react";
import type { Tool, TileType, ToolbarMode } from "@/lib/board-types";
import { cn } from "@/lib/utils";

interface ModeSidebarProps {
    currentTool: Tool;
    onToolChange: (tool: Tool) => void;
    onTileTypeSelect: (tileType: TileType) => void;
    selectedTileType?: TileType | null;
    toolLock: boolean;
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
    mode,
    onModeChange,
}: ModeSidebarProps) {
    const [isFlipping, setIsFlipping] = useState(false);

    const handleModeToggle = () => {
        setIsFlipping(true);
        setTimeout(() => {
            onModeChange(mode === "tiles" ? "draw" : "tiles");
            setTimeout(() => setIsFlipping(false), 300);
        }, 150);
    };

    const handleTileTypeClick = (tileType: TileType) => {
        onTileTypeSelect(tileType);
        onToolChange("tile");
    };

    return (
        <div className="fixed left-4 top-20 z-20 flex flex-col gap-2">
            {/* Sidebar with flip animation */}
            <div
                className="relative w-[72px]"
                style={{
                    perspective: "1000px",
                    height: mode === "tiles" ? "360px" : "440px",
                }}
            >
                {/* Hint of the back panel */}
                <div
                    className="absolute inset-0 bg-card/60 backdrop-blur-sm border border-border rounded-lg shadow-md -rotate-2 scale-95 opacity-30"
                    style={{ zIndex: -1 }}
                />

                {/* Main rotating panel */}
                <div
                    className={cn(
                        "relative w-full h-full transition-transform duration-300 ease-in-out",
                        isFlipping && "animate-flip",
                    )}
                    style={{
                        transformStyle: "preserve-3d",
                        transform:
                            mode === "draw"
                                ? "rotateY(180deg)"
                                : "rotateY(0deg)",
                    }}
                >
                    {/* Front: Tiles Mode */}
                    <div
                        className="absolute inset-0 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-lg p-2"
                        style={{
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                        }}
                    >
                        <div className="text-[10px] font-medium text-muted-foreground mb-2 px-1 text-center">
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
                                        "flex flex-col items-center gap-1 p-2 rounded-md border-2 transition-all",
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

                    {/* Back: Draw Mode */}
                    <div
                        className="absolute inset-0 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-lg p-2"
                        style={{
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                            transform: "rotateY(180deg)",
                        }}
                    >
                        <div className="text-[10px] font-medium text-muted-foreground mb-2 px-1 text-center">
                            DRAW
                        </div>
                        <div className="flex flex-col gap-0.5">
                            {DRAW_TOOLS.map((drawTool) => (
                                <button
                                    key={drawTool.tool}
                                    onClick={() => onToolChange(drawTool.tool)}
                                    className={cn(
                                        "flex items-center gap-2 px-2 py-1.5 rounded-md transition-all group relative",
                                        currentTool === drawTool.tool
                                            ? "bg-accent text-accent-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                                    )}
                                    title={`${drawTool.label} (${drawTool.hotkey})`}
                                >
                                    <div className="flex items-center justify-center w-4">
                                        {drawTool.icon}
                                    </div>
                                    <span className="text-[9px] font-mono opacity-60 absolute right-1">
                                        {drawTool.hotkey}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Switch Button */}
            <button
                onClick={handleModeToggle}
                className="w-[72px] h-8 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-lg hover:bg-accent/50 transition-all flex items-center justify-center gap-1.5 group"
                title={`Switch to ${mode === "tiles" ? "Draw" : "Tiles"} mode`}
            >
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-transform group-hover:rotate-180 duration-300" />
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground">
                    {mode === "tiles" ? "Draw" : "Tiles"}
                </span>
            </button>
        </div>
    );
}
