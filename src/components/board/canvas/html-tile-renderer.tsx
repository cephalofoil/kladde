"use client";

import { useCallback, useEffect, useMemo, useState, memo } from "react";
import type { BoardElement } from "@/lib/board-types";
import { cn } from "@/lib/utils";
import { GripVertical, MoreHorizontal } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichTextRenderer } from "./content-renderers/rich-text-renderer";
import { CodeRenderer } from "./content-renderers/code-renderer";
import { CodeTileControls } from "./content-renderers/code-tile-controls";
import { MermaidRenderer } from "./content-renderers/mermaid-renderer";
import { MermaidCodeEditor } from "./content-renderers/mermaid-code-editor";
import { MermaidTileControls } from "./content-renderers/mermaid-tile-controls";
import { renderMermaidToPngBlob } from "./utils/mermaid-export";
import {
    copyCodeAsImage,
    downloadCodeAsFile,
    formatCode,
    canFormatLanguage,
} from "./utils/code-export";
import { type CodeThemeName } from "@/lib/code-themes";
import { DocumentRenderer } from "./content-renderers/document-renderer";
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

const MERMAID_QUICK_TEMPLATES = [
    {
        name: "Flowchart",
        code: `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`,
    },
    {
        name: "Sequence",
        code: `sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob!
    B->>A: Hello Alice!`,
    },
    {
        name: "Class",
        code: `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +bark()
    }
    Animal <|-- Dog`,
    },
    {
        name: "State",
        code: `stateDiagram-v2
    [*] --> Still
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`,
    },
];

interface HtmlTileRendererProps {
    element: BoardElement;
    isSelected: boolean;
    isTextEditing: boolean;
    isCanvasTransient?: boolean;
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
        isCanvasTransient = false,
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

        // Mermaid-specific state
        const [mermaidScale, setMermaidScale] = useState(
            element.tileContent?.mermaidScale || 1,
        );

        // Code-specific state
        const [codeScale, setCodeScale] = useState(
            element.tileContent?.codeScale || 1,
        );
        const [codeWordWrap, setCodeWordWrap] = useState(
            element.tileContent?.codeWordWrap || false,
        );
        const [codeTheme, setCodeTheme] = useState<CodeThemeName>(
            (element.tileContent?.codeTheme as CodeThemeName) || "atom-dark",
        );
        const [codeHighlightedLines, setCodeHighlightedLines] = useState<
            number[]
        >(element.tileContent?.codeHighlightedLines || []);
        const [codeFoldedRanges, setCodeFoldedRanges] = useState<
            Array<{ start: number; end: number }>
        >(element.tileContent?.codeFoldedRanges || []);

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

        useEffect(() => {
            setMermaidScale(element.tileContent?.mermaidScale || 1);
        }, [element.tileContent?.mermaidScale]);

        // Sync code state with element content
        useEffect(() => {
            setCodeScale(element.tileContent?.codeScale || 1);
            setCodeWordWrap(element.tileContent?.codeWordWrap || false);
            setCodeTheme(
                (element.tileContent?.codeTheme as CodeThemeName) ||
                    "atom-dark",
            );
            setCodeHighlightedLines(
                element.tileContent?.codeHighlightedLines || [],
            );
            setCodeFoldedRanges(element.tileContent?.codeFoldedRanges || []);
        }, [
            element.tileContent?.codeScale,
            element.tileContent?.codeWordWrap,
            element.tileContent?.codeTheme,
            element.tileContent?.codeHighlightedLines,
            element.tileContent?.codeFoldedRanges,
        ]);

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
                setMermaidScale(newScale);
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
        }, [content?.chart, mermaidScale]);

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
                setCodeScale(newScale);
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
                setCodeWordWrap(wrap);
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
                setCodeTheme(theme);
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
                setCodeHighlightedLines(lines);
                onUpdate?.({
                    tileContent: {
                        ...content,
                        codeHighlightedLines: lines,
                    },
                });
            },
            [content, onUpdate],
        );

        const handleCodeFoldedRangesChange = useCallback(
            (ranges: Array<{ start: number; end: number }>) => {
                setCodeFoldedRanges(ranges);
                onUpdate?.({
                    tileContent: {
                        ...content,
                        codeFoldedRanges: ranges,
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
        }, [content?.code]);

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
        }, [content?.code, content?.language, codeTheme, codeScale]);

        const handleCodeDownload = useCallback(() => {
            const safeName = tileTitle.trim() ? tileTitle.trim() : "code";
            downloadCodeAsFile({
                code: content?.code || "",
                language: content?.language || "javascript",
                filename: safeName,
            });
        }, [content?.code, content?.language, tileTitle]);

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

        const handleCodeChange = useCallback(
            (code: string) => {
                onUpdate?.({
                    tileContent: { ...content, code },
                });
            },
            [content, onUpdate],
        );

        const handleCodeLanguageChange = useCallback(
            (language: string) => {
                onUpdate?.({
                    tileContent: { ...content, language },
                });
            },
            [content, onUpdate],
        );

        const renderTextTileBody = (
            markdown: string,
            field: "richText" | "noteText",
        ) => {
            return (
                <div
                    className={cn(
                        "absolute left-0 right-0 bottom-0 top-12 overflow-hidden rounded-b-lg",
                        "pointer-events-auto",
                    )}
                    data-canvas-interactive="true"
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
                >
                    <RichTextRenderer
                        content={markdown}
                        onChange={(text) =>
                            onUpdate?.({
                                tileContent: { ...content, [field]: text },
                            })
                        }
                        readOnly={!isTextEditing}
                        autoFocus={isTextEditing}
                        showFloatingToolbar={true}
                        toolbarVariant="inline"
                        toolbarVisible={isTextEditing}
                        className={cn(
                            "h-full bg-transparent",
                            getTileTextColor(),
                        )}
                    />
                </div>
            );
        };

        const renderTileContent = () => {
            switch (element.tileType) {
                case "tile-text": {
                    const markdown = content?.richText || "";
                    return renderTextTileBody(markdown, "richText");
                }
                case "tile-note":
                    return null; // Note tiles render their own content in the special branch below
                case "tile-code":
                    return (
                        <div className="absolute left-0 right-0 bottom-0 top-12 rounded-b-lg overflow-hidden pointer-events-auto">
                            <CodeRenderer
                                code={content?.code || ""}
                                language={content?.language || "javascript"}
                                scale={codeScale}
                                wordWrap={codeWordWrap}
                                theme={codeTheme}
                                highlightedLines={codeHighlightedLines}
                                foldedRanges={codeFoldedRanges}
                                isLowFidelity={isCanvasTransient}
                                onChange={handleCodeChange}
                                onLanguageChange={handleCodeLanguageChange}
                                onHighlightedLinesChange={
                                    handleCodeHighlightedLinesChange
                                }
                                onFoldedRangesChange={
                                    handleCodeFoldedRangesChange
                                }
                                onFinish={() => setIsEditing(false)}
                                isEditing={isEditing}
                                readOnly={!isEditing}
                            />
                        </div>
                    );

                case "tile-mermaid": {
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
                                    onExpand={() => {
                                        setIsEditing(false);
                                        onOpenMermaidEditor?.(element.id);
                                    }}
                                    width={width - 8}
                                    height={height - 8}
                                    tileTitle={tileTitle}
                                    isEditingTitle={isEditingTitle}
                                    onStartTitleEdit={() =>
                                        setIsEditingTitle(true)
                                    }
                                    onTitleChange={handleTitleChange}
                                    onFinishTitleEdit={() =>
                                        setIsEditingTitle(false)
                                    }
                                />
                            </div>
                        );
                    }

                    return content?.chart ? (
                        <div className="absolute left-2 right-2 bottom-2 top-12 pointer-events-none rounded-b-lg overflow-hidden flex items-center justify-center">
                            <MermaidRenderer
                                chart={content.chart}
                                width={width - 16}
                                height={height - 50}
                                scale={mermaidScale}
                                className="h-full"
                            />
                        </div>
                    ) : (
                        <div className="absolute left-0 right-0 bottom-0 top-12 flex items-center justify-center pointer-events-auto rounded-b-lg">
                            <div className="flex flex-col items-center justify-center gap-3 px-6 py-4 max-w-xs text-center">
                                <img
                                    src="/icons/diagram-tool.svg"
                                    alt=""
                                    className="w-12 h-12 opacity-40 dark:invert dark:opacity-50"
                                />
                                <h3 className="text-sm font-medium text-foreground">
                                    Create your diagram
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Visualize flows, sequences, and structures
                                    with Mermaid syntax
                                </p>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="mt-1 px-4 py-2 text-sm font-medium bg-foreground text-background rounded-full hover:bg-foreground/90 transition-colors"
                                >
                                    + Create Diagram
                                </button>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <span>or try:</span>
                                    {MERMAID_QUICK_TEMPLATES.map(
                                        (template, idx) => (
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
                                                {idx <
                                                    MERMAID_QUICK_TEMPLATES.length -
                                                        1 && <span>,</span>}
                                            </span>
                                        ),
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }

                case "tile-image":
                    return (
                        <div className="absolute left-0 right-0 bottom-0 top-12 flex items-center justify-center overflow-hidden pointer-events-none rounded-b-lg">
                            {content?.imageSrc ? (
                                <img
                                    src={content.imageSrc}
                                    alt={content.imageAlt || "Image"}
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : (
                                <div
                                    className={cn(
                                        "text-sm text-center",
                                        getTileTextColor(),
                                    )}
                                >
                                    Click to add image...
                                </div>
                            )}
                        </div>
                    );

                case "tile-document":
                    return (
                        <div
                            className="absolute inset-0 overflow-hidden rounded-lg pointer-events-auto cursor-pointer"
                            onClick={() => onOpenDocumentEditor?.(element.id)}
                        >
                            <div
                                data-tile-header="true"
                                data-element-id={element.id}
                                className={cn(
                                    "absolute top-0 left-0 h-10 w-10 flex items-center justify-center",
                                    isSelected
                                        ? "cursor-move"
                                        : "cursor-pointer",
                                )}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                            />
                            <button
                                type="button"
                                data-tile-header="true"
                                data-element-id={element.id}
                                className={cn(
                                    "absolute top-2 left-2 z-10 h-7 w-7",
                                    "flex items-center justify-center focus:outline-none",
                                    isSelected ? "cursor-move" : "cursor-grab",
                                )}
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Drag document tile"
                            >
                                <GripVertical className="h-5 w-5 text-[#4a3a2a]" />
                            </button>
                            <DocumentRenderer
                                documentContent={content?.documentContent}
                            />
                            <div
                                className="absolute left-0 right-0 bottom-3 px-4"
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
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
                                        className="w-full bg-transparent text-lg font-bold text-[#2f2418] outline-none placeholder:text-[#6b5a43]/60"
                                        placeholder="Untitled"
                                        autoFocus
                                    />
                                ) : (
                                    <div className="text-lg font-bold text-[#2f2418] truncate">
                                        {tileTitle}
                                    </div>
                                )}
                            </div>
                        </div>
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
                                isEditing={isTextEditing}
                                onRequestEdit={onRequestTextEdit}
                            />
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div
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
                                {element.tileType === "tile-code" &&
                                    !isEditing && (
                                        <CodeTileControls
                                            scale={codeScale}
                                            onScaleChange={
                                                handleCodeScaleChange
                                            }
                                            wordWrap={codeWordWrap}
                                            onWordWrapChange={
                                                handleCodeWordWrapChange
                                            }
                                            theme={codeTheme}
                                            onThemeChange={
                                                handleCodeThemeChange
                                            }
                                            onEdit={() => setIsEditing(true)}
                                            onExpand={() =>
                                                onOpenCodeEditor?.(element.id)
                                            }
                                            onCopyCode={handleCodeCopy}
                                            onCopyImage={handleCodeCopyImage}
                                            onDownload={handleCodeDownload}
                                            onFormat={handleCodeFormat}
                                            canFormat={canFormatLanguage(
                                                content?.language ||
                                                    "javascript",
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
                                            {(element.tileType ===
                                                "tile-code" ||
                                                element.tileType ===
                                                    "tile-mermaid") && (
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
