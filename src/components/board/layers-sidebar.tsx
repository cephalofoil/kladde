import { useState, useRef, useCallback, useEffect } from "react";
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
    Pin,
    PinOff,
    MousePointer2,
    Pen,
    Highlighter,
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
    Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LayersSidebarProps {
    elements: BoardElement[];
    selectedIds: Set<string>;
    folders: LayerFolder[];
    isPinned: boolean;
    onTogglePin: () => void;
    onClose: () => void;
    onFocusElement?: (element: BoardElement) => void;
    onHighlightElements?: (
        elementIds: string[],
        currentId?: string | null,
    ) => void;
    onSelectElement: (
        id: string,
        addToSelection: boolean,
        shiftKey?: boolean,
    ) => void;
    onDeleteElement: (id: string) => void;
    onDeleteSelected?: () => void;
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
            if (element.penMode === "highlighter") {
                return <Highlighter className={iconClass} />;
            }
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

    // For pen elements, check if it's a highlighter
    if (element.type === "pen" && element.penMode === "highlighter") {
        return "Highlighter";
    }

    // Default: capitalize the type
    return element.type.charAt(0).toUpperCase() + element.type.slice(1);
};

export function LayersSidebar({
    elements,
    selectedIds,
    folders,
    isPinned,
    onTogglePin,
    onClose,
    onFocusElement,
    onHighlightElements,
    onSelectElement,
    onDeleteElement,
    onDeleteSelected,
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

    const elementIndexById = new Map(
        sortedElements.map((element, index) => [element.id, index]),
    );

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
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Folder editing state
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editingFolderName, setEditingFolderName] = useState("");
    const [pendingDeleteFolderId, setPendingDeleteFolderId] = useState<
        string | null
    >(null);
    const pendingDeleteCount = pendingDeleteFolderId
        ? (folderElements.get(pendingDeleteFolderId)?.length ?? 0)
        : 0;

    // Handle keyboard delete
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (
                (e.key === "Delete" || e.key === "Backspace") &&
                selectedIds.size > 0 &&
                onDeleteSelected &&
                !editingFolderId // Don't delete when editing folder name
            ) {
                // Don't delete if focus is in an input
                const activeElement = document.activeElement;
                if (
                    activeElement instanceof HTMLInputElement ||
                    activeElement instanceof HTMLTextAreaElement
                ) {
                    return;
                }
                e.preventDefault();
                onDeleteSelected();
            }
        },
        [selectedIds, onDeleteSelected, editingFolderId],
    );
    const [activeTab, setActiveTab] = useState<"layers" | "find">("layers");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<BoardElement[]>([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(0);

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
            targetFolderId?: string | null,
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

            if (draggedType === "element" && targetFolderId) {
                const draggedElement = elements.find(
                    (el) => el.id === draggedId,
                );
                if (draggedElement?.folderId !== targetFolderId) {
                    onMoveToFolder?.(draggedId, targetFolderId);
                }
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
        [
            draggedId,
            draggedType,
            dropPosition,
            onMoveToIndex,
            onMoveToFolder,
            elements,
        ],
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

    const handleFolderContentsDragOver = useCallback(
        (e: React.DragEvent, folderId: string) => {
            if (draggedType !== "element") return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDropTargetId(folderId);
            setDropPosition("inside");
        },
        [draggedType],
    );

    const handleFolderContentsDrop = useCallback(
        (e: React.DragEvent, folderId: string) => {
            e.preventDefault();
            if (draggedId === null || draggedType !== "element") {
                resetDragState();
                return;
            }
            onMoveToFolder?.(draggedId, folderId);
            resetDragState();
        },
        [draggedId, draggedType, onMoveToFolder],
    );

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
        parentFolderId?: string | null,
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
                onDrop={(e) =>
                    handleDrop(e, element.id, "element", index, parentFolderId)
                }
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
                        e.ctrlKey || e.metaKey,
                        e.shiftKey,
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

                {/* Quick Actions */}
                <div className="flex items-center gap-0.5">
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
                                isHidden
                                    ? "opacity-100"
                                    : "opacity-0 group-hover:opacity-100",
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
                                isLocked && "text-amber-500 opacity-100",
                                !isLocked &&
                                    "opacity-0 group-hover:opacity-100",
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
                                setPendingDeleteFolderId(folder.id);
                            }}
                            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                            aria-label="Delete folder"
                            title="Delete folder and contents"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Folder Contents */}
                {!isCollapsed && folderContents.length > 0 && (
                    <div
                        className={cn(
                            "border-l-2 border-muted ml-3",
                            isDropTarget &&
                                dropPosition === "inside" &&
                                "bg-primary/5 border-primary/40 rounded-md",
                        )}
                        onDragOver={(e) =>
                            handleFolderContentsDragOver(e, folder.id)
                        }
                        onDrop={(e) => handleFolderContentsDrop(e, folder.id)}
                    >
                        {folderContents.map((element, idx) =>
                            renderElement(
                                element,
                                elementIndexById.get(element.id) ?? idx,
                                true,
                                folder.id,
                            ),
                        )}
                    </div>
                )}
            </div>
        );
    };

    const handleFindNext = () => {
        if (searchResults.length === 0 || !onFocusElement) return;
        const nextIndex = (currentResultIndex + 1) % searchResults.length;
        setCurrentResultIndex(nextIndex);
        const next = searchResults[nextIndex];
        onFocusElement(next);
        onHighlightElements?.(
            searchResults.map((el) => el.id),
            next.id,
        );
    };

    const handleFindPrevious = () => {
        if (searchResults.length === 0 || !onFocusElement) return;
        const prevIndex =
            currentResultIndex === 0
                ? searchResults.length - 1
                : currentResultIndex - 1;
        setCurrentResultIndex(prevIndex);
        const prev = searchResults[prevIndex];
        onFocusElement(prev);
        onHighlightElements?.(
            searchResults.map((el) => el.id),
            prev.id,
        );
    };

    const handleFindKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) {
                handleFindPrevious();
            } else {
                handleFindNext();
            }
        }
    };

    const clearFindState = useCallback(() => {
        setSearchQuery("");
        setSearchResults([]);
        setCurrentResultIndex(0);
        onHighlightElements?.([]);
    }, [onHighlightElements]);

    useEffect(() => {
        if (activeTab !== "find") {
            clearFindState();
        }
    }, [activeTab, clearFindState]);

    useEffect(() => {
        if (activeTab !== "find") return;
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setCurrentResultIndex(0);
            onHighlightElements?.([]);
            return;
        }

        const query = searchQuery.toLowerCase();
        const matchingElements = elements.filter((el) => {
            if (el.type === "text") {
                return el.text?.toLowerCase().includes(query);
            }
            if (el.type === "frame") {
                return el.label?.toLowerCase().includes(query);
            }
            if (el.type === "tile") {
                if (el.tileTitle?.toLowerCase().includes(query)) {
                    return true;
                }
                if (el.tileContent) {
                    const content = el.tileContent;
                    if (content.richText?.toLowerCase().includes(query)) {
                        return true;
                    }
                    if (content.noteText?.toLowerCase().includes(query)) {
                        return true;
                    }
                    if (content.code?.toLowerCase().includes(query)) {
                        return true;
                    }
                    if (content.chart?.toLowerCase().includes(query)) {
                        return true;
                    }
                    if (content.bookmarkTitle?.toLowerCase().includes(query)) {
                        return true;
                    }
                    if (
                        content.bookmarkDescription
                            ?.toLowerCase()
                            .includes(query)
                    ) {
                        return true;
                    }
                    if (content.displayName?.toLowerCase().includes(query)) {
                        return true;
                    }
                }
                if (el.tileType) {
                    const tileTypeName = el.tileType
                        .replace("tile-", "")
                        .toLowerCase();
                    if (tileTypeName.includes(query) || query === "tile") {
                        return true;
                    }
                }
            }
            if (el.type.toLowerCase().includes(query)) {
                return true;
            }
            return false;
        });

        setSearchResults(matchingElements);
        setCurrentResultIndex(0);
        onHighlightElements?.(
            matchingElements.map((el) => el.id),
            matchingElements.length > 0 ? matchingElements[0].id : null,
        );
        if (matchingElements.length > 0 && onFocusElement) {
            onFocusElement(matchingElements[0]);
        }
    }, [activeTab, elements, onFocusElement, onHighlightElements, searchQuery]);

    return (
        <div
            ref={sidebarRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className={cn(
                "h-full w-80 bg-card flex flex-col flex-shrink-0 select-none outline-none",
                isPinned
                    ? "border-l border-border shadow-[-16px_0_30px_-18px_rgba(15,23,42,0.35)]"
                    : "fixed top-0 right-0 bottom-0 z-[90] border-l border-border shadow-[-16px_0_30px_-18px_rgba(15,23,42,0.55)]",
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab("layers")}
                        className={cn(
                            "px-3 py-1 text-sm font-semibold rounded-md transition-colors",
                            activeTab === "layers"
                                ? "bg-background shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/70",
                        )}
                        aria-current="page"
                    >
                        Layers
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("find")}
                        className={cn(
                            "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                            activeTab === "find"
                                ? "bg-background shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/70",
                        )}
                        aria-label="Find on canvas"
                    >
                        Find
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onTogglePin}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                        aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
                        title={isPinned ? "Unpin" : "Pin"}
                    >
                        {isPinned ? (
                            <PinOff className="w-5 h-5" />
                        ) : (
                            <Pin className="w-5 h-5" />
                        )}
                    </button>
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

            {activeTab === "find" ? (
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    <div className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-1.5">
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleFindKeyDown}
                            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                            placeholder="Find on canvas..."
                        />
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={handleFindPrevious}
                                className="p-1 rounded hover:bg-muted transition-colors"
                                aria-label="Previous match"
                                disabled={searchResults.length === 0}
                            >
                                <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={handleFindNext}
                                className="p-1 rounded hover:bg-muted transition-colors"
                                aria-label="Next match"
                                disabled={searchResults.length === 0}
                            >
                                <ChevronDown className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {searchResults.length === 0
                            ? searchQuery.trim()
                                ? "No matches"
                                : "Type to search layers"
                            : `${currentResultIndex + 1} of ${searchResults.length} matches`}
                    </div>
                    {searchResults.length > 0 && (
                        <div className="space-y-1">
                            {searchResults.map((result, index) => {
                                const isActive = index === currentResultIndex;
                                return (
                                    <button
                                        key={result.id}
                                        type="button"
                                        onClick={() => {
                                            setCurrentResultIndex(index);
                                            onFocusElement?.(result);
                                            onHighlightElements?.(
                                                searchResults.map(
                                                    (el) => el.id,
                                                ),
                                                result.id,
                                            );
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors",
                                            isActive
                                                ? "bg-muted text-foreground"
                                                : "hover:bg-muted/70 text-muted-foreground hover:text-foreground",
                                        )}
                                    >
                                        <span className="text-muted-foreground">
                                            {getElementIcon(result)}
                                        </span>
                                        <span className="truncate">
                                            {getElementLabel(result)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
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
                                const index =
                                    elementIndexById.get(element.id) ?? idx;
                                const el = renderElement(element, index, false);
                                return el;
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Footer Info */}
            <div className="p-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
                <span>
                    {sortedElements.length}{" "}
                    {sortedElements.length === 1 ? "layer" : "layers"}
                    {folders.length > 0 &&
                        ` · ${folders.length} ${folders.length === 1 ? "folder" : "folders"}`}
                </span>
                {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2">
                        <span className="text-primary">
                            {selectedIds.size} selected
                        </span>
                        {onDeleteSelected && (
                            <button
                                onClick={onDeleteSelected}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                                aria-label="Delete selected layers"
                                title="Delete selected (Del)"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            <Dialog
                open={pendingDeleteFolderId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDeleteFolderId(null);
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete folder?</DialogTitle>
                        <DialogDescription>
                            This will delete the folder and all{" "}
                            {pendingDeleteCount === 1
                                ? "1 item"
                                : `${pendingDeleteCount} items`}{" "}
                            inside it.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="pt-2">
                        <Button
                            variant="secondary"
                            onClick={() => setPendingDeleteFolderId(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (pendingDeleteFolderId) {
                                    onDeleteFolder?.(pendingDeleteFolderId);
                                }
                                setPendingDeleteFolderId(null);
                            }}
                        >
                            Delete folder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
