"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { BoardElement } from "@/lib/board-types";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MermaidTileControls } from "./mermaid/mermaid-tile-controls";
import { renderMermaidToPngBlob } from "./mermaid/mermaid-export";
import {
    HeaderColorPicker,
    getContrastTextColor,
} from "../content-renderers/header-color-picker";
import { getEventTargetInfo } from "../utils/eventTargeting";
import { MermaidTileBody } from "./mermaid/tile-mermaid-body";
import { TextTileBody } from "./text/tile-text-body";
import { CodeTileBody } from "./code/tile-code-body";
import { ImageTileBody } from "./image/tile-image-body";
import { NoteTileBody } from "./note/tile-note-body";

interface TileRendererProps {
    element: BoardElement;
    isSelected: boolean;
    onUpdate?: (updates: Partial<BoardElement>) => void;
    onDelete?: () => void;
}

export function TileRenderer(props: TileRendererProps) {
    if (props.element.type !== "tile" || !props.element.tileType) {
        return null;
    }

    return <TileRendererContent {...props} />;
}

function TileRendererContent({
    element,
    isSelected,
    onUpdate,
    onDelete,
}: TileRendererProps) {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const tileRef = useRef<HTMLDivElement>(null);

    const mermaidScale = element.tileContent?.mermaidScale || 1;

    const x = element.x || 0;
    const y = element.y || 0;
    const width = element.width || 300;
    const height = element.height || 200;
    const tileTitle = element.tileTitle || "Untitled";

    const getTileBackground = () => {
        switch (element.tileType) {
            case "tile-text":
                return "bg-white dark:bg-neutral-900";
            case "tile-note":
                return "bg-amber-50 dark:bg-amber-900/20";
            case "tile-code":
                return "bg-neutral-800 dark:bg-neutral-950";
            case "tile-mermaid":
                return "bg-background";
            case "tile-image":
                return "bg-gray-100 dark:bg-neutral-900";
            default:
                return "bg-white dark:bg-neutral-900";
        }
    };

    const getTileTextColor = () => {
        switch (element.tileType) {
            case "tile-code":
                return "text-neutral-200";
            case "tile-note":
                return "text-amber-900 dark:text-amber-100";
            case "tile-mermaid":
                return "text-foreground";
            default:
                return "text-gray-900 dark:text-neutral-100";
        }
    };

    // Double-click to edit (only for code tiles)
    // Text and note tiles have always-on editing via Lexical
    // Mermaid tiles use explicit edit button
    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Don't enter edit mode if double-clicking on the header
        const { isTileHeader } = getEventTargetInfo(e);
        if (isTileHeader) {
            return;
        }

        // Only toggle edit mode for code tiles
        if (element.tileType === "tile-code") {
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

    // Click outside to exit edit mode for code tiles
    useEffect(() => {
        if (!isEditing || element.tileType !== "tile-code") return;

        const handleMouseDown = (e: MouseEvent) => {
            // Check if click is outside the tile
            if (
                tileRef.current &&
                !tileRef.current.contains(e.target as Node)
            ) {
                setIsEditing(false);
            }
        };

        // Use capture phase to handle the click before it's processed by other handlers
        document.addEventListener("mousedown", handleMouseDown, true);
        return () =>
            document.removeEventListener("mousedown", handleMouseDown, true);
    }, [isEditing, element.tileType]);

    // Mermaid handlers
    const handleMermaidScaleChange = useCallback(
        (newScale: number) => {
            onUpdate?.({
                tileContent: {
                    ...element.tileContent,
                    mermaidScale: newScale,
                },
            });
        },
        [element.tileContent, onUpdate],
    );

    const handleCodeChange = useCallback(
        (code: string) => {
            onUpdate?.({
                tileContent: { ...element.tileContent, code },
            });
        },
        [element.tileContent, onUpdate],
    );

    const stopHeaderActions = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const buildMermaidPng = useCallback(async () => {
        const chart = element.tileContent?.chart;
        if (!chart) return null;
        return renderMermaidToPngBlob({
            chart,
            scale: mermaidScale,
        });
    }, [element.tileContent?.chart, mermaidScale]);

    const handleMermaidCopyImage = useCallback(async () => {
        try {
            const blob = await buildMermaidPng();
            if (!blob) return;
            await navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob }),
            ]);
        } catch (error) {
            console.error("Failed to copy mermaid image:", error);
        }
    }, [buildMermaidPng]);

    const handleMermaidDownloadImage = useCallback(async () => {
        try {
            const blob = await buildMermaidPng();
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const safeName = tileTitle.trim()
                ? tileTitle.trim()
                : "mermaid-diagram";
            link.href = url;
            link.download = `${safeName}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download mermaid image:", error);
        }
    }, [buildMermaidPng, tileTitle]);

    const renderTileContent = () => {
        const content = element.tileContent;

        switch (element.tileType) {
            case "tile-text":
                return (
                    <TextTileBody
                        content={content}
                        readOnly={false}
                        autoFocus={false}
                        showFloatingToolbar={true}
                        onUpdate={onUpdate}
                    />
                );

            case "tile-note":
                return null; // Note tiles render their own content in the special branch below

            case "tile-code":
                return (
                    <CodeTileBody
                        content={content}
                        isSelected={isSelected}
                        isEditing={isEditing}
                        codeScale={content?.codeScale}
                        codeWordWrap={content?.codeWordWrap}
                        codeTheme={content?.codeTheme as "atom-dark" | undefined}
                        highlightedLines={content?.codeHighlightedLines}
                        onChange={handleCodeChange}
                        onFinish={() => setIsEditing(false)}
                        onClick={() => {
                            if (!isEditing) setIsEditing(true);
                        }}
                    />
                );

            case "tile-mermaid":
                return (
                    <MermaidTileBody
                        elementId={element.id}
                        content={content}
                        width={width}
                        height={height}
                        tileTitle={tileTitle}
                        isEditing={isEditing}
                        isEditingTitle={isEditingTitle}
                        mermaidScale={mermaidScale}
                        onSetEditing={setIsEditing}
                        onUpdate={onUpdate}
                        onStartTitleEdit={() => setIsEditingTitle(true)}
                        onFinishTitleEdit={() => setIsEditingTitle(false)}
                        onTitleChange={(value) =>
                            onUpdate?.({ tileTitle: value })
                        }
                    />
                );

            case "tile-image":
                return (
                    <ImageTileBody
                        content={content}
                        emptyText="📷 Click to add image..."
                        textClassName={getTileTextColor()}
                    />
                );

            default:
                return null;
        }
    };

    // Note tiles have a special sticky-note design without header
    const isNoteTile = element.tileType === "tile-note";
    const shouldRenderHeader = !(
        element.tileType === "tile-mermaid" && isEditing
    );

    if (isNoteTile) {
        const content = element.tileContent;
        return (
            <g>
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
                        overflow: "visible",
                    }}
                >
                    <div
                        data-tile-header="true"
                        data-element-id={element.id}
                        className={cn(
                            "relative w-full h-full select-none group",
                            isSelected && !isEditing
                                ? "cursor-move"
                                : "cursor-text",
                        )}
                        style={{
                            opacity: (element.opacity || 100) / 100,
                            pointerEvents: "auto",
                        }}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(true);
                        }}
                    >
                        <div className="absolute inset-0 pointer-events-auto">
                            <NoteTileBody
                                content={content}
                                isSelected={isSelected}
                                isEditing={isEditing}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                onRequestEdit={() => setIsEditing(true)}
                            />
                        </div>
                    </div>
                </foreignObject>
            </g>
        );
    }

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
                        "relative w-full h-full rounded-lg shadow-lg border-2 transition-all select-none overflow-hidden",
                        "border-gray-200 dark:border-neutral-700",
                    )}
                    style={{
                        opacity: (element.opacity || 100) / 100,
                        pointerEvents: "auto",
                    }}
                    onDoubleClick={handleDoubleClick}
                >
                    {/* Background - sits behind everything */}
                    <div
                        className={cn(
                            "absolute inset-0 -z-10 rounded-lg",
                            getTileBackground(),
                        )}
                    />

                    {/* Title Bar */}
                    {shouldRenderHeader && (
                        <div
                            data-tile-header="true"
                            data-element-id={element.id}
                            className={cn(
                                "absolute top-0 left-0 right-0 h-12 rounded-t-lg border-b-2 flex items-center px-3 gap-2 transition-colors z-10 backdrop-blur",
                                !element.tileContent?.headerBgColor &&
                                    (isEditingTitle
                                        ? "bg-card border-accent dark:border-accent pointer-events-auto"
                                        : "bg-card/95 border-border hover:bg-muted/40 pointer-events-auto"),
                                element.tileContent?.headerBgColor &&
                                    "pointer-events-auto",
                                isSelected ? "cursor-move" : "cursor-pointer",
                            )}
                            style={{
                                backgroundColor:
                                    element.tileContent?.headerBgColor ||
                                    undefined,
                                borderBottomColor:
                                    element.tileContent?.headerBgColor ||
                                    undefined,
                                color: element.tileContent?.headerBgColor
                                    ? getContrastTextColor(
                                          element.tileContent.headerBgColor,
                                      )
                                    : undefined,
                            }}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                setIsEditingTitle(true);
                            }}
                        >
                            {isEditingTitle ? (
                                <input
                                    type="text"
                                    value={tileTitle}
                                    onChange={(e) =>
                                        onUpdate?.({
                                            tileTitle: e.target.value,
                                        })
                                    }
                                    onBlur={() => setIsEditingTitle(false)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                            setIsEditingTitle(false);
                                        e.stopPropagation();
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 bg-transparent text-base font-semibold border-none outline-none"
                                    placeholder="Enter title..."
                                    autoFocus
                                />
                            ) : (
                                <div className="flex-1 text-base font-semibold truncate">
                                    {tileTitle}
                                </div>
                            )}

                            <div
                                className="ml-auto flex items-center gap-1"
                                onMouseDown={stopHeaderActions}
                                onClick={stopHeaderActions}
                            >
                                {element.tileType === "tile-mermaid" &&
                                    !isEditing && (
                                        <MermaidTileControls
                                            scale={mermaidScale}
                                            onScaleChange={
                                                handleMermaidScaleChange
                                            }
                                            onEdit={() => setIsEditing(true)}
                                            onCopyImage={handleMermaidCopyImage}
                                            onDownloadImage={
                                                handleMermaidDownloadImage
                                            }
                                            className="bg-transparent p-0"
                                        />
                                    )}
                                {!isEditingTitle && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger
                                            onClick={(e) => e.stopPropagation()}
                                            className={cn(
                                                "p-1 rounded",
                                                !element.tileContent
                                                    ?.headerBgColor &&
                                                    "hover:bg-muted",
                                            )}
                                            style={{
                                                color: element.tileContent
                                                    ?.headerBgColor
                                                    ? getContrastTextColor(
                                                          element.tileContent
                                                              .headerBgColor,
                                                      )
                                                    : undefined,
                                            }}
                                            onMouseEnter={(e) => {
                                                if (
                                                    element.tileContent
                                                        ?.headerBgColor
                                                ) {
                                                    e.currentTarget.style.backgroundColor =
                                                        element.tileContent.headerBgColor;
                                                    e.currentTarget.style.filter =
                                                        "brightness(0.9)";
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (
                                                    element.tileContent
                                                        ?.headerBgColor
                                                ) {
                                                    e.currentTarget.style.backgroundColor =
                                                        "transparent";
                                                    e.currentTarget.style.filter =
                                                        "none";
                                                }
                                            }}
                                        >
                                            <MoreHorizontal className="h-4 w-4" />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem
                                                onClick={() =>
                                                    setIsEditingTitle(true)
                                                }
                                            >
                                                Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() =>
                                                    setIsEditing(true)
                                                }
                                            >
                                                Edit Content
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowColorPicker(true);
                                                }}
                                            >
                                                Header Color
                                            </DropdownMenuItem>
                                            {onDelete && (
                                                <DropdownMenuItem
                                                    onClick={onDelete}
                                                    className="text-red-600"
                                                >
                                                    Delete
                                                </DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tile Content */}
                    {renderTileContent()}
                </div>
            </foreignObject>

            {/* Color Picker Popup */}
            {showColorPicker && (
                <>
                    {/* Invisible overlay to capture clicks outside */}
                    <rect
                        x={-10000}
                        y={-10000}
                        width={20000}
                        height={20000}
                        fill="transparent"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowColorPicker(false);
                        }}
                        style={{ cursor: "default" }}
                    />
                    <foreignObject
                        x={x + width + 10}
                        y={y}
                        width={280}
                        height={350}
                    >
                        <HeaderColorPicker
                            value={
                                element.tileContent?.headerBgColor || "#f9fafb"
                            }
                            onChange={(color) => {
                                onUpdate?.({
                                    tileContent: {
                                        ...element.tileContent,
                                        headerBgColor: color,
                                    },
                                });
                            }}
                            onReset={() => {
                                onUpdate?.({
                                    tileContent: {
                                        ...element.tileContent,
                                        headerBgColor: undefined,
                                    },
                                });
                                setShowColorPicker(false);
                            }}
                            onClose={() => setShowColorPicker(false)}
                        />
                    </foreignObject>
                </>
            )}
        </g>
    );
}
