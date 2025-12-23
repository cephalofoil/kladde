"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore } from "@/store/board-store";
import { BoardCard } from "@/components/board-card";
import { BoardFilters } from "@/components/board-filters";
import { WorkstreamSidebar } from "@/components/workstream-sidebar";
import { Plus, Grid3x3, List, FileText } from "lucide-react";
import Image from "next/image";

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
    const boardId = createBoard("Untitled Board", currentWorkstreamId);
    router.push(`/board/${boardId}`);
  };

  if (!isClient) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-lg">Loading boards...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Workstream Sidebar */}
      <WorkstreamSidebar />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b bg-white px-6 py-4">
          {/* Top Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Image
                src="/kladde-logo.svg"
                alt="Kladde"
                width={120}
                height={32}
                className="h-8 w-auto"
              />
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600">
                  {filteredBoards.length}{" "}
                  {filteredBoards.length === 1 ? "board" : "boards"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDashboardView("grid")}
                  className={`p-2 rounded ${
                    dashboardView === "grid"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-gray-100"
                  }`}
                  title="Grid view"
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDashboardView("list")}
                  className={`p-2 rounded ${
                    dashboardView === "list"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-gray-100"
                  }`}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              {/* Create Board Button */}
              <button
                onClick={handleCreateBoard}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
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
              <FileText className="h-16 w-16 text-gray-300 mb-6" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No boards found
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || selectedTags.length > 0
                  ? "Try adjusting your search or filter criteria"
                  : "Get started by creating your first board"}
              </p>
              <button
                onClick={handleCreateBoard}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Plus className="h-4 w-4" />
                Create New Board
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
