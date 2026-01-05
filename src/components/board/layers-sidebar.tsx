import { useState, useRef, useCallback } from "react";
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
    Copy,
    GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LayersSidebarProps {
    elements: BoardElement[];
    selectedIds: Set<string>;
    onClose: () => void;
    onSelectElement: (id: string, addToSelection: boolean) => void;
    onDeleteElement: (id: string) => void;
    onReorderElement: (id: string, direction: "up" | "down") => void;
    onMoveToIndex?: (id: string, newIndex: number) => void;
    onToggleVisibility?: (id: string) => void;
    onToggleLock?: (id: string) => void;
    onDuplicateElement?: (id: string) => void;
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
        case "tile":
            return "⊞";
        case "web-embed":
            return "🌐";
        default:
            return "•";
    }
};

const getElementLabel = (element: BoardElement) => {
    if (element.type === "text" && element.text) {
        return (
            element.text.substring(0, 20) +
            (element.text.length > 20 ? "..." : "")
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
    onMoveToIndex,
    onToggleVisibility,
    onToggleLock,
    onDuplicateElement,
}: LayersSidebarProps) {
    // Sort elements by zIndex (highest first for display)
    const sortedElements = [...elements].sort((a, b) => {
        const zIndexA = a.zIndex ?? 0;
        const zIndexB = b.zIndex ?? 0;
        return zIndexB - zIndexA;
    });

    // Drag and drop state
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
    const [dropPosition, setDropPosition] = useState<"above" | "below" | null>(
        null,
    );
    const dragStartIndexRef = useRef<number | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const handleDragStart = useCallback(
        (e: React.DragEvent, elementId: string, index: number) => {
            setDraggedId(elementId);
            dragStartIndexRef.current = index;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", elementId);

            // Create a custom drag image
            const dragEl = e.currentTarget as HTMLElement;
            const rect = dragEl.getBoundingClientRect();
            e.dataTransfer.setDragImage(
                dragEl,
                rect.width / 2,
                rect.height / 2,
            );
        },
        [],
    );

    const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const position = e.clientY < midY ? "above" : "below";

        setDropTargetIndex(index);
        setDropPosition(position);
    }, []);

    const handleDragLeave = useCallback(() => {
        // Don't clear immediately to prevent flickering
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent, targetIndex: number) => {
            e.preventDefault();

            if (draggedId === null || dragStartIndexRef.current === null)
                return;

            const startIndex = dragStartIndexRef.current;
            let newIndex = targetIndex;

            // Adjust index based on drop position
            if (dropPosition === "below") {
                newIndex = targetIndex + 1;
            }

            // Don't do anything if dropping in the same position
            if (startIndex === newIndex || startIndex === newIndex - 1) {
                setDraggedId(null);
                setDropTargetIndex(null);
                setDropPosition(null);
                dragStartIndexRef.current = null;
                return;
            }

            // If we have a custom move handler, use it
            if (onMoveToIndex) {
                onMoveToIndex(draggedId, newIndex);
            } else {
                // Fall back to using reorder repeatedly
                const stepsNeeded = startIndex - newIndex;
                const direction = stepsNeeded > 0 ? "up" : "down";
                const steps = Math.abs(stepsNeeded);

                for (let i = 0; i < steps; i++) {
                    onReorderElement(draggedId, direction);
                }
            }

            setDraggedId(null);
            setDropTargetIndex(null);
            setDropPosition(null);
            dragStartIndexRef.current = null;
        },
        [draggedId, dropPosition, onMoveToIndex, onReorderElement],
    );

    const handleDragEnd = useCallback(() => {
        setDraggedId(null);
        setDropTargetIndex(null);
        setDropPosition(null);
        dragStartIndexRef.current = null;
    }, []);

    return (
        <div className="h-full w-80 bg-card border-l border-border shadow-2xl flex flex-col flex-shrink-0 select-none">
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
            <div ref={listRef} className="flex-1 overflow-y-auto p-2">
                {sortedElements.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                        No layers yet
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {sortedElements.map((element, index) => {
                            const isSelected = selectedIds.has(element.id);
                            const isFirst = index === 0;
                            const isLast = index === sortedElements.length - 1;
                            const isDragging = draggedId === element.id;
                            const isDropTarget = dropTargetIndex === index;
                            const isHidden = element.hidden === true;
                            const isLocked = element.locked === true;

                            return (
                                <div
                                    key={element.id}
                                    draggable
                                    onDragStart={(e) =>
                                        handleDragStart(e, element.id, index)
                                    }
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragEnd={handleDragEnd}
                                    className={cn(
                                        "group flex items-center gap-1 p-2 rounded-md transition-all cursor-pointer relative",
                                        isSelected
                                            ? "bg-primary/10 border border-primary/30"
                                            : "hover:bg-muted/50 border border-transparent",
                                        isDragging && "opacity-50 scale-95",
                                        isHidden && "opacity-50",
                                        isDropTarget &&
                                            dropPosition === "above" &&
                                            "before:absolute before:left-0 before:right-0 before:top-0 before:h-0.5 before:bg-primary before:-translate-y-0.5",
                                        isDropTarget &&
                                            dropPosition === "below" &&
                                            "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-0.5 after:bg-primary after:translate-y-0.5",
                                    )}
                                    onClick={(e) => {
                                        if (isLocked) return;
                                        onSelectElement(
                                            element.id,
                                            e.shiftKey ||
                                                e.ctrlKey ||
                                                e.metaKey,
                                        );
                                    }}
                                >
                                    {/* Drag Handle */}
                                    <div
                                        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        <GripVertical className="w-4 h-4" />
                                    </div>

                                    {/* Element Icon & Label */}
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span
                                            className={cn(
                                                "text-base flex-shrink-0",
                                                isHidden &&
                                                    "text-muted-foreground",
                                            )}
                                        >
                                            {getElementIcon(element.type)}
                                        </span>
                                        <span
                                            className={cn(
                                                "text-sm truncate",
                                                isHidden &&
                                                    "text-muted-foreground",
                                            )}
                                        >
                                            {getElementLabel(element)}
                                        </span>
                                    </div>

                                    {/* Quick Actions (always visible for locked/hidden, hover for others) */}
                                    <div
                                        className={cn(
                                            "flex items-center gap-0.5 transition-opacity",
                                            isHidden || isLocked
                                                ? "opacity-100"
                                                : "opacity-0 group-hover:opacity-100",
                                        )}
                                    >
                                        {/* Visibility Toggle */}
                                        {onToggleVisibility && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleVisibility(
                                                        element.id,
                                                    );
                                                }}
                                                className={cn(
                                                    "p-1 rounded hover:bg-muted transition-colors",
                                                    isHidden &&
                                                        "text-muted-foreground",
                                                )}
                                                aria-label={
                                                    isHidden
                                                        ? "Show layer"
                                                        : "Hide layer"
                                                }
                                                title={
                                                    isHidden
                                                        ? "Show layer"
                                                        : "Hide layer"
                                                }
                                            >
                                                {isHidden ? (
                                                    <EyeOff className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Eye className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        )}

                                        {/* Lock Toggle */}
                                        {onToggleLock && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleLock(element.id);
                                                }}
                                                className={cn(
                                                    "p-1 rounded hover:bg-muted transition-colors",
                                                    isLocked &&
                                                        "text-amber-500",
                                                )}
                                                aria-label={
                                                    isLocked
                                                        ? "Unlock layer"
                                                        : "Lock layer"
                                                }
                                                title={
                                                    isLocked
                                                        ? "Unlock layer"
                                                        : "Lock layer"
                                                }
                                            >
                                                {isLocked ? (
                                                    <Lock className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Unlock className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Layer Controls - Show on hover */}
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {/* Move Up */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onReorderElement(
                                                    element.id,
                                                    "up",
                                                );
                                            }}
                                            disabled={isFirst}
                                            className={cn(
                                                "p-1 rounded hover:bg-muted transition-colors",
                                                isFirst &&
                                                    "opacity-30 cursor-not-allowed",
                                            )}
                                            aria-label="Move layer up"
                                            title="Move up (higher z-index)"
                                        >
                                            <ChevronUp className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Move Down */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onReorderElement(
                                                    element.id,
                                                    "down",
                                                );
                                            }}
                                            disabled={isLast}
                                            className={cn(
                                                "p-1 rounded hover:bg-muted transition-colors",
                                                isLast &&
                                                    "opacity-30 cursor-not-allowed",
                                            )}
                                            aria-label="Move layer down"
                                            title="Move down (lower z-index)"
                                        >
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Duplicate */}
                                        {onDuplicateElement && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDuplicateElement(
                                                        element.id,
                                                    );
                                                }}
                                                className="p-1 rounded hover:bg-muted transition-colors"
                                                aria-label="Duplicate layer"
                                                title="Duplicate layer"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        )}

                                        {/* Delete */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteElement(element.id);
                                            }}
                                            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                                            aria-label="Delete layer"
                                            title="Delete layer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer Info */}
            <div className="p-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
                <span>
                    {sortedElements.length}{" "}
                    {sortedElements.length === 1 ? "layer" : "layers"}
                </span>
                {selectedIds.size > 0 && (
                    <span className="text-primary">
                        {selectedIds.size} selected
                    </span>
                )}
            </div>
        </div>
    );
}
