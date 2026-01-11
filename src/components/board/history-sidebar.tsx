"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
    X,
    History,
    RotateCcw,
    User,
    ChevronDown,
    ChevronRight,
    Plus,
    Pencil,
    Highlighter,
    Trash2,
    Minimize2,
    Maximize2,
    Minus,
    MoveRight,
    RectangleHorizontal,
    Diamond,
    Circle,
    Type,
    Frame,
    StickyNote,
    CodeXml,
    Image as ImageIcon,
    FileText,
    Globe,
    Sparkles,
    MousePointer2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoryEntry, ElementChange } from "@/lib/history-types";

interface HistorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    entries: HistoryEntry[];
    selectedElementIds?: string[];
    onRestore: (entryId: string) => void;
    isPinned: boolean;
    onPreviewSnapshot?: (
        entryId: string | null,
        highlightIds?: string[],
    ) => void;
    onSelectElements?: (ids: string[]) => void;
}

function formatTimeChunk(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) {
        return "Just now";
    }

    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins} min${mins > 1 ? "s" : ""} ago`;
    }

    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday ${date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        })}`;
    }

    return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getTimeChunkKey(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Group by minute for recent changes (last hour)
    if (diff < 3600000) {
        const minutesAgo = Math.floor(diff / 60000);
        if (minutesAgo < 1) return "just-now";
        return `${minutesAgo}-min-ago`;
    }

    // Group by 5-minute chunks for today
    if (date.toDateString() === now.toDateString()) {
        const hours = date.getHours();
        const fiveMinChunk = Math.floor(date.getMinutes() / 5) * 5;
        return `today-${hours}-${fiveMinChunk}`;
    }

    // Group by hour for older dates
    return `${date.toDateString()}-${date.getHours()}`;
}

function getOperationIcon(operation: string) {
    switch (operation) {
        case "add":
            return <Plus className="w-3 h-3" />;
        case "update":
            return <Pencil className="w-3 h-3" />;
        case "delete":
            return <Trash2 className="w-3 h-3" />;
        default:
            return <History className="w-3 h-3" />;
    }
}

function getOperationColor(operation: string) {
    switch (operation) {
        case "add":
            return "text-green-500";
        case "update":
            return "text-blue-500";
        case "delete":
            return "text-red-500";
        default:
            return "text-muted-foreground";
    }
}

function getOperationBgColor(operation: string) {
    switch (operation) {
        case "add":
            return "bg-green-500/10";
        case "update":
            return "bg-blue-500/10";
        case "delete":
            return "bg-red-500/10";
        default:
            return "bg-muted/50";
    }
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
        <svg viewBox="0 0 24 24" fill="none" className={className}>
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

function TornNoteIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={className}
            aria-hidden="true"
        >
            {/* Paper body with torn bottom edge */}
            <path
                d="M5 4h14v14.5l-1.5 0.8-1 -0.6-1.5 0.9-1-0.7-1.5 0.8-1-0.6-1.5 0.9-1-0.7-1.5 0.8-1-0.6L5 19.5V4z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
            {/* Lines representing text */}
            <line
                x1="8"
                y1="8"
                x2="16"
                y2="8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            <line
                x1="8"
                y1="12"
                x2="14"
                y2="12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

function getElementTypeIcon(change: ElementChange): React.ReactNode {
    const iconClass = "w-3.5 h-3.5";
    switch (change.elementType) {
        case "pen":
            if (change.elementSubType === "highlighter") {
                return <Highlighter className={iconClass} />;
            }
            return <Pencil className={iconClass} />;
        case "line":
            return <Minus className={iconClass} />;
        case "arrow":
            return <MoveRight className={iconClass} />;
        case "rectangle":
            return <RectangleHorizontal className={iconClass} />;
        case "diamond":
            return <Diamond className={iconClass} />;
        case "ellipse":
            return <Circle className={iconClass} />;
        case "text":
            return <Type className={iconClass} />;
        case "frame":
            return <Frame className={iconClass} />;
        case "tile":
            switch (change.elementSubType) {
                case "tile-text":
                    return <TextTileIcon className={iconClass} />;
                case "tile-note-torn":
                    return <TornNoteIcon className={iconClass} />;
                case "tile-note":
                    return <StickyNote className={iconClass} />;
                case "tile-code":
                    return <CodeXml className={iconClass} />;
                case "tile-mermaid":
                    return <DiagramToolIcon className={iconClass} />;
                case "tile-image":
                    return <ImageIcon className={iconClass} />;
                case "tile-document":
                    return <FileText className={iconClass} />;
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
}

interface TimeChunkGroup {
    key: string;
    label: string;
    timestamp: number;
    entries: HistoryEntry[];
    allElementIds: string[];
}

function ChangeDetail({
    change,
    isCompact,
}: {
    change: ElementChange;
    isCompact: boolean;
}) {
    if (isCompact) {
        return (
            <div className="flex items-center gap-1.5 text-xs">
                <span
                    className={cn(
                        "w-4 h-4 rounded flex items-center justify-center text-[10px]",
                        getOperationBgColor(change.operation),
                        getOperationColor(change.operation),
                    )}
                >
                    {getOperationIcon(change.operation)}
                </span>
                <span className="text-muted-foreground">
                    {getElementTypeIcon(change)}
                </span>
                {change.elementLabel && (
                    <span className="truncate max-w-[100px] text-foreground/80">
                        {change.elementLabel}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-start gap-2 py-1 px-2 rounded-md bg-muted/30">
            <span
                className={cn(
                    "w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5",
                    getOperationBgColor(change.operation),
                    getOperationColor(change.operation),
                )}
            >
                {getOperationIcon(change.operation)}
            </span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                        {getElementTypeIcon(change)}
                    </span>
                    <span className="text-xs font-medium capitalize">
                        {change.elementType.replace("tile-", "")}
                    </span>
                    {change.elementLabel && (
                        <span className="text-xs text-muted-foreground truncate">
                            "{change.elementLabel}"
                        </span>
                    )}
                </div>
                {change.changeSummary && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {change.changeSummary}
                    </p>
                )}
                {change.changedProperties &&
                    change.changedProperties.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {change.changedProperties
                                .slice(0, 4)
                                .map((prop) => (
                                    <span
                                        key={prop}
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                                    >
                                        {prop}
                                    </span>
                                ))}
                            {change.changedProperties.length > 4 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    +{change.changedProperties.length - 4} more
                                </span>
                            )}
                        </div>
                    )}
            </div>
        </div>
    );
}

export function HistorySidebar({
    isOpen,
    onClose,
    entries,
    selectedElementIds,
    onRestore,
    isPinned,
    onPreviewSnapshot,
    onSelectElements,
}: HistorySidebarProps) {
    const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
        new Set(),
    );
    const [selectedChunkKey, setSelectedChunkKey] = useState<string | null>(
        null,
    );
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
    const [isCompact, setIsCompact] = useState(false);
    const [collapsedChunks, setCollapsedChunks] = useState<Set<string>>(
        new Set(),
    );
    const knownChunkKeysRef = useRef<Set<string>>(new Set());

    const filteredEntries = useMemo(() => {
        if (!selectedElementIds || selectedElementIds.length === 0) {
            return entries;
        }
        const selectedSet = new Set(selectedElementIds);
        return entries.filter((entry) =>
            entry.elementIds.some((id) => selectedSet.has(id)),
        );
    }, [entries, selectedElementIds]);

    const latestEntryId = useMemo(() => {
        if (filteredEntries.length === 0) return null;
        return filteredEntries.reduce((latest, entry) => {
            if (!latest || entry.timestamp > latest.timestamp) return entry;
            return latest;
        }, filteredEntries[0]).id;
    }, [filteredEntries]);

    // Track previous entries count to detect new additions
    const prevEntriesCountRef = useRef(filteredEntries.length);

    // Group entries by time chunks
    const groupedEntries = useMemo(() => {
        const groups: TimeChunkGroup[] = [];
        const groupMap = new Map<string, HistoryEntry[]>();

        const sorted = [...filteredEntries].sort(
            (a, b) => b.timestamp - a.timestamp,
        );

        for (const entry of sorted) {
            const key = getTimeChunkKey(entry.timestamp);
            if (!groupMap.has(key)) {
                groupMap.set(key, []);
            }
            groupMap.get(key)!.push(entry);
        }

        groupMap.forEach((groupEntries, key) => {
            const timestamp = groupEntries[0].timestamp;
            // Collect all element IDs from all entries in this chunk
            const allElementIds = new Set<string>();
            groupEntries.forEach((entry) => {
                entry.elementIds.forEach((id) => allElementIds.add(id));
            });

            groups.push({
                key,
                label: formatTimeChunk(timestamp),
                timestamp,
                entries: groupEntries,
                allElementIds: Array.from(allElementIds),
            });
        });

        groups.sort((a, b) => b.timestamp - a.timestamp);

        return groups;
    }, [filteredEntries]);

    // Don't collapse when new entries are added
    useEffect(() => {
        if (filteredEntries.length > prevEntriesCountRef.current) {
            // New entries added - don't change selection state
        }
        prevEntriesCountRef.current = filteredEntries.length;
    }, [filteredEntries.length]);

    useEffect(() => {
        if (!selectedEntryId) return;
        const stillVisible = filteredEntries.some(
            (entry) => entry.id === selectedEntryId,
        );
        if (!stillVisible) {
            setSelectedEntryId(null);
            setSelectedChunkKey(null);
            onPreviewSnapshot?.(null);
            onSelectElements?.([]);
        }
    }, [filteredEntries, onPreviewSnapshot, onSelectElements, selectedEntryId]);

    useEffect(() => {
        if (groupedEntries.length === 0) return;
        setCollapsedChunks((prev) => {
            const next = new Set(prev);
            groupedEntries.forEach((group) => {
                if (!knownChunkKeysRef.current.has(group.key)) {
                    next.add(group.key);
                }
            });
            return next;
        });
        knownChunkKeysRef.current = new Set(
            groupedEntries.map((group) => group.key),
        );
    }, [groupedEntries]);

    const toggleEntryExpanded = (entryId: string) => {
        setExpandedEntries((prev) => {
            const next = new Set(prev);
            if (next.has(entryId)) {
                next.delete(entryId);
            } else {
                next.add(entryId);
            }
            return next;
        });
    };

    const toggleChunkCollapsed = (chunkKey: string) => {
        setCollapsedChunks((prev) => {
            const next = new Set(prev);
            if (next.has(chunkKey)) {
                next.delete(chunkKey);
            } else {
                next.add(chunkKey);
            }
            return next;
        });
    };

    // Handle chunk click - select chunk and show canvas state from that time
    const handleChunkClick = (group: TimeChunkGroup) => {
        if (selectedChunkKey === group.key) {
            // Deselect
            setSelectedChunkKey(null);
            setSelectedEntryId(null);
            onPreviewSnapshot?.(null);
            onSelectElements?.([]);
        } else {
            // Select chunk - use the most recent entry to show state for that time
            const latestEntry = group.entries[0];
            setSelectedChunkKey(group.key);
            setSelectedEntryId(latestEntry.id);
            onPreviewSnapshot?.(latestEntry.id, group.allElementIds);
            onSelectElements?.(group.allElementIds);
        }
    };

    // Handle individual entry click
    const handleEntryClick = (entry: HistoryEntry, chunkKey: string) => {
        if (selectedEntryId === entry.id) {
            // Deselect
            setSelectedEntryId(null);
            setSelectedChunkKey(null);
            onPreviewSnapshot?.(null);
            onSelectElements?.([]);
        } else {
            // Select entry and show canvas state after this change
            setSelectedEntryId(entry.id);
            setSelectedChunkKey(chunkKey);
            onPreviewSnapshot?.(entry.id, entry.elementIds);
            onSelectElements?.(entry.elementIds);
        }
    };

    const handleRestore = () => {
        if (selectedEntryId) {
            onRestore(selectedEntryId);
        }
    };

    if (!isOpen) return null;

    const selectedEntry = selectedEntryId
        ? entries.find((e) => e.id === selectedEntryId)
        : null;

    return (
        <div
            className={cn(
                "flex flex-col h-full bg-card/95 backdrop-blur-md border-l border-border/60 dark:border-transparent shadow-2xl text-foreground",
                isPinned
                    ? "w-80"
                    : "fixed right-0 top-0 bottom-0 w-80 z-[9999]",
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/60">
                <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-muted-foreground" />
                    <h2 className="font-semibold">Version History</h2>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsCompact((prev) => !prev)}
                        className={cn(
                            "p-1.5 rounded-md transition-colors",
                            isCompact
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted text-muted-foreground",
                        )}
                        title={isCompact ? "Expand view" : "Compact view"}
                    >
                        {isCompact ? (
                            <Maximize2 className="w-4 h-4" />
                        ) : (
                            <Minimize2 className="w-4 h-4" />
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <History className="w-12 h-12 text-muted-foreground/30 mb-4" />
                        <p className="text-sm text-muted-foreground">
                            No history yet
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                            Changes will appear here as you edit the board
                        </p>
                    </div>
                ) : (
                    <div className="p-2">
                        {groupedEntries.map((group) => {
                            const isChunkSelected =
                                selectedChunkKey === group.key;
                            const isCollapsed = collapsedChunks.has(group.key);
                            const isCurrentChunk = group.entries.some(
                                (entry) => entry.id === latestEntryId,
                            );

                            return (
                                <div key={group.key} className="mb-3">
                                    {/* Time chunk header - clickable to select all */}
                                    <div
                                        className={cn(
                                            "flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium rounded-md transition-colors",
                                            isChunkSelected
                                                ? "bg-accent/20 text-foreground ring-1 ring-accent"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                                        )}
                                    >
                                        <button
                                            onClick={() =>
                                                toggleChunkCollapsed(group.key)
                                            }
                                            className="p-1 rounded transition-colors hover:bg-muted"
                                            aria-label={
                                                isCollapsed
                                                    ? "Expand time chunk"
                                                    : "Collapse time chunk"
                                            }
                                        >
                                            {isCollapsed ? (
                                                <ChevronRight className="w-3 h-3" />
                                            ) : (
                                                <ChevronDown className="w-3 h-3" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleChunkClick(group)
                                            }
                                            className="flex items-center gap-2 flex-1 text-left"
                                        >
                                            <span>{group.label}</span>
                                            <span className="text-muted-foreground/50">
                                                ({group.entries.length} change
                                                {group.entries.length !== 1
                                                    ? "s"
                                                    : ""}
                                                )
                                            </span>
                                            {isCurrentChunk && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/30 text-accent-foreground">
                                                    Current
                                                </span>
                                            )}
                                        </button>
                                    </div>

                                    {/* Entries */}
                                    {!isCollapsed && (
                                        <div className="ml-2 border-l border-border/40 pl-2 space-y-1 mt-1">
                                            {group.entries.map((entry) => {
                                                const isExpanded =
                                                    expandedEntries.has(
                                                        entry.id,
                                                    );
                                                const hasChanges =
                                                    entry.changes &&
                                                    entry.changes.length > 0;
                                                const isSelected =
                                                    selectedEntryId ===
                                                    entry.id;
                                                const isCurrentEntry =
                                                    entry.id === latestEntryId;

                                                return (
                                                    <div
                                                        key={entry.id}
                                                        className={cn(
                                                            "group relative rounded-md transition-colors cursor-pointer",
                                                            isSelected
                                                                ? "bg-accent/20 ring-1 ring-accent"
                                                                : "hover:bg-muted/50",
                                                        )}
                                                        onClick={() =>
                                                            handleEntryClick(
                                                                entry,
                                                                group.key,
                                                            )
                                                        }
                                                    >
                                                        <div className="p-2">
                                                            <div className="flex items-start gap-2">
                                                                {/* Operation icon */}
                                                                <div
                                                                    className={cn(
                                                                        "mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0",
                                                                        getOperationBgColor(
                                                                            entry.operation,
                                                                        ),
                                                                        getOperationColor(
                                                                            entry.operation,
                                                                        ),
                                                                    )}
                                                                >
                                                                    {getOperationIcon(
                                                                        entry.operation,
                                                                    )}
                                                                </div>

                                                                {/* Content */}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-sm font-medium truncate">
                                                                            {
                                                                                entry.description
                                                                            }
                                                                        </p>
                                                                        {isCurrentEntry && (
                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/30 text-accent-foreground">
                                                                                Current
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {/* Only show user info for guest changes */}
                                                                    {!entry.user
                                                                        .isOwner && (
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <User className="w-3 h-3 text-muted-foreground" />
                                                                            <span className="text-xs text-muted-foreground truncate">
                                                                                {entry
                                                                                    .user
                                                                                    .name ||
                                                                                    "Guest"}
                                                                            </span>
                                                                        </div>
                                                                    )}

                                                                    {/* Change type badges in compact mode */}
                                                                    {isCompact &&
                                                                        hasChanges && (
                                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                                {entry.changes
                                                                                    .slice(
                                                                                        0,
                                                                                        3,
                                                                                    )
                                                                                    .map(
                                                                                        (
                                                                                            change,
                                                                                            idx,
                                                                                        ) => (
                                                                                            <ChangeDetail
                                                                                                key={
                                                                                                    idx
                                                                                                }
                                                                                                change={
                                                                                                    change
                                                                                                }
                                                                                                isCompact={
                                                                                                    true
                                                                                                }
                                                                                            />
                                                                                        ),
                                                                                    )}
                                                                                {entry
                                                                                    .changes
                                                                                    .length >
                                                                                    3 && (
                                                                                    <span className="text-xs text-muted-foreground">
                                                                                        +
                                                                                        {entry
                                                                                            .changes
                                                                                            .length -
                                                                                            3}{" "}
                                                                                        more
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                </div>

                                                                {/* Expand button for details */}
                                                                {hasChanges &&
                                                                    !isCompact && (
                                                                        <button
                                                                            onClick={(
                                                                                e,
                                                                            ) => {
                                                                                e.stopPropagation();
                                                                                toggleEntryExpanded(
                                                                                    entry.id,
                                                                                );
                                                                            }}
                                                                            className="p-1 rounded hover:bg-background transition-all opacity-0 group-hover:opacity-100"
                                                                            title={
                                                                                isExpanded
                                                                                    ? "Collapse"
                                                                                    : "Show details"
                                                                            }
                                                                        >
                                                                            {isExpanded ? (
                                                                                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                                                            ) : (
                                                                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                                                            )}
                                                                        </button>
                                                                    )}
                                                            </div>

                                                            {/* Expanded details */}
                                                            {!isCompact &&
                                                                isExpanded &&
                                                                hasChanges && (
                                                                    <div className="mt-2 space-y-1 pl-7">
                                                                        {entry.changes.map(
                                                                            (
                                                                                change,
                                                                                idx,
                                                                            ) => (
                                                                                <ChangeDetail
                                                                                    key={
                                                                                        idx
                                                                                    }
                                                                                    change={
                                                                                        change
                                                                                    }
                                                                                    isCompact={
                                                                                        false
                                                                                    }
                                                                                />
                                                                            ),
                                                                        )}
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer - shows restore button when entry selected */}
            <div className="p-3 border-t border-border/60">
                {selectedEntry ? (
                    <button
                        onClick={handleRestore}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span className="text-sm font-medium">
                            Restore this version
                        </span>
                    </button>
                ) : (
                    <p className="text-xs text-muted-foreground text-center">
                        Select a change to preview and restore
                    </p>
                )}
            </div>
        </div>
    );
}
