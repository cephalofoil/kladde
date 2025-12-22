"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore } from "@/store/board-store";
import { BoardCard } from "@/components/board-card";
import { BoardFilters } from "@/components/board-filters";
import { WorkstreamSidebar } from "@/components/workstream-sidebar";
import { Plus, Grid3x3, List } from "lucide-react";

export default function BoardsPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  const boards = useBoardStore((s) => s.boards);
  const { searchQuery, selectedTags, currentWorkstreamId, dashboardView } =
    useBoardStore((s) => s.ui);
  const setDashboardView = useBoardStore((s) => s.setDashboardView);
  const createBoard = useBoardStore((s) => s.createBoard);

  const filteredBoards = useMemo(() => {
    let boardsArray = Array.from(boards.values());

    // Filter by workstream
    if (currentWorkstreamId) {
      boardsArray = boardsArray.filter(
        (board) => board.workstreamId === currentWorkstreamId,
      );
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      boardsArray = boardsArray.filter(
        (board) =>
          board.name.toLowerCase().includes(query) ||
          board.description?.toLowerCase().includes(query),
      );
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      boardsArray = boardsArray.filter((board) =>
        selectedTags.every((tag) => board.tags.includes(tag)),
      );
    }

    // Sort by last accessed (most recent first)
    return boardsArray.sort(
      (a, b) =>
        new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime(),
    );
  }, [boards, currentWorkstreamId, searchQuery, selectedTags]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleCreateBoard = () => {
    const boardId = createBoard("Untitled Board");
    router.push(`/board/${boardId}`);
  };

  if (!isClient) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading boards...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Workstream Sidebar */}
      <WorkstreamSidebar />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Boards</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {filteredBoards.length}{" "}
                {filteredBoards.length === 1 ? "board" : "boards"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex rounded-lg border border-gray-300 dark:border-gray-700">
                <button
                  onClick={() => setDashboardView("grid")}
                  className={`p-2 ${
                    dashboardView === "grid"
                      ? "bg-gray-100 dark:bg-gray-800"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                  title="Grid view"
                >
                  <Grid3x3 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setDashboardView("list")}
                  className={`p-2 ${
                    dashboardView === "list"
                      ? "bg-gray-100 dark:bg-gray-800"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                  title="List view"
                >
                  <List className="h-5 w-5" />
                </button>
              </div>

              {/* Create Board Button */}
              <button
                onClick={handleCreateBoard}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                <Plus className="h-5 w-5" />
                New Board
              </button>
            </div>
          </div>

          {/* Filters */}
          <BoardFilters />
        </header>

        {/* Boards Grid/List */}
        <main className="flex-1 overflow-y-auto p-6">
          {filteredBoards.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-500">
              <p className="text-lg">No boards found</p>
              <button
                onClick={handleCreateBoard}
                className="mt-4 text-blue-600 hover:underline"
              >
                Create your first board
              </button>
            </div>
          ) : dashboardView === "grid" ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredBoards.map((board) => (
                <BoardCard key={board.id} board={board} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBoards.map((board) => (
                <BoardCard key={board.id} board={board} viewMode="list" />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
