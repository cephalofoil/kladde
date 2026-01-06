import { useState, useRef, useCallback } from "react";
import { BoardElement, LayerFolder } from "@/lib/board-types";
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
    FolderPlus,
    Folder,
    FolderOpen,
    ChevronRight,
    Pencil,
    MousePointer2,
    Pen,
    Minus,
    MoveRight,
    RectangleHorizontal,
    Diamond,
    Circle,
    Type,
    Frame,
    StickyNote,
    Code,
    GitBranch,
    Image as ImageIcon,
    Globe,
    Sparkles,
    LetterText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LayersSidebarProps {
    elements: BoardElement[];
    selectedIds: Set<string>;
    folders: LayerFolder[];
    onClose: () => void;
    onSelectElement: (id: string, addToSelection: boolean) => void;
    onDeleteElement: (id: string) => void;
    onReorderElement: (id: string, direction: "up" | "down") => void;
    onMoveToIndex?: (id: string, newIndex: number) => void;
    onToggleVisibility?: (id: string) => void;
    onToggleLock?: (id: string) => void;
    onDuplicateElement?: (id: string) => void;
    onCreateFolder?: () => void;
    onDeleteFolder?: (folderId: string) => void;
    onRenameFolder?: (folderId: string, newName: string) => void;
    onToggleFolderCollapse?: (folderId: string) => void;
    onMoveToFolder?: (elementId: string, folderId: string | null) => void;
}

const getElementIcon = (element: BoardElement) => {
    const iconClass = "w-4 h-4";

    switch (element.type) {
        case "rectangle":
            return <RectangleHorizontal className={iconClass} />;
        case "ellipse":
            return <Circle className={iconClass} />;
        case "diamond":
            return <Diamond className={iconClass} />;
        case "line":
            return <Minus className={iconClass} />;
        case "arrow":
            return <MoveRight className={iconClass} />;
        case "pen":
            return <Pen className={iconClass} />;
        case "text":
            return <Type className={iconClass} />;
        case "frame":
            return <Frame className={iconClass} />;
        case "tile":
            // Use specific icons for tile types
            switch (element.tileType) {
                case "tile-note":
                    return <StickyNote className={iconClass} />;
                case "tile-code":
                    return <Code className={iconClass} />;
                case "tile-mermaid":
                    return <GitBranch className={iconClass} />;
                case "tile-image":
                    return <ImageIcon className={iconClass} />;
                case "tile-text":
                    return <LetterText className={iconClass} />;
                default:
                    return <StickyNote className={iconClass} />;
            }
        case "web-embed":
            return <Globe className={iconClass} />;
        case "laser":
            return <Sparkles className={iconClass} />;
        default:
            return <MousePointer2 className={iconClass} />;
    }
};

const getElementLabel = (element: BoardElement) => {
    // For text elements, show the text content
    if (element.type === "text" && element.text) {
        const cleanText = element.text.replace(/\n/g, " ").trim();
        return cleanText || "Text";
    }

    // For frames, show the label
    if (element.type === "frame" && element.label) {
        return element.label;
    }

    // For tiles, show the title if available
    if (element.type === "tile") {
        if (element.tileTitle) {
            return element.tileTitle;
        }
        // Fall back to tile type name
        switch (element.tileType) {
            case "tile-note":
                return "Note";
            case "tile-code":
                return "Code";
            case "tile-mermaid":
                return "Diagram";
            case "tile-image":
                return "Image";
            case "tile-text":
                return "Text Block";
            default:
                return "Tile";
        }
    }

    // Default: capitalize the type
    return element.type.charAt(0).toUpperCase() + element.type.slice(1);
};

export function LayersSidebar({
    elements,
    selectedIds,
    folders,
    onClose,
    onSelectElement,
    onDeleteElement,
    onReorderElement,
    onMoveToIndex,
    onToggleVisibility,
    onToggleLock,
    onDuplicateElement,
    onCreateFolder,
    onDeleteFolder,
    onRenameFolder,
    onToggleFolderCollapse,
    onMoveToFolder,
}: LayersSidebarProps) {
    // Sort elements by zIndex (highest first for display)
    const sortedElements = [...elements].sort((a, b) => {
        const zIndexA = a.zIndex ?? 0;
        const zIndexB = b.zIndex ?? 0;
        return zIndexB - zIndexA;
    });

    // Group elements by folder
    const rootElements = sortedElements.filter((el) => !el.folderId);
    const folderElements = new Map<string, BoardElement[]>();
    folders.forEach((folder) => {
        const els = sortedElements.filter((el) => el.folderId === folder.id);
        folderElements.set(folder.id, els);
    });

    // Drag and drop state
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [draggedType, setDraggedType] = useState<"element" | "folder" | null>(
        null,
    );
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<
        "above" | "below" | "inside" | null
    >(null);
    const dragStartIndexRef = useRef<number | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Folder editing state
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editingFolderName, setEditingFolderName] = useState("");

    const handleDragStart = useCallback(
        (
            e: React.DragEvent,
            id: string,
            type: "element" | "folder",
            index: number,
        ) => {
            setDraggedId(id);
            setDraggedType(type);
            dragStartIndexRef.current = index;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", id);

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

    const handleDragOver = useCallback(
        (
            e: React.DragEvent,
            targetId: string,
            targetType: "element" | "folder",
            index: number,
        ) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";

            const rect = (
                e.currentTarget as HTMLElement
            ).getBoundingClientRect();
            const relativeY = e.clientY - rect.top;
            const height = rect.height;

            let position: "above" | "below" | "inside";

            if (targetType === "folder" && draggedType === "element") {
                // For folders, allow dropping inside
                if (relativeY < height * 0.25) {
                    position = "above";
                } else if (relativeY > height * 0.75) {
                    position = "below";
                } else {
                    position = "inside";
                }
            } else {
                position = relativeY < height / 2 ? "above" : "below";
            }

            setDropTargetId(targetId);
            setDropPosition(position);
        },
        [draggedType],
    );

    const handleDrop = useCallback(
        (
            e: React.DragEvent,
            targetId: string,
            targetType: "element" | "folder",
            targetIndex: number,
        ) => {
            e.preventDefault();

            if (draggedId === null || dragStartIndexRef.current === null) {
                resetDragState();
                return;
            }

            // Handle dropping element into folder
            if (
                draggedType === "element" &&
                targetType === "folder" &&
                dropPosition === "inside"
            ) {
                onMoveToFolder?.(draggedId, targetId);
                resetDragState();
                return;
            }

            // Handle reordering
            if (draggedType === "element" && onMoveToIndex) {
                const startIndex = dragStartIndexRef.current;
                let newIndex = targetIndex;

                if (dropPosition === "below") {
                    newIndex = targetIndex + 1;
                }

                // Adjust if we're moving down (account for removal of original)
                if (startIndex < newIndex) {
                    newIndex--;
                }

                if (startIndex !== newIndex) {
                    onMoveToIndex(draggedId, newIndex);
                }
            }

            resetDragState();
        },
        [draggedId, draggedType, dropPosition, onMoveToIndex, onMoveToFolder],
    );

    const resetDragState = () => {
        setDraggedId(null);
        setDraggedType(null);
        setDropTargetId(null);
        setDropPosition(null);
        dragStartIndexRef.current = null;
    };

    const handleDragEnd = useCallback(() => {
        resetDragState();
    }, []);

    const startEditingFolder = (folder: LayerFolder) => {
        setEditingFolderId(folder.id);
        setEditingFolderName(folder.name);
    };

    const finishEditingFolder = () => {
        if (editingFolderId && editingFolderName.trim()) {
            onRenameFolder?.(editingFolderId, editingFolderName.trim());
        }
        setEditingFolderId(null);
        setEditingFolderName("");
    };

    const renderElement = (
        element: BoardElement,
        index: number,
        inFolder: boolean = false,
    ) => {
        const isSelected = selectedIds.has(element.id);
        const isDragging = draggedId === element.id;
        const isDropTarget = dropTargetId === element.id;
        const isHidden = element.hidden === true;
        const isLocked = element.locked === true;

        return (
            <div
                key={element.id}
                draggable
                onDragStart={(e) =>
                    handleDragStart(e, element.id, "element", index)
                }
                onDragOver={(e) =>
                    handleDragOver(e, element.id, "element", index)
                }
                onDrop={(e) => handleDrop(e, element.id, "element", index)}
                onDragEnd={handleDragEnd}
                className={cn(
                    "group flex items-center gap-1 p-2 rounded-md transition-all cursor-pointer relative",
                    inFolder && "ml-4",
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
                        e.shiftKey || e.ctrlKey || e.metaKey,
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
                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                    <div
                        className={cn(
                            "flex-shrink-0",
                            isHidden && "text-muted-foreground",
                        )}
                    >
                        {getElementIcon(element)}
                    </div>
                    <span
                        className={cn(
                            "text-sm truncate",
                            isHidden && "text-muted-foreground",
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
                                onToggleVisibility(element.id);
                            }}
                            className={cn(
                                "p-1 rounded hover:bg-muted transition-colors",
                                isHidden && "text-muted-foreground",
                            )}
                            aria-label={isHidden ? "Show layer" : "Hide layer"}
                            title={isHidden ? "Show layer" : "Hide layer"}
                        >
                            {isHidden ? (
                                <EyeOff className="w-4 h-4" />
                            ) : (
                                <Eye className="w-4 h-4" />
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
                                isLocked && "text-amber-500",
                            )}
                            aria-label={
                                isLocked ? "Unlock layer" : "Lock layer"
                            }
                            title={isLocked ? "Unlock layer" : "Lock layer"}
                        >
                            {isLocked ? (
                                <Lock className="w-4 h-4" />
                            ) : (
                                <Unlock className="w-4 h-4" />
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
                            onReorderElement(element.id, "up");
                        }}
                        disabled={index === 0}
                        className={cn(
                            "p-1 rounded hover:bg-muted transition-colors",
                            index === 0 && "opacity-30 cursor-not-allowed",
                        )}
                        aria-label="Move layer up"
                        title="Move up (higher z-index)"
                    >
                        <ChevronUp className="w-4 h-4" />
                    </button>

                    {/* Move Down */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onReorderElement(element.id, "down");
                        }}
                        disabled={index === sortedElements.length - 1}
                        className={cn(
                            "p-1 rounded hover:bg-muted transition-colors",
                            index === sortedElements.length - 1 &&
                                "opacity-30 cursor-not-allowed",
                        )}
                        aria-label="Move layer down"
                        title="Move down (lower z-index)"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </button>

                    {/* Duplicate */}
                    {onDuplicateElement && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateElement(element.id);
                            }}
                            className="p-1 rounded hover:bg-muted transition-colors"
                            aria-label="Duplicate layer"
                            title="Duplicate layer"
                        >
                            <Copy className="w-4 h-4" />
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
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

    const renderFolder = (folder: LayerFolder, folderIndex: number) => {
        const isCollapsed = folder.collapsed ?? false;
        const folderContents = folderElements.get(folder.id) ?? [];
        const isDropTarget = dropTargetId === folder.id;
        const isDragging = draggedId === folder.id;

        return (
            <div key={folder.id} className="space-y-0.5">
                {/* Folder Header */}
                <div
                    draggable
                    onDragStart={(e) =>
                        handleDragStart(e, folder.id, "folder", folderIndex)
                    }
                    onDragOver={(e) =>
                        handleDragOver(e, folder.id, "folder", folderIndex)
                    }
                    onDrop={(e) =>
                        handleDrop(e, folder.id, "folder", folderIndex)
                    }
                    onDragEnd={handleDragEnd}
                    className={cn(
                        "group flex items-center gap-1 p-2 rounded-md transition-all cursor-pointer relative",
                        "hover:bg-muted/50 border border-transparent",
                        isDragging && "opacity-50 scale-95",
                        isDropTarget &&
                            dropPosition === "above" &&
                            "before:absolute before:left-0 before:right-0 before:top-0 before:h-0.5 before:bg-primary before:-translate-y-0.5",
                        isDropTarget &&
                            dropPosition === "below" &&
                            "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-0.5 after:bg-primary after:translate-y-0.5",
                        isDropTarget &&
                            dropPosition === "inside" &&
                            "bg-primary/10 border-primary/30",
                    )}
                    onClick={() => onToggleFolderCollapse?.(folder.id)}
                >
                    {/* Drag Handle */}
                    <div
                        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Collapse Arrow */}
                    <ChevronRight
                        className={cn(
                            "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0",
                            !isCollapsed && "rotate-90",
                        )}
                    />

                    {/* Folder Icon */}
                    {isCollapsed ? (
                        <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                        <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}

                    {/* Folder Name */}
                    {editingFolderId === folder.id ? (
                        <input
                            type="text"
                            value={editingFolderName}
                            onChange={(e) =>
                                setEditingFolderName(e.target.value)
                            }
                            onBlur={finishEditingFolder}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") finishEditingFolder();
                                if (e.key === "Escape") {
                                    setEditingFolderId(null);
                                    setEditingFolderName("");
                                }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 min-w-0 text-sm bg-transparent border-b border-primary outline-none"
                            autoFocus
                        />
                    ) : (
                        <span
                            className="flex-1 min-w-0 text-sm truncate font-medium"
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                startEditingFolder(folder);
                            }}
                        >
                            {folder.name}
                        </span>
                    )}

                    {/* Element Count */}
                    <span className="text-xs text-muted-foreground">
                        {folderContents.length}
                    </span>

                    {/* Folder Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                startEditingFolder(folder);
                            }}
                            className="p-1 rounded hover:bg-muted transition-colors"
                            aria-label="Rename folder"
                            title="Rename folder"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteFolder?.(folder.id);
                            }}
                            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                            aria-label="Delete folder"
                            title="Delete folder (contents will be moved to root)"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Folder Contents */}
                {!isCollapsed && folderContents.length > 0 && (
                    <div className="border-l-2 border-muted ml-3">
                        {folderContents.map((element, idx) =>
                            renderElement(element, idx, true),
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Calculate global index for elements considering folders
    let globalIndex = 0;

    return (
        <div className="h-full w-80 bg-card border-l border-border shadow-2xl flex flex-col flex-shrink-0 select-none">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold">Layers</h2>
                <div className="flex items-center gap-1">
                    {onCreateFolder && (
                        <button
                            onClick={onCreateFolder}
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            aria-label="Create folder"
                            title="Create folder"
                        >
                            <FolderPlus className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                        aria-label="Close layers panel"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Layers List */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-2">
                {sortedElements.length === 0 && folders.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                        No layers yet
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {/* Render folders first */}
                        {folders.map((folder, idx) =>
                            renderFolder(folder, idx),
                        )}

                        {/* Render root elements (not in any folder) */}
                        {rootElements.map((element, idx) => {
                            const el = renderElement(
                                element,
                                globalIndex,
                                false,
                            );
                            globalIndex++;
                            return el;
                        })}
                    </div>
                )}
            </div>

            {/* Footer Info */}
            <div className="p-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
                <span>
                    {sortedElements.length}{" "}
                    {sortedElements.length === 1 ? "layer" : "layers"}
                    {folders.length > 0 &&
                        ` · ${folders.length} ${folders.length === 1 ? "folder" : "folders"}`}
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
