import { BoardElement } from "@/lib/board-types";
import {
  X,
  Eye,
  EyeOff,
  Trash2,
  ChevronUp,
  ChevronDown,
  Lock,
  Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LayersSidebarProps {
  elements: BoardElement[];
  selectedIds: Set<string>;
  onClose: () => void;
  onSelectElement: (id: string, addToSelection: boolean) => void;
  onDeleteElement: (id: string) => void;
  onReorderElement: (id: string, direction: "up" | "down") => void;
}

const getElementIcon = (type: BoardElement["type"]) => {
  switch (type) {
    case "rectangle":
      return "▢";
    case "ellipse":
      return "○";
    case "diamond":
      return "◇";
    case "line":
      return "─";
    case "arrow":
      return "→";
    case "pen":
      return "✎";
    case "text":
      return "T";
    case "frame":
      return "⬚";
    default:
      return "•";
  }
};

const getElementLabel = (element: BoardElement) => {
  if (element.type === "text" && element.text) {
    return (
      element.text.substring(0, 20) + (element.text.length > 20 ? "..." : "")
    );
  }
  if (element.type === "frame" && element.label) {
    return element.label;
  }
  return element.type.charAt(0).toUpperCase() + element.type.slice(1);
};

export function LayersSidebar({
  elements,
  selectedIds,
  onClose,
  onSelectElement,
  onDeleteElement,
  onReorderElement,
}: LayersSidebarProps) {
  // Sort elements by zIndex (highest first for display)
  const sortedElements = [...elements].sort((a, b) => {
    const zIndexA = a.zIndex ?? 0;
    const zIndexB = b.zIndex ?? 0;
    return zIndexB - zIndexA;
  });

  return (
    <div className="h-full w-80 bg-card border-l border-border shadow-2xl flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Layers</h2>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors"
          aria-label="Close layers panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Layers List */}
      <div className="flex-1 overflow-y-auto p-2">
        {sortedElements.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No layers yet
          </div>
        ) : (
          <div className="space-y-1">
            {sortedElements.map((element, index) => {
              const isSelected = selectedIds.has(element.id);
              const isFirst = index === 0;
              const isLast = index === sortedElements.length - 1;

              return (
                <div
                  key={element.id}
                  className={cn(
                    "group flex items-center gap-2 p-2 rounded-md transition-colors cursor-pointer",
                    isSelected
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50 border border-transparent",
                  )}
                  onClick={(e) =>
                    onSelectElement(element.id, e.shiftKey || e.ctrlKey)
                  }
                >
                  {/* Element Icon & Label */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg flex-shrink-0">
                      {getElementIcon(element.type)}
                    </span>
                    <span className="text-sm truncate">
                      {getElementLabel(element)}
                    </span>
                  </div>

                  {/* Layer Controls */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Move Up */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderElement(element.id, "up");
                      }}
                      disabled={isFirst}
                      className={cn(
                        "p-1 rounded hover:bg-muted transition-colors",
                        isFirst && "opacity-30 cursor-not-allowed",
                      )}
                      aria-label="Move layer up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>

                    {/* Move Down */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorderElement(element.id, "down");
                      }}
                      disabled={isLast}
                      className={cn(
                        "p-1 rounded hover:bg-muted transition-colors",
                        isLast && "opacity-30 cursor-not-allowed",
                      )}
                      aria-label="Move layer down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteElement(element.id);
                      }}
                      className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                      aria-label="Delete layer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-border text-xs text-muted-foreground">
        {sortedElements.length}{" "}
        {sortedElements.length === 1 ? "layer" : "layers"}
      </div>
    </div>
  );
}
