"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { BoardElement } from "@/lib/board-types";
import { cn } from "@/lib/utils";
import { getMinTileSize } from "@/lib/tile-utils";
import { MoreHorizontal } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichTextRenderer } from "./content-renderers/rich-text-renderer";
import { CodeRenderer } from "./content-renderers/code-renderer";
import { MermaidRenderer } from "./content-renderers/mermaid-renderer";
import { MermaidCodeEditor } from "./content-renderers/mermaid-code-editor";
import { MermaidTileControls } from "./content-renderers/mermaid-tile-controls";
import { BookmarkRenderer } from "./content-renderers/bookmark-renderer";
import { BookmarkInputRenderer } from "./content-renderers/bookmark-input-renderer";

interface TileRendererProps {
    element: BoardElement;
    isSelected: boolean;
    onUpdate?: (updates: Partial<BoardElement>) => void;
    onDelete?: () => void;
}

type ResizeDirection = "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se";

export function TileRenderer({
    element,
    isSelected,
    onUpdate,
    onDelete,
}: TileRendererProps) {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    const [dragStart, setDragStart] = useState({
        x: 0,
        y: 0,
        tileX: 0,
        tileY: 0,
    });
    const [resizeStart, setResizeStart] = useState({
        x: 0,
        y: 0,
        tileX: 0,
        tileY: 0,
        tileWidth: 0,
        tileHeight: 0,
        direction: "se" as ResizeDirection,
    });

    // Mermaid-specific state
    const [mermaidScale, setMermaidScale] = useState(
        element.tileContent?.mermaidScale || 1,
    );
    const [mermaidOffsetX, setMermaidOffsetX] = useState(
        element.tileContent?.mermaidOffsetX || 0,
    );
    const [mermaidOffsetY, setMermaidOffsetY] = useState(
        element.tileContent?.mermaidOffsetY || 0,
    );
    const [mermaidSvgContent, setMermaidSvgContent] = useState<string>("");

    const rafRef = useRef<number | null>(null);
    const tileRef = useRef<HTMLDivElement>(null);

    if (element.type !== "tile" || !element.tileType) {
        return null;
    }

    const x = element.x || 0;
    const y = element.y || 0;
    const width = element.width || 300;
    const height = element.height || 200;
    const tileTitle = element.tileTitle || "Untitled";

    useEffect(() => {
        setMermaidScale(element.tileContent?.mermaidScale || 1);
        setMermaidOffsetX(element.tileContent?.mermaidOffsetX || 0);
        setMermaidOffsetY(element.tileContent?.mermaidOffsetY || 0);
    }, [
        element.tileContent?.mermaidScale,
        element.tileContent?.mermaidOffsetX,
        element.tileContent?.mermaidOffsetY,
    ]);

    const getTileBackground = () => {
        switch (element.tileType) {
            case "tile-text":
                return "bg-white dark:bg-slate-900";
            case "tile-note":
                return "bg-amber-50 dark:bg-amber-900/20";
            case "tile-code":
                return "bg-slate-800 dark:bg-slate-950";
            case "tile-mermaid":
                return "bg-sky-50 dark:bg-sky-900/20";
            case "tile-bookmark":
                return "bg-white dark:bg-slate-900";
            case "tile-image":
                return "bg-gray-100 dark:bg-gray-800";
            case "tile-shape":
                return "bg-blue-500 dark:bg-blue-600";
            default:
                return "bg-white dark:bg-slate-900";
        }
    };

    const getTileTextColor = () => {
        switch (element.tileType) {
            case "tile-code":
                return "text-slate-200";
            case "tile-note":
                return "text-amber-900 dark:text-amber-100";
            case "tile-mermaid":
                return "text-sky-900 dark:text-sky-100";
            case "tile-shape":
                return "text-white";
            default:
                return "text-gray-900 dark:text-gray-100";
        }
    };

    // Drag handlers
    const handleHeaderMouseDown = (e: React.MouseEvent) => {
        if (isEditingTitle || isResizing || isEditing) return;
        e.stopPropagation();

        setIsDragging(true);
        setDragStart({
            x: e.clientX,
            y: e.clientY,
            tileX: x,
            tileY: y,
        });
    };

    // Resize handlers
    const handleResizeMouseDown = (
        e: React.MouseEvent,
        direction: ResizeDirection,
    ) => {
        e.stopPropagation();
        if (isEditing || isDragging) return;

        setIsResizing(true);
        setResizeStart({
            x: e.clientX,
            y: e.clientY,
            tileX: x,
            tileY: y,
            tileWidth: width,
            tileHeight: height,
            direction,
        });
    };

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDragging && !isResizing) return;
            const { clientX, clientY } = e;

            if (rafRef.current) cancelAnimationFrame(rafRef.current);

            rafRef.current = requestAnimationFrame(() => {
                if (isDragging) {
                    const deltaX = clientX - dragStart.x;
                    const deltaY = clientY - dragStart.y;

                    onUpdate?.({
                        x: dragStart.tileX + deltaX,
                        y: dragStart.tileY + deltaY,
                    });
                }

                if (isResizing) {
                    const deltaX = clientX - resizeStart.x;
                    const deltaY = clientY - resizeStart.y;
                    const isShiftPressed = e.shiftKey;

                    let newX = resizeStart.tileX;
                    let newY = resizeStart.tileY;
                    let newWidth = resizeStart.tileWidth;
                    let newHeight = resizeStart.tileHeight;

                    const originalAspectRatio =
                        resizeStart.tileWidth / resizeStart.tileHeight;

                    switch (resizeStart.direction) {
                        case "n":
                            newY = resizeStart.tileY + deltaY;
                            newHeight = resizeStart.tileHeight - deltaY;
                            if (isShiftPressed) {
                                newWidth = newHeight * originalAspectRatio;
                                newX =
                                    resizeStart.tileX +
                                    (resizeStart.tileWidth - newWidth) / 2;
                            }
                            break;
                        case "e":
                            newWidth = resizeStart.tileWidth + deltaX;
                            if (isShiftPressed) {
                                newHeight = newWidth / originalAspectRatio;
                            }
                            break;
                        case "s":
                            newHeight = resizeStart.tileHeight + deltaY;
                            if (isShiftPressed) {
                                newWidth = newHeight * originalAspectRatio;
                                newX =
                                    resizeStart.tileX +
                                    (resizeStart.tileWidth - newWidth) / 2;
                            }
                            break;
                        case "w":
                            newX = resizeStart.tileX + deltaX;
                            newWidth = resizeStart.tileWidth - deltaX;
                            if (isShiftPressed) {
                                newHeight = newWidth / originalAspectRatio;
                                newY =
                                    resizeStart.tileY +
                                    (resizeStart.tileHeight - newHeight) / 2;
                            }
                            break;
                        case "nw":
                            if (isShiftPressed) {
                                if (Math.abs(deltaX) >= Math.abs(deltaY)) {
                                    newWidth = resizeStart.tileWidth - deltaX;
                                    newHeight = newWidth / originalAspectRatio;
                                    newX = resizeStart.tileX + deltaX;
                                    newY =
                                        resizeStart.tileY +
                                        (resizeStart.tileHeight - newHeight);
                                } else {
                                    newHeight = resizeStart.tileHeight - deltaY;
                                    newWidth = newHeight * originalAspectRatio;
                                    newX =
                                        resizeStart.tileX +
                                        (resizeStart.tileWidth - newWidth);
                                    newY = resizeStart.tileY + deltaY;
                                }
                            } else {
                                newX = resizeStart.tileX + deltaX;
                                newY = resizeStart.tileY + deltaY;
                                newWidth = resizeStart.tileWidth - deltaX;
                                newHeight = resizeStart.tileHeight - deltaY;
                            }
                            break;
                        case "ne":
                            if (isShiftPressed) {
                                if (Math.abs(deltaX) >= Math.abs(deltaY)) {
                                    newWidth = resizeStart.tileWidth + deltaX;
                                    newHeight = newWidth / originalAspectRatio;
                                    newY =
                                        resizeStart.tileY +
                                        (resizeStart.tileHeight - newHeight);
                                } else {
                                    newHeight = resizeStart.tileHeight - deltaY;
                                    newWidth = newHeight * originalAspectRatio;
                                    newY = resizeStart.tileY + deltaY;
                                }
                            } else {
                                newY = resizeStart.tileY + deltaY;
                                newWidth = resizeStart.tileWidth + deltaX;
                                newHeight = resizeStart.tileHeight - deltaY;
                            }
                            break;
                        case "sw":
                            if (isShiftPressed) {
                                if (Math.abs(deltaX) >= Math.abs(deltaY)) {
                                    newWidth = resizeStart.tileWidth - deltaX;
                                    newHeight = newWidth / originalAspectRatio;
                                    newX = resizeStart.tileX + deltaX;
                                } else {
                                    newHeight = resizeStart.tileHeight + deltaY;
                                    newWidth = newHeight * originalAspectRatio;
                                    newX =
                                        resizeStart.tileX +
                                        (resizeStart.tileWidth - newWidth);
                                }
                            } else {
                                newX = resizeStart.tileX + deltaX;
                                newWidth = resizeStart.tileWidth - deltaX;
                                newHeight = resizeStart.tileHeight + deltaY;
                            }
                            break;
                        case "se":
                            if (isShiftPressed) {
                                if (Math.abs(deltaX) >= Math.abs(deltaY)) {
                                    newWidth = resizeStart.tileWidth + deltaX;
                                    newHeight = newWidth / originalAspectRatio;
                                } else {
                                    newHeight = resizeStart.tileHeight + deltaY;
                                    newWidth = newHeight * originalAspectRatio;
                                }
                            } else {
                                newWidth = resizeStart.tileWidth + deltaX;
                                newHeight = resizeStart.tileHeight + deltaY;
                            }
                            break;
                    }

                    // Enforce minimum size
                    const minSizes = element.tileType
                        ? getMinTileSize(element.tileType)
                        : { width: 100, height: 100 };
                    let clampedWidth = Math.max(newWidth, minSizes.width);
                    let clampedHeight = Math.max(newHeight, minSizes.height);

                    // Adjust position if clamping changed size
                    let adjX = newX;
                    let adjY = newY;
                    if (clampedWidth !== newWidth) {
                        if (
                            resizeStart.direction === "nw" ||
                            resizeStart.direction === "sw" ||
                            resizeStart.direction === "w"
                        ) {
                            adjX =
                                resizeStart.tileX +
                                (resizeStart.tileWidth - clampedWidth);
                        }
                    }
                    if (clampedHeight !== newHeight) {
                        if (
                            resizeStart.direction === "nw" ||
                            resizeStart.direction === "ne" ||
                            resizeStart.direction === "n"
                        ) {
                            adjY =
                                resizeStart.tileY +
                                (resizeStart.tileHeight - clampedHeight);
                        }
                    }

                    onUpdate?.({
                        x: adjX,
                        y: adjY,
                        width: clampedWidth,
                        height: clampedHeight,
                    });
                }
            });
        },
        [
            isDragging,
            isResizing,
            dragStart,
            resizeStart,
            onUpdate,
            element.tileType,
            x,
            y,
        ],
    );

    const handleMouseUpGlobal = useCallback(() => {
        setIsDragging(false);
        setIsResizing(false);
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (isDragging || isResizing) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUpGlobal);
            return () => {
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUpGlobal);
                if (rafRef.current) {
                    cancelAnimationFrame(rafRef.current);
                    rafRef.current = null;
                }
            };
        }
    }, [isDragging, isResizing, handleMouseMove, handleMouseUpGlobal]);

    // Double-click to edit
    const handleDoubleClick = () => {
        if (
            element.tileType === "tile-text" ||
            element.tileType === "tile-note" ||
            element.tileType === "tile-code" ||
            element.tileType === "tile-mermaid" ||
            element.tileType === "tile-bookmark"
        ) {
            setIsEditing(true);
        }
    };

    // Escape to exit edit mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isSelected) {
                setIsEditing(false);
                setIsEditingTitle(false);
            }
        };

        if (isSelected) {
            window.addEventListener("keydown", handleKeyDown);
            return () => window.removeEventListener("keydown", handleKeyDown);
        }
    }, [isSelected]);

    // Mermaid handlers
    const handleMermaidScaleChange = useCallback(
        (newScale: number) => {
            setMermaidScale(newScale);
            onUpdate?.({
                tileContent: {
                    ...element.tileContent,
                    mermaidScale: newScale,
                },
            });
        },
        [element.tileContent, onUpdate],
    );

    const handleMermaidOffsetChange = useCallback(
        (newOffsetX: number, newOffsetY: number) => {
            setMermaidOffsetX(newOffsetX);
            setMermaidOffsetY(newOffsetY);
            onUpdate?.({
                tileContent: {
                    ...element.tileContent,
                    mermaidOffsetX: newOffsetX,
                    mermaidOffsetY: newOffsetY,
                },
            });
        },
        [element.tileContent, onUpdate],
    );

    const handleBookmarkSave = useCallback(
        (bookmarkData: {
            url: string;
            title?: string;
            description?: string;
            favicon?: string;
            siteName?: string;
            imageUrl?: string;
            displayName?: string;
        }) => {
            onUpdate?.({
                tileContent: {
                    ...element.tileContent,
                    ...bookmarkData,
                },
            });
            setIsEditing(false);
        },
        [element.tileContent, onUpdate],
    );

    const renderTileContent = () => {
        const content = element.tileContent;

        switch (element.tileType) {
            case "tile-text":
                return (
                    <div className="absolute inset-0 top-10 p-4 overflow-hidden pointer-events-auto">
                        <RichTextRenderer
                            content={content?.richText || ""}
                            onChange={(text) =>
                                onUpdate?.({
                                    tileContent: { ...content, richText: text },
                                })
                            }
                            readOnly={false}
                            autoFocus={isEditing}
                        />
                    </div>
                );

            case "tile-note":
                return (
                    <div className="absolute inset-0 top-10 p-4 overflow-hidden pointer-events-auto">
                        <RichTextRenderer
                            content={content?.noteText || ""}
                            onChange={(text) =>
                                onUpdate?.({
                                    tileContent: { ...content, noteText: text },
                                })
                            }
                            onFinish={() => setIsEditing(false)}
                            readOnly={!isEditing}
                            autoFocus={isEditing}
                            className={cn("text-sm", getTileTextColor())}
                        />
                    </div>
                );

            case "tile-code":
                return (
                    <div className="absolute inset-2 top-10 pointer-events-auto">
                        <CodeRenderer
                            code={content?.code || ""}
                            language={content?.language || "javascript"}
                            onChange={(code) =>
                                onUpdate?.({
                                    tileContent: { ...content, code },
                                })
                            }
                            onLanguageChange={(language) =>
                                onUpdate?.({
                                    tileContent: { ...content, language },
                                })
                            }
                            onFinish={() => setIsEditing(false)}
                            isEditing={isEditing}
                            readOnly={!isEditing}
                        />
                    </div>
                );

            case "tile-mermaid":
                if (isEditing) {
                    return (
                        <div className="absolute inset-1 top-10 pointer-events-auto">
                            <MermaidCodeEditor
                                initialCode={content?.chart || ""}
                                onSave={(code) => {
                                    onUpdate?.({
                                        tileContent: {
                                            ...content,
                                            chart: code,
                                        },
                                    });
                                    setIsEditing(false);
                                }}
                                onCancel={() => setIsEditing(false)}
                                width={width - 8}
                                height={height - 48}
                            />
                        </div>
                    );
                }
                return content?.chart ? (
                    <div className="absolute inset-2 top-10 pointer-events-auto">
                        {isSelected && (
                            <div className="absolute top-0 right-0 z-10">
                                <MermaidTileControls
                                    scale={mermaidScale}
                                    onScaleChange={handleMermaidScaleChange}
                                    onEdit={() => setIsEditing(true)}
                                    className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg shadow-md p-1"
                                />
                            </div>
                        )}
                        <MermaidRenderer
                            chart={content.chart}
                            width={width - 16}
                            height={height - 48}
                            scale={mermaidScale}
                            offsetX={mermaidOffsetX}
                            offsetY={mermaidOffsetY}
                            onOffsetChange={handleMermaidOffsetChange}
                            isInteractive={isSelected}
                            onSvgReady={setMermaidSvgContent}
                        />
                    </div>
                ) : (
                    <div className="absolute inset-0 top-10 flex items-center justify-center pointer-events-auto">
                        <div
                            className={cn(
                                "text-sm text-center",
                                getTileTextColor(),
                            )}
                        >
                            Double-click to add diagram...
                        </div>
                    </div>
                );

            case "tile-bookmark":
                return content?.url ? (
                    <div className="absolute inset-2 top-2 pointer-events-auto">
                        <BookmarkRenderer
                            url={content.url}
                            title={content.bookmarkTitle}
                            description={content.bookmarkDescription}
                            favicon={content.favicon}
                            siteName={content.siteName}
                            imageUrl={content.imageUrl}
                            displayName={content.bookmarkTitle}
                            isSelected={isSelected}
                            onEdit={() => setIsEditing(true)}
                        />
                    </div>
                ) : isEditing ? (
                    <div className="absolute inset-2 top-2 pointer-events-auto">
                        <BookmarkInputRenderer
                            onSave={handleBookmarkSave}
                            onCancel={() => setIsEditing(false)}
                            width={width - 16}
                            height={height - 16}
                        />
                    </div>
                ) : (
                    <div className="absolute inset-0 top-10 p-4 overflow-hidden">
                        <div className={cn("text-sm", getTileTextColor())}>
                            Double-click to add bookmark...
                        </div>
                    </div>
                );

            case "tile-image":
                return (
                    <div className="absolute inset-0 top-10 flex items-center justify-center overflow-hidden">
                        {content?.imageSrc ? (
                            <img
                                src={content.imageSrc}
                                alt={content.imageAlt || "Image"}
                                className="max-w-full max-h-full object-contain"
                            />
                        ) : (
                            <div className={cn("text-sm", getTileTextColor())}>
                                📷 Click to add image...
                            </div>
                        )}
                    </div>
                );

            case "tile-shape":
                return (
                    <div className="absolute inset-0 top-10 flex items-center justify-center overflow-hidden">
                        <div
                            className={cn(
                                "text-lg font-bold",
                                getTileTextColor(),
                            )}
                        >
                            {content?.shape || "SHAPE"}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    const renderResizeHandles = () => {
        if (!isSelected || isEditing) return null;

        const handleSize = 8;
        const handleClass =
            "fill-blue-500 stroke-white stroke-1 cursor-pointer hover:fill-blue-600 transition-colors";

        const handles: Array<{
            x: number;
            y: number;
            direction: ResizeDirection;
            cursor: string;
        }> = [
            { x: width / 2, y: 0, direction: "n", cursor: "ns-resize" },
            { x: width, y: 0, direction: "ne", cursor: "nesw-resize" },
            { x: width, y: height / 2, direction: "e", cursor: "ew-resize" },
            { x: width, y: height, direction: "se", cursor: "nwse-resize" },
            { x: width / 2, y: height, direction: "s", cursor: "ns-resize" },
            { x: 0, y: height, direction: "sw", cursor: "nesw-resize" },
            { x: 0, y: height / 2, direction: "w", cursor: "ew-resize" },
            { x: 0, y: 0, direction: "nw", cursor: "nwse-resize" },
        ];

        return handles.map((handle) => (
            <rect
                key={handle.direction}
                x={x + handle.x - handleSize / 2}
                y={y + handle.y - handleSize / 2}
                width={handleSize}
                height={handleSize}
                className={handleClass}
                style={{ cursor: handle.cursor }}
                onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeMouseDown(
                        e as unknown as React.MouseEvent,
                        handle.direction,
                    );
                }}
            />
        ));
    };

    return (
        <g>
            {/* Foreign object to render HTML tile */}
            <foreignObject
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    transform: element.rotation
                        ? `rotate(${element.rotation}deg)`
                        : undefined,
                    transformOrigin: "center",
                }}
            >
                <div
                    ref={tileRef}
                    className={cn(
                        "relative w-full h-full rounded-lg shadow-lg border-2 transition-all",
                        getTileBackground(),
                        isSelected
                            ? "ring-2 ring-blue-500 border-blue-500"
                            : "border-gray-200 dark:border-gray-700",
                    )}
                    style={{
                        opacity: (element.opacity || 100) / 100,
                    }}
                    onDoubleClick={handleDoubleClick}
                >
                    {/* Title Bar */}
                    <div
                        className={cn(
                            "absolute top-0 left-0 right-0 h-10 rounded-t-lg border-b-2 flex items-center px-3 gap-2 cursor-move transition-colors pointer-events-auto",
                            isEditingTitle
                                ? "bg-white dark:bg-gray-700 border-blue-200 dark:border-blue-800"
                                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750",
                        )}
                        onMouseDown={handleHeaderMouseDown}
                    >
                        {isEditingTitle ? (
                            <input
                                type="text"
                                value={tileTitle}
                                onChange={(e) =>
                                    onUpdate?.({ tileTitle: e.target.value })
                                }
                                onBlur={() => setIsEditingTitle(false)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                        setIsEditingTitle(false);
                                    e.stopPropagation();
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 bg-transparent text-sm font-medium border-none outline-none"
                                placeholder="Enter title..."
                                autoFocus
                            />
                        ) : (
                            <div
                                className="flex-1 text-sm font-medium cursor-text truncate"
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingTitle(true);
                                }}
                            >
                                {tileTitle}
                            </div>
                        )}

                        {/* Dropdown Menu */}
                        {isSelected && !isEditingTitle && (
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem
                                        onClick={() => setIsEditingTitle(true)}
                                    >
                                        Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => setIsEditing(true)}
                                    >
                                        Edit Content
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={onDelete}
                                        className="text-red-600"
                                    >
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>

                    {/* Tile Content */}
                    {renderTileContent()}
                </div>
            </foreignObject>

            {/* Resize Handles */}
            {renderResizeHandles()}
        </g>
    );
}
