"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
    MoreVertical,
    Plus,
    Pin,
    Search,
    Settings,
    Trash2,
    Zap,
} from "lucide-react";
import { useBoardStore, QUICK_BOARDS_WORKSPACE_ID } from "@/store/board-store";
import type { Board } from "@/lib/store-types";
import { ThemeToggle } from "@/components/theme-toggle";
import { BoardCard } from "@/components/board-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { WorkspaceColorPicker } from "@/components/workspace-color-picker";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { QuickBoardsSidebar } from "@/components/quick-boards-sidebar";
import { cn } from "@/lib/utils";

const PINNED_STORAGE_KEY = "kladde-dashboard-pins";

export default function BoardsPage() {
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    const [pinnedByWorkstream, setPinnedByWorkstream] = useState<
        Record<string, string[]>
    >({});
    const [boardToMove, setBoardToMove] = useState<Board | null>(null);
    const [isRenamingWorkspace, setIsRenamingWorkspace] = useState(false);
    const [workspaceName, setWorkspaceName] = useState("");
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [draggingBoardId, setDraggingBoardId] = useState<string | null>(null);
    const [dropTargetWorkspaceId, setDropTargetWorkspaceId] = useState<string | null>(null);
    const [isGridDropTargetActive, setIsGridDropTargetActive] = useState(false);

    const boards = useBoardStore((s) => s.boards);
    const workstreamsMap = useBoardStore((s) => s.workstreams);
    const createWorkstream = useBoardStore((s) => s.createWorkstream);
    const moveBoard = useBoardStore((s) => s.moveBoard);
    const workstreams = useMemo(
        () => Array.from(workstreamsMap.values()),
        [workstreamsMap],
    );
    const { searchQuery, selectedTags, currentWorkstreamId } = useBoardStore(
        (s) => s.ui,
    );
    const createBoard = useBoardStore((s) => s.createBoard);
    const updateWorkstream = useBoardStore((s) => s.updateWorkstream);
    const deleteWorkstream = useBoardStore((s) => s.deleteWorkstream);

    const matchesFilters = (board: Board) => {
        if (currentWorkstreamId && board.workstreamId !== currentWorkstreamId) {
            return false;
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const description = board.description?.toLowerCase() || "";
            if (
                !board.name.toLowerCase().includes(query) &&
                !description.includes(query)
            ) {
                return false;
            }
        }

        if (selectedTags.length > 0) {
            return selectedTags.every((tag) => board.tags.includes(tag));
        }

        return true;
    };

    const filteredBoards = useMemo(() => {
        const boardsArray = Array.from(boards.values())
            .filter(matchesFilters)
            .filter(
                (board) => board.workstreamId !== QUICK_BOARDS_WORKSPACE_ID,
            );

        return boardsArray.sort(
            (a, b) =>
                new Date(b.lastAccessed).getTime() -
                new Date(a.lastAccessed).getTime(),
        );
    }, [boards, currentWorkstreamId, searchQuery, selectedTags]);

    const currentWorkstream =
        workstreams.find((ws) => ws.id === currentWorkstreamId) ||
        workstreams[0];

    const quickBoards = useMemo(() => {
        return Array.from(boards.values())
            .filter((board) => board.workstreamId === QUICK_BOARDS_WORKSPACE_ID)
            .sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime(),
            );
    }, [boards]);

    const pinnedIds = pinnedByWorkstream[currentWorkstreamId] || [];
    const pinnedSet = new Set(pinnedIds);
    const matchesPinnedFilters = (board: Board) => {
        if (currentWorkstreamId && board.workstreamId !== currentWorkstreamId) {
            return false;
        }

        if (selectedTags.length > 0) {
            return selectedTags.every((tag) => board.tags.includes(tag));
        }

        return true;
    };

    const pinnedBoards = pinnedIds
        .map((id) => boards.get(id))
        .filter((board): board is NonNullable<typeof board> => Boolean(board))
        .filter(matchesPinnedFilters);
    const unpinnedBoards = filteredBoards.filter(
        (board) => !pinnedSet.has(board.id),
    );

    useEffect(() => {
        setIsClient(true);
        try {
            const saved = localStorage.getItem(PINNED_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === "object") {
                    setPinnedByWorkstream(parsed);
                }
            }
        } catch {
            setPinnedByWorkstream({});
        }
    }, []);

    useEffect(() => {
        if (!isClient) return;
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== PINNED_STORAGE_KEY) return;
            try {
                if (!event.newValue) {
                    setPinnedByWorkstream({});
                    return;
                }
                const parsed = JSON.parse(event.newValue);
                if (parsed && typeof parsed === "object") {
                    setPinnedByWorkstream(parsed);
                }
            } catch {
                setPinnedByWorkstream({});
            }
        };

        window.addEventListener("storage", handleStorage);
        return () => {
            window.removeEventListener("storage", handleStorage);
        };
    }, [isClient]);

    useEffect(() => {
        if (!isClient) return;
        localStorage.setItem(
            PINNED_STORAGE_KEY,
            JSON.stringify(pinnedByWorkstream),
        );
    }, [isClient, pinnedByWorkstream]);

    const switchWorkstream = (id: string) => {
        useBoardStore.setState((state) => ({
            ui: { ...state.ui, currentWorkstreamId: id },
        }));
    };

    const handleCreateBoard = () => {
        createBoard("Untitled Board", currentWorkstreamId);
    };

    const handleCreateWorkstream = () => {
        const palette = [
            "#2563eb",
            "#16a34a",
            "#f97316",
            "#0ea5e9",
            "#7c3aed",
            "#db2777",
        ];
        const color = palette[Math.floor(Math.random() * palette.length)];
        const id = createWorkstream("New Workspace", color);
        switchWorkstream(id);
    };

    // Drag-and-drop handlers for Quick Boards
    const handleBoardDragStart = useCallback((boardId: string) => {
        setDraggingBoardId(boardId);
    }, []);

    const handleBoardDragEnd = useCallback(() => {
        setDraggingBoardId(null);
        setDropTargetWorkspaceId(null);
        setIsGridDropTargetActive(false);
    }, []);

    const handleWorkspaceDragOver = useCallback((e: React.DragEvent, workspaceId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropTargetWorkspaceId(workspaceId);
    }, []);

    const handleWorkspaceDragLeave = useCallback(() => {
        setDropTargetWorkspaceId(null);
    }, []);

    const handleWorkspaceDrop = useCallback((e: React.DragEvent, workspaceId: string) => {
        e.preventDefault();
        if (draggingBoardId) {
            moveBoard(draggingBoardId, workspaceId);
        }
        setDraggingBoardId(null);
        setDropTargetWorkspaceId(null);
    }, [draggingBoardId, moveBoard]);

    // Grid drop zone handlers
    const handleGridDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsGridDropTargetActive(true);
    }, []);

    const handleGridDragLeave = useCallback((e: React.DragEvent) => {
        // Only deactivate if leaving the drop zone itself, not entering a child
        const relatedTarget = e.relatedTarget as Node | null;
        const currentTarget = e.currentTarget as Node;
        if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
            setIsGridDropTargetActive(false);
        }
    }, []);

    const handleGridDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (draggingBoardId) {
            moveBoard(draggingBoardId, currentWorkstreamId);
        }
        setDraggingBoardId(null);
        setDropTargetWorkspaceId(null);
        setIsGridDropTargetActive(false);
    }, [draggingBoardId, moveBoard, currentWorkstreamId]);

    const togglePin = (boardId: string) => {
        setPinnedByWorkstream((prev) => {
            const current = prev[currentWorkstreamId] || [];
            const next = current.includes(boardId)
                ? current.filter((id) => id !== boardId)
                : [boardId, ...current];
            return { ...prev, [currentWorkstreamId]: next };
        });
    };

    const handleRenameWorkspace = () => {
        setWorkspaceName(currentWorkstream?.name || "");
        setIsRenamingWorkspace(true);
    };

    const handleWorkspaceNameSubmit = () => {
        if (
            workspaceName.trim() &&
            currentWorkstream &&
            workspaceName.trim() !== currentWorkstream.name
        ) {
            updateWorkstream(currentWorkstream.id, {
                name: workspaceName.trim(),
            });
        }
        setIsRenamingWorkspace(false);
    };

    const handleWorkspaceNameBlur = () => {
        handleWorkspaceNameSubmit();
    };

    const formatDate = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - new Date(date).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return new Date(date).toLocaleDateString();
    };

    if (!isClient) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-lg text-muted-foreground">
                    Loading boards...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="relative border-b border-border bg-card/70 backdrop-blur supports-backdrop-filter:bg-card/80">
                <Link
                    href="/"
                    aria-label="Go to homepage"
                    className="absolute left-6 top-0 z-10 flex h-16 items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:opacity-90 lg:left-8"
                >
                    <Image
                        src="/kladde-logo.svg"
                        alt="Kladde"
                        width={120}
                        height={32}
                        className="h-8 w-auto dark:hidden"
                    />
                    <Image
                        src="/kladde-logo-bright-540.svg"
                        alt="Kladde"
                        width={120}
                        height={32}
                        className="h-8 w-auto hidden dark:block"
                    />
                </Link>
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="flex flex-wrap items-center justify-end gap-6 min-h-16">
                        <div className="flex items-center gap-3">
                            <ThemeToggle />
                            <Link
                                href="/settings"
                                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-label="Settings"
                            >
                                <Settings className="h-5 w-5" />
                            </Link>
                        </div>
                    </div>

                    <div className="-mb-px mt-4 flex items-end gap-1 overflow-x-auto overflow-y-visible">
                        {workstreams
                            .filter((ws) => ws.id !== QUICK_BOARDS_WORKSPACE_ID)
                            .map((workstream) => {
                                const isActive =
                                    currentWorkstreamId === workstream.id;
                                const isDropTarget = draggingBoardId && dropTargetWorkspaceId === workstream.id;
                                return (
                                    <button
                                        key={workstream.id}
                                        onClick={() =>
                                            switchWorkstream(workstream.id)
                                        }
                                        onDragOver={(e) => handleWorkspaceDragOver(e, workstream.id)}
                                        onDragEnter={(e) => {
                                            e.preventDefault();
                                            setDropTargetWorkspaceId(workstream.id);
                                        }}
                                        onDragLeave={handleWorkspaceDragLeave}
                                        onDrop={(e) => handleWorkspaceDrop(e, workstream.id)}
                                        aria-current={
                                            isActive ? "page" : undefined
                                        }
                                        className={cn(
                                            "relative flex shrink-0 items-center gap-2.5 px-6 py-3 text-sm font-medium transition-all",
                                            isActive
                                                ? "z-10 bg-[var(--workspace-color)] text-white"
                                                : "text-muted-foreground hover:bg-[var(--workspace-color-soft)] hover:text-foreground"
                                        )}
                                        style={{
                                            borderTopLeftRadius: "12px",
                                            borderTopRightRadius: "12px",
                                            ["--workspace-color" as string]:
                                                workstream.color,
                                            ["--workspace-color-soft" as string]:
                                                "color-mix(in oklch, var(--workspace-color) 55%, transparent)",
                                            borderTop:
                                                "3px solid var(--workspace-color)",
                                            borderLeft:
                                                "3px solid var(--workspace-color)",
                                            borderRight:
                                                "3px solid var(--workspace-color)",
                                            borderBottom: "none",
                                            // Drop target highlight - inset shadow doesn't affect layout
                                            boxShadow: isDropTarget
                                                ? "inset 0 0 0 2px hsl(var(--primary)), 0 0 12px 2px hsl(var(--primary) / 0.4)"
                                                : undefined,
                                        }}
                                    >
                                        {workstream.name}
                                    </button>
                                );
                            })}
                        <button
                            className="px-3 py-3 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Add workspace"
                            onClick={handleCreateWorkstream}
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex">
                {/* Quick Boards Sidebar */}
                {quickBoards.length > 0 && (
                    <QuickBoardsSidebar
                        quickBoards={quickBoards}
                        onMoveBoard={setBoardToMove}
                        onDragStart={handleBoardDragStart}
                        onDragEnd={handleBoardDragEnd}
                    />
                )}

                <main className="flex-1 mx-auto max-w-7xl px-6 py-10 lg:px-8">
                <div className="space-y-8">
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="group flex items-center gap-3">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            className="h-5 w-5 rounded-full transition-all hover:scale-110 hover:ring-2 hover:ring-ring hover:ring-offset-2 hover:ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                            style={{
                                                backgroundColor:
                                                    currentWorkstream?.color,
                                            }}
                                            title="Change workspace color"
                                        />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="start"
                                        className="p-0 mt-3"
                                    >
                                        <WorkspaceColorPicker
                                            value={
                                                currentWorkstream?.color ||
                                                "#2563eb"
                                            }
                                            onChange={(color) => {
                                                if (currentWorkstream) {
                                                    updateWorkstream(
                                                        currentWorkstream.id,
                                                        { color },
                                                    );
                                                }
                                            }}
                                        />
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                {isRenamingWorkspace ? (
                                    <input
                                        type="text"
                                        value={workspaceName}
                                        onChange={(e) =>
                                            setWorkspaceName(e.target.value)
                                        }
                                        onBlur={handleWorkspaceNameBlur}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                handleWorkspaceNameSubmit();
                                            } else if (e.key === "Escape") {
                                                setIsRenamingWorkspace(false);
                                            }
                                        }}
                                        autoFocus
                                        className="text-3xl font-bold tracking-tight text-foreground bg-transparent border-b-2 border-ring outline-none px-1 -ml-1"
                                        onFocus={(e) => {
                                            // Position cursor at the end
                                            const len = e.target.value.length;
                                            e.target.setSelectionRange(
                                                len,
                                                len,
                                            );
                                        }}
                                    />
                                ) : (
                                    <h1 className="text-3xl font-bold tracking-tight text-foreground cursor-text hover:text-foreground/80 transition-colors font-[var(--font-heading)]">
                                        {currentWorkstream?.name || "Personal"}
                                    </h1>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuItem
                                            onClick={handleRenameWorkspace}
                                        >
                                            Rename Workspace
                                        </DropdownMenuItem>
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                                <span
                                                    className="h-3 w-3 rounded-full mr-1"
                                                    style={{
                                                        backgroundColor:
                                                            currentWorkstream?.color,
                                                    }}
                                                />
                                                Change Color
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent className="p-0">
                                                <WorkspaceColorPicker
                                                    value={
                                                        currentWorkstream?.color ||
                                                        "#2563eb"
                                                    }
                                                    onChange={(color) => {
                                                        if (currentWorkstream) {
                                                            updateWorkstream(
                                                                currentWorkstream.id,
                                                                { color },
                                                            );
                                                        }
                                                    }}
                                                />
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={() =>
                                                setIsDeleteDialogOpen(true)
                                            }
                                            className="text-destructive focus:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete Workspace
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <div className="relative w-full max-w-sm">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Search boards..."
                                    value={searchQuery}
                                    onChange={(event) =>
                                        useBoardStore
                                            .getState()
                                            .setSearchQuery(event.target.value)
                                    }
                                    className="h-10 rounded-full border-transparent bg-muted/50 pl-10 shadow-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                                />
                            </div>
                        </div>

                        <div className="flex min-h-[46px] flex-wrap items-center gap-2 overflow-x-auto">
                            {pinnedBoards.map((board) => (
                                <div
                                    key={board.id}
                                    onClick={(e) => {
                                        // Ctrl/Cmd + Click opens in new tab
                                        if (e.ctrlKey || e.metaKey) {
                                            window.open(
                                                `/board/${board.id}`,
                                                "_blank",
                                            );
                                            return;
                                        }
                                        router.push(`/board/${board.id}`);
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (
                                            e.key === "Enter" ||
                                            e.key === " "
                                        ) {
                                            e.preventDefault();
                                            router.push(`/board/${board.id}`);
                                        }
                                    }}
                                    className="group relative flex shrink-0 cursor-pointer items-start gap-3 rounded-lg border-2 border-[var(--workspace-color)]/30 bg-card p-3 transition-all duration-200 hover:border-[var(--workspace-color)]/60 hover:shadow-md w-full md:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)]"
                                    style={{
                                        ["--workspace-color" as string]:
                                            currentWorkstream?.color ||
                                            "transparent",
                                    }}
                                >
                                    <div
                                        className="flex h-8 w-8 items-center justify-center rounded-md shrink-0"
                                        style={{
                                            backgroundColor:
                                                currentWorkstream?.color,
                                        }}
                                    >
                                        <div className="h-4 w-4 rounded bg-card/20" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="mb-0.5 text-[10px] text-muted-foreground">
                                            {new Date(
                                                board.createdAt,
                                            ).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </div>
                                        <h3 className="line-clamp-2 text-xs font-medium leading-tight text-foreground">
                                            {board.name}
                                        </h3>
                                    </div>

                                    <button
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            togglePin(board.id);
                                        }}
                                        className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                                        aria-label="Unpin board"
                                        title="Unpin board"
                                    >
                                        <Pin
                                            className="h-3.5 w-3.5"
                                            fill="currentColor"
                                            stroke="currentColor"
                                        />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground font-[var(--font-heading)]">
                                All Boards
                            </h2>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground">
                                    {unpinnedBoards.length}{" "}
                                    {unpinnedBoards.length === 1
                                        ? "board"
                                        : "boards"}
                                </span>
                                <Button
                                    onClick={handleCreateBoard}
                                    size="icon"
                                    variant="ghost"
                                    className="h-11 w-11 rounded-full bg-transparent text-foreground hover:bg-transparent hover:text-foreground scale-125"
                                    aria-label="New board"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        className="fill-current"
                                    >
                                        <path d="M24 10h-10v-10h-4v10h-10v4h10v10h4v-10h10z" />
                                    </svg>
                                </Button>
                            </div>
                        </div>

                        {unpinnedBoards.length === 0 && !draggingBoardId ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
                                    <Search className="h-8 w-8 text-muted-foreground/50" />
                                </div>
                                <p className="mb-1 text-sm font-medium text-foreground">
                                    No boards found
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Try adjusting your search
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {/* Drop zone placeholder - shown when dragging a Quick Board */}
                                {draggingBoardId && (
                                    <div
                                        onDragOver={handleGridDragOver}
                                        onDragLeave={handleGridDragLeave}
                                        onDrop={handleGridDrop}
                                        className={cn(
                                            "relative flex flex-col rounded-xl border-2 border-dashed p-5 transition-all duration-200",
                                            isGridDropTargetActive
                                                ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                                                : "border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/20"
                                        )}
                                    >
                                        <div className="mb-4 flex items-start justify-between">
                                            <div
                                                className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500"
                                            >
                                                <Zap className="h-6 w-6 text-white" />
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="mb-2 text-base font-semibold leading-snug text-purple-600 dark:text-purple-400">
                                                {isGridDropTargetActive ? "Release to drop here" : "Drop Quick Board here"}
                                            </h3>
                                            <div className="flex items-center gap-2 text-xs text-purple-500 dark:text-purple-400">
                                                <span className="rounded bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5">
                                                    {currentWorkstream?.name}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {unpinnedBoards.map((board) => (
                                    <BoardCard
                                        key={board.id}
                                        board={board}
                                        isPinned={pinnedSet.has(board.id)}
                                        onTogglePin={togglePin}
                                        workstreamColor={
                                            currentWorkstream?.color
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

                {/* Spacer to balance sidebar for centered content */}
                {quickBoards.length > 0 && (
                    <div className="shrink-0 w-56 pr-6 hidden xl:block" aria-hidden="true" />
                )}
            </div>

            {/* Move to Workspace Dialog */}
            <Dialog
                open={!!boardToMove}
                onOpenChange={(open) => !open && setBoardToMove(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Move to Workspace</DialogTitle>
                        <DialogDescription>
                            Choose a workspace to move "{boardToMove?.name}" to.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2 py-4">
                        {workstreams
                            .filter((ws) => ws.id !== QUICK_BOARDS_WORKSPACE_ID)
                            .map((workspace) => (
                                <Button
                                    key={workspace.id}
                                    variant="outline"
                                    className="justify-start h-auto py-3"
                                    onClick={() => {
                                        if (boardToMove) {
                                            moveBoard(
                                                boardToMove.id,
                                                workspace.id,
                                            );
                                            setBoardToMove(null);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-3 w-full">
                                        <div
                                            className="h-4 w-4 rounded-full"
                                            style={{
                                                backgroundColor:
                                                    workspace.color,
                                            }}
                                        />
                                        <div className="flex-1 text-left">
                                            <div className="font-medium">
                                                {workspace.name}
                                            </div>
                                            {workspace.description && (
                                                <div className="text-xs text-muted-foreground">
                                                    {workspace.description}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {workspace.metadata.boardCount}{" "}
                                            boards
                                        </div>
                                    </div>
                                </Button>
                            ))}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setBoardToMove(null)}
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Workspace Confirmation Dialog */}
            <Dialog
                open={isDeleteDialogOpen}
                onOpenChange={(open) => {
                    setIsDeleteDialogOpen(open);
                    if (!open) setDeleteConfirmation("");
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive">
                            Delete Workspace
                        </DialogTitle>
                        <DialogDescription className="space-y-3">
                            <span className="block">
                                This will permanently delete the workspace{" "}
                                <strong className="text-foreground">
                                    {currentWorkstream?.name}
                                </strong>
                                . All boards in this workspace will be moved to
                                the default workspace.
                            </span>
                            <span className="block">
                                To confirm, type{" "}
                                <strong className="text-foreground font-mono">
                                    {currentWorkstream?.name}
                                </strong>{" "}
                                below:
                            </span>
                        </DialogDescription>
                    </DialogHeader>

                    <Input
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder={`Type "${currentWorkstream?.name}" to confirm`}
                        className="font-mono"
                        autoComplete="off"
                    />

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsDeleteDialogOpen(false);
                                setDeleteConfirmation("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={
                                deleteConfirmation !== currentWorkstream?.name
                            }
                            onClick={() => {
                                if (
                                    currentWorkstream &&
                                    deleteConfirmation ===
                                        currentWorkstream.name
                                ) {
                                    deleteWorkstream(currentWorkstream.id);
                                    setIsDeleteDialogOpen(false);
                                    setDeleteConfirmation("");
                                    // Switch to first available workspace
                                    const remaining = workstreams.filter(
                                        (ws) =>
                                            ws.id !== currentWorkstream.id &&
                                            ws.id !== QUICK_BOARDS_WORKSPACE_ID,
                                    );
                                    if (remaining.length > 0) {
                                        switchWorkstream(remaining[0].id);
                                    }
                                }
                            }}
                        >
                            Delete Workspace
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
