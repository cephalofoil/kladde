"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  StickyNote,
  GitBranch,
  Image as ImageIcon,
  Hand,
  MousePointer2,
  Pencil,
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
  Plus,
  Lasso,
  Frame,
  FileText,
  CodeXml,
  Type,
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

const ICON_CLASS = "h-5 w-5";

// Custom icon components for SVG files
function ShapesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M9 14H4C3.44772 14 3 14.4477 3 15V20C3 20.5523 3.44772 21 4 21H9C9.55228 21 10 20.5523 10 20V15C10 14.4477 9.55228 14 9 14Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.9268 3.15447L14.1544 5.92681C13.8482 6.23303 13.8482 6.72952 14.1544 7.03575L16.9268 9.80809C17.233 10.1143 17.7295 10.1143 18.0357 9.80809L20.8081 7.03575C21.1143 6.72952 21.1143 6.23303 20.8081 5.92681L18.0357 3.15447C17.7295 2.84824 17.233 2.84824 16.9268 3.15447Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 10C8.433 10 10 8.433 10 6.5C10 4.567 8.433 3 6.5 3C4.567 3 3 4.567 3 6.5C3 8.433 4.567 10 6.5 10Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 14V20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 15V14.3333C14 14.2449 14.0461 14.1601 14.1281 14.0976C14.2102 14.0351 14.3215 14 14.4375 14H20.5625C20.6785 14 20.7898 14.0351 20.8719 14.0976C20.9539 14.1601 21 14.2449 21 14.3333V15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.1 21H18.85"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

function DiagramToolIcon({ className }: { className?: string }) {
  return (
    <img
      src="/icons/diagram-tool.svg"
      alt=""
      aria-hidden="true"
      className={className}
    />
  );
}

// Tool groups for submenus
const PEN_GROUP: ToolInfo[] = [
  { tool: "pen", icon: <Pencil className={ICON_CLASS} />, label: "Pen" },
  {
    tool: "highlighter",
    icon: <Highlighter className={ICON_CLASS} />,
    label: "Highlighter",
  },
  { tool: "eraser", icon: <Eraser className={ICON_CLASS} />, label: "Eraser" },
];

const LINE_GROUP: ToolInfo[] = [
  { tool: "line", icon: <Minus className={ICON_CLASS} />, label: "Line" },
  { tool: "arrow", icon: <MoveRight className={ICON_CLASS} />, label: "Arrow" },
];

const SHAPE_GROUP: ToolInfo[] = [
  {
    tool: "rectangle",
    icon: <RectangleHorizontal className={ICON_CLASS} />,
    label: "Rectangle",
  },
  {
    tool: "diamond",
    icon: <Diamond className={ICON_CLASS} />,
    label: "Diamond",
  },
  { tool: "ellipse", icon: <Circle className={ICON_CLASS} />, label: "Ellipse" },
  { tool: "text", icon: <Type className={ICON_CLASS} />, label: "Text" },
];

const TILE_TYPES: TileTypeInfo[] = [
  {
    type: "tile-text",
    icon: <TextTileIcon className={ICON_CLASS} />,
    label: "Text",
    hotkey: "4",
  },
  {
    type: "tile-note",
    icon: <StickyNote className={`${ICON_CLASS} rotate-90`} />,
    label: "Note",
    hotkey: "5",
  },
  {
    type: "tile-code",
    icon: <CodeXml className={ICON_CLASS} />,
    label: "Code",
    hotkey: "6",
  },
  {
    type: "tile-mermaid",
    icon: <DiagramToolIcon className={ICON_CLASS} />,
    label: "Diagram",
    hotkey: "7",
  },
  {
    type: "tile-image",
    icon: <ImageIcon className={ICON_CLASS} />,
    label: "Image",
    hotkey: "8",
  },
  {
    type: "tile-document",
    icon: <FileText className={ICON_CLASS} />,
    label: "Doc",
    hotkey: "9",
  },
];

const MORE_TOOLS: Array<{ tool: Tool; label: string; icon: React.ReactNode }> =
  [
    { tool: "lasso", label: "Lasso", icon: <Lasso className={ICON_CLASS} /> },
    { tool: "frame", label: "Frame", icon: <Frame className={ICON_CLASS} /> },
  ];

// Get icon for a tool
function getToolIcon(tool: Tool): React.ReactNode {
  switch (tool) {
    case "pen":
      return <Pencil className={ICON_CLASS} />;
    case "highlighter":
      return <Highlighter className={ICON_CLASS} />;
    case "eraser":
      return <Eraser className={ICON_CLASS} />;
    case "line":
      return <Minus className={ICON_CLASS} />;
    case "arrow":
      return <MoveRight className={ICON_CLASS} />;
    case "rectangle":
      return <RectangleHorizontal className={ICON_CLASS} />;
    case "diamond":
      return <Diamond className={ICON_CLASS} />;
    case "ellipse":
      return <Circle className={ICON_CLASS} />;
    case "text":
      return <Type className={ICON_CLASS} />;
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
      className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-card border border-border rounded-lg shadow-2xl p-1 z-50 flex flex-col gap-0.5"
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

function MoreToolsMenu({
  isOpen,
  onClose,
  onSelect,
  buttonRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (tool: Tool) => void;
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
      className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-card border border-border rounded-lg shadow-2xl p-1 z-50 flex flex-col gap-0.5 min-w-[140px]"
    >
      {MORE_TOOLS.map((item) => (
        <button
          key={item.tool}
          onClick={() => {
            onSelect(item.tool);
            onClose();
          }}
          className="px-3 py-2 text-left text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all flex items-center gap-2"
        >
          {item.icon}
          {item.label}
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
      <ShapesIcon className={ICON_CLASS} />
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
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLDivElement>(null);
  const moreTool = MORE_TOOLS.find((item) => item.tool === currentTool);

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

  const getNextToolInGroup = useCallback(
    (tools: ToolInfo[], fallback: Tool) => {
      const currentIndex = tools.findIndex((t) => t.tool === currentTool);
      if (currentIndex === -1) return fallback;
      return tools[(currentIndex + 1) % tools.length].tool;
    },
    [currentTool],
  );

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
      if (key === "F" && (e.ctrlKey || e.metaKey)) {
        return;
      }

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
          onToolChange(getNextToolInGroup(PEN_GROUP, lastPenTool));
          break;
        case "2":
          e.preventDefault();
          onToolChange(getNextToolInGroup(LINE_GROUP, lastLineTool));
          break;
        case "3":
          e.preventDefault();
          onToolChange(getNextToolInGroup(SHAPE_GROUP, lastShapeTool));
          break;
        case "F":
          e.preventDefault();
          onToolChange("frame");
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
    getNextToolInGroup,
  ]);

  const handleTileTypeClick = useCallback(
    (tileType: TileType) => {
      onTileTypeSelect(tileType);
      onToolChange("tile");
    },
    [onTileTypeSelect, onToolChange],
  );

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 z-[80] flex flex-col items-center gap-1.5">
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
            icon={<Hand className={ICON_CLASS} />}
            label="Hand"
            hotkey="H"
            currentTool={currentTool}
            onToolChange={onToolChange}
          />

          {/* Select Tool */}
          <SimpleToolButton
            tool="select"
            icon={<MousePointer2 className={ICON_CLASS} />}
            activeIcon={
              <MousePointer2 className={ICON_CLASS} fill="currentColor" />
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

          <div className="h-px w-6 bg-border my-1" />

          {/* Tiles */}
          {TILE_TYPES.map((tileType) => (
            <button
              key={tileType.type}
              onPointerDown={() => handleTileTypeClick(tileType.type)}
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
          <div ref={moreButtonRef} className="relative">
            <button
              onClick={() => setIsMoreOpen((prev) => !prev)}
              className={cn(
                "flex items-center justify-center w-[38px] h-[38px] rounded-md transition-all",
                moreTool
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
              title="More tools"
            >
              {moreTool?.icon ?? <Plus className={ICON_CLASS} />}
            </button>
            <MoreToolsMenu
              isOpen={isMoreOpen}
              onClose={() => setIsMoreOpen(false)}
              onSelect={(tool) => onToolChange(tool)}
              buttonRef={moreButtonRef}
            />
          </div>
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
            <Pointer className={ICON_CLASS} />
          </button>
        </div>
      )}
    </div>
  );
}
