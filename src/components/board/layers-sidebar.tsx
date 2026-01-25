import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { BoardComment, BoardElement, LayerFolder } from "@/lib/board-types";
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
  Layers,
  MousePointer2,
  MessageSquare,
  SlidersHorizontal,
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
  CodeXml,
  FileText,
  Image as ImageIcon,
  Globe,
  Sparkles,
  Search,
  Check,
  ArrowUpDown,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Custom icon for text tiles (matching toolbar)
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

// Custom icon for diagram tiles (matching toolbar)
function DiagramToolIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M10 16H6C5.44772 16 5 16.4477 5 17V21C5 21.5523 5.44772 22 6 22H10C10.5523 22 11 21.5523 11 21V17C11 16.4477 10.5523 16 10 16Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 2H3C2.44772 2 2 2.44772 2 3V7C2 7.55228 2.44772 8 3 8H7C7.55228 8 8 7.55228 8 7V3C8 2.44772 7.55228 2 7 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 9V11.25C5 11.4489 5.10435 11.6397 5.2901 11.7803C5.47585 11.921 5.72779 12 5.99048 12H13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 19H17.557C17.6745 19 17.7872 18.921 17.8702 18.7803C17.9533 18.6397 18 18.4489 18 18.25V16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21.4497 10.6213L19.0355 8.20711C18.3689 7.54044 17.288 7.54044 16.6213 8.20711L14.2071 10.6213C13.5404 11.288 13.5404 12.3689 14.2071 13.0355L16.6213 15.4497C17.288 16.1164 18.3689 16.1164 19.0355 15.4497L21.4497 13.0355C22.1164 12.3689 22.1164 11.288 21.4497 10.6213Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface LayersSidebarProps {
  elements: BoardElement[];
  selectedIds: Set<string>;
  folders: LayerFolder[];
  comments: BoardComment[];
  selectedCommentIds?: Set<string>;
  activeTab?: "layers" | "comments" | "find";
  onTabChange?: (tab: "layers" | "comments" | "find") => void;
  hasUnseenComments?: boolean;
  commentSeenAt?: number;
  currentUserId?: string | null;
  showResolvedComments?: boolean;
  onToggleShowResolvedComments?: () => void;
  onMarkCommentsSeen?: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  onFocusElement?: (element: BoardElement) => void;
  onFocusComment?: (comment: BoardComment) => void;
  onSelectComment?: (commentId: string) => void;
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
      // Use specific icons for tile types (matching toolbar)
      switch (element.tileType) {
        case "tile-note":
          return <StickyNote className={`${iconClass} rotate-90`} />;
        case "tile-code":
          return <CodeXml className={iconClass} />;
        case "tile-mermaid":
          return <DiagramToolIcon className={iconClass} />;
        case "tile-image":
          return <ImageIcon className={iconClass} />;
        case "tile-text":
          return <TextTileIcon className={iconClass} />;
        case "tile-document":
          return <FileText className={iconClass} />;
        default:
          return <StickyNote className={`${iconClass} rotate-90`} />;
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
  if (!element?.type) {
    return "Layer";
  }

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

const formatRelativeTime = (timestamp: number) => {
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "a day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(timestamp).toLocaleDateString();
};

const getInitials = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("");
};

export function LayersSidebar({
  elements,
  selectedIds,
  folders,
  comments,
  selectedCommentIds,
  activeTab: activeTabProp,
  onTabChange,
  hasUnseenComments,
  commentSeenAt,
  currentUserId,
  showResolvedComments,
  onToggleShowResolvedComments,
  onMarkCommentsSeen,
  isPinned,
  onTogglePin,
  onClose,
  onFocusElement,
  onFocusComment,
  onSelectComment,
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
  // Use element id as secondary sort key for stability when zIndex is equal
  const sortedElements = [...elements].sort((a, b) => {
    const zIndexA = a.zIndex ?? 0;
    const zIndexB = b.zIndex ?? 0;
    if (zIndexB !== zIndexA) return zIndexB - zIndexA;
    // Secondary sort by id for stability
    return a.id.localeCompare(b.id);
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
  const commentSelection = selectedCommentIds ?? new Set<string>();

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
  const [internalTab, setInternalTab] = useState<
    "layers" | "comments" | "find"
  >("layers");
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [searchQuery, setSearchQuery] = useState("");
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [commentSearchQuery, setCommentSearchQuery] = useState("");
  const [commentSort, setCommentSort] = useState<
    "newest" | "oldest" | "status"
  >("newest");
  const [expandedComments, setExpandedComments] = useState<Set<string>>(
    new Set(),
  );

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
      e.dataTransfer.setDragImage(dragEl, rect.width / 2, rect.height / 2);
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string, targetType: "element" | "folder") => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
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

  const resetDragState = useCallback(() => {
    setDraggedId(null);
    setDraggedType(null);
    setDropTargetId(null);
    setDropPosition(null);
    dragStartIndexRef.current = null;
  }, []);

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
        const draggedElement = elements.find((el) => el.id === draggedId);
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
      resetDragState,
    ],
  );

  const handleDragEnd = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

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
    [draggedId, draggedType, onMoveToFolder, resetDragState],
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
    localIndex?: number,
    localTotal?: number,
  ) => {
    const isSelected = selectedIds.has(element.id);
    const isDragging = draggedId === element.id;
    const isDropTarget = dropTargetId === element.id;
    const isHidden = element.hidden === true;
    const isLocked = element.locked === true;

    // Use local index/total for boundary checks if provided, otherwise use global
    const isFirst = localIndex !== undefined ? localIndex === 0 : index === 0;
    const isLast =
      localTotal !== undefined
        ? localIndex === localTotal - 1
        : index === sortedElements.length - 1;

    return (
      <div
        key={element.id}
        draggable={!isLocked}
        onDragStart={(e) => {
          if (isLocked) {
            e.preventDefault();
            return;
          }
          handleDragStart(e, element.id, "element", index);
        }}
        onDragOver={(e) => handleDragOver(e, element.id, "element")}
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
          onSelectElement(element.id, e.ctrlKey || e.metaKey, e.shiftKey);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onFocusElement?.(element);
        }}
      >
        {/* Drag Handle */}
        <div
          className={cn(
            "flex-shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors",
            isLocked
              ? "cursor-not-allowed opacity-30"
              : "cursor-grab active:cursor-grabbing",
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Element Icon & Label */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          <div
            className={cn("flex-shrink-0", isHidden && "text-muted-foreground")}
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
                isHidden ? "opacity-100" : "opacity-0 group-hover:opacity-100",
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
                !isLocked && "opacity-0 group-hover:opacity-100",
              )}
              aria-label={isLocked ? "Unlock layer" : "Lock layer"}
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
          {/* Move Up - hidden for locked elements */}
          {!isLocked && (
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
              title="Move up (higher z-index)"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}

          {/* Move Down - hidden for locked elements */}
          {!isLocked && (
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
              title="Move down (lower z-index)"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}

          {/* Duplicate - always available */}
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

          {/* Delete - hidden for locked elements */}
          {!isLocked && (
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
          )}
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
          onDragOver={(e) => handleDragOver(e, folder.id, "folder")}
          onDrop={(e) => handleDrop(e, folder.id, "folder", folderIndex)}
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
              onChange={(e) => setEditingFolderName(e.target.value)}
              onBlur={finishEditingFolder}
              onKeyDown={(e) => {
                if (e.key === "Enter") finishEditingFolder();
                if (e.key === "Escape") {
                  setEditingFolderId(null);
                  setEditingFolderName("");
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 text-sm bg-transparent border-b border-primary outline-none text-foreground"
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
            onDragOver={(e) => handleFolderContentsDragOver(e, folder.id)}
            onDrop={(e) => handleFolderContentsDrop(e, folder.id)}
          >
            {folderContents.map((element, idx) =>
              renderElement(
                element,
                elementIndexById.get(element.id) ?? idx,
                true,
                folder.id,
                idx,
                folderContents.length,
              ),
            )}
          </div>
        )}
      </div>
    );
  };

  const handleFindNext = () => {
    if (searchResults.length === 0 || !onFocusElement) return;
    const nextIndex = (safeResultIndex + 1) % searchResults.length;
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
      safeResultIndex === 0
        ? searchResults.length - 1
        : safeResultIndex - 1;
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

  const getCommentLastActivity = useCallback((comment: BoardComment) => {
    const messageTimes = (comment.messages || []).map(
      (message) => message.createdAt,
    );
    return Math.max(comment.createdAt, ...messageTimes);
  }, []);

  const filteredComments = useMemo(() => {
    const query = commentSearchQuery.trim().toLowerCase();
    const showResolved = showResolvedComments ?? false;
    let next = comments.filter((comment) =>
      showResolved ? true : !comment.resolved,
    );

    if (query) {
      next = next.filter((comment) => {
        if (comment.createdBy.name.toLowerCase().includes(query)) {
          return true;
        }
        return (comment.messages || []).some((message) =>
          message.text.toLowerCase().includes(query),
        );
      });
    }

    const sorted = [...next];
    if (commentSort === "status") {
      sorted.sort((a, b) => {
        const statusA = a.resolved ? 1 : 0;
        const statusB = b.resolved ? 1 : 0;
        if (statusA !== statusB) return statusA - statusB;
        return getCommentLastActivity(b) - getCommentLastActivity(a);
      });
    } else if (commentSort === "oldest") {
      sorted.sort(
        (a, b) => getCommentLastActivity(a) - getCommentLastActivity(b),
      );
    } else {
      sorted.sort(
        (a, b) => getCommentLastActivity(b) - getCommentLastActivity(a),
      );
    }

    return sorted;
  }, [
    comments,
    commentSearchQuery,
    commentSort,
    getCommentLastActivity,
    showResolvedComments,
  ]);

  const toggleExpandedComment = useCallback((commentId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  }, []);

  const isFindTab = activeTab === "find";
  const activeSearchQuery = isFindTab ? searchQuery : "";
  const searchResults =
    isFindTab && activeSearchQuery.trim()
      ? elements.filter((el) => {
          const query = activeSearchQuery.toLowerCase();
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
              if (content.bookmarkDescription?.toLowerCase().includes(query)) {
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
        })
      : [];
  const safeResultIndex = Math.min(
    currentResultIndex,
    Math.max(searchResults.length - 1, 0),
  );

  useEffect(() => {
    if (!isFindTab || !activeSearchQuery.trim()) {
      onHighlightElements?.([]);
      return;
    }

    const query = activeSearchQuery.toLowerCase();
    const results = elements.filter((el) => {
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
          if (content.bookmarkDescription?.toLowerCase().includes(query)) {
            return true;
          }
          if (content.displayName?.toLowerCase().includes(query)) {
            return true;
          }
        }
        if (el.tileType) {
          const tileTypeName = el.tileType.replace("tile-", "").toLowerCase();
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

    const nextIds = results.map((el) => el.id);
    const currentId = results[0]?.id ?? null;
    onHighlightElements?.(nextIds, currentId);
    if (results.length > 0 && onFocusElement) {
      onFocusElement(results[0]);
    }
  }, [
    activeSearchQuery,
    isFindTab,
    elements,
    onFocusElement,
    onHighlightElements,
  ]);

  return (
    <div
      ref={sidebarRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-full w-80 bg-card text-foreground flex flex-col flex-shrink-0 select-none outline-none",
        isPinned
          ? "border-l border-border shadow-[-16px_0_30px_-18px_rgba(15,23,42,0.35)]"
          : "fixed top-0 right-0 bottom-0 z-[120] border-l border-border shadow-[-16px_0_30px_-18px_rgba(15,23,42,0.55)]",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1">
            <button
              type="button"
              onClick={() => {
                setCurrentResultIndex(0);
                setActiveTab("layers");
              }}
            className={cn(
              "p-2 rounded-md transition-colors",
              activeTab === "layers"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-background/70",
            )}
            aria-label="Layers"
            title="Layers"
          >
            <Layers className="w-4 h-4" />
          </button>
            <button
              type="button"
              onClick={() => {
                setCurrentResultIndex(0);
                setActiveTab("comments");
              }}
            className={cn(
              "p-2 rounded-md transition-colors relative",
              activeTab === "comments"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-background/70",
            )}
            aria-label="Comments"
            title="Comments"
          >
            <MessageSquare className="w-4 h-4" />
            {hasUnseenComments && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500" />
            )}
          </button>
            <button
              type="button"
              onClick={() => setActiveTab("find")}
            className={cn(
              "p-2 rounded-md transition-colors",
              activeTab === "find"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-background/70",
            )}
            aria-label="Find on canvas"
            title="Find"
          >
            <Search className="w-4 h-4" />
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
          {activeTab === "layers" && onCreateFolder && (
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentResultIndex(0);
              }}
              onKeyDown={handleFindKeyDown}
              className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
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
              : `${safeResultIndex + 1} of ${searchResults.length} matches`}
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((result, index) => {
                const isActive = index === safeResultIndex;
                return (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      setCurrentResultIndex(index);
                      onFocusElement?.(result);
                      onHighlightElements?.(
                        searchResults.map((el) => el.id),
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
                    <span className="truncate">{getElementLabel(result)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === "comments" ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Search */}
          <div className="border-b border-border px-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={commentSearchQuery}
                onChange={(e) => setCommentSearchQuery(e.target.value)}
                placeholder="Quick search"
                className="h-9 w-full rounded-md bg-muted/50 border-0 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-8 px-2 flex items-center gap-2 rounded-md hover:bg-muted/60 transition-colors"
                >
                  <SlidersHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <ArrowUpDown className="size-4" />
                  Sort by
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={commentSort}
                  onValueChange={(value) =>
                    setCommentSort(value as "newest" | "oldest" | "status")
                  }
                >
                  <DropdownMenuRadioItem value="newest">
                    Sort by date
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="status">
                    Sort by unread
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="oldest">
                    Oldest first
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={showResolvedComments}
                  onCheckedChange={() => onToggleShowResolvedComments?.()}
                >
                  Show resolved comments
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={() => onMarkCommentsSeen?.()}
              className={cn(
                "h-8 px-2 flex items-center gap-2 text-sm rounded-md transition-colors",
                hasUnseenComments
                  ? "text-foreground hover:bg-muted/60"
                  : "text-muted-foreground/60 cursor-default",
              )}
              disabled={!hasUnseenComments}
            >
              <Check className="size-4" />
              Mark all as read
            </button>
          </div>

          {/* Comments list */}
          <ScrollArea ref={listRef} className="flex-1">
            {filteredComments.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No comments yet
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/50">
                {filteredComments.map((comment) => {
                  const isSelected = commentSelection.has(comment.id);
                  const messages = comment.messages || [];
                  const originalMessage = messages[0];
                  const replyMessages = messages.slice(1);
                  const hasReplies = replyMessages.length > 0;
                  const isExpanded = expandedComments.has(comment.id);
                  const activity = getCommentLastActivity(comment);
                  const seenAt = commentSeenAt ?? 0;
                  const isUnread =
                    (seenAt === 0 || activity > seenAt) &&
                    comment.createdBy?.id !== currentUserId;
                  const authorName =
                    originalMessage?.author.name ||
                    comment.createdBy?.name ||
                    "Guest";
                  const originalText =
                    originalMessage?.text?.trim() || "New comment";
                  const originalTimestamp =
                    originalMessage?.createdAt ?? comment.createdAt;
                  const reactions = comment.reactions || [];
                  const uniqueReactors = new Set(
                    reactions.flatMap((r) => r.userIds || []),
                  );
                  const reactorCount = uniqueReactors.size;

                  return (
                    <div
                      key={comment.id}
                      className={cn(
                        "relative px-3 py-4 cursor-pointer transition-colors",
                        isUnread && "border-l-[3px] border-l-primary",
                        isSelected
                          ? "bg-muted/40 dark:bg-muted/20"
                          : "hover:bg-muted/30",
                      )}
                      onClick={() => {
                        onSelectComment?.(comment.id);
                        onFocusComment?.(comment);
                      }}
                    >
                      {/* Author row */}
                      <div className="mb-2 flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarFallback className="text-xs bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                            {getInitials(authorName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {authorName}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(originalTimestamp)}
                        </span>
                        {comment.resolved && (
                          <span className="text-xs text-emerald-600 font-medium">
                            Resolved
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <p className="mb-3 text-sm leading-relaxed text-foreground/90">
                        {originalText}
                      </p>

                      {/* Footer with reactions and replies */}
                      {(reactorCount > 0 || hasReplies) && (
                        <div className="flex items-center justify-between">
                          {reactorCount > 0 && (
                            <div className="flex items-center">
                              <div className="flex -space-x-1.5">
                                {reactions.slice(0, 3).map((reaction, idx) => (
                                  <div
                                    key={idx}
                                    className="size-5 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px]"
                                  >
                                    {reaction.emoji}
                                  </div>
                                ))}
                              </div>
                              {reactorCount > 3 && (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  + {reactorCount - 3} more
                                </span>
                              )}
                            </div>
                          )}
                          {hasReplies && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandedComment(comment.id);
                              }}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {replyMessages.length} replies
                              <ChevronDown
                                className={cn(
                                  "size-3 transition-transform duration-200",
                                  isExpanded && "rotate-180",
                                )}
                              />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Expandable replies */}
                      {hasReplies && isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex flex-col gap-3">
                            {replyMessages.map((message) => (
                              <div key={message.id} className="flex gap-2">
                                <Avatar className="size-5 shrink-0">
                                  <AvatarFallback className="text-[8px] bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                                    {getInitials(message.author.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-xs font-medium">
                                      {message.author.name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatRelativeTime(message.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-xs leading-relaxed text-foreground/80">
                                    {message.text}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
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
              {folders.map((folder, idx) => renderFolder(folder, idx))}

              {/* Render root elements (not in any folder) */}
              {rootElements.map((element, idx) => {
                const index = elementIndexById.get(element.id) ?? idx;
                return renderElement(
                  element,
                  index,
                  false,
                  null,
                  idx,
                  rootElements.length,
                );
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
        {activeTab === "layers" && selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-primary">{selectedIds.size} selected</span>
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
