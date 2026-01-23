"use client";

import {
    ZoomIn,
    ZoomOut,
    Maximize2,
    Download,
    Copy,
    Image,
    WrapText,
    Sparkles,
    Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CODE_THEMES, type CodeThemeName } from "@/lib/code-themes";

interface CodeTileControlsProps {
    scale: number;
    onScaleChange: (scale: number) => void;
    wordWrap: boolean;
    onWordWrapChange: (wrap: boolean) => void;
    theme: CodeThemeName;
    onThemeChange: (theme: CodeThemeName) => void;
    onExpand?: () => void;
    onCopyCode?: () => void;
    onCopyImage?: () => void;
    onDownload?: () => void;
    onFormat?: () => void;
    canFormat?: boolean;
    className?: string;
}

export function CodeTileControls({
    scale,
    onScaleChange,
    wordWrap,
    onWordWrapChange,
    theme,
    onThemeChange,
    onExpand,
    onCopyCode,
    onCopyImage,
    onDownload,
    onFormat,
    canFormat = false,
    className,
}: CodeTileControlsProps) {
    const handleZoomIn = () => {
        onScaleChange(Math.min(scale + 0.1, 2));
    };

    const handleZoomOut = () => {
        onScaleChange(Math.max(scale - 0.1, 0.5));
    };

    const handleResetZoom = () => {
        onScaleChange(1);
    };

    const currentTheme =
        CODE_THEMES.find((t) => t.name === theme) || CODE_THEMES[0];

    return (
        <div className={cn("flex items-center gap-1", className)}>
            {/* Zoom Controls */}
            <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-muted rounded transition-colors"
                title="Zoom Out"
            >
                <ZoomOut className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
                onClick={handleResetZoom}
                className="px-2 py-1 hover:bg-muted rounded transition-colors"
                title="Reset Zoom"
            >
                <span className="text-xs text-muted-foreground font-medium">
                    {Math.round(scale * 100)}%
                </span>
            </button>

            <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-muted rounded transition-colors"
                title="Zoom In"
            >
                <ZoomIn className="h-4 w-4 text-muted-foreground" />
            </button>

            <div className="w-px h-4 bg-border mx-1" />

            {/* Word Wrap Toggle */}
            <button
                onClick={() => onWordWrapChange(!wordWrap)}
                className={cn(
                    "p-1.5 rounded transition-colors",
                    wordWrap
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted text-muted-foreground",
                )}
                title={wordWrap ? "Disable Word Wrap" : "Enable Word Wrap"}
            >
                <WrapText className="h-4 w-4" />
            </button>

            {/* Theme Selector */}
            <DropdownMenu>
                <DropdownMenuTrigger
                    className="p-1.5 hover:bg-muted rounded transition-colors"
                    title="Change Theme"
                >
                    <Palette className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    {CODE_THEMES.map((t) => (
                        <DropdownMenuItem
                            key={t.name}
                            onClick={() => onThemeChange(t.name)}
                            className="flex items-center gap-2"
                        >
                            <div
                                className="w-4 h-4 rounded border border-border flex-shrink-0"
                                style={{
                                    backgroundColor: t.previewColors.background,
                                }}
                            >
                                <div className="flex h-full items-center justify-center gap-px">
                                    <div
                                        className="w-1 h-2 rounded-sm"
                                        style={{
                                            backgroundColor:
                                                t.previewColors.keyword,
                                        }}
                                    />
                                    <div
                                        className="w-1 h-2 rounded-sm"
                                        style={{
                                            backgroundColor:
                                                t.previewColors.string,
                                        }}
                                    />
                                </div>
                            </div>
                            <span
                                className={cn(
                                    theme === t.name && "font-medium",
                                )}
                            >
                                {t.label}
                            </span>
                            {theme === t.name && (
                                <span className="ml-auto text-primary text-xs">
                                    Active
                                </span>
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <div className="w-px h-4 bg-border mx-1" />

            {/* Format Button */}
            {canFormat && onFormat && (
                <button
                    onClick={onFormat}
                    className="p-1.5 hover:bg-muted rounded transition-colors"
                    title="Format Code"
                >
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                </button>
            )}

            {/* Expand Button */}
            {onExpand && (
                <button
                    onClick={onExpand}
                    className="p-1.5 hover:bg-muted rounded transition-colors"
                    title="Open Fullscreen Editor"
                >
                    <Maximize2 className="h-4 w-4 text-muted-foreground" />
                </button>
            )}

            {/* Copy Code */}
            {onCopyCode && (
                <button
                    onClick={onCopyCode}
                    className="p-1.5 hover:bg-muted rounded transition-colors"
                    title="Copy Code"
                >
                    <Copy className="h-4 w-4 text-muted-foreground" />
                </button>
            )}

            {/* Copy as Image */}
            {onCopyImage && (
                <button
                    onClick={onCopyImage}
                    className="p-1.5 hover:bg-muted rounded transition-colors"
                    title="Copy as Image"
                >
                    <Image className="h-4 w-4 text-muted-foreground" />
                </button>
            )}

            {/* Download */}
            {onDownload && (
                <button
                    onClick={onDownload}
                    className="p-1.5 hover:bg-muted rounded transition-colors"
                    title="Download Code File"
                >
                    <Download className="h-4 w-4 text-muted-foreground" />
                </button>
            )}
        </div>
    );
}
