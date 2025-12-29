"use client";

import { useMemo } from "react";
import {
  GripVertical,
  X,
  Type,
  StickyNote,
  Code2,
  GitBranch,
  Image,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardElement, TileContentSection } from "@/lib/board-types";

interface TileContentSectionRendererProps {
  section: TileContentSection;
  allElements: BoardElement[];
  onRemove: () => void;
}

const getTileIcon = (tileType: string | undefined) => {
  switch (tileType) {
    case "tile-text":
      return <Type className="w-3 h-3" />;
    case "tile-note":
      return <StickyNote className="w-3 h-3" />;
    case "tile-code":
      return <Code2 className="w-3 h-3" />;
    case "tile-mermaid":
      return <GitBranch className="w-3 h-3" />;
    case "tile-image":
      return <Image className="w-3 h-3" />;
    default:
      return <Type className="w-3 h-3" />;
  }
};

const getTileTypeColor = (tileType: string | undefined) => {
  switch (tileType) {
    case "tile-text":
      return "bg-blue-500";
    case "tile-note":
      return "bg-yellow-500";
    case "tile-code":
      return "bg-green-500";
    case "tile-mermaid":
      return "bg-purple-500";
    case "tile-image":
      return "bg-pink-500";
    default:
      return "bg-gray-500";
  }
};

export function TileContentSectionRenderer({
  section,
  allElements,
  onRemove,
}: TileContentSectionRendererProps) {
  // Try to find the live tile, fall back to cached content
  const liveTile = useMemo(
    () => allElements.find((el) => el.id === section.tileId),
    [allElements, section.tileId]
  );

  const tileType = liveTile?.tileType || section.cachedTileType;
  const tileTitle = liveTile?.tileTitle || section.cachedTileTitle || "Untitled";
  const tileContent = liveTile?.tileContent || section.cachedContent;
  const isDeleted = !liveTile && section.cachedContent;

  // Render tile content based on type
  const renderContent = () => {
    if (!tileContent) {
      return <p className="text-gray-400 italic text-[9px]">Empty content</p>;
    }

    switch (tileType) {
      case "tile-text":
        if (tileContent.richText) {
          // Strip HTML and render as plain text for preview
          const plainText = tileContent.richText.replace(/<[^>]*>/g, "");
          return (
            <p className="text-gray-700 text-[9px] leading-relaxed whitespace-pre-wrap">
              {plainText}
            </p>
          );
        }
        return null;

      case "tile-note":
        if (tileContent.noteText) {
          return (
            <div className="bg-yellow-50 border-l-2 border-yellow-400 pl-2 py-1">
              <p className="text-gray-700 text-[9px] leading-relaxed whitespace-pre-wrap">
                {tileContent.noteText}
              </p>
            </div>
          );
        }
        return null;

      case "tile-code":
        if (tileContent.code) {
          return (
            <div className="bg-gray-100 rounded p-2 overflow-x-auto">
              <pre className="text-[8px] font-mono text-gray-800 whitespace-pre-wrap">
                {tileContent.code}
              </pre>
              {tileContent.language && (
                <span className="text-[7px] text-gray-400 mt-1 block">
                  {tileContent.language}
                </span>
              )}
            </div>
          );
        }
        return null;

      case "tile-mermaid":
        if (tileContent.chart) {
          return (
            <div className="bg-purple-50 border border-purple-200 rounded p-2 text-center">
              <GitBranch className="w-6 h-6 text-purple-400 mx-auto mb-1" />
              <p className="text-[8px] text-purple-600">Mermaid Diagram</p>
              <p className="text-[7px] text-gray-400 mt-0.5">
                (Rendered in PDF export)
              </p>
            </div>
          );
        }
        return null;

      case "tile-image":
        if (tileContent.imageSrc) {
          return (
            <div className="flex justify-center">
              <img
                src={tileContent.imageSrc}
                alt={tileContent.imageAlt || "Image"}
                className="max-w-full h-auto rounded"
                style={{ maxHeight: "100px" }}
              />
            </div>
          );
        }
        return null;

      default:
        return (
          <p className="text-gray-400 italic text-[9px]">
            Unknown tile type: {tileType}
          </p>
        );
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-start gap-1 py-1 rounded transition-colors",
        isDeleted ? "bg-red-50/50" : "hover:bg-gray-50/50"
      )}
    >
      {/* Drag Handle */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing pt-0.5">
        <GripVertical className="w-3 h-3 text-gray-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header with type badge and title */}
        <div className="flex items-center gap-1 mb-1">
          <div
            className={cn(
              "flex items-center justify-center w-4 h-4 rounded text-white",
              getTileTypeColor(tileType)
            )}
          >
            {getTileIcon(tileType)}
          </div>
          <span className="text-[9px] font-medium text-gray-600 truncate">
            {tileTitle}
          </span>
          {isDeleted && (
            <div className="flex items-center gap-0.5 text-amber-600 text-[8px]">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>Source deleted</span>
            </div>
          )}
        </div>

        {/* Tile Content */}
        <div className="pl-5">{renderContent()}</div>
      </div>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-100 rounded"
      >
        <X className="w-3 h-3 text-red-500" />
      </button>
    </div>
  );
}
