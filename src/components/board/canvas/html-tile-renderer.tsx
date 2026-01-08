"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { MarkdownEditor } from "./content-renderers/markdown-editor";
import { DocumentRenderer } from "./content-renderers/document-renderer";
import {
  HeaderColorPicker,
  getContrastTextColor,
} from "./content-renderers/header-color-picker";
import {
  NoteTileRenderer,
  type NoteColor,
} from "./content-renderers/note-tile-renderer";
import { getEventTargetInfo } from "./utils/eventTargeting";

interface HtmlTileRendererProps {
  element: BoardElement;
  isSelected: boolean;
  isTextEditing: boolean;
  onRequestTextEdit: () => void;
  onUpdate?: (updates: Partial<BoardElement>) => void;
  onDelete?: () => void;
  onOpenDocumentEditor?: (elementId: string) => void;
}

export function HtmlTileRenderer({
  element,
  isSelected,
  isTextEditing,
  onRequestTextEdit,
  onUpdate,
  onDelete,
  onOpenDocumentEditor,
}: HtmlTileRendererProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

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
        const existingDocContent = element.tileContent?.documentContent;
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
        return "bg-white dark:bg-neutral-900";
      case "tile-note":
        return "bg-amber-50 dark:bg-amber-900/20";
      case "tile-code":
        return "bg-neutral-800 dark:bg-neutral-950";
      case "tile-mermaid":
        return "bg-sky-50 dark:bg-neutral-900";
      case "tile-image":
        return "bg-gray-100 dark:bg-neutral-900";
      case "tile-document":
        return "bg-orange-50 dark:bg-neutral-900";
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
        return "text-sky-900 dark:text-neutral-100";
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
  }, [element.opacity, element.rotation, element.zIndex, height, width, x, y]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { isTileHeader } = getEventTargetInfo(e);
    if (isTileHeader) return;

    if (
      element.tileType === "tile-code" ||
      element.tileType === "tile-mermaid"
    ) {
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
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isSelected]);

  const stopCanvas = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
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

  const handleMermaidOffsetChange = useCallback(
    (newOffsetX: number, newOffsetY: number) => {
      setMermaidOffsetX(newOffsetX);
      setMermaidOffsetY(newOffsetY);
      onUpdate?.({
        tileContent: {
          ...content,
          mermaidOffsetX: newOffsetX,
          mermaidOffsetY: newOffsetY,
        },
      });
    },
    [content, onUpdate],
  );

  const renderTextTileBody = (
    markdown: string,
    field: "richText" | "noteText",
  ) => {
    if (isTextEditing) {
      return (
        <div
          className={cn(
            "absolute left-0 right-0 bottom-0 top-10 overflow-hidden rounded-b-lg",
            "pointer-events-auto",
          )}
          onMouseDownCapture={stopCanvas}
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
            readOnly={false}
            autoFocus={true}
            showFloatingToolbar={true}
            className={cn("h-full", getTileTextColor())}
          />
        </div>
      );
    }

    return (
      <div
        className={cn(
          "absolute left-0 right-0 bottom-0 top-10 overflow-hidden rounded-b-lg",
          "pointer-events-auto",
        )}
        data-canvas-interactive="true"
        onMouseDownCapture={requestTextEdit}
        onMouseMoveCapture={stopCanvas}
        onMouseUpCapture={stopCanvas}
      >
        <MarkdownEditor
          content={markdown}
          readOnly={true}
          className={cn("h-full p-4", getTileTextColor())}
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
          <div className="absolute left-0 right-0 bottom-0 top-10 rounded-b-lg overflow-hidden pointer-events-auto">
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

      case "tile-mermaid": {
        if (isEditing) {
          return (
            <div className="absolute left-1 right-1 bottom-1 top-10 pointer-events-auto rounded-b-lg overflow-hidden">
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
          <div className="absolute left-2 right-2 bottom-2 top-10 pointer-events-auto rounded-b-lg overflow-hidden">
            {isSelected && (
              <div
                className="absolute top-0 right-0 z-10"
                onMouseDownCapture={stopCanvas}
                onMouseMoveCapture={stopCanvas}
                onMouseUpCapture={stopCanvas}
              >
                <MermaidTileControls
                  scale={mermaidScale}
                  onScaleChange={handleMermaidScaleChange}
                  onEdit={() => setIsEditing(true)}
                  className="bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm rounded-lg shadow-md p-1"
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
              className="h-full"
            />
          </div>
        ) : (
          <div className="absolute left-0 right-0 bottom-0 top-10 flex items-center justify-center pointer-events-none rounded-b-lg">
            <div className={cn("text-sm text-center", getTileTextColor())}>
              Double-click to add diagram...
            </div>
          </div>
        );
      }

      case "tile-image":
        return (
          <div className="absolute left-0 right-0 bottom-0 top-10 flex items-center justify-center overflow-hidden pointer-events-none rounded-b-lg">
            {content?.imageSrc ? (
              <img
                src={content.imageSrc}
                alt={content.imageAlt || "Image"}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className={cn("text-sm text-center", getTileTextColor())}>
                Click to add image...
              </div>
            )}
          </div>
        );

      case "tile-document":
        return (
          <div
            className="absolute left-0 right-0 bottom-0 top-10 overflow-hidden rounded-b-lg pointer-events-auto cursor-pointer"
            onClick={() => onOpenDocumentEditor?.(element.id)}
          >
            <DocumentRenderer
              documentContent={content?.documentContent}
              className={getTileTextColor()}
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (element.type !== "tile" || !element.tileType) return null;

  // Note tiles have a special sticky-note design without header
  const isNoteTile = element.tileType === "tile-note";

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
            isSelected && !isTextEditing ? "cursor-move" : "cursor-text",
          )}
        >
          <div className="absolute inset-0 pointer-events-auto">
            <NoteTileRenderer
              content={content?.noteText || ""}
              color={(content?.noteColor as NoteColor) || "butter"}
              onChange={(text) =>
                onUpdate?.({
                  tileContent: { ...content, noteText: text },
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
          "relative w-full h-full rounded-lg shadow-lg border-2 transition-all",
          "border-gray-200 dark:border-neutral-700",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 -z-10 rounded-lg",
            getTileBackground(),
          )}
        />

        <div
          data-tile-header="true"
          data-element-id={element.id}
          className={cn(
            "absolute top-0 left-0 right-0 h-10 rounded-t-lg border-b-2 flex items-center px-3 gap-2 transition-colors z-10",
            !content?.headerBgColor &&
              (isEditingTitle
                ? "bg-white dark:bg-neutral-800 border-accent dark:border-accent"
                : "bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700"),
            content?.headerBgColor && "pointer-events-auto",
            isSelected ? "cursor-move" : "cursor-pointer",
            "select-none",
          )}
          style={{
            backgroundColor: content?.headerBgColor || undefined,
            borderBottomColor: content?.headerBgColor || undefined,
            color: content?.headerBgColor
              ? getContrastTextColor(content.headerBgColor)
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
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setIsEditingTitle(false);
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-transparent text-sm font-medium border-none outline-none"
              placeholder="Enter title..."
              autoFocus
            />
          ) : (
            <div className="flex-1 text-sm font-medium truncate">
              {tileTitle}
            </div>
          )}

          {isSelected && !isEditingTitle && (
            <DropdownMenu>
              <DropdownMenuTrigger
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "p-1 rounded",
                  !content?.headerBgColor &&
                    "hover:bg-gray-200 dark:hover:bg-neutral-600",
                )}
                style={{
                  color: content?.headerBgColor
                    ? getContrastTextColor(content.headerBgColor)
                    : undefined,
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setIsEditingTitle(true)}>
                  Rename
                </DropdownMenuItem>
                {(element.tileType === "tile-code" ||
                  element.tileType === "tile-mermaid") && (
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
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
                  <DropdownMenuItem onClick={onDelete} className="text-red-600">
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

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
}
