"use client";

import { Plus, StickyNote, CodeXml, Image as ImageIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardElement } from "@/lib/board-types";

// Custom TextTileIcon matching toolbar.tsx
function TextTileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M22 3.5C22 3.78 21.78 4 21.5 4H2.5C2.22 4 2 3.78 2 3.5V2.5C2 2.22 2.22 2 2.5 2H21.5C21.78 2 22 2.22 22 2.5V3.5Z"
        fill="currentColor"
      />
      <path
        d="M8 7.5C8 7.22 7.78 7 7.5 7H3C2.72 7 2.5 7.22 2.5 7.5V8.5C2.5 8.78 2.72 9 3 9H7.5C7.78 9 8 8.78 8 8.5V7.5Z"
        fill="currentColor"
      />
      <path
        d="M10 11.5C10 11.22 9.78 11 9.5 11H3C2.72 11 2.5 11.22 2.5 11.5V12.5C2.5 12.78 2.72 13 3 13H9.5C9.78 13 10 12.78 10 12.5V11.5Z"
        fill="currentColor"
      />
      <path
        d="M8.5 15.5C8.5 15.22 8.28 15 8 15H3C2.72 15 2.5 15.22 2.5 15.5V16.5C2.5 16.78 2.72 17 3 17H8C8.28 17 8.5 16.78 8.5 16.5V15.5Z"
        fill="currentColor"
      />
      <path
        d="M22 21.5C22 21.78 21.78 22 21.5 22H2.5C2.22 22 2 21.78 2 21.5V20.5C2 20.22 2.22 20 2.5 20H21.5C21.78 20 22 20.22 22 20.5V21.5Z"
        fill="currentColor"
      />
      <path
        d="M15.5 9V16.5C15.5 16.78 15.72 17 16 17H17C17.28 17 17.5 16.78 17.5 16.5V9H15.5Z"
        fill="currentColor"
      />
      <path
        d="M12.5 7C12.22 7 12 7.22 12 7.5V8.5C12 8.78 12.22 9 12.5 9H15.5H17.5H20.5C20.78 9 21 8.78 21 8.5V7.5C21 7.22 20.78 7 20.5 7H12.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Custom DiagramToolIcon matching toolbar.tsx
function DiagramToolIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M10 16H6C5.44772 16 5 16.4477 5 17V21C5 21.5523 5.44772 22 6 22H10C10.5523 22 11 21.5523 11 21V17C11 16.4477 10.5523 16 10 16Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 2H3C2.44772 2 2 2.44772 2 3V7C2 7.55228 2.44772 8 3 8H7C7.55228 8 8 7.55228 8 7V3C8 2.44772 7.55228 2 7 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 9V11.25C5 11.4489 5.10435 11.6397 5.2901 11.7803C5.47585 11.921 5.72779 12 5.99048 12H13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 19H17.557C17.6745 19 17.7872 18.921 17.8702 18.7803C17.9533 18.6397 18 18.4489 18 18.25V16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21.4497 10.6213L19.0355 8.20711C18.3689 7.54044 17.288 7.54044 16.6213 8.20711L14.2071 10.6213C13.5404 11.288 13.5404 12.3689 14.2071 13.0355L16.6213 15.4497C17.288 16.1164 18.3689 16.1164 19.0355 15.4497L21.4497 13.0355C22.1164 12.3689 22.1164 11.288 21.4497 10.6213Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Use the same icons as toolbar.tsx for consistency
export const getTileIcon = (tileType: string | undefined, className = "w-4 h-4") => {
  switch (tileType) {
    case "tile-text":
      return <TextTileIcon className={className} />;
    case "tile-note":
      return <StickyNote className={`${className} rotate-90`} />;
    case "tile-code":
      return <CodeXml className={className} />;
    case "tile-mermaid":
      return <DiagramToolIcon className={className} />;
    case "tile-image":
      return <ImageIcon className={className} />;
    case "tile-document":
      return <FileText className={className} />;
    default:
      return <TextTileIcon className={className} />;
  }
};

export const getTileTypeColor = (tileType: string | undefined) => {
  switch (tileType) {
    case "tile-text":
      return "bg-neutral-100 dark:bg-neutral-800";
    case "tile-note":
      return "bg-amber-100 dark:bg-amber-800/50";
    case "tile-code":
      return "bg-neutral-700 dark:bg-neutral-900 text-white";
    case "tile-mermaid":
      return "bg-sky-100 dark:bg-sky-800/50";
    case "tile-image":
      return "bg-purple-100 dark:bg-purple-900/30";
    default:
      return "bg-gray-100 dark:bg-gray-800";
  }
};

const getTilePreview = (tile: BoardElement): string => {
  const content = tile.tileContent;
  if (!content) return "Empty tile";

  if (content.richText) {
    const text = content.richText.replace(/<[^>]*>/g, "");
    return text.slice(0, 80) + (text.length > 80 ? "..." : "");
  }
  if (content.noteText) {
    return content.noteText.slice(0, 80) + (content.noteText.length > 80 ? "..." : "");
  }
  if (content.code) {
    return content.code.slice(0, 80) + (content.code.length > 80 ? "..." : "");
  }
  if (content.chart) {
    return "Mermaid diagram";
  }
  if (content.imageSrc) {
    return content.imageAlt || "Image";
  }

  return "Empty tile";
};

// Check if a tile has content
export const tileHasContent = (tile: BoardElement): boolean => {
  const content = tile.tileContent;
  if (!content) return false;

  if (content.richText && content.richText.replace(/<[^>]*>/g, "").trim()) return true;
  if (content.noteText && content.noteText.trim()) return true;
  if (content.code && content.code.trim()) return true;
  if (content.chart && content.chart.trim()) return true;
  if (content.imageSrc) return true;

  return false;
};

interface TileCardProps {
  tile: BoardElement;
  isAdded: boolean;
  onAdd: () => void;
}

export function TileCard({ tile, isAdded, onAdd }: TileCardProps) {
  const hasContent = tileHasContent(tile);
  const isDisabled = isAdded || !hasContent;

  return (
    <div
      className={cn(
        "group relative p-2 rounded-lg border transition-colors",
        isAdded
          ? "border-green-500/30 bg-green-500/5"
          : !hasContent
          ? "border-border/50 bg-muted/30 opacity-60"
          : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
      )}
    >
      {/* Type Badge */}
      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn(
            "flex items-center justify-center w-5 h-5 rounded",
            getTileTypeColor(tile.tileType)
          )}
        >
          {getTileIcon(tile.tileType, "w-3.5 h-3.5")}
        </div>
        <span className="text-xs font-medium truncate flex-1">
          {tile.tileTitle || "Untitled"}
        </span>
      </div>

      {/* Content Preview */}
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
        {getTilePreview(tile)}
      </p>

      {/* Add Button */}
      <button
        onClick={onAdd}
        disabled={isDisabled}
        className={cn(
          "w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
          isAdded
            ? "bg-green-500/10 text-green-600 cursor-default"
            : !hasContent
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-primary/10 hover:bg-primary/20 text-primary"
        )}
      >
        {isAdded ? (
          "Added"
        ) : !hasContent ? (
          "Empty"
        ) : (
          <>
            <Plus className="w-3 h-3" />
            Add
          </>
        )}
      </button>
    </div>
  );
}
