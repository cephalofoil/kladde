"use client";

import { useCallback, useEffect, useMemo, useState, memo, useRef } from "react";
import type { BoardElement } from "@/lib/board-types";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CodeTileControls } from "./code/code-tile-controls";
import { MermaidTileControls } from "./mermaid/mermaid-tile-controls";
import { renderMermaidToPngBlob } from "./mermaid/mermaid-export";
import {
    copyCodeAsImage,
    downloadCodeAsFile,
    formatCode,
    canFormatLanguage,
} from "./code/code-export";
import { importCodeFile } from "./code/code-import";
import { type CodeThemeName } from "@/lib/code-themes";
import {
    HeaderColorPicker,
    getContrastTextColor,
} from "../content-renderers/header-color-picker";
import { getEventTargetInfo } from "../utils/eventTargeting";
import { MermaidTileBody } from "./mermaid/tile-mermaid-body";
import { TextTileBody } from "./text/tile-text-body";
import { CodeTileBody } from "./code/tile-code-body";
import { ImageTileBody } from "./image/tile-image-body";
import { DocumentTileBody } from "./document/tile-document-body";
import { NoteTileBody } from "./note/tile-note-body";

interface HtmlTileRendererProps {
    element: BoardElement;
    isSelected: boolean;
    isTextEditing: boolean;
    onRequestTextEdit: () => void;
    onUpdate?: (updates: Partial<BoardElement>) => void;
    onDelete?: () => void;
    onOpenDocumentEditor?: (elementId: string) => void;
    onOpenMermaidEditor?: (elementId: string) => void;
    onOpenCodeEditor?: (elementId: string) => void;
}

export const HtmlTileRenderer = memo(
    function HtmlTileRenderer({
        element,
        isSelected,
        isTextEditing,
        onRequestTextEdit,
        onUpdate,
        onDelete,
        onOpenDocumentEditor,
        onOpenMermaidEditor,
        onOpenCodeEditor,
    }: HtmlTileRendererProps) {
        const [isEditingTitle, setIsEditingTitle] = useState(false);
        const [isEditing, setIsEditing] = useState(false);
        const [showColorPicker, setShowColorPicker] = useState(false);
        const tileRef = useRef<HTMLDivElement>(null);

        const mermaidScale = element.tileContent?.mermaidScale || 1;
        const codeScale = element.tileContent?.codeScale || 1;
        const codeWordWrap = element.tileContent?.codeWordWrap || false;
        const codeTheme =
            (element.tileContent?.codeTheme as CodeThemeName) || "atom-dark";
        const codeHighlightedLines =
            element.tileContent?.codeHighlightedLines || [];

        const x = element.x || 0;
        const y = element.y || 0;
        const width = element.width || 300;
        const height = element.height || 200;
        const tileTitle = element.tileTitle || "Untitled";

        const content = element.tileContent;

        // Handle title change - for document tiles, also sync documentContent.title
        const handleTitleChange = useCallback(
            (newTitle: string) => {
                if (element.tileType === "tile-document") {
                    // Sync both tileTitle and documentContent.title for document tiles
                    const existingDocContent =
                        element.tileContent?.documentContent;
                    onUpdate?.({
                        tileTitle: newTitle,
                        tileContent: {
                            ...element.tileContent,
                            documentContent: existingDocContent
                                ? { ...existingDocContent, title: newTitle }
                                : undefined,
                        },
                    });
                } else {
                    onUpdate?.({ tileTitle: newTitle });
                }
            },
            [element.tileType, element.tileContent, onUpdate],
        );

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
                case "tile-document":
                    return "bg-transparent";
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
                case "tile-document":
                    return "text-orange-900 dark:text-neutral-100";
                default:
                    return "text-gray-900 dark:text-neutral-100";
            }
        };

        const tileStyle = useMemo(() => {
            const rotation = element.rotation ?? 0;
            return {
                left: x,
                top: y,
                width,
                height,
                opacity: (element.opacity || 100) / 100,
                zIndex: element.zIndex || 0,
                transform: rotation ? `rotate(${rotation}deg)` : undefined,
                transformOrigin: "center",
            } as const;
        }, [
            element.opacity,
            element.rotation,
            element.zIndex,
            height,
            width,
            x,
            y,
        ]);

        // Double-click to edit (only for code tiles)
        // Mermaid tiles use explicit edit button
        const handleDoubleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            const { isTileHeader } = getEventTargetInfo(e);
            if (isTileHeader) return;

            if (element.tileType === "tile-code") {
                setIsEditing(true);
            }
        };

        useEffect(() => {
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === "Escape" && isSelected) {
                    setIsEditing(false);
                    setIsEditingTitle(false);
                    setShowColorPicker(false);
                }
            };

            if (isSelected) {
                window.addEventListener("keydown", handleKeyDown);
                return () =>
                    window.removeEventListener("keydown", handleKeyDown);
            }
        }, [isSelected]);

        useEffect(() => {
            if (!isEditing) return;
            const handleOutsideClick = (event: MouseEvent) => {
                const target = event.target as Node | null;
                if (!tileRef.current || !target) return;
                if (tileRef.current.contains(target)) return;
                // Ignore clicks inside Radix UI portals (dropdowns, popovers, etc.)
                const radixPortal = (target as Element).closest?.(
                    "[data-radix-popper-content-wrapper], [data-radix-menu-content]"
                );
                if (radixPortal) return;
                setIsEditing(false);
            };
            document.addEventListener("mousedown", handleOutsideClick);
            return () => {
                document.removeEventListener("mousedown", handleOutsideClick);
            };
        }, [isEditing]);

        useEffect(() => {
            if (isEditing && !isSelected) {
                onRequestTextEdit();
            }
        }, [isEditing, isSelected, onRequestTextEdit]);

        const stopCanvas = useCallback((e: React.SyntheticEvent) => {
            e.stopPropagation();
        }, []);

        const isLinkTarget = useCallback((e: React.SyntheticEvent) => {
            const target = e.target as HTMLElement | null;
            return Boolean(target?.closest("a"));
        }, []);

        const requestTextEdit = useCallback(
            (e: React.SyntheticEvent) => {
                stopCanvas(e);
                onRequestTextEdit();
            },
            [onRequestTextEdit, stopCanvas],
        );

        const handleMermaidScaleChange = useCallback(
            (newScale: number) => {
                onUpdate?.({
                    tileContent: {
                        ...content,
                        mermaidScale: newScale,
                    },
                });
            },
            [content, onUpdate],
        );

        const buildMermaidPng = useCallback(async () => {
            if (!content?.chart) return null;
            return renderMermaidToPngBlob({
                chart: content.chart,
                scale: mermaidScale,
            });
        }, [content, mermaidScale]);

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

        // Code tile handlers
        const handleCodeScaleChange = useCallback(
            (newScale: number) => {
                onUpdate?.({
                    tileContent: {
                        ...content,
                        codeScale: newScale,
                    },
                });
            },
            [content, onUpdate],
        );

        const handleCodeWordWrapChange = useCallback(
            (wrap: boolean) => {
                onUpdate?.({
                    tileContent: {
                        ...content,
                        codeWordWrap: wrap,
                    },
                });
            },
            [content, onUpdate],
        );

        const handleCodeThemeChange = useCallback(
            (theme: CodeThemeName) => {
                onUpdate?.({
                    tileContent: {
                        ...content,
                        codeTheme: theme,
                    },
                });
            },
            [content, onUpdate],
        );

        const handleCodeHighlightedLinesChange = useCallback(
            (lines: number[]) => {
                onUpdate?.({
                    tileContent: {
                        ...content,
                        codeHighlightedLines: lines,
                    },
                });
            },
            [content, onUpdate],
        );


        const handleCodeCopy = useCallback(async () => {
            try {
                await navigator.clipboard.writeText(content?.code || "");
            } catch (error) {
                console.error("Failed to copy code:", error);
            }
        }, [content]);

        const handleCodeCopyImage = useCallback(async () => {
            try {
                await copyCodeAsImage({
                    code: content?.code || "",
                    language: content?.language || "javascript",
                    theme: codeTheme,
                    scale: codeScale,
                });
            } catch (error) {
                console.error("Failed to copy code as image:", error);
            }
        }, [content, codeTheme, codeScale]);

        const handleCodeDownload = useCallback(() => {
            const safeName = tileTitle.trim() ? tileTitle.trim() : "code";
            downloadCodeAsFile({
                code: content?.code || "",
                language: content?.language || "javascript",
                filename: safeName,
            });
        }, [content, tileTitle]);

        const handleCodeFormat = useCallback(async () => {
            const { formatted, error } = await formatCode(
                content?.code || "",
                content?.language || "javascript",
            );
            if (!error && formatted !== content?.code) {
                onUpdate?.({
                    tileContent: {
                        ...content,
                        code: formatted,
                    },
                });
            }
        }, [content, onUpdate]);

        const handleCodeImport = useCallback(async () => {
            const imported = await importCodeFile(
                content?.language || "javascript",
            );
            if (!imported) return;
            onUpdate?.({
                tileContent: {
                    ...content,
                    code: imported.code,
                    language: imported.language,
                    codeHighlightedLines: [],
                },
            });
        }, [content, onUpdate]);

        const handleCodeChange = useCallback(
            (code: string) => {
                onUpdate?.({
                    tileContent: { ...content, code },
                });
            },
            [content, onUpdate],
        );


        const renderTileContent = () => {
            switch (element.tileType) {
                case "tile-text": {
                    return (
                        <TextTileBody
                            content={content}
                            readOnly={!isTextEditing}
                            autoFocus={isTextEditing}
                            showFloatingToolbar={true}
                            toolbarVariant="inline"
                            toolbarVisible={isTextEditing}
                            textClassName={getTileTextColor()}
                            onUpdate={onUpdate}
                            onMouseDownCapture={(e) => {
                                if (isTextEditing) {
                                    stopCanvas(e);
                                    return;
                                }
                                if (isLinkTarget(e)) {
                                    stopCanvas(e);
                                    return;
                                }
                                requestTextEdit(e);
                            }}
                            onMouseMoveCapture={stopCanvas}
                            onMouseUpCapture={stopCanvas}
                        />
                    );
                }
                case "tile-note":
                    return null; // Note tiles render their own content in the special branch below
                case "tile-code":
                    return (
                        <CodeTileBody
                            content={content}
                            isSelected={isSelected}
                            isEditing={isEditing}
                            codeScale={codeScale}
                            codeWordWrap={codeWordWrap}
                            codeTheme={codeTheme}
                            highlightedLines={codeHighlightedLines}
                            onChange={handleCodeChange}
                            onHighlightedLinesChange={
                                handleCodeHighlightedLinesChange
                            }
                            onFinish={() => setIsEditing(false)}
                            onMouseDownCapture={(e) => {
                                if (isSelected) {
                                    stopCanvas(e);
                                }
                            }}
                            onClickCapture={(e) => {
                                onRequestTextEdit();
                                if (isSelected) {
                                    stopCanvas(e);
                                }
                                if (!isEditing) {
                                    setIsEditing(true);
                                }
                            }}
                        />
                    );

                case "tile-mermaid": {
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
                            onOpenMermaidEditor={onOpenMermaidEditor}
                            onStartTitleEdit={() => setIsEditingTitle(true)}
                            onFinishTitleEdit={() => setIsEditingTitle(false)}
                            onTitleChange={handleTitleChange}
                            chartPointerEvents="none"
                            rendererClassName="h-full"
                        />
                    );
                }

                case "tile-image":
                    return (
                        <ImageTileBody
                            content={content}
                            emptyText="Click to add image..."
                            textClassName={getTileTextColor()}
                        />
                    );

                case "tile-document":
                    return (
                        <DocumentTileBody
                            elementId={element.id}
                            content={content}
                            isSelected={isSelected}
                            tileTitle={tileTitle}
                            isEditingTitle={isEditingTitle}
                            onTitleChange={handleTitleChange}
                            onStartTitleEdit={() => setIsEditingTitle(true)}
                            onFinishTitleEdit={() =>
                                setIsEditingTitle(false)
                            }
                            onOpenDocumentEditor={onOpenDocumentEditor}
                        />
                    );

                default:
                    return null;
            }
        };

        if (element.type !== "tile" || !element.tileType) return null;

        // Note tiles have a special sticky-note design without header
        const isNoteTile = element.tileType === "tile-note";
        const hasHeader =
            element.tileType !== "tile-note" &&
            element.tileType !== "tile-document";
        const shouldRenderHeader =
            hasHeader && !(element.tileType === "tile-mermaid" && isEditing);

        if (isNoteTile) {
            return (
                <div
                    className="absolute group"
                    style={tileStyle}
                    data-element-id={element.id}
                    data-tile-id={element.id}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        onRequestTextEdit();
                    }}
                >
                    <div
                        data-tile-header="true"
                        data-element-id={element.id}
                        className={cn(
                            "relative w-full h-full select-none",
                            isSelected && !isTextEditing
                                ? "cursor-move"
                                : "cursor-text",
                        )}
                    >
                        <div className="absolute inset-0 pointer-events-auto">
                            <NoteTileBody
                                content={content}
                                isSelected={isSelected}
                                isEditing={isTextEditing}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                onRequestEdit={onRequestTextEdit}
                            />
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div
                ref={tileRef}
                className="absolute"
                style={tileStyle}
                data-element-id={element.id}
                data-tile-id={element.id}
                onDoubleClick={handleDoubleClick}
            >
                <div
                    className={cn(
                        "relative w-full h-full rounded-lg shadow-lg border-2 transition-all overflow-hidden",
                        "border-gray-200 dark:border-neutral-700",
                    )}
                >
                    <div
                        className={cn(
                            "absolute inset-0 -z-10 rounded-lg",
                            getTileBackground(),
                        )}
                    />

                    {shouldRenderHeader && (
                        <div
                            data-tile-header="true"
                            data-element-id={element.id}
                            className={cn(
                                "absolute top-0 left-0 right-0 h-12 rounded-t-lg border-b-2 flex items-center px-3 gap-2 transition-colors z-10 backdrop-blur",
                                !content?.headerBgColor &&
                                    (isEditingTitle
                                        ? "bg-card border-accent dark:border-accent"
                                        : "bg-card/95 border-border hover:bg-muted/40"),
                                content?.headerBgColor && "pointer-events-auto",
                                isSelected ? "cursor-move" : "cursor-pointer",
                                "select-none",
                            )}
                            style={{
                                backgroundColor:
                                    content?.headerBgColor || undefined,
                                borderBottomColor:
                                    content?.headerBgColor || undefined,
                                color: content?.headerBgColor
                                    ? getContrastTextColor(
                                          content.headerBgColor,
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
                                        handleTitleChange(e.target.value)
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
                                onMouseDown={stopCanvas}
                                onClick={stopCanvas}
                            >
                                {element.tileType === "tile-code" && (
                                    <CodeTileControls
                                        scale={codeScale}
                                        onScaleChange={handleCodeScaleChange}
                                        wordWrap={codeWordWrap}
                                        onWordWrapChange={
                                            handleCodeWordWrapChange
                                        }
                                        theme={codeTheme}
                                        onThemeChange={handleCodeThemeChange}
                                        onExpand={() =>
                                            onOpenCodeEditor?.(element.id)
                                        }
                                        onCopyCode={handleCodeCopy}
                                        onCopyImage={handleCodeCopyImage}
                                        onImport={handleCodeImport}
                                        onDownload={handleCodeDownload}
                                        onFormat={handleCodeFormat}
                                        canFormat={canFormatLanguage(
                                            content?.language || "javascript",
                                        )}
                                        className="bg-transparent p-0"
                                    />
                                )}
                                {element.tileType === "tile-mermaid" &&
                                    !isEditing && (
                                        <MermaidTileControls
                                            scale={mermaidScale}
                                            onScaleChange={
                                                handleMermaidScaleChange
                                            }
                                            onEdit={() => setIsEditing(true)}
                                            onExpand={() =>
                                                onOpenMermaidEditor?.(
                                                    element.id,
                                                )
                                            }
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
                                            onMouseDown={(e) =>
                                                e.stopPropagation()
                                            }
                                            onClick={(e) => e.stopPropagation()}
                                            className={cn(
                                                "p-1 rounded",
                                                !content?.headerBgColor &&
                                                    "hover:bg-muted",
                                            )}
                                            style={{
                                                color: content?.headerBgColor
                                                    ? getContrastTextColor(
                                                          content.headerBgColor,
                                                      )
                                                    : undefined,
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
                                            {element.tileType ===
                                                "tile-mermaid" && (
                                                <DropdownMenuItem
                                                    onClick={() =>
                                                        setIsEditing(true)
                                                    }
                                                >
                                                    Edit Content
                                                </DropdownMenuItem>
                                            )}
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

                    {renderTileContent()}

                    {showColorPicker && (
                        <div
                            className="fixed inset-0"
                            style={{ zIndex: 9999 }}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                setShowColorPicker(false);
                            }}
                        >
                            <div
                                className="absolute"
                                style={{
                                    left: x + width + 10,
                                    top: y,
                                    width: 280,
                                    height: 350,
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                <HeaderColorPicker
                                    value={content?.headerBgColor || "#f9fafb"}
                                    onChange={(color) => {
                                        onUpdate?.({
                                            tileContent: {
                                                ...content,
                                                headerBgColor: color,
                                            },
                                        });
                                    }}
                                    onReset={() => {
                                        onUpdate?.({
                                            tileContent: {
                                                ...content,
                                                headerBgColor: undefined,
                                            },
                                        });
                                        setShowColorPicker(false);
                                    }}
                                    onClose={() => setShowColorPicker(false)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    },
    (prev, next) => {
        return (
            prev.element === next.element &&
            prev.isSelected === next.isSelected &&
            prev.isTextEditing === next.isTextEditing
        );
    },
);
