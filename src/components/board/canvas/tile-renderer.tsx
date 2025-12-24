"use client";

import { useState } from "react";
import type { BoardElement } from "@/lib/board-types";
import { cn } from "@/lib/utils";

interface TileRendererProps {
  element: BoardElement;
  isSelected: boolean;
  onUpdate?: (updates: Partial<BoardElement>) => void;
}

export function TileRenderer({ element, isSelected, onUpdate }: TileRendererProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  if (element.type !== "tile" || !element.tileType) {
    return null;
  }

  const x = element.x || 0;
  const y = element.y || 0;
  const width = element.width || 300;
  const height = element.height || 200;
  const tileTitle = element.tileTitle || "Untitled";

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

  const renderTileContent = () => {
    const content = element.tileContent;

    switch (element.tileType) {
      case "tile-text":
        return (
          <div className="absolute inset-0 top-10 p-4 overflow-hidden">
            <div className={cn("text-sm", getTileTextColor())}>
              {content?.richText || "Click to edit text..."}
            </div>
          </div>
        );

      case "tile-note":
        return (
          <div className="absolute inset-0 top-10 p-4 overflow-hidden">
            <div className={cn("text-sm whitespace-pre-wrap", getTileTextColor())}>
              {content?.noteText || "Click to add note..."}
            </div>
          </div>
        );

      case "tile-code":
        return (
          <div className="absolute inset-0 top-10 p-4 overflow-hidden">
            <pre className={cn("text-xs font-mono", getTileTextColor())}>
              <code>{content?.code || "// Add your code here"}</code>
            </pre>
          </div>
        );

      case "tile-mermaid":
        return (
          <div className="absolute inset-0 top-10 p-4 flex items-center justify-center overflow-hidden">
            <div className={cn("text-sm text-center", getTileTextColor())}>
              {content?.chart ? "📊 Mermaid Diagram" : "Click to add diagram..."}
            </div>
          </div>
        );

      case "tile-bookmark":
        return (
          <div className="absolute inset-0 top-10 p-4 overflow-hidden">
            <div className="flex flex-col gap-2">
              {content?.url ? (
                <>
                  <div className="text-xs text-blue-600 dark:text-blue-400 truncate">
                    {content.url}
                  </div>
                  <div className={cn("text-sm font-medium", getTileTextColor())}>
                    {content.bookmarkTitle || "Untitled"}
                  </div>
                  {content.bookmarkDescription && (
                    <div className={cn("text-xs opacity-80", getTileTextColor())}>
                      {content.bookmarkDescription}
                    </div>
                  )}
                </>
              ) : (
                <div className={cn("text-sm", getTileTextColor())}>
                  Click to add bookmark...
                </div>
              )}
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
            <div className={cn("text-lg font-bold", getTileTextColor())}>
              {content?.shape || "SHAPE"}
            </div>
          </div>
        );

      default:
        return null;
    }
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
          transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
          transformOrigin: "center",
        }}
      >
        <div
          className={cn(
            "relative w-full h-full rounded-lg shadow-lg border-2 transition-all",
            getTileBackground(),
            isSelected
              ? "ring-2 ring-blue-500 border-blue-500"
              : "border-gray-200 dark:border-gray-700"
          )}
          style={{
            opacity: (element.opacity || 100) / 100,
          }}
        >
          {/* Title Bar */}
          <div
            className={cn(
              "absolute top-0 left-0 right-0 h-10 rounded-t-lg border-b-2 flex items-center px-3 gap-2 cursor-move",
              isEditingTitle
                ? "bg-white dark:bg-gray-700 border-blue-200 dark:border-blue-800"
                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750"
            )}
          >
            {isEditingTitle ? (
              <input
                type="text"
                value={tileTitle}
                onChange={(e) => onUpdate?.({ tileTitle: e.target.value })}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setIsEditingTitle(false);
                }}
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
          </div>

          {/* Tile Content */}
          {renderTileContent()}
        </div>
      </foreignObject>
    </g>
  );
}
