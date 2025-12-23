"use client";

import { useRouter } from "next/navigation";
import { useBoardStore } from "@/store/board-store";
import type { Board } from "@/lib/store-types";
import { MoreVertical, Copy, Trash2, Edit2 } from "lucide-react";
import { useState } from "react";

interface BoardCardProps {
  board: Board;
  viewMode?: "grid" | "list";
}

export function BoardCard({ board, viewMode = "grid" }: BoardCardProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(board.name);

  const duplicateBoard = useBoardStore((s) => s.duplicateBoard);
  const deleteBoard = useBoardStore((s) => s.deleteBoard);
  const updateBoard = useBoardStore((s) => s.updateBoard);

  const handleClick = () => {
    router.push(`/board/${board.id}`);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = duplicateBoard(board.id);
    if (newId) {
      router.push(`/board/${newId}`);
    }
    setShowMenu(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${board.name}"?`)) {
      deleteBoard(board.id);
    }
    setShowMenu(false);
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
    setShowMenu(false);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (newName.trim()) {
      updateBoard(board.id, { name: newName.trim() });
    }
    setIsRenaming(false);
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

  if (viewMode === "list") {
    return (
      <div
        onClick={handleClick}
        className="flex cursor-pointer items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-[#1a1a1a] dark:bg-[#0f0f0f]"
      >
        {/* Thumbnail */}
        <div className="h-16 w-24 flex-shrink-0 rounded border border-gray-200 bg-gray-100 dark:border-[#1a1a1a] dark:bg-[#1a1a1a]">
          {board.thumbnail ? (
            <img
              src={board.thumbnail}
              alt={board.name}
              className="h-full w-full rounded object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400 dark:text-gray-500">
              Empty
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <form onSubmit={handleRenameSubmit} onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => setIsRenaming(false)}
                autoFocus
                className="w-full rounded border border-primary bg-white px-2 py-1 font-semibold text-gray-900 outline-none dark:bg-[#1a1a1a] dark:text-gray-100"
              />
            </form>
          ) : (
            <h3 className="truncate font-semibold text-gray-900 dark:text-gray-100">{board.name}</h3>
          )}
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <span>{board.metadata.elementCount} elements</span>
            <span>•</span>
            <span>Updated {formatDate(board.updatedAt)}</span>
          </div>
        </div>

        {/* Tags */}
        {board.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {board.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              >
                {tag}
              </span>
            ))}
            {board.tags.length > 3 && (
              <span className="text-xs text-gray-500">+{board.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-8 z-20 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <button
                  onClick={handleRename}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Edit2 className="h-4 w-4" />
                  Rename
                </button>
                <button
                  onClick={handleDuplicate}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Copy className="h-4 w-4" />
                  Duplicate
                </button>
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      onClick={handleClick}
      className="group relative cursor-pointer rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-lg dark:border-[#1a1a1a] dark:bg-[#0f0f0f]"
    >
      {/* Thumbnail */}
      <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-gray-100 dark:bg-[#1a1a1a]">
        {board.thumbnail ? (
          <img
            src={board.thumbnail}
            alt={board.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
            <span className="text-sm">Empty board</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {isRenaming ? (
          <form onSubmit={handleRenameSubmit} onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => setIsRenaming(false)}
              autoFocus
              className="w-full rounded border border-primary bg-white px-2 py-1 font-semibold text-gray-900 outline-none dark:bg-gray-700 dark:text-gray-100"
            />
          </form>
        ) : (
          <h3 className="truncate font-semibold text-gray-900 dark:text-gray-100">{board.name}</h3>
        )}

        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          <p>{board.metadata.elementCount} elements</p>
          <p className="mt-1">Updated {formatDate(board.updatedAt)}</p>
        </div>

        {/* Tags */}
        {board.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {board.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              >
                {tag}
              </span>
            ))}
            {board.tags.length > 2 && (
              <span className="text-xs text-gray-500">+{board.tags.length - 2}</span>
            )}
          </div>
        )}
      </div>

      {/* Menu Button */}
      <div className="absolute right-2 top-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="rounded bg-white p-1.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-10 z-20 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
              <button
                onClick={handleRename}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Edit2 className="h-4 w-4" />
                Rename
              </button>
              <button
                onClick={handleDuplicate}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </button>
              <button
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
