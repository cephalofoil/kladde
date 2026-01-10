"use client";

import { useState, useMemo, useEffect } from "react";
import {
    X,
    History,
    RotateCcw,
    User,
    ChevronDown,
    ChevronRight,
    Plus,
    Pencil,
    Trash2,
    Minimize2,
    Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoryEntry, ElementChange } from "@/lib/history-types";

interface HistorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    entries: HistoryEntry[];
    onRestore: (entryId: string) => void;
    isPinned: boolean;
    onTogglePin: () => void;
    onPreviewEntry?: (entryId: string | null) => void;
}

function formatTimeChunk(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than a minute ago
    if (diff < 60000) {
        return "Just now";
    }

    // Less than an hour - show minutes ago
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins} min${mins > 1 ? "s" : ""} ago`;
    }

    // Same day - show time
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday ${date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        })}`;
    }

    // Older
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

function getElementTypeIcon(type: string): string {
    const iconMap: Record<string, string> = {
        pen: "✏️",
        line: "📏",
        arrow: "➡️",
        rectangle: "▢",
        diamond: "◇",
        ellipse: "○",
        text: "T",
        frame: "⬜",
        tile: "📄",
        "web-embed": "🌐",
        laser: "✨",
    };
    return iconMap[type] || "•";
}

interface TimeChunkGroup {
    key: string;
    label: string;
    timestamp: number;
    entries: HistoryEntry[];
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
                    {getElementTypeIcon(change.elementType)}
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
                        {getElementTypeIcon(change.elementType)}
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
    onRestore,
    isPinned,
    onTogglePin,
    onPreviewEntry,
}: HistorySidebarProps) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        new Set(),
    );
    const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
        new Set(),
    );
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
    const [isCompact, setIsCompact] = useState(false);

    // Group entries by time chunks
    const groupedEntries = useMemo(() => {
        const groups: TimeChunkGroup[] = [];
        const groupMap = new Map<string, HistoryEntry[]>();

        // Sort entries by timestamp (newest first)
        const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);

        for (const entry of sorted) {
            const key = getTimeChunkKey(entry.timestamp);
            if (!groupMap.has(key)) {
                groupMap.set(key, []);
            }
            groupMap.get(key)!.push(entry);
        }

        groupMap.forEach((groupEntries, key) => {
            // Use the first (most recent) entry's timestamp for the label
            const timestamp = groupEntries[0].timestamp;
            groups.push({
                key,
                label: formatTimeChunk(timestamp),
                timestamp,
                entries: groupEntries,
            });
        });

        // Sort groups by timestamp (newest first)
        groups.sort((a, b) => b.timestamp - a.timestamp);

        return groups;
    }, [entries]);

    // Auto-expand the first group
    useEffect(() => {
        if (groupedEntries.length > 0 && expandedGroups.size === 0) {
            setExpandedGroups(new Set([groupedEntries[0].key]));
        }
    }, [groupedEntries, expandedGroups.size]);

    const toggleGroup = (key: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

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

    // Handle entry click - select and highlight
    const handleEntryClick = (entryId: string) => {
        if (selectedEntryId === entryId) {
            // Clicking same entry deselects it
            setSelectedEntryId(null);
            onPreviewEntry?.(null);
        } else {
            setSelectedEntryId(entryId);
            onPreviewEntry?.(entryId);
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
                "flex flex-col h-full bg-card/95 backdrop-blur-md border-l border-border/60 dark:border-transparent shadow-2xl",
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
                        onClick={onTogglePin}
                        className={cn(
                            "p-1.5 rounded-md transition-colors",
                            isPinned
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted text-muted-foreground",
                        )}
                        title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="12" y1="17" x2="12" y2="22" />
                            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                        </svg>
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
                        {groupedEntries.map((group) => (
                            <div key={group.key} className="mb-2">
                                {/* Time chunk header */}
                                <button
                                    onClick={() => toggleGroup(group.key)}
                                    className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {expandedGroups.has(group.key) ? (
                                        <ChevronDown className="w-3 h-3" />
                                    ) : (
                                        <ChevronRight className="w-3 h-3" />
                                    )}
                                    {group.label}
                                    <span className="text-muted-foreground/50">
                                        ({group.entries.length})
                                    </span>
                                </button>

                                {/* Entries */}
                                {expandedGroups.has(group.key) && (
                                    <div className="ml-2 border-l border-border/40 pl-2 space-y-1">
                                        {group.entries.map((entry) => {
                                            const isExpanded =
                                                expandedEntries.has(entry.id);
                                            const hasChanges =
                                                entry.changes &&
                                                entry.changes.length > 0;
                                            const isSelected =
                                                selectedEntryId === entry.id;

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
                                                            entry.id,
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
                                                                <p className="text-sm font-medium truncate">
                                                                    {
                                                                        entry.description
                                                                    }
                                                                </p>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    {/* Only show user info for guest changes */}
                                                                    {!entry.user
                                                                        .isOwner && (
                                                                        <>
                                                                            <User className="w-3 h-3 text-muted-foreground" />
                                                                            <span className="text-xs text-muted-foreground truncate">
                                                                                {entry
                                                                                    .user
                                                                                    .name ||
                                                                                    "Guest"}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>

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
                                                            {hasChanges && (
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
                        ))}
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
