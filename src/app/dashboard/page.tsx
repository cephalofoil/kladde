"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MoreHorizontal, Pin, Plus, Search, X } from "lucide-react";
import { useBoardStore } from "@/store/board-store";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PINNED_STORAGE_KEY = "kladde-dashboard-pins";

export default function BoardsPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [pinnedByWorkstream, setPinnedByWorkstream] = useState<
    Record<string, string[]>
  >({});

  const boards = useBoardStore((s) => s.boards);
  const workstreamsMap = useBoardStore((s) => s.workstreams);
  const workstreams = useMemo(
    () => Array.from(workstreamsMap.values()),
    [workstreamsMap],
  );
  const { searchQuery, selectedTags, currentWorkstreamId } = useBoardStore(
    (s) => s.ui,
  );
  const createBoard = useBoardStore((s) => s.createBoard);

  const filteredBoards = useMemo(() => {
    let boardsArray = Array.from(boards.values());

    if (currentWorkstreamId) {
      boardsArray = boardsArray.filter(
        (board) => board.workstreamId === currentWorkstreamId,
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      boardsArray = boardsArray.filter(
        (board) =>
          board.name.toLowerCase().includes(query) ||
          board.description?.toLowerCase().includes(query),
      );
    }

    if (selectedTags.length > 0) {
      boardsArray = boardsArray.filter((board) =>
        selectedTags.every((tag) => board.tags.includes(tag)),
      );
    }

    return boardsArray.sort(
      (a, b) =>
        new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime(),
    );
  }, [boards, currentWorkstreamId, searchQuery, selectedTags]);

  const currentWorkstream =
    workstreams.find((ws) => ws.id === currentWorkstreamId) || workstreams[0];

  const pinnedIds = pinnedByWorkstream[currentWorkstreamId] || [];
  const pinnedSet = new Set(pinnedIds);
  const filteredBoardMap = useMemo(
    () => new Map(filteredBoards.map((board) => [board.id, board])),
    [filteredBoards],
  );
  const pinnedBoards = pinnedIds
    .map((id) => filteredBoardMap.get(id))
    .filter((board): board is NonNullable<typeof board> => Boolean(board));
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
    const boardId = createBoard("Untitled Board", currentWorkstreamId);
    router.push(`/board/${boardId}`);
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
      <header className="border-b border-border bg-card/70 backdrop-blur supports-backdrop-filter:bg-card/80">
        <div className="mx-auto max-w-7xl px-8 py-5 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
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
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button onClick={handleCreateBoard}>
                <Plus className="h-4 w-4" />
                New Board
              </Button>
            </div>
          </div>

          <div className="mt-4 flex items-end gap-1 overflow-x-auto pb-1">
            {workstreams.map((workstream) => {
              const isActive = currentWorkstreamId === workstream.id;
              return (
                <button
                  key={workstream.id}
                  onClick={() => switchWorkstream(workstream.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex shrink-0 items-center gap-2.5 px-6 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? "z-10 bg-background text-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }`}
                  style={{
                    borderTopLeftRadius: "12px",
                    borderTopRightRadius: "12px",
                    borderTop: isActive
                      ? "1px solid hsl(var(--border))"
                      : "none",
                    borderLeft: isActive
                      ? "1px solid hsl(var(--border))"
                      : "none",
                    borderRight: isActive
                      ? "1px solid hsl(var(--border))"
                      : "none",
                    borderBottom: isActive
                      ? "1px solid hsl(var(--background))"
                      : "none",
                    marginBottom: isActive ? "-1px" : "0",
                  }}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: workstream.color }}
                  />
                  {workstream.name}
                </button>
              );
            })}
            <button
              className="px-3 py-3 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Add workspace"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-10 lg:px-10">
        <div className="space-y-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span
                className="h-5 w-5 rounded-full"
                style={{ backgroundColor: currentWorkstream?.color }}
              />
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {currentWorkstream?.name || "Personal"}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search boards..."
                  value={searchQuery}
                  onChange={(event) =>
                    useBoardStore.getState().setSearchQuery(event.target.value)
                  }
                  className="h-10 border-border bg-muted/50 pl-10"
                />
              </div>

              <div className="flex flex-1 items-center gap-2 overflow-x-auto">
                {pinnedBoards.map((board) => (
                  <button
                    key={board.id}
                    onClick={() => router.push(`/board/${board.id}`)}
                    className="group relative flex shrink-0 items-center gap-2 rounded-lg border-2 border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-accent-foreground/40 hover:bg-accent/50"
                    style={{
                      boxShadow: `0 0 0 3px hsl(var(--background)), 0 0 0 4px ${
                        currentWorkstream?.color || "transparent"
                      }`,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: currentWorkstream?.color }}
                    />
                    <span className="max-w-[140px] truncate">{board.name}</span>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePin(board.id);
                      }}
                      className="ml-1 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </button>
                ))}
                {pinnedBoards.length === 0 && (
                  <span className="px-2 text-xs italic text-muted-foreground">
                    Pin boards for quick access
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                All Boards
              </h2>
              <span className="text-sm text-muted-foreground">
                {unpinnedBoards.length}{" "}
                {unpinnedBoards.length === 1 ? "board" : "boards"}
              </span>
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
                        <span>•</span>
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
    </div>
  );
}
