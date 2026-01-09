"use client";

import { useState, useCallback, useEffect } from "react";
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

export function TileRenderer({
  element,
  isSelected,
  onUpdate,
  onDelete,
}: TileRendererProps) {
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
  const [mermaidSvgContent, setMermaidSvgContent] = useState<string>("");

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
        return "bg-white dark:bg-neutral-900";
      case "tile-note":
        return "bg-amber-50 dark:bg-amber-900/20";
      case "tile-code":
        return "bg-neutral-800 dark:bg-neutral-950";
      case "tile-mermaid":
        return "bg-sky-50 dark:bg-neutral-900";
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
        return "text-sky-900 dark:text-neutral-100";
      default:
        return "text-gray-900 dark:text-neutral-100";
    }
  };

  // Double-click to edit (only for code and mermaid tiles)
  // Text and note tiles have always-on editing via Lexical
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Don't enter edit mode if double-clicking on the header
    const { isTileHeader } = getEventTargetInfo(e);
    if (isTileHeader) {
      return;
    }

    // Only toggle edit mode for code and mermaid
    if (
      element.tileType === "tile-code" ||
      element.tileType === "tile-mermaid"
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

  const renderTileContent = () => {
    const content = element.tileContent;

    switch (element.tileType) {
      case "tile-text":
        return (
          <div className="absolute left-0 right-0 bottom-0 top-10 overflow-hidden pointer-events-auto rounded-b-lg">
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
          <div className="absolute left-0 right-0 bottom-0 top-10 pointer-events-auto rounded-b-lg overflow-hidden">
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
              <div className="absolute top-2 right-2 z-10">
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
              onSvgReady={setMermaidSvgContent}
            />
          </div>
        ) : (
          <div className="absolute left-0 right-0 bottom-0 top-10 flex items-center justify-center pointer-events-none rounded-b-lg">
            <div className={cn("text-sm text-center", getTileTextColor())}>
              Double-click to add diagram...
            </div>
          </div>
        );

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
              isSelected && !isEditing ? "cursor-move" : "cursor-text",
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
                color={(content?.noteColor as NoteColor) || (content?.noteStyle === "torn" ? "natural-tan" : "butter")}
                style={(content?.noteStyle as NoteStyle) || "classic"}
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
          className={cn(
            "relative w-full h-full rounded-lg shadow-lg border-2 transition-all select-none",
            "border-gray-200 dark:border-neutral-700",
          )}
          style={{
            opacity: (element.opacity || 100) / 100,
            pointerEvents: isEditing ? "auto" : "none",
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
          <div
            data-tile-header="true"
            data-element-id={element.id}
            className={cn(
              "absolute top-0 left-0 right-0 h-10 rounded-t-lg border-b-2 flex items-center px-3 gap-2 transition-colors z-10",
              !element.tileContent?.headerBgColor &&
                (isEditingTitle
                  ? "bg-white dark:bg-neutral-800 border-accent dark:border-accent pointer-events-auto"
                  : "bg-gray-50 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-700 pointer-events-auto"),
              element.tileContent?.headerBgColor && "pointer-events-auto",
              isSelected ? "cursor-move" : "cursor-pointer",
            )}
            style={{
              backgroundColor: element.tileContent?.headerBgColor || undefined,
              borderBottomColor:
                element.tileContent?.headerBgColor || undefined,
              color: element.tileContent?.headerBgColor
                ? getContrastTextColor(element.tileContent.headerBgColor)
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
                onChange={(e) => onUpdate?.({ tileTitle: e.target.value })}
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

            {/* Dropdown Menu */}
            {isSelected && !isEditingTitle && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "p-1 rounded",
                    !element.tileContent?.headerBgColor &&
                      "hover:bg-gray-200 dark:hover:bg-neutral-600",
                  )}
                  style={{
                    color: element.tileContent?.headerBgColor
                      ? getContrastTextColor(element.tileContent.headerBgColor)
                      : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (element.tileContent?.headerBgColor) {
                      e.currentTarget.style.backgroundColor =
                        element.tileContent.headerBgColor;
                      e.currentTarget.style.filter = "brightness(0.9)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (element.tileContent?.headerBgColor) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.filter = "none";
                    }
                  }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setIsEditingTitle(true)}>
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
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
          <foreignObject x={x + width + 10} y={y} width={280} height={350}>
            <HeaderColorPicker
              value={element.tileContent?.headerBgColor || "#f9fafb"}
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
