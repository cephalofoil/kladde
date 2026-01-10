"use client";

import { useState, useMemo, useCallback } from "react";
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
    Eye,
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

function formatTimestamp(timestamp: number): string {
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

interface GroupedEntries {
    date: string;
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
        new Set(["Today"]),
    );
    const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
        new Set(),
    );
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
    const [isCompact, setIsCompact] = useState(false);
    const [previewingEntryId, setPreviewingEntryId] = useState<string | null>(
        null,
    );

    const groupedEntries = useMemo(() => {
        const groups: GroupedEntries[] = [];
        const today = new Date().toDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        const entriesByDate = new Map<string, HistoryEntry[]>();
        const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);

        for (const entry of sorted) {
            const date = new Date(entry.timestamp);
            let dateKey: string;

            if (date.toDateString() === today) {
                dateKey = "Today";
            } else if (date.toDateString() === yesterdayStr) {
                dateKey = "Yesterday";
            } else {
                dateKey = date.toLocaleDateString([], {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                });
            }

            if (!entriesByDate.has(dateKey)) {
                entriesByDate.set(dateKey, []);
            }
            entriesByDate.get(dateKey)!.push(entry);
        }

        entriesByDate.forEach((dateEntries, date) => {
            groups.push({ date, entries: dateEntries });
        });

        return groups;
    }, [entries]);

    const toggleGroup = (date: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(date)) {
                next.delete(date);
            } else {
                next.add(date);
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

    const handleRestore = (entryId: string) => {
        setSelectedEntryId(entryId);
        onRestore(entryId);
    };

    const handlePreview = useCallback(
        (entryId: string | null) => {
            setPreviewingEntryId(entryId);
            onPreviewEntry?.(entryId);
        },
        [onPreviewEntry],
    );

    // Count changes by type
    const changeCounts = useMemo(() => {
        let adds = 0;
        let updates = 0;
        let deletes = 0;

        for (const entry of entries) {
            if (entry.changes) {
                for (const change of entry.changes) {
                    if (change.operation === "add") adds++;
                    else if (change.operation === "update") updates++;
                    else if (change.operation === "delete") deletes++;
                }
            } else {
                // Fallback for old entries without changes array
                if (entry.operation === "add") adds += entry.elementIds.length;
                else if (entry.operation === "update")
                    updates += entry.elementIds.length;
                else if (entry.operation === "delete")
                    deletes += entry.elementIds.length;
            }
        }

        return { adds, updates, deletes };
    }, [entries]);

    if (!isOpen) return null;

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

            {/* Stats bar */}
            {entries.length > 0 && (
                <div className="flex items-center justify-center gap-4 px-4 py-2 border-b border-border/40 bg-muted/30">
                    <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-green-500/10 text-green-500">
                            <Plus className="w-3 h-3" />
                        </span>
                        <span className="text-xs font-medium">
                            {changeCounts.adds}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-blue-500/10 text-blue-500">
                            <Pencil className="w-3 h-3" />
                        </span>
                        <span className="text-xs font-medium">
                            {changeCounts.updates}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-red-500/10 text-red-500">
                            <Trash2 className="w-3 h-3" />
                        </span>
                        <span className="text-xs font-medium">
                            {changeCounts.deletes}
                        </span>
                    </div>
                </div>
            )}

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
                            <div key={group.date} className="mb-2">
                                {/* Date header */}
                                <button
                                    onClick={() => toggleGroup(group.date)}
                                    className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {expandedGroups.has(group.date) ? (
                                        <ChevronDown className="w-3 h-3" />
                                    ) : (
                                        <ChevronRight className="w-3 h-3" />
                                    )}
                                    {group.date}
                                    <span className="text-muted-foreground/50">
                                        ({group.entries.length})
                                    </span>
                                </button>

                                {/* Entries */}
                                {expandedGroups.has(group.date) && (
                                    <div className="ml-2 border-l border-border/40 pl-2 space-y-1">
                                        {group.entries.map((entry) => {
                                            const isExpanded =
                                                expandedEntries.has(entry.id);
                                            const hasChanges =
                                                entry.changes &&
                                                entry.changes.length > 0;

                                            return (
                                                <div
                                                    key={entry.id}
                                                    className={cn(
                                                        "group relative rounded-md transition-colors",
                                                        selectedEntryId ===
                                                            entry.id
                                                            ? "bg-primary/10"
                                                            : previewingEntryId ===
                                                                entry.id
                                                              ? "bg-accent/20 ring-1 ring-accent"
                                                              : "hover:bg-muted/50",
                                                    )}
                                                >
                                                    <div
                                                        className="p-2 cursor-pointer"
                                                        onClick={() =>
                                                            setSelectedEntryId(
                                                                entry.id,
                                                            )
                                                        }
                                                    >
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
                                                                            <span className="text-xs text-muted-foreground/50">
                                                                                &middot;
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                    <span className="text-xs text-muted-foreground/70">
                                                                        {formatTimestamp(
                                                                            entry.timestamp,
                                                                        )}
                                                                    </span>
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

                                                            {/* Actions */}
                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                {onPreviewEntry && (
                                                                    <button
                                                                        onClick={(
                                                                            e,
                                                                        ) => {
                                                                            e.stopPropagation();
                                                                            handlePreview(
                                                                                previewingEntryId ===
                                                                                    entry.id
                                                                                    ? null
                                                                                    : entry.id,
                                                                            );
                                                                        }}
                                                                        className={cn(
                                                                            "p-1 rounded hover:bg-background transition-all",
                                                                            previewingEntryId ===
                                                                                entry.id &&
                                                                                "bg-accent text-accent-foreground",
                                                                        )}
                                                                        title="Preview changes"
                                                                    >
                                                                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(
                                                                        e,
                                                                    ) => {
                                                                        e.stopPropagation();
                                                                        handleRestore(
                                                                            entry.id,
                                                                        );
                                                                    }}
                                                                    className="p-1 rounded hover:bg-background transition-all"
                                                                    title="Restore to this version"
                                                                >
                                                                    <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                                                                </button>
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
                                                                        className="p-1 rounded hover:bg-background transition-all"
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

            {/* Footer */}
            <div className="p-3 border-t border-border/60">
                <p className="text-xs text-muted-foreground text-center">
                    {entries.length} change{entries.length !== 1 ? "s" : ""}{" "}
                    recorded
                </p>
            </div>
        </div>
    );
}
