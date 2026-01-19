"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Search,
    X,
    FileText,
    Type,
    StickyNote,
    Frame,
    ArrowRight,
    CodeXml,
    Image as ImageIcon,
    FolderOpen,
    Clock,
} from "lucide-react";
import { useBoardStore } from "@/store/board-store";
import {
    searchWorkspace,
    groupResultsByBoard,
    type SearchResult,
} from "@/lib/search-utils";
import { cn } from "@/lib/utils";

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

function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}

interface WorkspaceSearchDialogProps {
    isOpen: boolean;
    onClose: () => void;
    workstreamId?: string;
}

function getMatchTypeIcon(
    matchType: SearchResult["matchType"],
    tileType?: string,
) {
    const iconClass = "w-3.5 h-3.5";

    switch (matchType) {
        case "board-name":
            return <FileText className={iconClass} />;
        case "tile-title":
        case "tile-content":
            // Use specific tile type icons matching the toolbar
            switch (tileType) {
                case "code":
                    return <CodeXml className={iconClass} />;
                case "document":
                    return <FileText className={iconClass} />;
                case "image":
                    return <ImageIcon className={iconClass} />;
                case "mermaid":
                    return <DiagramToolIcon className={iconClass} />;
                case "text":
                    return <TextTileIcon className={iconClass} />;
                case "note":
                default:
                    return <StickyNote className={`${iconClass} rotate-90`} />;
            }
        case "text-element":
            return <Type className={iconClass} />;
        case "frame-label":
            return <Frame className={iconClass} />;
        default:
            return <FileText className={iconClass} />;
    }
}

function getMatchTypeLabel(
    matchType: SearchResult["matchType"],
    tileType?: string,
) {
    switch (matchType) {
        case "board-name":
            return "Board";
        case "tile-title":
        case "tile-content":
            // Use specific tile type labels
            switch (tileType) {
                case "code":
                    return "Code";
                case "document":
                    return "Doc";
                case "image":
                    return "Image";
                case "mermaid":
                    return "Diagram";
                case "text":
                    return "Text tile";
                case "note":
                    return "Note";
                default:
                    return "Tile";
            }
        case "text-element":
            return "Text";
        case "frame-label":
            return "Frame";
        default:
            return "Match";
    }
}

export function WorkspaceSearchDialog({
    isOpen,
    onClose,
    workstreamId,
}: WorkspaceSearchDialogProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    const boards = useBoardStore((s) => s.boards);
    const boardData = useBoardStore((s) => s.boardData);
    const workstreams = useBoardStore((s) => s.workstreams);

    const results = useMemo(() => {
        return searchWorkspace(searchQuery, boards, boardData, workstreamId);
    }, [searchQuery, boards, boardData, workstreamId]);

    const groupedResults = useMemo(() => {
        return groupResultsByBoard(results);
    }, [results]);

    // Flatten for keyboard navigation
    const flatResults = useMemo(() => {
        const flat: { boardId: string; result: SearchResult }[] = [];
        for (const [boardId, boardResults] of groupedResults) {
            // Just add the first/best result per board for navigation
            if (boardResults.length > 0) {
                flat.push({ boardId, result: boardResults[0] });
            }
        }
        return flat;
    }, [groupedResults]);

    // Auto-focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 0);
        } else {
            setSearchQuery("");
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Reset selection when results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [searchQuery]);

    // Scroll selected item into view
    useEffect(() => {
        if (resultsRef.current && flatResults.length > 0) {
            const selectedElement = resultsRef.current.querySelector(
                `[data-index="${selectedIndex}"]`,
            );
            selectedElement?.scrollIntoView({ block: "nearest" });
        }
    }, [selectedIndex, flatResults.length]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) =>
                prev < flatResults.length - 1 ? prev + 1 : prev,
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (flatResults.length > 0 && flatResults[selectedIndex]) {
                navigateToResult(flatResults[selectedIndex]);
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        }
    };

    const navigateToResult = (item: {
        boardId: string;
        result: SearchResult;
    }) => {
        onClose();
        // Navigate to board, optionally with element focus in the future
        router.push(`/board/${item.boardId}`);
    };

    const currentWorkstream = workstreamId
        ? workstreams.get(workstreamId)
        : null;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Dialog */}
            <div
                ref={containerRef}
                className="relative bg-card border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[60vh] flex flex-col overflow-hidden"
            >
                {/* Search input */}
                <div className="flex items-center gap-3 p-4 border-b border-border">
                    <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-muted-foreground"
                        placeholder={
                            currentWorkstream
                                ? `Search in ${currentWorkstream.name}...`
                                : "Search all boards..."
                        }
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="p-1 rounded hover:bg-muted transition-colors"
                        >
                            <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                    )}
                    <div className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                        esc
                    </div>
                </div>

                {/* Results */}
                <div ref={resultsRef} className="flex-1 overflow-y-auto">
                    {searchQuery.trim() === "" ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <p className="text-sm">
                                Type to search board names and content
                            </p>
                        </div>
                    ) : flatResults.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <p className="text-sm">
                                No results found for "{searchQuery}"
                            </p>
                        </div>
                    ) : (
                        <div className="py-2">
                            {flatResults.map((item, index) => {
                                const boardResults =
                                    groupedResults.get(item.boardId) || [];
                                const isSelected = index === selectedIndex;
                                const board = boards.get(item.boardId);
                                const workspace = board
                                    ? workstreams.get(board.workstreamId)
                                    : null;

                                return (
                                    <div
                                        key={item.boardId}
                                        data-index={index}
                                        onClick={() => navigateToResult(item)}
                                        className={cn(
                                            "px-4 py-3 cursor-pointer transition-colors",
                                            isSelected
                                                ? "bg-accent"
                                                : "hover:bg-muted/50",
                                        )}
                                    >
                                        {/* Board name and metadata */}
                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className={cn(
                                                        "font-medium truncate",
                                                        isSelected
                                                            ? "text-accent-foreground"
                                                            : "text-foreground",
                                                    )}
                                                >
                                                    {item.result.boardName}
                                                </span>
                                                <ArrowRight
                                                    className={cn(
                                                        "w-3 h-3 shrink-0",
                                                        isSelected
                                                            ? "text-accent-foreground/60"
                                                            : "text-muted-foreground",
                                                    )}
                                                />
                                            </div>
                                            {/* Workspace and time info */}
                                            <div
                                                className={cn(
                                                    "flex items-center gap-3 text-xs shrink-0",
                                                    isSelected
                                                        ? "text-accent-foreground/70"
                                                        : "text-muted-foreground",
                                                )}
                                            >
                                                {workspace && (
                                                    <span className="flex items-center gap-1">
                                                        <FolderOpen className="w-3 h-3" />
                                                        <span className="max-w-[100px] truncate">
                                                            {workspace.name}
                                                        </span>
                                                    </span>
                                                )}
                                                {board && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatRelativeTime(
                                                            new Date(
                                                                board.updatedAt,
                                                            ),
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Matches in this board */}
                                        <div className="space-y-1">
                                            {boardResults
                                                .slice(0, 3)
                                                .map((result, resultIndex) => (
                                                    <div
                                                        key={`${result.elementId || "board"}-${resultIndex}`}
                                                        className="flex items-start gap-2 text-sm"
                                                    >
                                                        <span
                                                            className={cn(
                                                                "mt-0.5 shrink-0",
                                                                isSelected
                                                                    ? "text-accent-foreground/70"
                                                                    : "text-muted-foreground",
                                                            )}
                                                        >
                                                            {getMatchTypeIcon(
                                                                result.matchType,
                                                                result.tileType,
                                                            )}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                "text-xs shrink-0",
                                                                isSelected
                                                                    ? "text-accent-foreground/70"
                                                                    : "text-muted-foreground",
                                                            )}
                                                        >
                                                            {getMatchTypeLabel(
                                                                result.matchType,
                                                                result.tileType,
                                                            )}
                                                            :
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                "truncate",
                                                                isSelected
                                                                    ? "text-accent-foreground/90"
                                                                    : "text-foreground/70",
                                                            )}
                                                        >
                                                            {result.matchedText}
                                                        </span>
                                                    </div>
                                                ))}
                                            {boardResults.length > 3 && (
                                                <div
                                                    className={cn(
                                                        "text-xs pl-5",
                                                        isSelected
                                                            ? "text-accent-foreground/60"
                                                            : "text-muted-foreground",
                                                    )}
                                                >
                                                    +{boardResults.length - 3}{" "}
                                                    more matches
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {flatResults.length > 0 && (
                    <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground flex items-center gap-4">
                        <span>
                            {results.length} result
                            {results.length !== 1 ? "s" : ""} in{" "}
                            {flatResults.length} board
                            {flatResults.length !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                                ↑↓
                            </kbd>
                            navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
                                ↵
                            </kbd>
                            open
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
