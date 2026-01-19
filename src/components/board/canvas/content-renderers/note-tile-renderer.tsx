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
import type { NoteColor, NoteStyle } from "@/lib/board-types";
import { TornNoteTileRenderer } from "./torn-note-tile-renderer";

export type { NoteColor };
export type { NoteStyle };

interface NoteTileRendererProps {
    content: string;
    color?: NoteColor;
    style?: NoteStyle;
    onChange?: (content: string) => void;
    onColorChange?: (color: NoteColor) => void;
    onStyleChange?: (style: NoteStyle) => void;
    onDelete?: () => void;
    readOnly?: boolean;
    isSelected?: boolean;
    isEditing?: boolean;
    onRequestEdit?: () => void;
    className?: string;
}

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

const colorOrder: NoteColor[] = ["butter", "mint", "lavender"];

export function NoteTileRenderer({
    content,
    color = "butter",
    style = "classic",
    onChange,
    onColorChange,
    onStyleChange,
    onDelete,
    readOnly = false,
    isSelected = false,
    isEditing = false,
    onRequestEdit,
    className,
}: NoteTileRendererProps) {
    // Delegate to TornNoteTileRenderer for torn style
    if (style === "torn") {
        return (
            <TornNoteTileRenderer
                content={content}
                color={color}
                onChange={onChange}
                onColorChange={onColorChange}
                onDelete={onDelete}
                readOnly={readOnly}
                isSelected={isSelected}
                isEditing={isEditing}
                onRequestEdit={onRequestEdit}
                className={className}
            />
        );
    }
    const [localContent, setLocalContent] = useState(content);
    const resolvedColor = color === "natural-tan" ? "butter" : color;

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

    // Tape style matching the reference exactly
    const tapeStyle: React.CSSProperties = {
        background: `
      linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 50%, rgba(0,0,0,0.05) 100%),
      var(--color-note-tape)
    `,
        boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.5),
      inset 0 -1px 0 rgba(0,0,0,0.08),
      0 2px 4px rgba(0,0,0,0.1)
    `,
    };

    return (
        <div className={cn("relative w-full h-full", className)}>
            {/* Note body - full square, sits behind tape */}
            <div
                className={cn(
                    "absolute inset-0 rounded-[2px] shadow-note",
                    colorStyles[resolvedColor].bg,
                )}
            >
                {/* Tape - centered at top, half sticking out */}
                <div
                    className="absolute z-20 pointer-events-auto cursor-grab active:cursor-grabbing"
                    style={{
                        ...tapeStyle,
                        width: "72px",
                        height: "24px",
                        left: "50%",
                        top: "-12px",
                        transform: "translateX(-50%) rotate(-1.5deg)",
                        borderRadius: "1px",
                        opacity: 0.92,
                    }}
                />
                {/* Options menu - bottom left, subtle */}
                {!readOnly && (
                    <div className="absolute bottom-2 left-2 z-10 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
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
                                {colorOrder.map((colorOption) => (
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
                {/* When selected but not editing, disable pointer events so drag works */}
                <textarea
                    value={localContent}
                    onChange={handleContentChange}
                    readOnly={readOnly || (isSelected && !isEditing)}
                    placeholder="Type your note..."
                    className={cn(
                        "w-full h-full px-5 pt-6 pb-4 bg-transparent border-none outline-none resize-none",
                        "font-bold text-2xl text-note-text leading-tight tracking-tight",
                        "placeholder:text-note-text/25",
                        readOnly ? "cursor-default" : "cursor-text",
                        isSelected && !isEditing && "pointer-events-none",
                    )}
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
