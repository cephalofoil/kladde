"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  StickyNote,
  Code,
  GitBranch,
  Image as ImageIcon,
  Hand,
  MousePointer2,
  Pen,
  Minus,
  MoveRight,
  RectangleHorizontal,
  Diamond,
  Circle,
  Eraser,
  Pointer,
  Lock,
  Unlock,
  Highlighter,
  Shapes,
  Plus,
  Type,
  LetterText,
} from "lucide-react";
import type { Tool, TileType } from "@/lib/board-types";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
  onTileTypeSelect: (tileType: TileType) => void;
  selectedTileType?: TileType | null;
  toolLock: boolean;
  onToggleToolLock: () => void;
  isCollabMode?: boolean;
}

interface TileTypeInfo {
  type: TileType;
  icon: React.ReactNode;
  label: string;
  hotkey: string;
}

interface ToolInfo {
  tool: Tool;
  icon: React.ReactNode;
  label: string;
}

// Tool groups for submenus
const PEN_GROUP: ToolInfo[] = [
  { tool: "pen", icon: <Pen className="h-4 w-4" />, label: "Pen" },
  {
    tool: "highlighter",
    icon: <Highlighter className="h-4 w-4" />,
    label: "Highlighter",
  },
  { tool: "eraser", icon: <Eraser className="h-4 w-4" />, label: "Eraser" },
];

const LINE_GROUP: ToolInfo[] = [
  { tool: "line", icon: <Minus className="h-4 w-4" />, label: "Line" },
  { tool: "arrow", icon: <MoveRight className="h-4 w-4" />, label: "Arrow" },
];

const SHAPE_GROUP: ToolInfo[] = [
  {
    tool: "rectangle",
    icon: <RectangleHorizontal className="h-4 w-4" />,
    label: "Rectangle",
  },
  { tool: "diamond", icon: <Diamond className="h-4 w-4" />, label: "Diamond" },
  { tool: "ellipse", icon: <Circle className="h-4 w-4" />, label: "Ellipse" },
];

const TILE_TYPES: TileTypeInfo[] = [
  {
    type: "tile-text",
    icon: <LetterText className="h-4 w-4" />,
    label: "Text",
    hotkey: "5",
  },
  {
    type: "tile-note",
    icon: <StickyNote className="h-4 w-4" />,
    label: "Note",
    hotkey: "6",
  },
  {
    type: "tile-code",
    icon: <Code className="h-4 w-4" />,
    label: "Code",
    hotkey: "7",
  },
  {
    type: "tile-mermaid",
    icon: <GitBranch className="h-4 w-4" />,
    label: "Diagram",
    hotkey: "8",
  },
  {
    type: "tile-image",
    icon: <ImageIcon className="h-4 w-4" />,
    label: "Image",
    hotkey: "9",
  },
];

// Get icon for a tool
function getToolIcon(tool: Tool): React.ReactNode {
  switch (tool) {
    case "pen":
      return <Pen className="h-4 w-4" />;
    case "highlighter":
      return <Highlighter className="h-4 w-4" />;
    case "eraser":
      return <Eraser className="h-4 w-4" />;
    case "line":
      return <Minus className="h-4 w-4" />;
    case "arrow":
      return <MoveRight className="h-4 w-4" />;
    case "rectangle":
      return <RectangleHorizontal className="h-4 w-4" />;
    case "diamond":
      return <Diamond className="h-4 w-4" />;
    case "ellipse":
      return <Circle className="h-4 w-4" />;
    default:
      return null;
  }
}

// Submenu component - icons only
function ToolSubmenu({
  tools,
  currentTool,
  onToolChange,
  isOpen,
  onClose,
  buttonRef,
}: {
  tools: ToolInfo[];
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
  isOpen: boolean;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLDivElement | null>;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, buttonRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl p-1 z-50 flex flex-col gap-0.5"
    >
      {tools.map((tool) => (
        <button
          key={tool.tool}
          onClick={() => {
            onToolChange(tool.tool);
            onClose();
          }}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-md transition-all",
            currentTool === tool.tool
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          )}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}

// Tool button with submenu
function ToolButton({
  tools,
  currentTool,
  onToolChange,
  hotkey,
  lastUsedTool,
  showStackedIcon = false,
}: {
  tools: ToolInfo[];
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
  hotkey: string;
  lastUsedTool: Tool;
  showStackedIcon?: boolean;
}) {
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  const isActive = tools.some((t) => t.tool === currentTool);
  const displayTool = tools.find((t) => t.tool === lastUsedTool) || tools[0];

  // For shapes, show the actual selected shape icon when active, otherwise show stacked icon
  const displayIcon =
    showStackedIcon && !isActive ? (
      <Shapes className="h-4 w-4" />
    ) : (
      displayTool.icon
    );

  return (
    <div ref={buttonRef} className="relative">
      <button
        onClick={() => setIsSubmenuOpen(!isSubmenuOpen)}
        className={cn(
          "flex items-center justify-center w-[38px] h-[38px] rounded-md transition-all group relative",
          isActive
            ? "bg-accent text-accent-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
        )}
        title={`${displayTool.label} (${hotkey})`}
      >
        {displayIcon}
        <span
          className={cn(
            "text-[9px] font-mono absolute right-1 bottom-0.5",
            isActive ? "opacity-70" : "opacity-40",
          )}
        >
          {hotkey}
        </span>
      </button>
      <ToolSubmenu
        tools={tools}
        currentTool={currentTool}
        onToolChange={onToolChange}
        isOpen={isSubmenuOpen}
        onClose={() => setIsSubmenuOpen(false)}
        buttonRef={buttonRef}
      />
    </div>
  );
}

// Simple tool button (no submenu)
function SimpleToolButton({
  tool,
  icon,
  activeIcon,
  label,
  hotkey,
  currentTool,
  onToolChange,
}: {
  tool: Tool;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  label: string;
  hotkey?: string;
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
}) {
  const isActive = currentTool === tool;
  return (
    <button
      onClick={() => onToolChange(tool)}
      className={cn(
        "flex items-center justify-center w-[38px] h-[38px] rounded-md transition-all group relative",
        isActive
          ? "bg-accent text-accent-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
      )}
      title={`${label}${hotkey ? ` (${hotkey})` : ""}`}
    >
      {isActive && activeIcon ? activeIcon : icon}
      {hotkey && (
        <span
          className={cn(
            "text-[9px] font-mono absolute right-1 bottom-0.5",
            isActive ? "opacity-70" : "opacity-40",
          )}
        >
          {hotkey}
        </span>
      )}
    </button>
  );
}

export function Toolbar({
  currentTool,
  onToolChange,
  onTileTypeSelect,
  selectedTileType,
  toolLock,
  onToggleToolLock,
  isCollabMode = false,
}: ToolbarProps) {
  // Track last used tool in each group
  const [lastPenTool, setLastPenTool] = useState<Tool>("pen");
  const [lastLineTool, setLastLineTool] = useState<Tool>("line");
  const [lastShapeTool, setLastShapeTool] = useState<Tool>("rectangle");

  // Update last used tool when tool changes
  useEffect(() => {
    if (PEN_GROUP.some((t) => t.tool === currentTool)) {
      setLastPenTool(currentTool);
    } else if (LINE_GROUP.some((t) => t.tool === currentTool)) {
      setLastLineTool(currentTool);
    } else if (SHAPE_GROUP.some((t) => t.tool === currentTool)) {
      setLastShapeTool(currentTool);
    }
  }, [currentTool]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toUpperCase();

      switch (key) {
        case "H":
          e.preventDefault();
          onToolChange("hand");
          break;
        case "V":
          e.preventDefault();
          onToolChange("select");
          break;
        case "1":
          e.preventDefault();
          onToolChange(lastPenTool);
          break;
        case "2":
          e.preventDefault();
          onToolChange(lastLineTool);
          break;
        case "3":
          e.preventDefault();
          onToolChange(lastShapeTool);
          break;
        case "4":
          e.preventDefault();
          onToolChange("text");
          break;
      }

      const matchedTile = TILE_TYPES.find((t) => t.hotkey === key);
      if (matchedTile) {
        e.preventDefault();
        onTileTypeSelect(matchedTile.type);
        onToolChange("tile");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onToolChange,
    onTileTypeSelect,
    lastPenTool,
    lastLineTool,
    lastShapeTool,
  ]);

  const handleTileTypeClick = useCallback(
    (tileType: TileType) => {
      onTileTypeSelect(tileType);
      onToolChange("tile");
    },
    [onTileTypeSelect, onToolChange],
  );

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1.5">
      {/* Lock Button - Separate box */}
      <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl p-1">
        <button
          onClick={onToggleToolLock}
          className={cn(
            "flex items-center justify-center w-[38px] h-[38px] rounded-md transition-all",
            toolLock
              ? "bg-accent text-accent-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          )}
          title={toolLock ? "Tool locked" : "Tool unlocked"}
        >
          {toolLock ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Unlock className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Main Toolbar */}
      <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl p-1">
        <div className="flex flex-col items-center gap-0.5">
          {/* Hand Tool */}
          <SimpleToolButton
            tool="hand"
            icon={<Hand className="h-4 w-4" />}
            label="Hand"
            hotkey="H"
            currentTool={currentTool}
            onToolChange={onToolChange}
          />

          {/* Select Tool */}
          <SimpleToolButton
            tool="select"
            icon={<MousePointer2 className="h-4 w-4" />}
            activeIcon={
              <MousePointer2 className="h-4 w-4" fill="currentColor" />
            }
            label="Select"
            hotkey="V"
            currentTool={currentTool}
            onToolChange={onToolChange}
          />

          <div className="h-px w-6 bg-border my-1" />

          {/* Pen Group */}
          <ToolButton
            tools={PEN_GROUP}
            currentTool={currentTool}
            onToolChange={onToolChange}
            hotkey="1"
            lastUsedTool={lastPenTool}
          />

          {/* Line/Arrow Group */}
          <ToolButton
            tools={LINE_GROUP}
            currentTool={currentTool}
            onToolChange={onToolChange}
            hotkey="2"
            lastUsedTool={lastLineTool}
          />

          {/* Shape Group - with stacked icon when not active */}
          <ToolButton
            tools={SHAPE_GROUP}
            currentTool={currentTool}
            onToolChange={onToolChange}
            hotkey="3"
            lastUsedTool={lastShapeTool}
            showStackedIcon={true}
          />

          {/* Text Tool */}
          <SimpleToolButton
            tool="text"
            icon={<Type className="h-4 w-4" />}
            label="Text"
            hotkey="4"
            currentTool={currentTool}
            onToolChange={onToolChange}
          />

          <div className="h-px w-6 bg-border my-1" />

          {/* Tiles */}
          {TILE_TYPES.map((tileType) => (
            <button
              key={tileType.type}
              onClick={() => handleTileTypeClick(tileType.type)}
              className={cn(
                "flex items-center justify-center w-[38px] h-[38px] rounded-md transition-all group relative",
                selectedTileType === tileType.type && currentTool === "tile"
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
              title={`${tileType.label} (${tileType.hotkey})`}
            >
              {tileType.icon}
              <span
                className={cn(
                  "text-[9px] font-mono absolute right-1 bottom-0.5",
                  selectedTileType === tileType.type && currentTool === "tile"
                    ? "opacity-70"
                    : "opacity-40",
                )}
              >
                {tileType.hotkey}
              </span>
            </button>
          ))}

          <div className="h-px w-6 bg-border my-1" />

          {/* More Tools */}
          <button
            className="flex items-center justify-center w-[38px] h-[38px] rounded-md transition-all text-muted-foreground hover:text-foreground hover:bg-accent/50"
            title="More tools"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Laser Pointer - Separate box, only in collab mode */}
      {isCollabMode && (
        <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-2xl p-1">
          <button
            onClick={() => onToolChange("laser")}
            className={cn(
              "flex items-center justify-center w-[38px] h-[38px] rounded-md transition-all",
              currentTool === "laser"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
            title="Laser Pointer"
          >
            <Pointer className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
