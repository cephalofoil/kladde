"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { MoreHorizontal, Pin, Plus, Search, X, Zap, Trash2 } from "lucide-react";
import { useBoardStore, QUICK_BOARDS_WORKSPACE_ID } from "@/store/board-store";
import type { Board } from "@/lib/store-types";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PINNED_STORAGE_KEY = "kladde-dashboard-pins";

export default function BoardsPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [pinnedByWorkstream, setPinnedByWorkstream] = useState<
    Record<string, string[]>
  >({});
  const [boardToMove, setBoardToMove] = useState<Board | null>(null);

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
      .filter((board) => board.workstreamId !== QUICK_BOARDS_WORKSPACE_ID);

    return boardsArray.sort(
      (a, b) =>
        new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime(),
    );
  }, [boards, currentWorkstreamId, searchQuery, selectedTags]);

  const currentWorkstream =
    workstreams.find((ws) => ws.id === currentWorkstreamId) || workstreams[0];

  const quickBoards = useMemo(() => {
    return Array.from(boards.values())
      .filter((board) => board.workstreamId === QUICK_BOARDS_WORKSPACE_ID)
      .sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
  const togglePin = (boardId: string) => {
    setPinnedByWorkstream((prev) => {
      const current = prev[currentWorkstreamId] || [];
      const next = current.includes(boardId)
        ? current.filter((id) => id !== boardId)
        : [boardId, ...current];
      return { ...prev, [currentWorkstreamId]: next };
    });
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
        <div className="text-lg text-muted-foreground">Loading boards...</div>
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
            </div>
          </div>

          <div className="mt-4 flex items-end gap-1 overflow-x-auto pb-1">
            {workstreams
              .filter((ws) => ws.id !== QUICK_BOARDS_WORKSPACE_ID)
              .map((workstream) => {
              const isActive = currentWorkstreamId === workstream.id;
              return (
                <button
                  key={workstream.id}
                  onClick={() => switchWorkstream(workstream.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex shrink-0 items-center gap-2.5 px-6 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? "z-10 bg-[var(--workspace-color)] text-white"
                      : "text-muted-foreground hover:bg-[var(--workspace-color-soft)] hover:text-foreground"
                  }`}
                  style={{
                    borderTopLeftRadius: "12px",
                    borderTopRightRadius: "12px",
                    ["--workspace-color" as string]: workstream.color,
                    ["--workspace-color-soft" as string]:
                      "color-mix(in oklch, var(--workspace-color) 55%, transparent)",
                    borderTop: "3px solid var(--workspace-color)",
                    borderLeft: "3px solid var(--workspace-color)",
                    borderRight: "3px solid var(--workspace-color)",
                    borderBottom: "none",
                    marginBottom: isActive ? "-1px" : "0",
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

      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="space-y-8">
          {/* Quick Boards Section - Moved to top */}
          {quickBoards.length > 0 && (
            <div className="rounded-xl border border-purple-500/30 bg-purple-50/30 dark:bg-purple-950/10 px-3 py-2.5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Quick Boards
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {quickBoards.length}
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3 mr-1.5" />
                        Delete All
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete all Quick Boards?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all {quickBoards.length} Quick Board{quickBoards.length === 1 ? "" : "s"}. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            quickBoards.forEach((board) => {
                              useBoardStore.getState().deleteBoard(board.id);
                            });
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {quickBoards.map((board) => (
                  <div
                    key={board.id}
                    onClick={() => router.push(`/board/${board.id}`)}
                    className="group relative flex shrink-0 cursor-pointer items-start gap-3 rounded-lg border-2 border-dashed border-purple-200 dark:border-purple-800 bg-card p-3 transition-all duration-200 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-md w-[240px]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-500 shrink-0">
                      <Zap className="h-4 w-4 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="mb-0.5 text-[10px] text-muted-foreground">
                        {new Date(board.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <h3 className="line-clamp-2 text-xs font-medium leading-tight text-foreground">
                        {board.name}
                      </h3>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/board/${board.id}`);
                          }}
                        >
                          Open
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setBoardToMove(board);
                          }}
                        >
                          Move to Workspace...
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            useBoardStore.getState().deleteBoard(board.id);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full"
                  style={{ backgroundColor: currentWorkstream?.color }}
                />
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  {currentWorkstream?.name || "Personal"}
                </h1>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search boards..."
                  value={searchQuery}
                  onChange={(event) =>
                    useBoardStore.getState().setSearchQuery(event.target.value)
                  }
                  className="h-10 rounded-full border-transparent bg-muted/50 pl-10 shadow-none focus-visible:ring-2 focus-visible:ring-foreground/20"
                />
              </div>
            </div>

            <div className="flex min-h-[46px] flex-wrap items-center gap-2 overflow-x-auto">
              {pinnedBoards.map((board) => (
                <div
                  key={board.id}
                  onClick={() => router.push(`/board/${board.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/board/${board.id}`);
                    }
                  }}
                  className="group relative flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border-2 border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:ring-2 hover:ring-[var(--workspace-color)]"
                  style={{
                    ["--workspace-color" as string]:
                      currentWorkstream?.color || "transparent",
                    boxShadow: `0 0 0 3px hsl(var(--background)), 0 0 0 4px ${
                      currentWorkstream?.color || "transparent"
                    }`,
                  }}
                >
                  <span className="max-w-[140px] truncate">{board.name}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(event) => event.stopPropagation()}
                        className="ml-1 rounded-md p-1 text-muted-foreground/70 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                        aria-label="Pinned board options"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(event) => {
                          event.stopPropagation();
                          togglePin(board.id);
                        }}
                      >
                        Unpin
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/board/${board.id}`);
                        }}
                      >
                        Open
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                All Boards
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {unpinnedBoards.length}{" "}
                  {unpinnedBoards.length === 1 ? "board" : "boards"}
                </span>
                <Button
                  onClick={handleCreateBoard}
                  size="icon"
                  variant="ghost"
                  className="h-11 w-11 rounded-full bg-transparent text-foreground/80 hover:bg-transparent hover:text-foreground"
                  aria-label="New board"
                >
                  <Plus className="h-6 w-6 stroke-[2.5]" />
                </Button>
              </div>
            </div>

            {unpinnedBoards.length === 0 ? (
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
                {unpinnedBoards.map((board) => (
                  <div
                    key={board.id}
                    onClick={() => router.push(`/board/${board.id}`)}
                    className="group relative flex cursor-pointer flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-accent-foreground/30 hover:shadow-lg"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: currentWorkstream?.color,
                        }}
                      >
                        <div className="h-6 w-6 rounded bg-card/20" />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            togglePin(board.id);
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Pin className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push(`/board/${board.id}`);
                              }}
                            >
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.stopPropagation();
                                togglePin(board.id);
                              }}
                            >
                              {pinnedSet.has(board.id)
                                ? "Unpin Board"
                                : "Pin Board"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(event) => {
                                event.stopPropagation();
                                useBoardStore.getState().deleteBoard(board.id);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="flex-1">
                      <h3 className="mb-2 line-clamp-2 text-base font-semibold leading-snug text-foreground">
                        {board.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {new Date(board.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </span>
                        <span>-</span>
                        <span className="rounded bg-muted px-2 py-0.5 capitalize text-muted-foreground">
                          temporary
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Move to Workspace Dialog */}
      <Dialog open={!!boardToMove} onOpenChange={(open) => !open && setBoardToMove(null)}>
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
                      moveBoard(boardToMove.id, workspace.id);
                      setBoardToMove(null);
                    }
                  }}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: workspace.color }}
                    />
                    <div className="flex-1 text-left">
                      <div className="font-medium">{workspace.name}</div>
                      {workspace.description && (
                        <div className="text-xs text-muted-foreground">
                          {workspace.description}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {workspace.metadata.boardCount} boards
                    </div>
                  </div>
                </Button>
              ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBoardToMove(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
