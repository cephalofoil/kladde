"use client";

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
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
import { measureWrappedTextHeightPx } from "../text-utils";

export type { NoteColor };

interface TornNoteTileRendererProps {
    content: string;
    color?: NoteColor;
    fontFamily?: string;
    textAlign?: "left" | "center" | "right";
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
    mint: {
        bg: "bg-note-mint",
        cssVar: "var(--color-note-mint)",
        label: "Mint",
    },
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
    fontFamily,
    textAlign,
    onChange,
    onColorChange,
    onDelete,
    readOnly = false,
    isSelected = false,
    isEditing = false,
    onRequestEdit,
    className,
}: TornNoteTileRendererProps) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [localContent, setLocalContent] = useState(content);
    const [autoFontSize, setAutoFontSize] = useState(24);
    const [verticalPadding, setVerticalPadding] = useState(18);
    const resolvedFontFamily = fontFamily || "var(--font-inter)";
    const resolvedTextAlign = textAlign || "center";
    // Use the single torn path
    const tornPathIndex = 0;

    useEffect(() => {
        setLocalContent(content);
    }, [content]);

    const plainText = useMemo(() => {
        const text = localContent || "";
        return text.replace(/\r\n/g, "\n");
    }, [localContent]);

    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const { width, height } = entry.contentRect;
            if (!width || !height) return;
            const paddingX = 24;
            const minPadding = 14;
            const availableWidth = Math.max(0, width - paddingX * 2);
            const availableHeight = Math.max(0, height - minPadding * 2);
            if (!availableWidth || !availableHeight) return;
            const minSize = 12;
            const maxSize = Math.max(
                minSize,
                Math.min(72, Math.floor(availableHeight)),
            );
            const textToMeasure = plainText || " ";
            let low = minSize;
            let high = maxSize;
            let best = minSize;
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const measuredHeight = measureWrappedTextHeightPx({
                    text: textToMeasure,
                    width: availableWidth,
                    fontSize: mid,
                    lineHeight: 1.2,
                    fontFamily: resolvedFontFamily,
                    letterSpacing: 0,
                    textAlign: resolvedTextAlign,
                });
                if (measuredHeight <= availableHeight) {
                    best = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }
            setAutoFontSize(best);
            const measuredHeight = measureWrappedTextHeightPx({
                text: textToMeasure,
                width: availableWidth,
                fontSize: best,
                lineHeight: 1.2,
                fontFamily: resolvedFontFamily,
                letterSpacing: 0,
                textAlign: resolvedTextAlign,
            });
            const nextPadding = Math.max(
                minPadding,
                Math.floor((height - measuredHeight) / 2),
            );
            setVerticalPadding(nextPadding);
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [plainText, resolvedFontFamily, resolvedTextAlign]);

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
                className={cn("absolute inset-0", colorStyle.bg)}
                style={{
                    clipPath: tornPath,
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
                                                backgroundColor:
                                                    colorStyles[colorOption]
                                                        .cssVar,
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
                                            onMouseDown={(e) =>
                                                e.stopPropagation()
                                            }
                                            className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            <span className="text-sm">
                                                Delete
                                            </span>
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}

                {/* Text content */}
                <div ref={containerRef} className="w-full h-full">
                    <textarea
                        ref={textareaRef}
                        value={localContent}
                        onChange={(e) => {
                            const next = e.target.value;
                            setLocalContent(next);
                            onChange?.(next);
                        }}
                        readOnly={readOnly || (isSelected && !isEditing)}
                        placeholder="Quick note..."
                        className={cn(
                            "w-full h-full pl-6 pr-10 bg-transparent border-none outline-none resize-none",
                            "font-bold text-[#2a2a2a] leading-tight tracking-tight",
                            "placeholder:text-[#6b6b6b]/40 placeholder:text-base focus:placeholder:opacity-0",
                            readOnly ? "cursor-default" : "cursor-text",
                        )}
                        style={{
                            fontFamily: resolvedFontFamily,
                            textAlign: resolvedTextAlign,
                            WebkitFontSmoothing: "antialiased",
                            fontSize: `${autoFontSize}px`,
                            lineHeight: "1.2",
                            paddingTop: `${verticalPadding}px`,
                            paddingBottom: `${verticalPadding}px`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            if (!readOnly && !isEditing) {
                                onRequestEdit?.();
                            }
                        }}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            onRequestEdit?.();
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
