"use client";

import { useId, useState, useEffect } from "react";
import {
  Menu,
  FolderOpen,
  Save,
  Image,
  Share2,
  Search,
  HelpCircle,
  RotateCcw,
  Sun,
  Moon,
  Monitor,
  X,
  ExternalLink,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { isMac } from "@/lib/platform";

interface BurgerMenuProps {
  onClear: () => void;
  onExportImage?: () => void;
  onOpen?: () => void;
  onSave?: () => void;
  onFindOnCanvas?: () => void;
  onHelp?: () => void;
  onInvite?: () => void;
  canvasBackground: "none" | "dots" | "lines" | "grid";
  onCanvasBackgroundChange: (
    background: "none" | "dots" | "lines" | "grid",
  ) => void;
  isReadOnly?: boolean;
}

function CanvasBackgroundPreview({
  type,
}: {
  type: "dots" | "lines" | "grid";
}) {
  const idBase = useId();
  const patternId = `${idBase}-${type}`;
  const opacity = type === "dots" ? 0.35 : 0.28;
  const size = 24;
  const spacing = 6;

  if (type === "dots") {
    return (
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-full block"
        style={{ color: "var(--foreground)", opacity }}
      >
        <defs>
          <pattern
            id={patternId}
            width={spacing}
            height={spacing}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={spacing / 2}
              cy={spacing / 2}
              r="0.9"
              fill="currentColor"
              shapeRendering="crispEdges"
            />
          </pattern>
        </defs>
        <rect width={size} height={size} fill={`url(#${patternId})`} />
      </svg>
    );
  }

  if (type === "lines") {
    return (
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-full block"
        style={{ color: "var(--foreground)", opacity }}
      >
        <defs>
          <pattern
            id={patternId}
            x={spacing / 2}
            y={spacing / 2}
            width={spacing}
            height={spacing}
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0.5"
              x2={spacing}
              y2="0.5"
              stroke="currentColor"
              strokeWidth="1"
              shapeRendering="crispEdges"
            />
          </pattern>
        </defs>
        <rect width={size} height={size} fill={`url(#${patternId})`} />
      </svg>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-full block"
      style={{ color: "var(--foreground)", opacity }}
    >
      <defs>
        <pattern
          id={patternId}
          x={spacing / 2}
          y={spacing / 2}
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M0 0.5H${spacing}M0.5 0V${spacing}`}
            stroke="currentColor"
            strokeWidth="1"
            shapeRendering="crispEdges"
            fill="none"
          />
        </pattern>
      </defs>
      <rect width={size} height={size} fill={`url(#${patternId})`} />
    </svg>
  );
}

export function BurgerMenu({
  onClear,
  onExportImage,
  onOpen,
  onSave,
  onFindOnCanvas,
  onHelp,
  onInvite,
  canvasBackground,
  onCanvasBackgroundChange,
  isReadOnly = false,
}: BurgerMenuProps) {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const selectedTheme =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system";

  const handleExportImage = () => {
    if (onExportImage) {
      onExportImage();
    } else {
      console.log("Export image clicked");
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const ctrlKey = isMac() ? e.metaKey : e.ctrlKey;

      // Ctrl+O - Open
      if (ctrlKey && e.key === "o") {
        e.preventDefault();
        if (isReadOnly) return;
        onOpen?.();
      }

      // Ctrl+S - Save
      if (ctrlKey && e.key === "s") {
        e.preventDefault();
        if (isReadOnly) return;
        onSave?.();
      }

      // Ctrl+Shift+E - Export Image
      if (ctrlKey && e.shiftKey && (e.key === "E" || e.key === "e")) {
        e.preventDefault();
        handleExportImage();
      }

      // Ctrl+F - Find on canvas
      if (ctrlKey && e.key === "f") {
        e.preventDefault();
        onFindOnCanvas?.();
      }

      // ? - Help
      if (e.key === "?" && !ctrlKey) {
        e.preventDefault();
        onHelp?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpen, onSave, onExportImage, onFindOnCanvas, onHelp, isReadOnly]);

  const modKey = isMac() ? "⌘" : "Ctrl";

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "h-10 w-10 rounded-md transition-all duration-200 inline-flex items-center justify-center leading-none select-none",
            "bg-card/95 backdrop-blur-md border border-border",
            "hover:bg-muted/60 text-muted-foreground hover:text-foreground",
            "shadow-2xl",
          )}
          aria-label="Menu"
        >
          <Menu className="w-5 h-5 block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 select-none">
        {/* Main Actions */}
        <DropdownMenuItem onClick={onOpen} disabled={isReadOnly}>
          <FolderOpen className="w-4 h-4" />
          <span>Open</span>
          <div className="ml-auto flex gap-0.5">
            <Kbd>{modKey}</Kbd>
            <Kbd>O</Kbd>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onSave} disabled={isReadOnly}>
          <Save className="w-4 h-4" />
          <span>Save to...</span>
          <div className="ml-auto flex gap-0.5">
            <Kbd>{modKey}</Kbd>
            <Kbd>S</Kbd>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleExportImage}>
          <Image className="w-4 h-4" />
          <span>Export image...</span>
          <div className="ml-auto flex gap-0.5">
            <Kbd>{modKey}</Kbd>
            <Kbd>⇧</Kbd>
            <Kbd>E</Kbd>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Collaboration */}
        <DropdownMenuItem onClick={onInvite} disabled={!onInvite}>
          <Share2 className="w-4 h-4" />
          <span>Invite</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Canvas Actions */}
        <DropdownMenuItem onClick={onFindOnCanvas}>
          <Search className="w-4 h-4" />
          <span>Find on canvas</span>
          <div className="ml-auto flex gap-0.5">
            <Kbd>{modKey}</Kbd>
            <Kbd>F</Kbd>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onHelp}>
          <HelpCircle className="w-4 h-4" />
          <span>Help</span>
          <Kbd className="ml-auto">?</Kbd>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onClear}
          className="text-red-400 dark:text-red-400"
          disabled={isReadOnly}
        >
          <RotateCcw className="w-4 h-4 !text-red-400 dark:!text-red-400" />
          <span>Reset the canvas</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Links */}
        <DropdownMenuItem asChild>
          <a
            href="https://github.com/cephalofoil/kladde"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>GitHub</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/docs" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4" />
            <span>Documentation</span>
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Theme Selection */}
        <div className="px-2 py-1.5 flex items-center justify-between gap-2">
          <DropdownMenuLabel className="p-0 m-0">Theme</DropdownMenuLabel>
          <div className="flex items-center bg-secondary/40 rounded-md p-0.5 gap-0.5">
            <button
              onClick={() => setTheme("light")}
              className={cn(
                "w-7 h-7 rounded-sm flex items-center justify-center",
                "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selectedTheme === "light"
                  ? "bg-muted/70 border border-foreground/10 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Light theme"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={cn(
                "w-7 h-7 rounded-sm flex items-center justify-center",
                "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selectedTheme === "dark"
                  ? "bg-muted/70 border border-foreground/10 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Dark theme"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme("system")}
              className={cn(
                "w-7 h-7 rounded-sm flex items-center justify-center",
                "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selectedTheme === "system"
                  ? "bg-muted/70 border border-foreground/10 shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label="System theme"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Canvas Background */}
        <div className="px-2 py-1.5 flex items-center justify-between gap-2">
          <DropdownMenuLabel className="p-0 m-0">Canvas</DropdownMenuLabel>
          <div className="flex gap-0.5">
            <button
              onClick={() => onCanvasBackgroundChange("none")}
              className={cn(
                "w-7 h-7 rounded-sm transition-all border-2 overflow-hidden flex items-center justify-center",
                "bg-background hover:bg-muted/60",
                canvasBackground === "none"
                  ? "border-foreground/30 ring-2 ring-foreground/10"
                  : "border-border",
              )}
              aria-label="No background"
              title="None"
            >
              <X className="w-3 h-3" />
            </button>
            <button
              onClick={() => onCanvasBackgroundChange("dots")}
              className={cn(
                "w-7 h-7 rounded-sm transition-all border-2 overflow-hidden",
                "bg-background hover:bg-muted/60",
                canvasBackground === "dots"
                  ? "border-foreground/30 ring-2 ring-foreground/10"
                  : "border-border",
              )}
              aria-label="Dots background"
              title="Dots"
            >
              <CanvasBackgroundPreview type="dots" />
            </button>
            <button
              onClick={() => onCanvasBackgroundChange("lines")}
              className={cn(
                "w-7 h-7 rounded-sm transition-all border-2 overflow-hidden",
                "bg-background hover:bg-muted/60",
                canvasBackground === "lines"
                  ? "border-foreground/30 ring-2 ring-foreground/10"
                  : "border-border",
              )}
              aria-label="Lines background"
              title="Lines"
            >
              <CanvasBackgroundPreview type="lines" />
            </button>
            <button
              onClick={() => onCanvasBackgroundChange("grid")}
              className={cn(
                "w-7 h-7 rounded-sm transition-all border-2 overflow-hidden",
                "bg-background hover:bg-muted/60",
                canvasBackground === "grid"
                  ? "border-foreground/30 ring-2 ring-foreground/10"
                  : "border-border",
              )}
              aria-label="Grid background"
              title="Grid"
            >
              <CanvasBackgroundPreview type="grid" />
            </button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
