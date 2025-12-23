"use client";

import {
  MousePointer2,
  Pencil,
  Minus,
  ArrowRight,
  Square,
  Diamond,
  Circle,
  Eraser,
  Type,
  Trash2,
  Pointer,
  Lock,
  Unlock,
  Hand,
} from "lucide-react";
import { Tool } from "@/lib/board-types";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/animate-ui/components/radix/tooltip";

interface ToolbarProps {
  selectedTool: Tool;
  onToolChange: (tool: Tool) => void;
  strokeColor: string;
  onStrokeColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  onClear: () => void;
  isToolLocked: boolean;
  onToggleToolLock: () => void;
}

const tools: {
  id: Tool;
  icon: React.ElementType;
  label: string;
  hotkey: number | string;
}[] = [
  { id: "hand", icon: Hand, label: "Hand", hotkey: "H" },
  { id: "select", icon: MousePointer2, label: "Select", hotkey: "V" },
  { id: "pen", icon: Pencil, label: "Pen", hotkey: 1 },
  { id: "line", icon: Minus, label: "Line", hotkey: 2 },
  { id: "arrow", icon: ArrowRight, label: "Arrow", hotkey: 3 },
  { id: "rectangle", icon: Square, label: "Rectangle", hotkey: 4 },
  { id: "diamond", icon: Diamond, label: "Diamond", hotkey: 5 },
  { id: "ellipse", icon: Circle, label: "Ellipse", hotkey: 6 },
  { id: "text", icon: Type, label: "Text", hotkey: 7 },
  { id: "eraser", icon: Eraser, label: "Eraser", hotkey: 8 },
  { id: "laser", icon: Pointer, label: "Laser Pointer", hotkey: 9 },
];

export function Toolbar({
  selectedTool,
  onToolChange,
  strokeColor,
  onStrokeColorChange,
  strokeWidth,
  onStrokeWidthChange,
  onClear,
  isToolLocked,
  onToggleToolLock,
}: ToolbarProps) {
  // Keyboard shortcuts for tools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Letter keys for tools
      if (e.key === "h" || e.key === "H") {
        onToolChange("hand");
        return;
      }
      if (e.key === "v" || e.key === "V") {
        onToolChange("select");
        return;
      }

      // Number keys 1-9 for tools
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        const matchedTool = tools.find((t) => t.hotkey === num);
        if (matchedTool) onToolChange(matchedTool.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToolChange]);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-stretch gap-2 select-none">
      {/* Lock Button */}
      <div className="flex items-center gap-1 bg-card/95 backdrop-blur-md border border-border rounded-md p-1.5 shadow-2xl">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleToolLock}
              className={cn(
                "relative h-10 w-10 rounded-sm transition-all duration-200 flex items-center justify-center",
                "hover:bg-secondary/80",
                isToolLocked
                  ? "bg-accent text-accent-foreground shadow-lg"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isToolLocked ? (
                <Lock className="w-[18px] h-[18px]" />
              ) : (
                <Unlock className="w-[18px] h-[18px]" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="flex flex-col gap-1">
              <span>{isToolLocked ? "Tool Locked" : "Tool Unlocked"}</span>
              <span className="text-xs text-muted-foreground">
                {isToolLocked
                  ? "Tool will not switch after drawing"
                  : "Tool will switch to select after drawing"}
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Main Tools */}
      <div className="flex items-center gap-1 bg-card/95 backdrop-blur-md border border-border rounded-md p-1.5 shadow-2xl">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={cn(
              "relative h-10 w-10 rounded-sm transition-all duration-200 flex items-center justify-center",
              "hover:bg-secondary/80",
              selectedTool === tool.id
                ? "bg-accent text-accent-foreground shadow-lg"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tool.icon className="w-[18px] h-[18px]" />
            <span className="absolute bottom-1 right-1 text-[9px] font-medium opacity-60 leading-none">
              {tool.hotkey}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
