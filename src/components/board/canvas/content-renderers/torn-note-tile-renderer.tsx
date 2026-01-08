"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Palette, Trash2 } from "lucide-react";
import type { NoteColor } from "@/lib/board-types";

export type { NoteColor };

interface TornNoteTileRendererProps {
  content: string;
  color?: NoteColor;
  onChange?: (content: string) => void;
  onColorChange?: (color: NoteColor) => void;
  onDelete?: () => void;
  readOnly?: boolean;
  isSelected?: boolean;
  isEditing?: boolean;
  onRequestEdit?: () => void;
  className?: string;
}

// Custom vertical paperclip SVG component matching the prototype
function PaperclipVertical({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="56"
      viewBox="0 0 22 56"
      className={className}
      fill="none"
    >
      {/* Main body - thick outer wire */}
      <path
        d="M11 3 C11 3, 4.5 3, 4.5 11 L4.5 40 C4.5 48, 11 48, 11 48 C11 48, 17.5 48, 17.5 40 L17.5 15 C17.5 9.5, 13 9.5, 13 9.5 C13 9.5, 8.5 9.5, 8.5 15 L8.5 38"
        stroke="#2d2d2d"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Inner highlight for 3D effect */}
      <path
        d="M11.5 5 C11.5 5, 6.5 5, 6.5 11 L6.5 40 C6.5 45.5, 11.5 45.5, 11.5 45.5"
        stroke="#4a4a4a"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      {/* Edge highlight for metal shine */}
      <path
        d="M10 4 C10 4, 6 4, 6 11 L6 40 C6 46, 10 46, 10 46"
        stroke="#6a6a6a"
        strokeWidth="0.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />
    </svg>
  );
}

// Two torn edge path variations as specified by user
// PATH 1: warm-beige style - organic curves
// PATH 2: recycled-brown style - deeper tears
const TORN_PATHS = [
  "polygon(0 0, 100% 0, 100% 93%, 97% 95%, 94% 92%, 91% 96%, 88% 93%, 85% 97%, 82% 94%, 79% 91%, 76% 96%, 73% 93%, 70% 95%, 67% 91%, 64% 96%, 61% 93%, 58% 97%, 55% 94%, 52% 91%, 49% 96%, 46% 93%, 43% 95%, 40% 91%, 37% 96%, 34% 93%, 31% 97%, 28% 94%, 25% 91%, 22% 96%, 19% 93%, 16% 95%, 13% 91%, 10% 96%, 7% 93%, 4% 97%, 2% 94%, 0 91%)",
  "polygon(0 0, 100% 0, 100% 88%, 98% 91%, 96% 87%, 94% 93%, 92% 89%, 90% 95%, 88% 90%, 86% 86%, 84% 92%, 82% 88%, 80% 94%, 78% 89%, 76% 85%, 74% 91%, 72% 87%, 70% 93%, 68% 88%, 66% 84%, 64% 90%, 62% 86%, 60% 92%, 58% 87%, 56% 83%, 54% 89%, 52% 85%, 50% 91%, 48% 86%, 46% 82%, 44% 88%, 42% 84%, 40% 90%, 38% 85%, 36% 81%, 34% 87%, 32% 83%, 30% 89%, 28% 84%, 26% 80%, 24% 86%, 22% 82%, 20% 88%, 18% 83%, 16% 79%, 14% 85%, 12% 81%, 10% 87%, 8% 82%, 6% 78%, 4% 84%, 2% 80%, 0 85%)",
];

const colorStyles: Record<
  NoteColor,
  { bg: string; cssVar: string; label: string }
> = {
  butter: {
    bg: "bg-note-butter",
    cssVar: "var(--color-note-butter)",
    label: "Butter",
  },
  mint: { bg: "bg-note-mint", cssVar: "var(--color-note-mint)", label: "Mint" },
  lavender: {
    bg: "bg-note-lavender",
    cssVar: "var(--color-note-lavender)",
    label: "Lavender",
  },
  "natural-tan": {
    bg: "bg-note-natural-tan",
    cssVar: "var(--color-note-natural-tan)",
    label: "Natural Tan",
  },
};

// Natural-tan first for torn notes (the primary color)
const tornColorOrder: NoteColor[] = ["natural-tan"];

export function TornNoteTileRenderer({
  content,
  color = "natural-tan",
  onChange,
  onColorChange,
  onDelete,
  readOnly = false,
  isSelected = false,
  isEditing = false,
  onRequestEdit,
  className,
}: TornNoteTileRendererProps) {
  const [localContent, setLocalContent] = useState(content);
  // Use a stable torn path - default to first (PATH 1)
  const [tornPathIndex] = useState(() => Math.floor(Math.random() * 2));

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setLocalContent(newContent);
      onChange?.(newContent);
    },
    [onChange],
  );

  const tornPath = TORN_PATHS[tornPathIndex];
  const colorStyle = colorStyles["natural-tan"];

  return (
    <div className={cn("relative w-full h-full group", className)}>
      {/* Paperclip - positioned at top right, overlapping the edge */}
      <div className="absolute -top-1 right-4 z-10 pointer-events-auto cursor-grab active:cursor-grabbing">
        <PaperclipVertical className="drop-shadow-sm" />
      </div>

      {/* Torn note body - with clip-path for torn edge effect */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: tornPath,
          backgroundColor: colorStyle.cssVar,
          transform: "rotate(0.3deg)",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='6' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.12'/%3E%3C/svg%3E")`,
        }}
      >
        {/* Options menu - bottom left, subtle */}
        {!readOnly && (
          <div className="absolute bottom-4 left-3 z-10 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-6 h-6 rounded-full flex items-center justify-center bg-black/5 hover:bg-black/10 transition-colors focus:outline-none"
              >
                <Palette className="w-3.5 h-3.5 text-note-text/60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={4}
                className="min-w-[140px]"
              >
                {tornColorOrder.map((colorOption) => (
                  <DropdownMenuItem
                    key={colorOption}
                    onClick={(e) => {
                      e.stopPropagation();
                      onColorChange?.(colorOption);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <span
                      className={cn(
                        "w-4 h-4 rounded-full border",
                        color === colorOption
                          ? "border-note-text ring-1 ring-note-text/20"
                          : "border-note-text/20",
                      )}
                      style={{
                        backgroundColor: colorStyles[colorOption].cssVar,
                      }}
                    />
                    <span className="text-sm">
                      {colorStyles[colorOption].label}
                    </span>
                  </DropdownMenuItem>
                ))}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">Delete</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Text content */}
        <textarea
          value={localContent}
          onChange={handleContentChange}
          readOnly={readOnly || (isSelected && !isEditing)}
          placeholder="Quick note..."
          className={cn(
            "w-full h-full p-6 pr-10 bg-transparent border-none outline-none resize-none",
            "font-bold text-2xl text-[#2a2a2a] leading-tight",
            "placeholder:text-[#6b6b6b]/40",
            readOnly ? "cursor-default" : "cursor-text",
            isSelected && !isEditing && "pointer-events-none",
          )}
          style={{
            fontFamily: "'Inter', -apple-system, sans-serif",
            WebkitFontSmoothing: "antialiased",
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onRequestEdit?.();
          }}
        />
      </div>
    </div>
  );
}
