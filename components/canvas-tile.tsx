"use client";

import type React from "react";

import { useRef, useEffect, useState, useCallback } from "react";
import type { TileData, Connection } from "@/types/canvas";
import { useBoardStore } from "@/stores/board-management-store";
import { useEventListener } from "@/hooks/useEventListener";
import { getMinTileSize } from "@/lib/tile-utils";
import { CodeRenderer } from "./content-renderers/code-renderer";
import { RichTextRenderer } from "./content-renderers/rich-text-renderer";
import { MermaidRenderer } from "./content-renderers/mermaid-renderer";
import { MermaidCodeEditor } from "./content-renderers/mermaid-code-editor";
import { MermaidTileControls } from "./content-renderers/mermaid-tile-controls";
import {
  exportSvgAsImage,
  copySvgAsImage,
  generateMermaidFilename,
} from "@/lib/mermaid-export";
import { toast } from "sonner";
import { DocumentRenderer } from "./content-renderers/document-renderer";
import { BookmarkInputRenderer } from "./content-renderers/bookmark-input-renderer";
import { BookmarkRenderer } from "./content-renderers/bookmark-renderer";
import type { EditorRef } from "./content-renderers/Editor";
import { MoreHorizontal } from "lucide-react";
import { PromptWriter } from "./prompt-writer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CanvasTileProps {
  tile: TileData;
  isSelected: boolean;
  zoom: number;
  onSelect: (multiSelect: boolean) => void;
  onUpdate: (updates: Partial<TileData>) => void;
  onDelete: () => void;
  onStartConnection?: (
    tileId: string,
    side?: "top" | "right" | "bottom" | "left",
  ) => void;
  onEndConnection?: (tileId: string) => void;
  isConnectionTarget?: boolean;
  isConnectionMode?: boolean;
  allTiles?: TileData[];
  onOpenDocumentSideView?: (
    tileId: string,
    content: Record<string, unknown> | DocumentContent,
  ) => void;
  connections?: Connection[];
}

/**
 * Renders an interactive canvas tile and manages its local UI state and interactions.
 *
 * The component displays tile content (text, code, mermaid, note, image, document, etc.),
 * supports selecting, dragging, resizing, title editing, in-place content editing,
 * starting/ending connections to other tiles, and an adjacent PromptWriter UI when selected.
 * Updates and actions are propagated via the provided callbacks.
 *
 * @param tile - Tile data describing position, size, rotation, type and content.
 * @param isSelected - Whether this tile is currently selected.
 * @param onSelect - Called when the tile is clicked; receives a boolean flag indicating multi-select (Ctrl/Meta).
 * @param onUpdate - Called with partial TileData to apply updates (position, size, type, content, etc.).
 * @param onDelete - Called to delete the tile.
 * @param onStartConnection - Optional callback(tileId) invoked when initiating a connection from this tile.
 * @param onEndConnection - Optional callback(tileId) invoked when ending a connection targeting this tile.
 * @param isConnectionTarget - When true, indicates this tile is currently a connection target (affects interaction).
 * @param isConnectionMode - When true, the canvas is in connection mode (affects cursor/handles).
 * @param allTiles - Optional list of all tiles (used by editors and prompt generation).
 * @param onOpenDocumentSideView - Optional callback(tileId, content) to open a document tile in a side view.
 * @param connections - Optional list of current connections (passed to PromptWriter).
 *
 * @returns A JSX element representing the canvas tile.
 */
export function CanvasTile({
  tile,
  isSelected,
  zoom,
  onSelect,
  onUpdate,
  onDelete,
  onStartConnection,
  onEndConnection,
  isConnectionTarget = false,
  isConnectionMode = false,
  allTiles = [],
  onOpenDocumentSideView,
  connections = [],
}: CanvasTileProps) {
  const tileRef = useRef<HTMLDivElement>(null);
  const textEditorRef = useRef<EditorRef>(null);
  const currentBoardId = useBoardStore((state) => state.currentBoardId);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isTextEditorFocused, setIsTextEditorFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({
    x: 0,
    y: 0,
    tileX: 0,
    tileY: 0,
  });

  // New resize types for edge-based scaling
  type ResizeDirection = "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se";

  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    tileX: number;
    tileY: number;
    tileWidth: number;
    tileHeight: number;
    direction: ResizeDirection;
  }>({
    x: 0,
    y: 0,
    tileX: 0,
    tileY: 0,
    tileWidth: 0,
    tileHeight: 0,
    direction: "se",
  });

  const rafRef = useRef<number | null>(null);

  // Mermaid scaling state
  const [mermaidScale, setMermaidScale] = useState(tile.content?.scale || 1);
  const [mermaidOffsetX, setMermaidOffsetX] = useState(
    tile.content?.offsetX || 0,
  );
  const [mermaidOffsetY, setMermaidOffsetY] = useState(
    tile.content?.offsetY || 0,
  );

  // Mermaid SVG content for export
  const [mermaidSvgContent, setMermaidSvgContent] = useState<string>("");

  // Update local state when tile content changes
  useEffect(() => {
    setMermaidScale(tile.content?.scale || 1);
    setMermaidOffsetX(tile.content?.offsetX || 0);
    setMermaidOffsetY(tile.content?.offsetY || 0);
  }, [tile.content?.scale, tile.content?.offsetX, tile.content?.offsetY]);

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(e.ctrlKey || e.metaKey);
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (isEditing || isResizing) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      tileX: tile.x,
      tileY: tile.y,
    });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isConnectionTarget && onEndConnection) {
      e.stopPropagation();
      onEndConnection(tile.id);
    }
    // Defer flush to global handler; avoids spurious flushes on simple clicks.
    // No-op here.
  };

  const handleResizeMouseDown = (
    e: React.MouseEvent,
    direction: ResizeDirection,
  ) => {
    e.stopPropagation(); // Prevent triggering tile drag
    if (isEditing || isDragging) return;

    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      tileX: tile.x,
      tileY: tile.y,
      tileWidth: tile.width,
      tileHeight: tile.height,
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

          onUpdate({
            x: dragStart.tileX + deltaX,
            y: dragStart.tileY + deltaY,
          });
        }

        if (isResizing) {
          const deltaX = clientX - resizeStart.x;
          const deltaY = clientY - resizeStart.y;
          const isShiftPressed = e.shiftKey; // Check for proportional scaling

          let newX = resizeStart.tileX;
          let newY = resizeStart.tileY;
          let newWidth = resizeStart.tileWidth;
          let newHeight = resizeStart.tileHeight;

          // Store original aspect ratio for proportional scaling
          const originalAspectRatio =
            resizeStart.tileWidth / resizeStart.tileHeight;

          // Handle different resize directions
          switch (resizeStart.direction) {
            case "n": // Top edge
              newY = resizeStart.tileY + deltaY;
              newHeight = resizeStart.tileHeight - deltaY;
              if (isShiftPressed) {
                // Proportional scaling - adjust width based on height change
                newWidth = newHeight * originalAspectRatio;
                newX =
                  resizeStart.tileX + (resizeStart.tileWidth - newWidth) / 2;
              }
              break;
            case "e": // Right edge
              newWidth = resizeStart.tileWidth + deltaX;
              if (isShiftPressed) {
                // Proportional scaling - adjust height based on width change
                newHeight = newWidth / originalAspectRatio;
              }
              break;
            case "s": // Bottom edge
              newHeight = resizeStart.tileHeight + deltaY;
              if (isShiftPressed) {
                // Proportional scaling - adjust width based on height change
                newWidth = newHeight * originalAspectRatio;
                newX =
                  resizeStart.tileX + (resizeStart.tileWidth - newWidth) / 2;
              }
              break;
            case "w": // Left edge
              newX = resizeStart.tileX + deltaX;
              newWidth = resizeStart.tileWidth - deltaX;
              if (isShiftPressed) {
                // Proportional scaling - adjust height based on width change
                newHeight = newWidth / originalAspectRatio;
                newY =
                  resizeStart.tileY + (resizeStart.tileHeight - newHeight) / 2;
              }
              break;
            case "nw": // Top-left corner
              if (isShiftPressed) {
                // Proportional scaling - maintain aspect ratio
                // Use the larger delta to determine the primary scaling direction
                if (Math.abs(deltaX) >= Math.abs(deltaY)) {
                  // Width-driven scaling
                  newWidth = resizeStart.tileWidth - deltaX;
                  newHeight = newWidth / originalAspectRatio;
                  newX = resizeStart.tileX + deltaX;
                  newY =
                    resizeStart.tileY + (resizeStart.tileHeight - newHeight);
                } else {
                  // Height-driven scaling
                  newHeight = resizeStart.tileHeight - deltaY;
                  newWidth = newHeight * originalAspectRatio;
                  newX = resizeStart.tileX + (resizeStart.tileWidth - newWidth);
                  newY = resizeStart.tileY + deltaY;
                }
              } else {
                // Free scaling
                newX = resizeStart.tileX + deltaX;
                newY = resizeStart.tileY + deltaY;
                newWidth = resizeStart.tileWidth - deltaX;
                newHeight = resizeStart.tileHeight - deltaY;
              }
              break;
            case "ne": // Top-right corner
              if (isShiftPressed) {
                // Proportional scaling - maintain aspect ratio
                if (Math.abs(deltaX) >= Math.abs(deltaY)) {
                  // Width-driven scaling
                  newWidth = resizeStart.tileWidth + deltaX;
                  newHeight = newWidth / originalAspectRatio;
                  newY =
                    resizeStart.tileY + (resizeStart.tileHeight - newHeight);
                } else {
                  // Height-driven scaling
                  newHeight = resizeStart.tileHeight - deltaY;
                  newWidth = newHeight * originalAspectRatio;
                  newY = resizeStart.tileY + deltaY;
                }
              } else {
                // Free scaling
                newY = resizeStart.tileY + deltaY;
                newWidth = resizeStart.tileWidth + deltaX;
                newHeight = resizeStart.tileHeight - deltaY;
              }
              break;
            case "sw": // Bottom-left corner
              if (isShiftPressed) {
                // Proportional scaling - maintain aspect ratio
                if (Math.abs(deltaX) >= Math.abs(deltaY)) {
                  // Width-driven scaling
                  newWidth = resizeStart.tileWidth - deltaX;
                  newHeight = newWidth / originalAspectRatio;
                  newX = resizeStart.tileX + deltaX;
                } else {
                  // Height-driven scaling
                  newHeight = resizeStart.tileHeight + deltaY;
                  newWidth = newHeight * originalAspectRatio;
                  newX = resizeStart.tileX + (resizeStart.tileWidth - newWidth);
                }
              } else {
                // Free scaling
                newX = resizeStart.tileX + deltaX;
                newWidth = resizeStart.tileWidth - deltaX;
                newHeight = resizeStart.tileHeight + deltaY;
              }
              break;
            case "se": // Bottom-right corner
              if (isShiftPressed) {
                // Proportional scaling - maintain aspect ratio
                if (Math.abs(deltaX) >= Math.abs(deltaY)) {
                  // Width-driven scaling
                  newWidth = resizeStart.tileWidth + deltaX;
                  newHeight = newWidth / originalAspectRatio;
                } else {
                  // Height-driven scaling
                  newHeight = resizeStart.tileHeight + deltaY;
                  newWidth = newHeight * originalAspectRatio;
                }
              } else {
                // Free scaling
                newWidth = resizeStart.tileWidth + deltaX;
                newHeight = resizeStart.tileHeight + deltaY;
              }
              break;
          }

          // Enforce minimum size based on content type by clamping
          const minSizes = getMinTileSize(tile.type);
          let clampedWidth = Math.max(newWidth, minSizes.width);
          let clampedHeight = Math.max(newHeight, minSizes.height);

          // For document tiles, maintain 1:1.4 proportions after clamping
          const isDoc = tile.type === "document";
          const aspectRatio = 1.4;
          if (isDoc) {
            const widthDriven = Math.abs(deltaX) >= Math.abs(deltaY);
            if (widthDriven) {
              clampedHeight = Math.max(
                minSizes.height,
                Math.round(clampedWidth * aspectRatio),
              );
            } else {
              clampedWidth = Math.max(
                minSizes.width,
                Math.round(clampedHeight / aspectRatio),
              );
            }
          }

          // If clamping changed size, adjust origin for anchored edges/corners
          let adjX = newX;
          let adjY = newY;
          if (clampedWidth !== newWidth) {
            if (
              resizeStart.direction === "nw" ||
              resizeStart.direction === "sw" ||
              resizeStart.direction === "w"
            ) {
              adjX = resizeStart.tileX + (resizeStart.tileWidth - clampedWidth);
            }
          }
          if (clampedHeight !== newHeight) {
            if (
              resizeStart.direction === "nw" ||
              resizeStart.direction === "ne" ||
              resizeStart.direction === "n"
            ) {
              adjY =
                resizeStart.tileY + (resizeStart.tileHeight - clampedHeight);
            }
          }

          onUpdate({
            x: adjX,
            y: adjY,
            width: clampedWidth,
            height: clampedHeight,
          });
        }
      });
    },
    [isDragging, isResizing, dragStart, resizeStart, onUpdate, tile.type],
  );

  const handleMouseUpGlobal = useCallback(() => {
    const wasInteracting = isDragging || isResizing;
    setIsDragging(false);
    setIsResizing(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Flush only if we were interacting
    if (wasInteracting) {
      const { scheduleFlush } = useBoardStore.getState();
      if (typeof scheduleFlush === "function") {
        scheduleFlush("pointerup");
      }
    }
  }, [isDragging, isResizing]);

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
  }, [
    isDragging,
    isResizing,
    dragStart,
    resizeStart,
    handleMouseMove,
    handleMouseUpGlobal,
  ]);

  const handleDoubleClick = () => {
    if (
      tile.type === "note" ||
      tile.type === "code" ||
      tile.type === "bookmark"
    ) {
      setIsEditing(true);
    }
    // Disabled double-click for mermaid tiles to prevent conflicts with scaling controls
  };

  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
  };

  const handleTextEditorFocus = () => {
    setIsTextEditorFocused(true);
  };

  const handleTextEditorBlur = () => {
    setIsTextEditorFocused(false);
  };

  // Also blur when clicking outside the tile
  useEffect(() => {
    if (!isTextEditorFocused) {
      if (textEditorRef.current) {
        textEditorRef.current.blur();
      }
    }
  }, [isTextEditorFocused]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle Escape key - delete keys are now handled globally in canvas-workspace
      if (e.key === "Escape") {
        setIsEditing(false);
        setIsEditingTitle(false);
        setIsTextEditorFocused(false); // Clear text editor focus on escape
      }
    },
    [], // State setters are stable, no dependencies needed
  );

  useEventListener("keydown", handleKeyDown, isSelected ? window : null);

  // Mermaid scaling handlers
  const handleMermaidScaleChange = useCallback(
    (newScale: number) => {
      setMermaidScale(newScale);
      onUpdate({
        content: {
          ...tile.content,
          scale: newScale,
        },
      });
    },
    [tile.content, onUpdate],
  );

  const handleMermaidOffsetChange = useCallback(
    (newOffsetX: number, newOffsetY: number) => {
      setMermaidOffsetX(newOffsetX);
      setMermaidOffsetY(newOffsetY);
      onUpdate({
        content: {
          ...tile.content,
          offsetX: newOffsetX,
          offsetY: newOffsetY,
        },
      });
    },
    [tile.content, onUpdate],
  );

  const handleMermaidEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  // Mermaid export handlers
  const handleMermaidCopyImage = useCallback(async () => {
    if (!mermaidSvgContent) {
      toast.error("No diagram to copy");
      return;
    }

    try {
      await copySvgAsImage(mermaidSvgContent, { scale: 2, debug: true });
      toast.success("Diagram copied to clipboard");
    } catch (error) {
      console.error("Failed to copy diagram:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to copy diagram to clipboard";
      toast.error(errorMessage);
    }
  }, [mermaidSvgContent]);

  const handleMermaidDownloadImage = useCallback(async () => {
    if (!mermaidSvgContent) {
      toast.error("No diagram to download");
      return;
    }

    try {
      const filename = generateMermaidFilename();
      await exportSvgAsImage(mermaidSvgContent, {
        filename,
        scale: 2,
        format: "png",
        debug: true,
      });
      toast.success("Diagram downloaded successfully");
    } catch (error) {
      console.error("Failed to download diagram:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to download diagram";
      toast.error(errorMessage);
    }
  }, [mermaidSvgContent]);

  // Bookmark handlers
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
      onUpdate({
        content: {
          ...tile.content,
          ...bookmarkData,
          isValidated: true,
        },
      });
      setIsEditing(false);
    },
    [tile.content, onUpdate],
  );

  const handleBookmarkEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (tileRef.current && !tileRef.current.contains(event.target as Node)) {
        if (isEditing) {
          setIsEditing(false);
        }
        if (isEditingTitle) {
          setIsEditingTitle(false);
        }
        if (isTextEditorFocused) {
          setIsTextEditorFocused(false);
        }
      }
    },
    [isEditing, isEditingTitle, isTextEditorFocused],
  );

  useEventListener(
    "mousedown",
    handleClickOutside,
    isEditing || isEditingTitle || isTextEditorFocused ? document : null,
  );

  // Blur text editor when tile is deselected
  useEffect(() => {
    if (!isSelected && isTextEditorFocused) {
      setIsTextEditorFocused(false);
      // Programmatically blur the editor
      if (textEditorRef.current) {
        textEditorRef.current.blur();
      }
    }
  }, [isSelected, isTextEditorFocused]);

  const getTileColor = () => {
    switch (tile.type) {
      case "text":
        return "bg-slate-50";
      case "code":
        return "bg-slate-800";
      case "note":
        return "bg-amber-100";
      case "image":
        return "bg-gray-100";
      case "mermaid":
        return "bg-sky-50";
      case "bookmark":
        return "bg-white";
      case "shape":
        return "bg-blue-500";
      default:
        return "bg-white";
    }
  };

  const getTextColor = () => {
    switch (tile.type) {
      case "code":
        return "text-slate-200";
      case "note":
        return "text-amber-800";
      case "mermaid":
        return "text-sky-800";
      case "bookmark":
        return "text-gray-800";
      default:
        return "text-gray-800";
    }
  };

  const getDefaultDocumentContent = () => ({
    title: tile.title || "New Document",
    description: tile.content?.description || "Click to add description",
  });

  const renderContent = () => {
    if (isEditing && tile.type === "note") {
      return (
        <div className="absolute inset-2 top-10">
          <RichTextRenderer
            content={tile.content?.text || ""}
            onChange={(text) =>
              onUpdate({ content: { ...tile.content, text } })
            }
            onFinish={() => setIsEditing(false)}
            autoFocus
            boardId={currentBoardId || undefined}
            tileId={tile.id}
          />
        </div>
      );
    }

    if (isEditing && tile.type === "code") {
      return (
        <div className="absolute inset-2 top-10">
          <CodeRenderer
            code={tile.content?.code || ""}
            language={tile.content?.language || "javascript"}
            onFinish={() => setIsEditing(false)}
            isEditing={true}
            onChange={(code) =>
              onUpdate({ content: { ...tile.content, code } })
            }
          />
        </div>
      );
    }

    if (isEditing && tile.type === "mermaid") {
      return (
        <div className="absolute inset-1 top-10">
          <MermaidCodeEditor
            initialCode={tile.content?.chart || ""}
            onSave={(code) => {
              onUpdate({
                content: {
                  ...tile.content,
                  chart: code,
                },
              });
              setIsEditing(false);
            }}
            onCancel={() => setIsEditing(false)}
            width={tile.width - 8}
            height={tile.height - 32}
          />
        </div>
      );
    }

    if (isEditing && tile.type === "bookmark") {
      return (
        <div className="absolute inset-1 top-10">
          <BookmarkInputRenderer
            initialUrl={tile.content?.url || ""}
            initialDisplayName={tile.content?.displayName || ""}
            initialTitle={tile.content?.title || ""}
            initialDescription={tile.content?.description || ""}
            initialFavicon={tile.content?.favicon || ""}
            initialSiteName={tile.content?.siteName || ""}
            onSave={handleBookmarkSave}
            onCancel={() => setIsEditing(false)}
            width={tile.width - 8}
            height={tile.height - 32}
          />
        </div>
      );
    }

    switch (tile.type) {
      case "text":
        return (
          <div className="absolute inset-0 top-10 pointer-events-auto">
            <RichTextRenderer
              ref={textEditorRef}
              content={tile.content?.text || ""}
              onChange={(text) =>
                onUpdate({ content: { ...tile.content, text } })
              }
              readOnly={false}
              showBorder={false}
              showToolbar={false}
              showFloatingToolbar={true}
              autoFocus={false}
              onFocus={handleTextEditorFocus}
              onBlur={handleTextEditorBlur}
              boardId={currentBoardId || undefined}
              tileId={tile.id}
            />
          </div>
        );
      case "code":
        return (
          <div className="absolute inset-2 top-10 pointer-events-none">
            <CodeRenderer
              code={
                tile.content?.code ||
                '// Your code here\nconsole.log("Hello World");'
              }
              language={tile.content?.language || "javascript"}
              readOnly
            />
          </div>
        );
      case "mermaid":
        return tile.content?.chart ? (
          <div className="absolute inset-2 top-10 pointer-events-none">
            {/* Mermaid Controls - positioned at top-right of content area */}
            {isSelected && (
              <div className="absolute top-0 right-0 z-10 pointer-events-auto">
                <MermaidTileControls
                  scale={mermaidScale as number}
                  onScaleChange={handleMermaidScaleChange}
                  onEdit={handleMermaidEdit}
                  onCopyImage={handleMermaidCopyImage}
                  onDownloadImage={handleMermaidDownloadImage}
                  className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-1"
                />
              </div>
            )}

            {/* Mermaid Renderer */}
            <MermaidRenderer
              chart={tile.content.chart}
              width={tile.width - 16}
              height={tile.height - 48}
              scale={mermaidScale as number}
              offsetX={mermaidOffsetX as number}
              offsetY={mermaidOffsetY as number}
              onOffsetChange={handleMermaidOffsetChange}
              isInteractive={isSelected}
              onSvgReady={setMermaidSvgContent}
            />
          </div>
        ) : (
          <div className="absolute inset-1 top-10">
            <MermaidCodeEditor
              initialCode=""
              onSave={(code) => {
                onUpdate({
                  content: {
                    ...tile.content,
                    chart: code,
                  },
                });
              }}
              width={tile.width - 8}
              height={tile.height - 32}
            />
          </div>
        );
      case "bookmark":
        return tile.content?.url ? (
          <div className="absolute inset-2 top-2">
            <BookmarkRenderer
              url={tile.content.url}
              title={tile.content.title}
              description={tile.content.description}
              favicon={tile.content.favicon}
              siteName={tile.content.siteName}
              imageUrl={tile.content.imageUrl}
              displayName={tile.content.displayName}
              isSelected={isSelected}
              onEdit={handleBookmarkEdit}
            />
          </div>
        ) : (
          <div className="absolute inset-2 top-2">
            <BookmarkInputRenderer
              onSave={handleBookmarkSave}
              width={tile.width - 16}
              height={tile.height - 16}
            />
          </div>
        );
      case "note":
        return (
          <div
            className={`absolute inset-2 top-10 text-sm ${getTextColor()} pointer-events-none overflow-hidden`}
          >
            {tile.content?.text || "Note"}
          </div>
        );
      case "image":
        return (
          <div
            className={`absolute inset-0 top-10 flex items-center justify-center text-lg ${getTextColor()}`}
          >
            📷 Image
          </div>
        );
      case "shape":
        return null;
      case "document":
        return (
          <div className="absolute inset-1 top-10 pointer-events-auto">
            <DocumentRenderer
              content={getDefaultDocumentContent()}
              onUpdate={() => {}}
              onOpenSideView={() => onOpenDocumentSideView?.(tile.id)}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const handleConnectionHandleMouseDown = (
    e: React.MouseEvent,
    side: "top" | "right" | "bottom" | "left",
  ) => {
    e.stopPropagation(); // Prevent tile drag
    if (onStartConnection) {
      onStartConnection(tile.id, side);
    }
  };

  const selectionPadding = 8 / zoom;
  const handleSize = 10 / zoom;
  const handleStrokeWidth = 2.5 / zoom;
  const handleRadius = 3 / zoom;
  const handleBaseStyle: React.CSSProperties = {
    width: handleSize,
    height: handleSize,
    background: "var(--background)",
    borderColor: "var(--selection-accent)",
    borderWidth: handleStrokeWidth,
    borderStyle: "solid",
    borderRadius: handleRadius,
    boxSizing: "border-box",
    zIndex: 3,
  };

  const handleInset = 2 / zoom;
  const handleOffset = selectionPadding + handleSize / 2 - handleInset;

  return (
    <>
      <div
        ref={tileRef}
        className={`absolute relative rounded-lg ${tile.type === "document" ? "shadow-none" : "shadow-lg"} ${isConnectionMode ? "cursor-crosshair" : ""} select-none ${getTileColor()} flex items-end justify-between ${
          tile.type === "document"
            ? "ring-2 ring-blue-400"
            : "ring-2 ring-gray-200"
        } ${isSelected ? "shadow-xl" : ""} ${
          isConnectionTarget ? "ring-2 ring-green-400" : ""
        }`}
        style={{
          left: tile.x,
          top: tile.y,
          width: tile.width,
          height: tile.height,
          transform: `rotate(${tile.rotation || 0}deg)`,
          zIndex: isSelected ? 10 : 1,
        }}
        onClick={handleSelect}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        {isSelected && !isEditing && !isConnectionMode && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: -selectionPadding,
              top: -selectionPadding,
              width: tile.width + selectionPadding * 2,
              height: tile.height + selectionPadding * 2,
              border: "2.5px solid var(--selection-accent)",
              borderRadius: 0,
              zIndex: 2,
            }}
          />
        )}
        {tile.type !== "document" && tile.type !== "bookmark" && (
          <div
            className={`absolute top-0 left-0 right-0 h-10 rounded-t-lg border-b-2 flex items-center px-3 gap-2 cursor-move transition-colors duration-200 ${
              isEditingTitle
                ? "bg-white dark:bg-gray-600 border-blue-200 dark:border-blue-800"
                : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-650"
            }`}
            onMouseDown={handleHeaderMouseDown}
          >
            {isEditingTitle ? (
              <input
                type="text"
                value={tile.title || ""}
                onChange={(e) => onUpdate({ title: e.target.value })}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setIsEditingTitle(false);
                  }
                }}
                className="flex-1 bg-transparent text-sm font-medium text-gray-900 dark:text-gray-100 border-none outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                placeholder="Enter title..."
                autoFocus
              />
            ) : (
              <div
                className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-text truncate transition-colors duration-200 hover:text-gray-900 dark:hover:text-gray-100"
                onDoubleClick={handleTitleDoubleClick}
              >
                {tile.title || "Untitled"}
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem onClick={() => setIsEditingTitle(true)}>
                  Edit Title
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-red-600">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {renderContent()}

        {isSelected && !isEditing && !isConnectionMode && (
          <>
            {/* Corner handles for scaling */}
            <div
              className="absolute"
              style={{
                ...handleBaseStyle,
                left: -handleOffset,
                top: -handleOffset,
                cursor: "nwse-resize",
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, "nw")}
            />
            <div
              className="absolute"
              style={{
                ...handleBaseStyle,
                right: -handleOffset,
                top: -handleOffset,
                cursor: "nesw-resize",
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, "ne")}
            />
            <div
              className="absolute"
              style={{
                ...handleBaseStyle,
                left: -handleOffset,
                bottom: -handleOffset,
                cursor: "nesw-resize",
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, "sw")}
            />
            <div
              className="absolute"
              style={{
                ...handleBaseStyle,
                right: -handleOffset,
                bottom: -handleOffset,
                cursor: "nwse-resize",
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, "se")}
            />
          </>
        )}

        {isSelected && !isEditing && (
          <>
            {/* Top connection handle - Arrow pointing up */}
            <div
              className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-6 h-6 cursor-crosshair hover:scale-110 transition-transform"
              onMouseDown={(e) => handleConnectionHandleMouseDown(e, "top")}
              title="Drag to create connection"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 text-blue-500 hover:text-blue-600"
                fill="currentColor"
              >
                <path
                  d="m13.022 14.999v3.251c0 .412.335.75.752.75.188 0 .375-.071.518-.206 1.775-1.685 4.945-4.692 6.396-6.069.2-.189.312-.452.312-.725 0-.274-.112-.536-.312-.725-1.451-1.377-4.621-4.385-6.396-6.068-.143-.136-.33-.207-.518-.207-.417 0-.752.337-.752.75v3.251h-9.02c-.531 0-1.002.47-1.002 1v3.998c0 .53.471 1 1.002 1z"
                  transform="rotate(-90 12 12)"
                />
              </svg>
            </div>

            {/* Right connection handle - Arrow pointing right */}
            <div
              className="absolute top-1/2 -right-12 transform -translate-y-1/2 w-6 h-6 cursor-crosshair hover:scale-110 transition-transform"
              onMouseDown={(e) => handleConnectionHandleMouseDown(e, "right")}
              title="Drag to create connection"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 text-blue-500 hover:text-blue-600"
                fill="currentColor"
              >
                <path d="m13.022 14.999v3.251c0 .412.335.75.752.75.188 0 .375-.071.518-.206 1.775-1.685 4.945-4.692 6.396-6.069.2-.189.312-.452.312-.725 0-.274-.112-.536-.312-.725-1.451-1.377-4.621-4.385-6.396-6.068-.143-.136-.33-.207-.518-.207-.417 0-.752.337-.752.75v3.251h-9.02c-.531 0-1.002.47-1.002 1v3.998c0 .53.471 1 1.002 1z" />
              </svg>
            </div>

            {/* Bottom connection handle - Arrow pointing down */}
            <div
              className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 w-6 h-6 cursor-crosshair hover:scale-110 transition-transform"
              onMouseDown={(e) => handleConnectionHandleMouseDown(e, "bottom")}
              title="Drag to create connection"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 text-blue-500 hover:text-blue-600"
                fill="currentColor"
              >
                <path
                  d="m13.022 14.999v3.251c0 .412.335.75.752.75.188 0 .375-.071.518-.206 1.775-1.685 4.945-4.692 6.396-6.069.2-.189.312-.452.312-.725 0-.274-.112-.536-.312-.725-1.451-1.377-4.621-4.385-6.396-6.068-.143-.136-.33-.207-.518-.207-.417 0-.752.337-.752.75v3.251h-9.02c-.531 0-1.002.47-1.002 1v3.998c0 .53.471 1 1.002 1z"
                  transform="rotate(90 12 12)"
                />
              </svg>
            </div>

            {/* Left connection handle - Arrow pointing left */}
            <div
              className="absolute top-1/2 -left-12 transform -translate-y-1/2 w-6 h-6 cursor-crosshair hover:scale-110 transition-transform"
              onMouseDown={(e) => handleConnectionHandleMouseDown(e, "left")}
              title="Drag to create connection"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 text-blue-500 hover:text-blue-600"
                fill="currentColor"
              >
                <path
                  d="m13.022 14.999v3.251c0 .412.335.75.752.75.188 0 .375-.071.518-.206 1.775-1.685 4.945-4.692 6.396-6.069.2-.189.312-.452.312-.725 0-.274-.112-.536-.312-.725-1.451-1.377-4.621-4.385-6.396-6.068-.143-.136-.33-.207-.518-.207-.417 0-.752.337-.752.75v3.251h-9.02c-.531 0-1.002.47-1.002 1v3.998c0 .53.471 1 1.002 1z"
                  transform="rotate(180 12 12)"
                />
              </svg>
            </div>
          </>
        )}
      </div>

      {/* Prompt Writer Section - positioned below the tile */}
      {isSelected &&
        !isEditing &&
        !isConnectionMode &&
        tile.type !== "document" &&
        tile.type !== "shape" &&
        tile.type !== "note" && (
          <div
            className="absolute rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            style={{
              left: tile.x,
              top: tile.y + tile.height + 8,
              width: tile.width,
              zIndex: isSelected ? 10 : 1,
            }}
            data-prompt-writer-container
          >
            <div className="p-3">
              <PromptWriter
                tileId={tile.id}
                tileType={tile.type}
                allTiles={allTiles}
                connections={connections}
                onCopyPrompt={(prompt) => {
                  navigator.clipboard.writeText(prompt);
                }}
                onSendToAI={async (prompt) => {
                  // AI integration disabled for local-first version
                  console.log(
                    "AI send disabled in local-first version. Prompt:",
                    prompt,
                  );
                }}
              />
            </div>
          </div>
        )}
    </>
  );
}
