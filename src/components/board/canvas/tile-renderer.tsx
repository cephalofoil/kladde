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
import { RichTextRenderer } from "./content-renderers/rich-text-renderer";
import { CodeRenderer } from "./content-renderers/code-renderer";
import { MermaidRenderer } from "./content-renderers/mermaid-renderer";
import { MermaidCodeEditor } from "./content-renderers/mermaid-code-editor";
import { MermaidTileControls } from "./content-renderers/mermaid-tile-controls";
import Image from "next/image";
import { renderMermaidToPngBlob } from "./utils/mermaid-export";
import {
    HeaderColorPicker,
    getContrastTextColor,
} from "./content-renderers/header-color-picker";
import {
    NoteTileRenderer,
    type NoteColor,
    type NoteStyle,
} from "./content-renderers/note-tile-renderer";
import { getEventTargetInfo } from "./utils/eventTargeting";

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
                    <div className="absolute left-0 right-0 bottom-0 top-12 overflow-hidden pointer-events-auto rounded-b-lg">
                        <RichTextRenderer
                            content={content?.richText || ""}
                            onChange={(text) =>
                                onUpdate?.({
                                    tileContent: { ...content, richText: text },
                                })
                            }
                            readOnly={false}
                            autoFocus={false}
                            showFloatingToolbar={true}
                            className="h-full"
                        />
                    </div>
                );

            case "tile-note":
                return null; // Note tiles render their own content in the special branch below

            case "tile-code":
                return (
                    <div
                        className="absolute left-0 right-0 bottom-0 top-12 pointer-events-auto rounded-b-lg overflow-hidden"
                        onClick={() => {
                            if (!isEditing) setIsEditing(true);
                        }}
                    >
                        <CodeRenderer
                            code={content?.code || ""}
                            language={content?.language || "javascript"}
                            scale={content?.codeScale}
                            wordWrap={content?.codeWordWrap}
                            theme={
                                content?.codeTheme as "atom-dark" | undefined
                            }
                            highlightedLines={content?.codeHighlightedLines}
                            isSelected={isSelected}
                            onChange={handleCodeChange}
                            onFinish={() => setIsEditing(false)}
                            isEditing={isEditing}
                            readOnly={!isEditing}
                        />
                    </div>
                );

            case "tile-mermaid":
                if (isEditing) {
                    return (
                        <div className="absolute inset-0 pointer-events-auto rounded-lg overflow-hidden">
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
                                height={height - 8}
                                tileTitle={tileTitle}
                                isEditingTitle={isEditingTitle}
                                onStartTitleEdit={() => setIsEditingTitle(true)}
                                onTitleChange={(value) =>
                                    onUpdate?.({ tileTitle: value })
                                }
                                onFinishTitleEdit={() =>
                                    setIsEditingTitle(false)
                                }
                            />
                        </div>
                    );
                }
                return content?.chart ? (
                    <div className="absolute left-2 right-2 bottom-2 top-12 pointer-events-auto rounded-b-lg overflow-hidden flex items-center justify-center">
                        <MermaidRenderer
                            chart={content.chart}
                            width={width - 16}
                            height={height - 50}
                            scale={mermaidScale}
                        />
                    </div>
                ) : (
                    <div className="absolute left-0 right-0 bottom-0 top-12 flex items-center justify-center pointer-events-auto rounded-b-lg">
                        <div className="flex flex-col items-center justify-center gap-3 px-6 py-4 max-w-xs text-center">
                            {/* Icon */}
                            <Image
                                src="/icons/diagram-tool.svg"
                                alt=""
                                width={48}
                                height={48}
                                className="w-12 h-12 opacity-40 dark:invert dark:opacity-50"
                            />
                            {/* Title */}
                            <h3 className="text-sm font-medium text-foreground">
                                Create your diagram
                            </h3>
                            {/* Subtitle */}
                            <p className="text-xs text-muted-foreground">
                                Visualize flows, sequences, and structures with
                                Mermaid syntax
                            </p>
                            {/* Primary CTA */}
                            <button
                                onClick={() => setIsEditing(true)}
                                className="mt-1 px-4 py-2 text-sm font-medium bg-foreground text-background rounded-full hover:bg-foreground/90 transition-colors"
                            >
                                + Create Diagram →
                            </button>
                            {/* Secondary template links */}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span>or try:</span>
                                {[
                                    {
                                        name: "Flowchart",
                                        code: `graph TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Action 1]\n    B -->|No| D[Action 2]\n    C --> E[End]\n    D --> E`,
                                    },
                                    {
                                        name: "Sequence",
                                        code: `sequenceDiagram\n    participant A as Alice\n    participant B as Bob\n    A->>B: Hello Bob!\n    B->>A: Hello Alice!`,
                                    },
                                    {
                                        name: "Class",
                                        code: `classDiagram\n    class Animal {\n        +String name\n        +int age\n        +makeSound()\n    }\n    class Dog {\n        +bark()\n    }\n    Animal <|-- Dog`,
                                    },
                                    {
                                        name: "State",
                                        code: `stateDiagram-v2\n    [*] --> Still\n    Still --> Moving\n    Moving --> Still\n    Moving --> Crash\n    Crash --> [*]`,
                                    },
                                ].map((template, idx, arr) => (
                                    <span key={template.name}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onUpdate?.({
                                                    tileContent: {
                                                        ...content,
                                                        chart: template.code,
                                                    },
                                                });
                                                setIsEditing(true);
                                            }}
                                            className="text-primary hover:underline"
                                        >
                                            {template.name}
                                        </button>
                                        {idx < arr.length - 1 && <span>,</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case "tile-image":
                return (
                    <div className="absolute left-0 right-0 bottom-0 top-12 flex items-center justify-center overflow-hidden pointer-events-none rounded-b-lg relative">
                        {content?.imageSrc ? (
                            <Image
                                src={content.imageSrc}
                                alt={content.imageAlt || "Image"}
                                fill
                                sizes="(max-width: 768px) 100vw, 400px"
                                className="object-contain"
                            />
                        ) : (
                            <div className={cn("text-sm", getTileTextColor())}>
                                📷 Click to add image...
                            </div>
                        )}
                    </div>
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
                            <NoteTileRenderer
                                content={content?.noteText || ""}
                                color={
                                    (content?.noteColor as NoteColor) ||
                                    (content?.noteStyle === "torn"
                                        ? "natural-tan"
                                        : "butter")
                                }
                                style={
                                    (content?.noteStyle as NoteStyle) ||
                                    "classic"
                                }
                                fontFamily={content?.noteFontFamily}
                                textAlign={content?.noteTextAlign}
                                onChange={(text) =>
                                    onUpdate?.({
                                        tileContent: {
                                            ...content,
                                            noteText: text,
                                        },
                                    })
                                }
                                onColorChange={(newColor) =>
                                    onUpdate?.({
                                        tileContent: {
                                            ...content,
                                            noteColor: newColor,
                                        },
                                    })
                                }
                                onDelete={onDelete}
                                readOnly={false}
                                isSelected={isSelected}
                                isEditing={isEditing}
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
