"use client";

import { useState, useRef, useEffect } from "react";
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
    FileText,
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
    hotkey: string;
}

interface DrawToolInfo {
    tool: Tool;
    icon: React.ReactNode;
    label: string;
    hotkey: string;
}

const TILE_SELECT_TOOL: DrawToolInfo = {
    tool: "select",
    icon: <MousePointer2 className="h-4 w-4" />,
    label: "Select",
    hotkey: "V",
};

const TILE_TYPES: TileTypeInfo[] = [
    {
        type: "tile-text",
        icon: <Type className="h-4 w-4" />,
        label: "Text",
        color: "bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700",
        hotkey: "M",
    },
    {
        type: "tile-note",
        icon: <StickyNote className="h-4 w-4" />,
        label: "Note",
        color: "bg-amber-50 hover:bg-amber-100 dark:bg-amber-800/50 dark:hover:bg-amber-700/60",
        hotkey: "N",
    },
    {
        type: "tile-code",
        icon: <Code className="h-4 w-4" />,
        label: "Code",
        color: "bg-neutral-700 hover:bg-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-950 text-white",
        hotkey: "C",
    },
    {
        type: "tile-mermaid",
        icon: <GitBranch className="h-4 w-4" />,
        label: "Diagram",
        color: "bg-sky-50 hover:bg-sky-100 dark:bg-neutral-800 dark:hover:bg-neutral-700",
        hotkey: "D",
    },
    {
        type: "tile-image",
        icon: <ImageIcon className="h-4 w-4" />,
        label: "Image",
        color: "bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30",
        hotkey: "I",
    },
    {
        type: "tile-document",
        icon: <FileText className="h-4 w-4" />,
        label: "Doc",
        color: "bg-orange-50 hover:bg-orange-100 dark:bg-orange-800/50 dark:hover:bg-orange-700/60",
        hotkey: "O",
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
    const [isFadingOut, setIsFadingOut] = useState(false);
    const tilesRef = useRef<HTMLDivElement>(null);
    const drawRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Keyboard shortcuts for tiles and draw tools
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target instanceof HTMLElement && e.target.isContentEditable)
            ) {
                return;
            }

            const key = e.key.toUpperCase();

            if (mode === "tiles") {
                // Tile hotkeys (letter keys)
                const matchedTile = TILE_TYPES.find((t) => t.hotkey === key);
                if (matchedTile) {
                    e.preventDefault();
                    onTileTypeSelect(matchedTile.type);
                    onToolChange("tile");
                    return;
                }
            } else if (mode === "draw") {
                // Draw tool hotkeys (number keys 1-9)
                const matchedTool = DRAW_TOOLS.find((t) => t.hotkey === e.key);
                if (matchedTool) {
                    e.preventDefault();
                    onToolChange(matchedTool.tool);
                    return;
                }
            }

            // Letter hotkeys work in both modes
            if (key === "H") {
                e.preventDefault();
                onToolChange("hand");
            }
            if (key === "V") {
                e.preventDefault();
                onToolChange("select");
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [mode, onTileTypeSelect, onToolChange]);

    // Update container height when mode changes (after transition completes)
    useEffect(() => {
        if (!containerRef.current || isFadingOut) return;

        const activeRef = mode === "tiles" ? tilesRef : drawRef;
        if (activeRef.current && containerRef.current) {
            // Add padding (p-2 = 0.5rem = 8px on each side = 16px total) + buffer
            const padding = 17;
            containerRef.current.style.height = `${activeRef.current.scrollHeight + padding}px`;
        }
    }, [mode, isFadingOut]);

    const handleModeToggle = () => {
        if (!tilesRef.current || !drawRef.current || !containerRef.current)
            return;

        const padding = 17;

        // Get current height
        const currentHeight = containerRef.current.offsetHeight;

        // Get target height (the other mode's content)
        const targetRef = mode === "tiles" ? drawRef : tilesRef;
        if (!targetRef.current) return;
        const targetHeight = targetRef.current.scrollHeight + padding;

        // Set current height explicitly before starting transition
        containerRef.current.style.height = `${currentHeight}px`;

        setIsFadingOut(true);

        // Wait for fade out, then change mode and animate to new height
        setTimeout(() => {
            onModeChange(mode === "tiles" ? "draw" : "tiles");
            setIsFadingOut(false);

            // Animate to target height
            if (containerRef.current) {
                containerRef.current.style.height = `${targetHeight}px`;
            }
        }, 200);
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
                        : "bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground",
                )}
                title={toolLock ? "Tool locked" : "Tool unlocked"}
            >
                {toolLock ? (
                    <Lock className="w-4 h-4" />
                ) : (
                    <Unlock className="w-4 h-4" />
                )}
            </button>

            {/* Main Sidebar - Dynamic height */}
            <div className="relative w-16">
                {/* Hint of the back panel */}
                <div
                    className="absolute inset-0 bg-card/60 backdrop-blur-sm border border-border rounded-lg shadow-md translate-x-0.5 translate-y-0.5 opacity-20"
                    style={{ zIndex: -1 }}
                />

                {/* Main panel */}
                <div
                    ref={containerRef}
                    className="relative w-full bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent rounded-lg shadow-lg p-2 overflow-hidden"
                    style={{
                        transition: "height 0.3s ease-in-out",
                    }}
                >
                    {/* Tiles Mode */}
                    <div
                        ref={tilesRef}
                        className={cn(
                            "transition-opacity duration-200",
                            mode === "tiles"
                                ? isFadingOut
                                    ? "opacity-0"
                                    : "opacity-100"
                                : "opacity-0 absolute inset-0 pointer-events-none",
                        )}
                    >
                        <div className="text-[9px] font-medium text-muted-foreground mb-2 px-1 text-center">
                            TILES
                        </div>
                        <div className="flex flex-col gap-1">
                            {/* Select Tool */}
                            <button
                                onClick={() => onToolChange("select")}
                                className={cn(
                                    "flex flex-col items-center gap-1 px-2 py-2.5 rounded-md transition-all group",
                                    currentTool === "select"
                                        ? "bg-accent text-accent-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                                )}
                                title={`${TILE_SELECT_TOOL.label} (${TILE_SELECT_TOOL.hotkey})`}
                            >
                                {TILE_SELECT_TOOL.icon}
                                <span className="text-[9px] font-medium text-center leading-tight">
                                    Select
                                </span>
                            </button>

                            {/* Tile Types */}
                            {TILE_TYPES.map((tileType) => (
                                <button
                                    key={tileType.type}
                                    onClick={() =>
                                        handleTileTypeClick(tileType.type)
                                    }
                                    className={cn(
                                        "flex flex-col items-center gap-1 px-2 py-2.5 rounded-md transition-all group",
                                        selectedTileType === tileType.type &&
                                            currentTool === "tile"
                                            ? "bg-accent text-accent-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                                    )}
                                    title={`${tileType.label} (${tileType.hotkey})`}
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
                        ref={drawRef}
                        className={cn(
                            "transition-opacity duration-200",
                            mode === "draw"
                                ? isFadingOut
                                    ? "opacity-0"
                                    : "opacity-100"
                                : "opacity-0 absolute inset-0 pointer-events-none",
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
                className="w-16 h-12 bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent rounded-md shadow-2xl hover:bg-muted/60 transition-all flex items-center justify-center gap-1.5 group"
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
