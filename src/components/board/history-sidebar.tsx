"use client";

import { useState, useMemo } from "react";
import {
    X,
    History,
    RotateCcw,
    User,
    Crown,
    ChevronDown,
    ChevronRight,
    Plus,
    Pencil,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/history-types";

interface HistorySidebarProps {
    isOpen: boolean;
    onClose: () => void;
    entries: HistoryEntry[];
    onRestore: (entryId: string) => void;
    isPinned: boolean;
    onTogglePin: () => void;
}

function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than a minute
    if (diff < 60000) {
        return "Just now";
    }

    // Less than an hour
    if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins} min${mins > 1 ? "s" : ""} ago`;
    }

    // Same day
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

interface GroupedEntries {
    date: string;
    entries: HistoryEntry[];
}

export function HistorySidebar({
    isOpen,
    onClose,
    entries,
    onRestore,
    isPinned,
    onTogglePin,
}: HistorySidebarProps) {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        new Set(["Today"])
    );
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

    // Group entries by date
    const groupedEntries = useMemo(() => {
        const groups: GroupedEntries[] = [];
        const today = new Date().toDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        const entriesByDate = new Map<string, HistoryEntry[]>();

        // Sort entries by timestamp (newest first)
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

    const handleRestore = (entryId: string) => {
        setSelectedEntryId(entryId);
        onRestore(entryId);
    };

    if (!isOpen) return null;

    return (
        <div
            className={cn(
                "flex flex-col h-full bg-card/95 backdrop-blur-md border-l border-border/60 dark:border-transparent shadow-2xl",
                isPinned ? "w-80" : "fixed right-0 top-0 bottom-0 w-80 z-50"
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
                        onClick={onTogglePin}
                        className={cn(
                            "p-1.5 rounded-md transition-colors",
                            isPinned
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted text-muted-foreground"
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
                                        {group.entries.map((entry) => (
                                            <div
                                                key={entry.id}
                                                className={cn(
                                                    "group relative rounded-md p-2 transition-colors cursor-pointer",
                                                    selectedEntryId ===
                                                        entry.id
                                                        ? "bg-primary/10"
                                                        : "hover:bg-muted/50"
                                                )}
                                                onClick={() =>
                                                    setSelectedEntryId(
                                                        entry.id
                                                    )
                                                }
                                            >
                                                <div className="flex items-start gap-2">
                                                    {/* Operation icon */}
                                                    <div
                                                        className={cn(
                                                            "mt-0.5",
                                                            getOperationColor(
                                                                entry.operation
                                                            )
                                                        )}
                                                    >
                                                        {getOperationIcon(
                                                            entry.operation
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">
                                                            {entry.description}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            {entry.user
                                                                .isOwner ? (
                                                                <Crown className="w-3 h-3 text-amber-500" />
                                                            ) : (
                                                                <User className="w-3 h-3 text-muted-foreground" />
                                                            )}
                                                            <span className="text-xs text-muted-foreground truncate">
                                                                {entry.user
                                                                    .name ||
                                                                    "Unknown"}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground/50">
                                                                &middot;
                                                            </span>
                                                            <span className="text-xs text-muted-foreground/70">
                                                                {formatTimestamp(
                                                                    entry.timestamp
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Restore button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRestore(
                                                                entry.id
                                                            );
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background transition-all"
                                                        title="Restore to this version"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
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
